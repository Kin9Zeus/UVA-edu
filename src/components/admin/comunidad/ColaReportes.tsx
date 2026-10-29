"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ExternalLink, History, Paperclip, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { useAdminToast } from "@/components/admin/Toast";
import { ModerarComunidadDialog } from "@/components/dashboard/comunidad/ModerarComunidadDialog";
import { DIAS_ALERTA_ESPERA } from "@/components/admin/comunidad/ResumenComunidad";
import { eliminarPostComunidad, eliminarRespuestaComunidad } from "@/actions/comunidad/eliminar";
import { descartarReportesComunidad } from "@/actions/admin/comunidadReportes";
import { CATEGORIA_LABEL } from "@/lib/comunidad-tipos";
import { RUTA_DECISIONES_COMUNIDAD } from "@/lib/admin/bitacora-tipos";
import { cn } from "@/lib/utils";
import type { ContenidoReportado } from "@/lib/admin/comunidadReportes";

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;
const cuando = (dias: number) => (dias === 0 ? "hoy" : dias === 1 ? "ayer" : `hace ${dias} días`);

function textoAdjuntos({ imagenes, archivos }: { imagenes: number; archivos: number }) {
  const partes = [
    imagenes > 0 && plural(imagenes, "imagen adjunta", "imágenes adjuntas"),
    archivos > 0 && plural(archivos, "archivo adjunto", "archivos adjuntos"),
  ].filter(Boolean);
  return partes.length ? partes.join(" y ") : null;
}

/**
 * Cola de moderación de Comunidad (`/admin/comunidad`): una tarjeta por
 * contenido reportado, la más antigua primero. "Eliminar" reusa
 * ModerarComunidadDialog (el mismo de la comunidad), así el motivo le llega
 * por correo al autor por un solo camino de moderación.
 */
export function ColaReportes({ contenidos }: { contenidos: ContenidoReportado[] }) {
  const router = useRouter();
  const showToast = useAdminToast();
  const [, startTransition] = useTransition();
  const [dejando, setDejando] = useState<string | null>(null);
  const [eliminando, setEliminando] = useState<ContenidoReportado | null>(null);

  function dejar(contenido: ContenidoReportado) {
    setDejando(contenido.contenidoId);
    startTransition(async () => {
      const resultado = await descartarReportesComunidad({ tipo: contenido.tipoContenido, id: contenido.contenidoId });
      setDejando(null);
      router.refresh();
      if (resultado.error) {
        showToast(resultado.error, "error");
        return;
      }
      const n = contenido.reportes.length;
      showToast(
        `${n === 1 ? "Cerraste el reporte" : `Cerraste los ${n} reportes`}. La ${contenido.tipoContenido} sigue en la comunidad.`,
      );
    });
  }

  async function confirmarEliminacion(motivo: string) {
    if (!eliminando) return {};
    const resultado =
      eliminando.tipoContenido === "publicación"
        ? await eliminarPostComunidad(eliminando.contenidoId, "/admin/comunidad", motivo)
        : await eliminarRespuestaComunidad(eliminando.contenidoId, "/admin/comunidad", motivo);

    if ("error" in resultado) return { error: resultado.error };
    showToast(`Eliminaste la ${eliminando.tipoContenido} de ${eliminando.autorNombre}. Le llega un correo con tu motivo.`);
    router.refresh();
    return {};
  }

  return (
    <section aria-labelledby="cola-reportes" className="flex flex-col gap-3.5">
      <h2 id="cola-reportes" className="text-uva-titulo-4 font-extrabold text-uva-text">
        Por revisar
        {contenidos.length > 0 && <span className="ml-2 font-semibold text-uva-text-muted">{contenidos.length}</span>}
      </h2>

      {contenidos.length === 0 ? (
        <div className="grid justify-items-center gap-1.5 rounded-uva-lg border border-uva-divider bg-uva-surface px-5 py-10 text-center">
          <p className="m-0 text-uva-cuerpo font-bold text-uva-text">No hay reportes por revisar</p>
          <p className="m-0 max-w-[46ch] text-uva-detalle text-uva-text-muted">
            Cuando alguien reporte una publicación o una respuesta, aparece aquí con su motivo, la más antigua primero.
          </p>
          <Link
            href={RUTA_DECISIONES_COMUNIDAD}
            className="mt-1.5 inline-flex min-h-11 items-center gap-1.5 text-uva-detalle font-semibold text-uva-accent-text hover:underline"
          >
            <History className="size-4" aria-hidden />
            Ver decisiones anteriores en la bitácora
          </Link>
        </div>
      ) : (
        <>
          <p className="m-0 max-w-[80ch] text-uva-detalle text-uva-text-muted">
            La más antigua primero. Al eliminar, el autor recibe un correo con tu motivo. Al dejarla, se cierran sus
            reportes y el contenido sigue igual. En los dos casos, quien reportó recibe un aviso con la decisión.
          </p>
          {contenidos.map((contenido) => (
            <Tarjeta
              key={contenido.contenidoId}
              contenido={contenido}
              ocupada={dejando === contenido.contenidoId}
              onEliminar={() => setEliminando(contenido)}
              onDejar={() => dejar(contenido)}
            />
          ))}
        </>
      )}

      <ModerarComunidadDialog
        open={eliminando !== null}
        onOpenChange={(open) => !open && setEliminando(null)}
        tipoContenido={eliminando?.tipoContenido ?? "publicación"}
        onConfirm={confirmarEliminacion}
      />
    </section>
  );
}

function Tarjeta({
  contenido,
  ocupada,
  onEliminar,
  onDejar,
}: {
  contenido: ContenidoReportado;
  ocupada: boolean;
  onEliminar: () => void;
  onDejar: () => void;
}) {
  const esPublicacion = contenido.tipoContenido === "publicación";
  const n = contenido.reportes.length;
  const espera = contenido.reportes[0].dias;
  const adjuntos = contenido.adjuntos && textoAdjuntos(contenido.adjuntos);
  const idTitulo = `reporte-${contenido.contenidoId}`;

  return (
    <article
      aria-labelledby={idTitulo}
      className="flex flex-col gap-3.5 rounded-uva-lg border border-uva-divider bg-uva-surface p-4 sm:px-6 sm:py-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
        <p id={idTitulo} className="m-0 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-uva-detalle text-uva-text-muted">
          {esPublicacion ? (
            <span>
              Publicación en{" "}
              <b className="font-bold text-uva-text">
                {contenido.categoria ? CATEGORIA_LABEL[contenido.categoria] : "la comunidad"}
              </b>
            </span>
          ) : (
            <span className="min-w-0 break-words">
              Respuesta en <b className="font-bold text-uva-text">«{contenido.postTitulo || "una publicación"}»</b>
            </span>
          )}
          {n > 1 && <StatusBadge tone="warning">{n} reportes</StatusBadge>}
        </p>
        <span
          className={cn(
            "text-uva-detalle whitespace-nowrap",
            espera >= DIAS_ALERTA_ESPERA ? "font-bold text-uva-warning-text" : "text-uva-text-muted",
          )}
        >
          Reportada {cuando(espera)}
        </span>
      </div>

      <div className="flex min-w-0 flex-col gap-1.5 rounded-uva-md border border-uva-divider bg-uva-bg px-4 py-3.5">
        <p className="m-0 flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-uva-detalle text-uva-text-muted">
          <span>
            {contenido.autorSlug ? (
              <Link
                href={`/admin/usuarios/${contenido.autorSlug}`}
                className="font-bold text-uva-text hover:text-uva-accent-text hover:underline"
              >
                {contenido.autorNombre}
              </Link>
            ) : (
              <b className="font-bold text-uva-text">{contenido.autorNombre}</b>
            )}{" "}
            {esPublicacion ? "publicó" : "respondió"} {cuando(contenido.diasPublicado)}
          </span>
          {contenido.eliminacionesPrevias !== null &&
            (contenido.eliminacionesPrevias > 0 ? (
              <span className="font-bold text-uva-warning-text">
                Ya le eliminaron {plural(contenido.eliminacionesPrevias, "contenido", "contenidos")}
              </span>
            ) : (
              <span>No le han eliminado nada antes</span>
            ))}
        </p>
        {esPublicacion && contenido.postTitulo && (
          <h3 className="mt-1 text-uva-cuerpo font-extrabold break-words text-uva-text">{contenido.postTitulo}</h3>
        )}
        <p className="m-0 line-clamp-4 break-words whitespace-pre-line text-uva-cuerpo text-uva-text">
          {contenido.texto || <i className="text-uva-text-muted">Sin texto</i>}
        </p>
        {adjuntos && (
          <span className="inline-flex items-center gap-1.5 text-uva-detalle text-uva-text-muted">
            <Paperclip className="size-3.5" aria-hidden />
            {adjuntos}
          </span>
        )}
        <a
          href={`/dashboard/comunidad/${contenido.postSlug}`}
          target="_blank"
          rel="noopener"
          className="inline-flex min-h-8 items-center gap-1.5 self-start text-uva-detalle font-semibold text-uva-accent-text hover:underline pointer-coarse:min-h-11 max-sm:min-h-11"
        >
          Ver en la comunidad
          <ExternalLink className="size-3.5" aria-hidden />
          <span className="sr-only">(se abre en otra pestaña)</span>
        </a>
      </div>

      <div>
        <p className="m-0 text-uva-detalle font-bold text-uva-text">
          {n === 1 ? "Motivo del reporte" : `Motivos de los ${n} reportes`}
        </p>
        <ul className="mt-2 flex list-none flex-col gap-2 p-0">
          {contenido.reportes.map((reporte) => (
            <li
              key={reporte.id}
              className="border-l-[3px] border-uva-warning-text/55 pl-3 text-uva-cuerpo break-words text-uva-text"
            >
              «{reporte.motivo}»
              <span className="block text-uva-detalle text-uva-text-muted">
                {reporte.reportanteNombre}, {cuando(reporte.dias)}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="destructive" className="max-sm:flex-1" onClick={onEliminar} disabled={ocupada}>
          <Trash2 aria-hidden />
          Eliminar {contenido.tipoContenido}
        </Button>
        <Button type="button" className="max-sm:flex-1" onClick={onDejar} disabled={ocupada}>
          <Check aria-hidden />
          {ocupada ? "Cerrando…" : esPublicacion ? "Dejar publicada" : "Dejar la respuesta"}
        </Button>
      </div>
    </article>
  );
}
