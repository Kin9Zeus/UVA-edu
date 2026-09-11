"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AdminCard } from "@/components/admin/AdminCard";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { useAdminToast } from "@/components/admin/Toast";
import { ModerarComunidadDialog } from "@/components/dashboard/comunidad/ModerarComunidadDialog";
import { eliminarPostComunidad, eliminarRespuestaComunidad } from "@/actions/comunidad/eliminar";
import { descartarReporteComunidad } from "@/actions/admin/comunidadReportes";
import { formatFechaHora } from "@/lib/admin/format";
import type { ReporteComunidadPendiente } from "@/lib/admin/comunidadReportes";

/**
 * Cola de moderación de Comunidad (`/admin/comunidad`) — a diferencia de la
 * Bitácora, no pagina: se espera que se vacíe seguido (ver el comentario en
 * getReportesComunidadPendientes). Reusa ModerarComunidadDialog (mismo
 * componente que ComunidadPostCard/ComunidadRespuestaItem) para "Eliminar",
 * así el motivo que escriba el admin acá también le llega por correo al
 * autor — no hay dos caminos de moderación con reglas distintas.
 */
export function ComunidadReportesTable({ reportes }: { reportes: ReporteComunidadPendiente[] }) {
  const router = useRouter();
  const showToast = useAdminToast();
  const [pendienteDescarte, startTransition] = useTransition();
  const [reporteEnDialogo, setReporteEnDialogo] = useState<ReporteComunidadPendiente | null>(null);

  function descartar(id: string) {
    startTransition(async () => {
      const resultado = await descartarReporteComunidad(id);
      if (resultado.error) {
        showToast(resultado.error, "error");
        return;
      }
      showToast("Reporte descartado.");
      router.refresh();
    });
  }

  async function confirmarEliminacion(motivo: string) {
    if (!reporteEnDialogo) return {};
    const resultado =
      reporteEnDialogo.tipoContenido === "publicación"
        ? await eliminarPostComunidad(reporteEnDialogo.contenidoId, "/admin/comunidad", motivo)
        : await eliminarRespuestaComunidad(reporteEnDialogo.contenidoId, "/admin/comunidad", motivo);

    if ("error" in resultado) return { error: resultado.error };
    showToast("Publicación eliminada.");
    router.refresh();
    return {};
  }

  if (reportes.length === 0) {
    return (
      <AdminCard flush className="gap-0">
        <p className="px-5 py-6 text-center text-sm text-uva-text-faint">No hay reportes pendientes.</p>
      </AdminCard>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-3">
        {reportes.map((reporte) => (
          <AdminCard key={reporte.id} className="gap-3">
            <div className="flex flex-wrap items-start justify-between gap-x-2 gap-y-1">
              <StatusBadge tone="warning">{reporte.tipoContenido}</StatusBadge>
              <span className="shrink-0 font-mono text-[11.5px] text-uva-muted-2 tabular-nums">
                {formatFechaHora(reporte.creadoEn)}
              </span>
            </div>

            <div>
              <p className="m-0 text-[13px] text-uva-muted">
                De <span className="text-uva-text">{reporte.autorNombre}</span> — reportado por{" "}
                <span className="text-uva-text">{reporte.reportanteNombre}</span>
              </p>
              <Link
                href={`/dashboard/comunidad/${reporte.postSlug}`}
                className="mt-1 block text-sm whitespace-pre-line text-uva-text hover:text-uva-accent-text"
              >
                {reporte.preview || "(contenido vacío)"}
              </Link>
            </div>

            <div className="rounded-uva-md border border-uva-divider bg-uva-surface-2 px-3 py-2.5 text-[12.5px] text-uva-muted-2">
              <span className="font-semibold text-uva-muted">Motivo del reporte: </span>
              {reporte.motivo}
            </div>

            <div className="flex items-center gap-4 text-[13px]">
              <button
                type="button"
                onClick={() => setReporteEnDialogo(reporte)}
                className="cursor-pointer border-0 bg-transparent p-0 text-uva-badge-danger-fg hover:underline"
              >
                Eliminar
              </button>
              <button
                type="button"
                disabled={pendienteDescarte}
                onClick={() => descartar(reporte.id)}
                className="cursor-pointer border-0 bg-transparent p-0 text-uva-muted hover:text-uva-text disabled:cursor-not-allowed disabled:opacity-60"
              >
                Descartar
              </button>
            </div>
          </AdminCard>
        ))}
      </div>

      <ModerarComunidadDialog
        open={reporteEnDialogo !== null}
        onOpenChange={(open) => !open && setReporteEnDialogo(null)}
        tipoContenido={reporteEnDialogo?.tipoContenido ?? "publicación"}
        onConfirm={confirmarEliminacion}
      />
    </>
  );
}
