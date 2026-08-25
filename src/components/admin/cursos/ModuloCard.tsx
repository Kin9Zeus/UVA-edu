"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { GripVertical, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AdminCard } from "@/components/admin/AdminCard";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { useAdminToast } from "@/components/admin/Toast";
import { formatDuracion } from "@/lib/admin/format";
import {
  actualizarModulo,
  eliminarModulo,
  crearLeccion,
  eliminarLeccion,
  moverLeccion,
} from "@/actions/admin/cursos";
import { cn } from "@/lib/utils";
import type { ModuloDetalle, LeccionDetalle } from "@/lib/admin/cursoDetalle";

const ESTADO_LABEL = {
  SUBIENDO: "Subiendo",
  PROCESANDO: "Procesando",
  LISTO: "Listo",
  ERROR: "Error",
} as const;
const ESTADO_TONO = {
  SUBIENDO: "neutral",
  PROCESANDO: "warning",
  LISTO: "success",
  ERROR: "error",
} as const;

/**
 * Tarjeta de módulo del mockup del panel admin: `padding:0` con una franja de
 * cabecera en `--surface-2` y las lecciones separadas por `border-top`, en vez
 * de una lista indentada dentro de una tarjeta con padding.
 *
 * El estado de las lecciones vive en ContenidoTab (fuente única), porque el
 * editor lateral necesita ver y actualizar la misma lección que la fila.
 */
export function ModuloCard({
  modulo,
  posicion,
  cursoId,
  draggable,
  leccionActivaId,
  onSeleccionarLeccion,
  onLeccionesChange,
  onTituloChange,
  onDragStart,
  onDragOver,
  onDrop,
}: {
  modulo: ModuloDetalle;
  /** Posición 1..N en la lista; el mockup la pinta junto al nombre del módulo. */
  posicion: number;
  cursoId: string;
  draggable: boolean;
  leccionActivaId: string | null;
  onSeleccionarLeccion: (leccion: LeccionDetalle) => void;
  onLeccionesChange: (moduloId: string, lecciones: LeccionDetalle[]) => void;
  onTituloChange: (moduloId: string, titulo: string) => void;
  onDragStart: () => void;
  onDragOver: (event: React.DragEvent) => void;
  onDrop: () => void;
}) {
  const [agregandoLeccion, setAgregandoLeccion] = useState(false);
  const [nombreLeccion, setNombreLeccion] = useState("");
  const [borrandoModulo, setBorrandoModulo] = useState(false);
  const [borrandoLeccion, setBorrandoLeccion] = useState<LeccionDetalle | null>(null);
  const [draggedLeccionIndex, setDraggedLeccionIndex] = useState<number | null>(null);
  const [editandoTitulo, setEditandoTitulo] = useState(false);
  const [tituloEditado, setTituloEditado] = useState(modulo.titulo);
  const [guardandoTitulo, setGuardandoTitulo] = useState(false);
  const showToast = useAdminToast();
  const router = useRouter();

  const lecciones = modulo.lecciones;

  async function handleGuardarTitulo() {
    // Deshabilitar el input mientras guarda le quita el foco (dispara
    // `blur` → este mismo handler otra vez): sin esta guarda se dispararía
    // la mutación dos veces.
    if (guardandoTitulo) return;

    const nombre = tituloEditado.trim();
    if (!nombre || nombre === modulo.titulo) {
      setTituloEditado(modulo.titulo);
      setEditandoTitulo(false);
      return;
    }

    setGuardandoTitulo(true);
    const resultado = await actualizarModulo(modulo.id, cursoId, nombre);
    setGuardandoTitulo(false);

    if (resultado.error) {
      showToast(resultado.error, "error");
      return;
    }
    setEditandoTitulo(false);
    onTituloChange(modulo.id, nombre);
    showToast("Módulo renombrado.");
    router.refresh();
  }

  async function handleEliminarModulo() {
    const resultado = await eliminarModulo(modulo.id, cursoId);
    if (resultado.error) {
      showToast(resultado.error, "error");
      return;
    }
    showToast("Módulo eliminado.");
    router.refresh();
  }

  async function handleAgregarLeccion() {
    const nombre = nombreLeccion.trim();
    if (!nombre) return;

    const resultado = await crearLeccion(modulo.id, cursoId, nombre);
    if (resultado.error) {
      showToast(resultado.error, "error");
      return;
    }
    setNombreLeccion("");
    setAgregandoLeccion(false);
    showToast("Lección creada.");
    router.refresh();

    if (resultado.id) {
      const nueva: LeccionDetalle = {
        id: resultado.id,
        titulo: nombre,
        orden: lecciones.length,
        duracion: null,
        resumen: null,
        estadoProcesamiento: "SUBIENDO",
        errorProcesamiento: null,
        idMuxUploadId: null,
        idVideoMux: null,
        recursos: [],
      };
      onLeccionesChange(modulo.id, [...lecciones, nueva]);
      onSeleccionarLeccion(nueva);
    }
  }

  async function handleEliminarLeccion() {
    if (!borrandoLeccion) return;
    const resultado = await eliminarLeccion(borrandoLeccion.id, cursoId);
    if (resultado.error) {
      showToast(resultado.error, "error");
      return;
    }
    onLeccionesChange(
      modulo.id,
      lecciones.filter((leccion) => leccion.id !== borrandoLeccion.id),
    );
    showToast("Lección eliminada.");
    router.refresh();
  }

  function handleDropLeccion(targetIndex: number) {
    if (draggedLeccionIndex === null || draggedLeccionIndex === targetIndex) return;

    const reordenadas = [...lecciones];
    const [movida] = reordenadas.splice(draggedLeccionIndex, 1);
    reordenadas.splice(targetIndex, 0, movida);
    onLeccionesChange(modulo.id, reordenadas);
    setDraggedLeccionIndex(null);

    const idAnterior = reordenadas[targetIndex - 1]?.id ?? null;
    const idSiguiente = reordenadas[targetIndex + 1]?.id ?? null;

    moverLeccion(cursoId, modulo.id, movida.id, idAnterior, idSiguiente).then((resultado) => {
      if (resultado.error) showToast(resultado.error, "error");
    });
  }

  return (
    <AdminCard
      flush
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      className="cursor-grab"
    >
      {/* Franja de cabecera del módulo: `background:var(--surface-2)` */}
      <div className="flex items-center gap-2.5 bg-uva-surface-2 px-4 py-[13px]">
        <GripVertical className="size-[15px] shrink-0 text-uva-muted-2" strokeWidth={2} />
        {editandoTitulo ? (
          <Input
            autoFocus
            value={tituloEditado}
            disabled={guardandoTitulo}
            onChange={(event) => setTituloEditado(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") handleGuardarTitulo();
              if (event.key === "Escape") {
                setTituloEditado(modulo.titulo);
                setEditandoTitulo(false);
              }
            }}
            onBlur={handleGuardarTitulo}
            className="h-7 max-w-[240px] text-[13.5px] font-bold"
          />
        ) : (
          <span className="text-[13.5px] font-bold text-uva-text">{modulo.titulo}</span>
        )}
        <span className="font-mono text-[11.5px] text-uva-muted-2">{posicion}</span>
        <div className="ml-auto flex items-center gap-1">
          {!editandoTitulo && (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`Renombrar el modulo ${modulo.titulo}`}
              title="Renombrar módulo"
              className="text-uva-muted-2 hover:text-uva-accent"
              onClick={() => {
                setTituloEditado(modulo.titulo);
                setEditandoTitulo(true);
              }}
            >
              <Pencil className="size-4" />
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`Eliminar el modulo ${modulo.titulo}`}
            title="Eliminar modulo"
            className="text-uva-muted-2 hover:text-uva-accent"
            onClick={() => setBorrandoModulo(true)}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>

      <div>
        {lecciones.map((leccion, index) => (
          <div
            key={leccion.id}
            draggable
            onDragStart={() => setDraggedLeccionIndex(index)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={() => handleDropLeccion(index)}
            className={cn(
              "flex cursor-grab items-center gap-[11px] border-t border-uva-divider px-4 py-[11px] hover:bg-uva-hover",
              leccion.id === leccionActivaId && "bg-uva-hover",
            )}
          >
            <GripVertical className="size-[14px] shrink-0 text-uva-muted-2" strokeWidth={2} />
            {/* El esquema no distingue tipos de lección todavía: toda lección
                es un video de Mux (id_video_mux / duracion / estado). */}
            <span className="w-[14px] shrink-0 font-mono text-xs text-uva-muted">&#9654;</span>
            <button
              type="button"
              onClick={() => onSeleccionarLeccion(leccion)}
              className="flex-1 truncate text-left text-[13px] text-uva-text"
            >
              {leccion.titulo}
            </button>
            <span className="shrink-0 font-mono text-[11.5px] text-uva-muted-2">
              {formatDuracion(leccion.duracion)}
            </span>
            <StatusBadge tone={ESTADO_TONO[leccion.estadoProcesamiento]} className="shrink-0 text-[10px]">
              {ESTADO_LABEL[leccion.estadoProcesamiento]}
            </StatusBadge>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`Eliminar la lección ${leccion.titulo}`}
              title="Eliminar lección"
              className="shrink-0 text-uva-muted-2 hover:text-uva-accent"
              onClick={() => setBorrandoLeccion(leccion)}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        ))}

        {agregandoLeccion ? (
          <div className="flex items-center gap-2 border-t border-uva-divider px-4 py-2.5">
            <Input
              autoFocus
              placeholder="Nombre de la lección"
              value={nombreLeccion}
              onChange={(event) => setNombreLeccion(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && handleAgregarLeccion()}
              className="h-8 max-w-[280px] text-sm"
            />
            <Button type="button" size="sm" onClick={handleAgregarLeccion}>
              Agregar
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setAgregandoLeccion(false)}>
              Cancelar
            </Button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setAgregandoLeccion(true)}
            className="w-full border-t border-uva-divider px-4 py-[9px] text-left text-xs text-uva-muted hover:bg-uva-hover"
          >
            + Añadir lección
          </button>
        )}
      </div>

      <ConfirmDialog
        open={borrandoModulo}
        onOpenChange={setBorrandoModulo}
        title="Eliminar módulo"
        description={`¿Eliminar "${modulo.titulo}" y todas sus lecciones? Esta acción no se puede deshacer.`}
        onConfirm={handleEliminarModulo}
      />
      <ConfirmDialog
        open={borrandoLeccion !== null}
        onOpenChange={(open) => !open && setBorrandoLeccion(null)}
        title="Eliminar lección"
        description={`¿Eliminar "${borrandoLeccion?.titulo}"? Esta acción no se puede deshacer.`}
        onConfirm={handleEliminarLeccion}
      />
    </AdminCard>
  );
}
