import Link from "next/link";
import { CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CanjearCodigoForm } from "@/components/dashboard/CanjearCodigoForm";
import { formatFecha, formatMoneda } from "@/lib/admin/format";
import { calcularDiasVigencia, suscripcionDaAcceso } from "@/lib/estadoAcceso";
import type { PagoItem, SuscripcionActual } from "@/lib/suscripcion";

const ESTADO_LABEL: Record<SuscripcionActual["estado"], string> = {
  ACTIVA: "Activa",
  PAST_DUE: "Pago pendiente",
  VENCIDA: "Vencida",
  CANCELADA: "Cancelada",
};

/**
 * Tipado como Record sobre la unión —no un objeto suelto— para que agregar un
 * valor a `EstadoPago` rompa la compilación en vez de pintar la celda vacía.
 * Es justo lo que habría pasado al sumar REEMBOLSADO y REVERSADO al enum.
 */
const ESTADO_PAGO_LABEL: Record<PagoItem["estado"], string> = {
  EXITOSO: "Pagado",
  FALLIDO: "Fallido",
  PENDIENTE: "Pendiente",
  REEMBOLSADO: "Reembolsado",
  REVERSADO: "Reversado",
};

/**
 * Qué decir bajo el nombre del plan cuando el acceso ya no está en pie.
 *
 * `fecha_renovacion` es cuándo TERMINABA el período, no cuándo alguien
 * canceló. Para una VENCIDA las dos cosas coinciden y la fecha es el dato
 * útil. Para una CANCELADA no: un admin que revoca antes de tiempo deja esa
 * fecha en el futuro, y la tarjeta llegaba a decir "Cancelada desde el 3 de
 * octubre de 2026" un 14 de septiembre — una fecha que todavía no ha pasado.
 *
 * Ninguna columna guarda cuándo se canceló, así que se omite en vez de
 * inventarla con la única fecha que hay a mano.
 */
function leyendaSinAcceso(
  estado: SuscripcionActual["estado"],
  fechaRenovacion: string | null,
): string {
  if (estado === "CANCELADA") return ESTADO_LABEL.CANCELADA;
  return fechaRenovacion
    ? `${ESTADO_LABEL[estado]} el ${formatFecha(fechaRenovacion)}`
    : ESTADO_LABEL[estado];
}

function porcentajeTranscurrido(fechaInicio: string, fechaRenovacion: string | null) {
  if (!fechaRenovacion) return 0;
  const inicio = new Date(fechaInicio).getTime();
  const fin = new Date(fechaRenovacion).getTime();
  if (fin <= inicio) return 0;
  const avance = ((Date.now() - inicio) / (fin - inicio)) * 100;
  return Math.min(100, Math.max(0, Math.round(avance)));
}

export function SuscripcionContent({
  suscripcion,
  esAdministrador = false,
}: {
  suscripcion: SuscripcionActual | null;
  /**
   * Un ADMINISTRADOR tiene acceso incondicional a todo el catálogo (ver
   * `obtenerAccesoAlCurso`, src/lib/accesoCurso.ts) sin depender de una fila
   * en `suscripciones` propia — esta pantalla no puede seguir invitándolo a
   * "elegir un plan" ni a "renovar" algo que nunca vence para él.
   */
  esAdministrador?: boolean;
}) {
  if (esAdministrador) {
    return (
      <div className="mx-auto flex max-w-[640px] flex-col gap-6 px-[clamp(20px,3vw,44px)] py-16">
        <div className="flex flex-col items-center gap-4 text-center">
          <h1 className="text-2xl text-uva-text">Mi suscripción</h1>
          <Badge variant="default" className="w-fit">
            Acceso permanente
          </Badge>
          <p className="text-sm text-uva-text-muted">
            Como administrador tienes acceso completo a todo el catálogo. No necesitas un plan
            ni renovarlo — esto no vence.
          </p>
        </div>
      </div>
    );
  }

  if (!suscripcion) {
    return (
      <div className="mx-auto flex max-w-[640px] flex-col gap-6 px-[clamp(20px,3vw,44px)] py-16">
        <div className="flex flex-col items-center gap-4 text-center">
          <h1 className="text-2xl text-uva-text">Mi suscripción</h1>
          <p className="text-sm text-uva-text-muted">
            Todavía no tienes una suscripción activa. Elige un plan para acceder a todo el
            catálogo.
          </p>
          <Button
            render={<Link href="/dashboard/planes" />}
            nativeButton={false}
            variant="uva-primary"
            size="uva"
            className="w-auto px-6"
          >
            Ver planes
          </Button>
        </div>

        {/* Quien llega con un código es justo quien no tiene suscripción,
            así que aquí el formulario va destacado y no al final. */}
        <CanjearCodigoForm tieneSuscripcion={false} />
      </div>
    );
  }

  // Mismo conteo (días de calendario colombiano) que la tarjeta "Tu acceso"
  // del perfil: si cada pantalla lo calculara a su manera, la misma
  // suscripción diría 6 días aquí y 7 allá. Acotado a 0 solo al mostrarlo.
  const accesoVigente = suscripcionDaAcceso(suscripcion);
  // Una suscripción cuyo periodo terminó sigue guardada como ACTIVA (nada la
  // mueve), pero anunciarla como "Activa" al lado de un catálogo con candado
  // sería mentirle al estudiante.
  const estadoMostrado = accesoVigente
    ? suscripcion.estado
    : suscripcion.estado === "CANCELADA"
      ? "CANCELADA"
      : "VENCIDA";
  const diasSinAcotar = calcularDiasVigencia(suscripcion.fechaRenovacion);
  const dias = diasSinAcotar === null ? null : Math.max(0, diasSinAcotar);
  const avance = porcentajeTranscurrido(suscripcion.fechaInicio, suscripcion.fechaRenovacion);

  // "Mensual"/"Anual" solo tiene sentido para un plan de pago, que sí se
  // renueva en un ciclo fijo. Un código puede otorgar cualquier número de
  // días (15, 45, 90...) y antes esto lo etiquetaba igual que un plan
  // mensual con solo que duracionDias < 360 — un código de 15 días se leía
  // literalmente como "Acceso por invitación · Mensual", que es falso.
  const nombrePlan = suscripcion.accesoManual
    ? `${suscripcion.planNombre} · ${suscripcion.duracionDias} día${suscripcion.duracionDias === 1 ? "" : "s"}`
    : (() => {
        const periodoLabel = suscripcion.duracionDias >= 360 ? "Anual" : "Mensual";
        return suscripcion.planNombre.toLowerCase().includes(periodoLabel.toLowerCase())
          ? suscripcion.planNombre
          : `${suscripcion.planNombre} · ${periodoLabel}`;
      })();

  return (
    <div className="flex max-w-[820px] flex-col gap-6 px-[clamp(20px,3vw,44px)] py-8">
      <h1 className="text-2xl text-uva-text">Mi suscripción</h1>

      <div className="flex flex-col gap-4 rounded-uva-md border border-uva-divider bg-uva-accent-soft p-6">
        <div className="flex items-center gap-3">
          <div>
            <p className="font-heading text-xl text-uva-text">{nombrePlan}</p>
            <p className="text-[13px] text-uva-text-muted">
              {/* Sin acceso vigente (revocada, cancelada o vencida por fecha):
                  "Vence"/"Renovación" en futuro le mentiría al estudiante —
                  ese acceso ya no está en curso, así que la fecha pasa a ser
                  solo un dato histórico. */}
              {!accesoVigente
                ? leyendaSinAcceso(estadoMostrado, suscripcion.fechaRenovacion)
                : suscripcion.fechaRenovacion
                  ? // Un acceso manual (código/cortesía) no se renueva solo: se
                    // vence y punto, no hay cobro automático detrás. "Renovación"
                    // ahí prometía algo que no iba a pasar. La de pago sí
                    // renueva, así que conserva su palabra.
                    `${suscripcion.accesoManual ? "Vence" : "Renovación"} ${formatFecha(suscripcion.fechaRenovacion)}`
                  : "Sin fecha de vencimiento"}
            </p>
          </div>
          {/* "X días restantes" solo tiene sentido con acceso vigente: una
              CANCELADA con fecha de renovación todavía futura (el admin revocó
              antes de que terminara el periodo) seguía mostrando "quedan 12
              días" — que leía como suscripción activa cuando ya no lo estaba.

              Sin días que mostrar, este bloque ya NO cae a un badge: el estado
              lo pinta el badge de abajo, y tener los dos hacía que una
              suscripción cancelada dijera "Cancelada" dos veces en la misma
              tarjeta. */}
          {accesoVigente && dias !== null && (
            <div className="ml-auto text-right">
              <p className="font-heading text-2xl text-uva-accent">{dias}</p>
              <p className="text-[11.5px] text-uva-text-muted">días restantes</p>
            </div>
          )}
        </div>
        {accesoVigente && suscripcion.fechaRenovacion && (
          <div className="h-[7px] rounded-full bg-black/25">
            <div
              className="h-full rounded-full bg-uva-accent"
              style={{ width: `${avance}%` }}
            />
          </div>
        )}
        <Badge
          variant={accesoVigente ? "default" : estadoMostrado === "CANCELADA" ? "secondary" : "destructive"}
          className="w-fit"
        >
          {ESTADO_LABEL[estadoMostrado]}
        </Badge>
      </div>

      {/* Un acceso manual (cortesía/invitación) nunca tendrá filas en Pagos
          — es gratis por definición — así que el módulo ni se muestra en
          vez de mostrarse vacío ("Todavía no hay pagos registrados"),
          que lee como desconfianza sobre una suscripción que nunca debió
          pasar por caja. */}
      {!suscripcion.accesoManual && (
        <div className="rounded-uva-md border border-uva-divider bg-uva-surface p-6">
          <h2 className="mb-4 text-base text-uva-text">Historial de pagos</h2>
          {suscripcion.pagos.length === 0 ? (
            <p className="text-sm text-uva-text-muted">Todavía no hay pagos registrados.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Monto</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {suscripcion.pagos.map((pago) => (
                  <TableRow key={pago.id}>
                    <TableCell>{formatFecha(pago.fecha)}</TableCell>
                    <TableCell className="font-mono tabular-nums">
                      {formatMoneda(pago.monto_centavos, pago.moneda)}
                    </TableCell>
                    <TableCell>{ESTADO_PAGO_LABEL[pago.estado]}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      )}

      {/* El formulario se ofrece a quien NO tiene acceso vigente, no solo a
          quien está en VENCIDA/CANCELADA: un periodo terminado deja la fila
          en ACTIVA (nadie la mueve), y ese es justo el estudiante que llega
          aquí desde "Renueva tu acceso". El canje sobre una suscripción
          caducada funciona porque `canjear_codigo_invitacion` la cierra
          antes de comprobar el índice único (038_vigencia_por_fecha.sql).
          A quien sí tiene acceso vigente no se le ofrece: se rechazaría con
          'ya_tiene_suscripcion'. */}
      {/* UNA sección con dos salidas, no dos tarjetas.
          Pagar y canjear un código no son dos objetos distintos: son las dos
          respuestas a la misma pregunta. Enmarcadas por separado pesaban
          visualmente lo mismo que la suscripción de arriba —que sí es el
          sujeto de la pantalla— y dejaban tres cajas grises idénticas
          apiladas, sin nada que dijera qué mirar primero.
          El plan va antes que el código porque es el camino que el producto
          quiere; el código es la alternativa, no un igual. */}
      {!accesoVigente && (
        <section className="rounded-uva-md border border-uva-divider bg-uva-surface p-6">
          <h2 className="mb-5 text-base text-uva-text">
            ¿Cómo quieres recuperar el acceso?
          </h2>

          <div>
            <h3 className="flex items-center gap-2 text-sm font-semibold text-uva-text">
              <CreditCard className="size-4 text-uva-accent" aria-hidden />
              Elige un plan
            </h3>
            <p className="mt-1 text-[13px] text-uva-text-muted">
              Recupera el acceso a los 180+ cursos, las plantillas descargables
              y los certificados.
            </p>
            <Button
              render={<Link href="/dashboard/planes" />}
              nativeButton={false}
              variant="uva-primary"
              size="uva"
              className="mt-3 w-auto px-6"
            >
              Ver planes
            </Button>
          </div>

          {/* Una línea basta para separar las dos opciones. Un marco completo
              alrededor de cada una decía "son cosas aparte", que es justo lo
              que no son. */}
          <div className="mt-6 border-t border-uva-divider pt-6">
            <CanjearCodigoForm tieneSuscripcion embebido />
          </div>
        </section>
      )}
    </div>
  );
}
