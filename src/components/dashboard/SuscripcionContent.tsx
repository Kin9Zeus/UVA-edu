import Link from "next/link";
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
import type { SuscripcionActual } from "@/lib/suscripcion";

const ESTADO_LABEL: Record<SuscripcionActual["estado"], string> = {
  ACTIVA: "Activa",
  PAST_DUE: "Pago pendiente",
  VENCIDA: "Vencida",
  CANCELADA: "Cancelada",
};

const ESTADO_PAGO_LABEL = {
  EXITOSO: "Pagado",
  FALLIDO: "Fallido",
  PENDIENTE: "Pendiente",
};

function diasRestantes(fechaRenovacion: string | null) {
  if (!fechaRenovacion) return null;
  const ms = new Date(fechaRenovacion).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

function porcentajeTranscurrido(fechaInicio: string, fechaRenovacion: string | null) {
  if (!fechaRenovacion) return 0;
  const inicio = new Date(fechaInicio).getTime();
  const fin = new Date(fechaRenovacion).getTime();
  if (fin <= inicio) return 0;
  const avance = ((Date.now() - inicio) / (fin - inicio)) * 100;
  return Math.min(100, Math.max(0, Math.round(avance)));
}

export function SuscripcionContent({ suscripcion }: { suscripcion: SuscripcionActual | null }) {
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

  const dias = diasRestantes(suscripcion.fechaRenovacion);
  const avance = porcentajeTranscurrido(suscripcion.fechaInicio, suscripcion.fechaRenovacion);
  const periodoLabel = suscripcion.duracionDias >= 360 ? "Anual" : "Mensual";
  const nombrePlan = suscripcion.planNombre.toLowerCase().includes(periodoLabel.toLowerCase())
    ? suscripcion.planNombre
    : `${suscripcion.planNombre} · ${periodoLabel}`;

  return (
    <div className="mx-auto flex max-w-[820px] flex-col gap-6 px-[clamp(20px,3vw,44px)] py-8">
      <h1 className="text-2xl text-uva-text">Mi suscripción</h1>

      <div className="flex flex-col gap-4 rounded-uva-md border border-uva-divider bg-uva-accent-soft p-6">
        <div className="flex items-center gap-3">
          <div>
            <p className="font-heading text-xl text-uva-text">{nombrePlan}</p>
            <p className="text-[13px] text-uva-text-muted">
              {suscripcion.fechaRenovacion
                ? `Renovación ${formatFecha(suscripcion.fechaRenovacion)}`
                : "Sin fecha de renovación"}
            </p>
          </div>
          <div className="ml-auto text-right">
            {dias !== null ? (
              <>
                <p className="font-heading text-2xl text-uva-accent">{dias}</p>
                <p className="text-[11.5px] text-uva-text-muted">días restantes</p>
              </>
            ) : (
              <Badge variant="secondary">{ESTADO_LABEL[suscripcion.estado]}</Badge>
            )}
          </div>
        </div>
        {suscripcion.fechaRenovacion && (
          <div className="h-[7px] rounded-full bg-black/25">
            <div
              className="h-full rounded-full bg-uva-accent"
              style={{ width: `${avance}%` }}
            />
          </div>
        )}
        <Badge variant="secondary" className="w-fit">
          {ESTADO_LABEL[suscripcion.estado]}
        </Badge>
      </div>

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

      {/* El formulario NO se muestra a quien ya tiene una suscripción
          vigente: `suscripcion_activa_unica_por_usuario` solo admite una en
          ACTIVA o PAST_DUE, así que el canje se rechazaría
          ('ya_tiene_suscripcion' en 027). Ofrecerlo sería invitar a un
          error seguro. */}
      {(suscripcion.estado === "VENCIDA" || suscripcion.estado === "CANCELADA") && (
        <CanjearCodigoForm tieneSuscripcion />
      )}
    </div>
  );
}
