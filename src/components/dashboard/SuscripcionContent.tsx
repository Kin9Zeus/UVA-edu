import Link from "next/link";
import { CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CanjearCodigoForm } from "@/components/dashboard/CanjearCodigoForm";
import { PRECIOS_HABILITADOS } from "@/lib/features";
import { formatFecha, formatMoneda } from "@/lib/admin/format";
import {
  calcularDiasVigencia,
  suscripcionDaAcceso,
  tipoAccesoGratuito,
} from "@/lib/estadoAcceso";
import { cn } from "@/lib/utils";
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

function porcentajeTranscurrido(fechaInicio: string, fechaRenovacion: string | null) {
  if (!fechaRenovacion) return 0;
  const inicio = new Date(fechaInicio).getTime();
  const fin = new Date(fechaRenovacion).getTime();
  if (fin <= inicio) return 0;
  const avance = ((Date.now() - inicio) / (fin - inicio)) * 100;
  return Math.min(100, Math.max(0, Math.round(avance)));
}

/** "12 de noviembre de 2026": la fecha de la frase grande va completa. */
function fechaLarga(fechaIso: string) {
  return new Date(fechaIso).toLocaleDateString("es-CO", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "America/Bogota",
  });
}

const CLASE_INSIGNIA = "inline-flex min-h-[30px] w-fit shrink-0 items-center rounded-full px-3 text-uva-detalle font-bold";

/**
 * Armazón de la dirección visual «Frase»: el título de la pantalla y, en una
 * columna de lectura centrada, una frase grande que dice hasta cuándo se
 * puede entrar, una línea de avance y el estado. Debajo, si hace falta, cómo
 * recuperar el acceso.
 */
function Marco({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-uva flex-col gap-[22px] px-uva-margen py-7 lg:gap-7 lg:py-9">
      <h1 className="text-uva-titulo-3 text-uva-text">Mi suscripción</h1>
      <div className="mx-auto grid w-full max-w-[760px] gap-9 pt-3">{children}</div>
    </div>
  );
}

function Frase({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-uva-titulo-2 font-extrabold text-balance text-uva-text [&_em]:text-uva-accent-ink [&_em]:not-italic">
      {children}
    </p>
  );
}

function Estado({ insignia, claseInsignia, children }: { insignia: string; claseInsignia: string; children?: React.ReactNode }) {
  return (
    <p className="flex flex-wrap items-center gap-x-[18px] gap-y-2.5 text-uva-lead text-uva-text-muted">
      <span className={cn(CLASE_INSIGNIA, claseInsignia)}>{insignia}</span>
      {children && <span>{children}</span>}
    </p>
  );
}

// Los pares de color de las insignias están medidos para AA en los dos temas.
const INSIGNIA_ACTIVA = "bg-uva-btn text-uva-on-accent";
const INSIGNIA_CANCELADA = "bg-uva-surface-2 text-uva-text-muted";
const INSIGNIA_VENCIDA = "bg-uva-badge-danger-bg text-uva-badge-danger-fg";

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
      <Marco>
        <Frase>Tu acceso no vence.</Frase>
        <Estado insignia="Acceso permanente" claseInsignia={INSIGNIA_ACTIVA}>
          Como administrador tienes acceso completo a todo el catálogo, sin necesitar un código.
        </Estado>
      </Marco>
    );
  }

  if (!suscripcion) {
    return (
      <Marco>
        <Frase>Todavía no tienes acceso activo.</Frase>
        <p className="text-uva-lead text-uva-text-muted">
          {PRECIOS_HABILITADOS
            ? "Elige un plan o canjea tu código de invitación para entrar a todo el catálogo."
            : "Canjea tu código de invitación para entrar a todo el catálogo."}
        </p>
        {PRECIOS_HABILITADOS && (
          <Button
            render={<Link href="/dashboard/planes" />}
            nativeButton={false}
            variant="uva-primary"
            size="uva"
            className="min-h-12 w-auto justify-self-start px-[22px] text-base"
          >
            Ver planes
          </Button>
        )}
        {/* Quien llega con un código es justo quien no tiene suscripción,
            así que aquí el formulario va destacado y no al final. */}
        <section className="border-t-2 border-uva-text pt-6">
          <CanjearCodigoForm tieneSuscripcion={false} />
        </section>
      </Marco>
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
  const tipo = tipoAccesoGratuito(suscripcion);

  // De dónde viene el acceso, dicho en la misma frase que los días. Con el
  // cobro apagado ninguna pantalla nombra un plan: tampoco la de una
  // suscripción de pago (solo existe en datos de prueba).
  const periodoLabel = suscripcion.duracionDias >= 360 ? "Anual" : "Mensual";
  const nombrePlan = suscripcion.planNombre.toLowerCase().includes(periodoLabel.toLowerCase())
    ? suscripcion.planNombre
    : `${suscripcion.planNombre}, ${periodoLabel.toLowerCase()}`;
  const origen =
    tipo === "INVITACION"
      ? "por invitación"
      : tipo === "OTORGADO_ADMIN"
        ? // Sin punto final: el de "U.V.A." cierra también la frase.
          "otorgado por el equipo de U.V.A"
        : PRECIOS_HABILITADOS
          ? `con el plan ${nombrePlan}`
          : null;

  // `fecha_renovacion` es cuándo TERMINABA el período, no cuándo alguien
  // canceló: una CANCELADA revocada antes de tiempo tiene esa fecha en el
  // futuro, y decir "venció el 3 de octubre" un 14 de septiembre sería
  // anunciar como pasada una fecha que no ha llegado (ver leyendaAcceso).
  const fechaYaPaso =
    suscripcion.fechaRenovacion !== null && estadoMostrado !== "CANCELADA" && diasSinAcotar !== null && diasSinAcotar < 0;

  return (
    <Marco>
      {accesoVigente ? (
        <>
          <Frase>
            {suscripcion.fechaRenovacion ? (
              <>
                Puedes entrar hasta el <em>{fechaLarga(suscripcion.fechaRenovacion)}</em>.
              </>
            ) : (
              "Tu acceso no tiene fecha de cierre."
            )}
          </Frase>
          {suscripcion.fechaRenovacion && (
            <div>
              <div
                role="progressbar"
                aria-label="Parte de tu periodo de acceso que ya pasó"
                aria-valuenow={avance}
                aria-valuemin={0}
                aria-valuemax={100}
                className="relative h-[3px] bg-uva-divider"
              >
                <span className="absolute inset-y-0 left-0 bg-uva-accent" style={{ width: `${avance}%` }} />
              </div>
              <p className="mt-2 flex justify-between gap-4 text-uva-detalle text-uva-text-muted">
                <span>{formatFecha(suscripcion.fechaInicio)}</span>
                <span>{formatFecha(suscripcion.fechaRenovacion)}</span>
              </p>
            </div>
          )}
          <Estado insignia={ESTADO_LABEL[estadoMostrado]} claseInsignia={INSIGNIA_ACTIVA}>
            {dias !== null
              ? `Te ${dias === 1 ? "queda" : "quedan"} ${dias} ${dias === 1 ? "día" : "días"} de acceso${origen ? ` ${origen}` : ""}.`
              : origen
                ? `Tu acceso es ${origen}.`
                : null}
          </Estado>
        </>
      ) : (
        <>
          <Frase>
            {fechaYaPaso ? (
              <>
                Tu acceso venció el <em>{fechaLarga(suscripcion.fechaRenovacion!)}</em>.
              </>
            ) : (
              "Tu acceso terminó."
            )}
          </Frase>
          <Estado
            insignia={ESTADO_LABEL[estadoMostrado]}
            claseInsignia={estadoMostrado === "CANCELADA" ? INSIGNIA_CANCELADA : INSIGNIA_VENCIDA}
          >
            {PRECIOS_HABILITADOS
              ? "Elige un plan o canjea un código nuevo para volver a entrar."
              : "Si tienes un código nuevo, canjéalo aquí abajo."}
          </Estado>
        </>
      )}

      {/* El módulo solo existe si hay pagos que mostrar. Un acceso manual
          (cortesía/invitación) nunca los tiene —es gratis por definición—, y
          una suscripción de pago sin cobros registrados tampoco debe mostrar
          "Todavía no hay pagos": lee como desconfianza sobre algo que nunca
          debió pasar por caja. */}
      {suscripcion.pagos.length > 0 && (
        <section aria-labelledby="historial-pagos" className="grid gap-4 border-t border-uva-divider pt-6">
          <h2 id="historial-pagos" className="text-uva-titulo-4 font-extrabold text-uva-text">
            Historial de pagos
          </h2>

          {/* En móvil, filas apiladas: una tabla de tres columnas no cabe en
              320 px y `overflow-x-auto` la dejaría cortada. */}
          <ul className="sm:hidden">
            {suscripcion.pagos.map((pago) => (
              <li
                key={pago.id}
                className="flex items-baseline justify-between gap-3 border-b border-uva-divider py-3 first:pt-0 last:border-b-0 last:pb-0"
              >
                <div className="min-w-0">
                  <p className="text-uva-cuerpo text-uva-text">{formatFecha(pago.fecha)}</p>
                  <p className="text-uva-detalle text-uva-text-muted">{ESTADO_PAGO_LABEL[pago.estado]}</p>
                </div>
                <p className="shrink-0 font-mono text-uva-cuerpo text-uva-text">
                  {formatMoneda(pago.monto_centavos, pago.moneda)}
                </p>
              </li>
            ))}
          </ul>

          <div className="hidden sm:block">
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
                    <TableCell className="font-mono">{formatMoneda(pago.monto_centavos, pago.moneda)}</TableCell>
                    <TableCell>{ESTADO_PAGO_LABEL[pago.estado]}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>
      )}

      {/* El formulario se ofrece a quien NO tiene acceso vigente, no solo a
          quien está en VENCIDA/CANCELADA: un periodo terminado deja la fila
          en ACTIVA (nadie la mueve), y ese es justo el estudiante que llega
          aquí desde "Renueva tu acceso". El canje sobre una suscripción
          caducada funciona porque `canjear_codigo_invitacion` la cierra
          antes de comprobar el índice único (038_vigencia_por_fecha.sql).
          A quien sí tiene acceso vigente no se le ofrece: se rechazaría con
          'ya_tiene_suscripcion'.
          Una sola sección con las dos salidas (plan y código): son dos
          respuestas a la misma pregunta. El plan va antes porque es el
          camino que el producto quiere; el código es la alternativa. */}
      {!accesoVigente && (
        <section aria-labelledby={PRECIOS_HABILITADOS ? "recuperar-acceso" : undefined} className="grid gap-6 border-t-2 border-uva-text pt-6">
          {PRECIOS_HABILITADOS && (
            <>
              <h2 id="recuperar-acceso" className="text-uva-titulo-4 font-extrabold text-uva-text">
                ¿Cómo quieres recuperar el acceso?
              </h2>
              <div className="grid gap-3">
                <h3 className="flex items-center gap-2.5 text-uva-cuerpo font-bold text-uva-text">
                  <CreditCard className="size-5 text-uva-accent-ink" strokeWidth={1.8} aria-hidden />
                  Elige un plan
                </h3>
                <p className="text-uva-cuerpo text-uva-text-muted">
                  Recupera el acceso a todo el catálogo, las plantillas descargables y los certificados.
                </p>
                <Button
                  render={<Link href="/dashboard/planes" />}
                  nativeButton={false}
                  variant="uva-primary"
                  size="uva"
                  className="min-h-12 w-auto justify-self-start px-[22px] text-base"
                >
                  Ver planes
                </Button>
              </div>
            </>
          )}
          <div className={PRECIOS_HABILITADOS ? "border-t border-uva-divider pt-6" : undefined}>
            <CanjearCodigoForm tieneSuscripcion embebido={PRECIOS_HABILITADOS} />
          </div>
        </section>
      )}
    </Marco>
  );
}
