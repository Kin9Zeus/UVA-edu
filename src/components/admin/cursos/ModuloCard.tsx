"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { GripVertical, Trash2, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { useAdminToast } from "@/components/admin/Toast";
import { LeccionEditorDialog } from "@/components/admin/cursos/LeccionEditorDialog";
import {
  eliminarModulo,
  crearLeccion,
  eliminarLeccion,
  reordenarLecciones,
} from "@/actions/admin/cursos";
import type { ModuloDetalle, LeccionDetalle } from "@/lib/admin/cursoDetalle";

const ESTADO_LABEL = { SUBIENDO: "Subiendo", PROCESANDO: "Procesando", LISTO: "Listo" } as const;
const ESTADO_TONO = { SUBIENDO: "neutral", PROCESANDO: "warning", LISTO: "success" } as const;

export function ModuloCard({
  modulo,
  cursoId,
  draggable,
  onDragStart,
  onDragOver,
  onDrop,
}: {
  modulo: ModuloDetalle;
  cursoId: string;
  draggable: boolean;
  onDragStart: () => void;
  onDragOver: (event: React.DragEvent) => void;
  onDrop: () => void;
}) {
  const [lecciones, setLecciones] = useState(modulo.lecciones);
  const [agregandoLeccion, setAgregandoLeccion] = useState(false);
  const [nombreLeccion, setNombreLeccion] = useState("");
  const [borrandoModulo, setBorrandoModulo] = useState(false);
  const [borrandoLeccion, setBorrandoLeccion] = useState<LeccionDetalle | null>(null);
  const [editando, setEditando] = useState<LeccionDetalle | null>(null);
  const [draggedLeccionIndex, setDraggedLeccionIndex] = useState<number | null>(null);
  const showToast = useAdminToast();
  const router = useRouter();

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
      setEditando({
        id: resultado.id,
        titulo: nombre,
        orden: lecciones.length,
        duracion: null,
        resumen: null,
        estadoProcesamiento: "SUBIENDO",
      });
    }
  }

  async function handleEliminarLeccion() {
    if (!borrandoLeccion) return;
    const resultado = await eliminarLeccion(borrandoLeccion.id, cursoId);
    if (resultado.error) {
      showToast(resultado.error, "error");
      return;
    }
    showToast("Lección eliminada.");
    router.refresh();
  }

  function handleDropLeccion(targetIndex: number) {
    if (draggedLeccionIndex === null || draggedLeccionIndex === targetIndex) return;

    const reordenadas = [...lecciones];
    const [movida] = reordenadas.splice(draggedLeccionIndex, 1);
    reordenadas.splice(targetIndex, 0, movida);
    setLecciones(reordenadas);
    setDraggedLeccionIndex(null);

    reordenarLecciones(
      cursoId,
      reordenadas.map((leccion, index) => ({ id: leccion.id, orden: index })),
    ).then((resultado) => {
      if (resultado.error) showToast(resultado.error, "error");
    });
  }

  return (
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      className="rounded-uva-md border border-uva-divider bg-uva-surface p-4"
    >
      <div className="flex items-center gap-2">
        <GripVertical className="size-4 shrink-0 cursor-grab text-uva-text-faint" />
        <h3 className="flex-1 text-sm font-medium text-uva-text">{modulo.titulo}</h3>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Eliminar módulo"
          onClick={() => setBorrandoModulo(true)}
        >
          <Trash2 className="size-4" />
        </Button>
      </div>

      <div className="mt-3 flex flex-col gap-1.5 pl-6">
        {lecciones.map((leccion, index) => (
          <div
            key={leccion.id}
            draggable
            onDragStart={() => setDraggedLeccionIndex(index)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={() => handleDropLeccion(index)}
            className="flex items-center gap-2 rounded-uva-sm border border-transparent px-2 py-1.5 hover:border-uva-divider hover:bg-uva-surface-soft"
          >
            <GripVertical className="size-3.5 shrink-0 cursor-grab text-uva-text-faint" />
            <button
              type="button"
              onClick={() => setEditando(leccion)}
              className="flex-1 truncate text-left text-sm text-uva-text-muted hover:text-uva-text"
            >
              {leccion.titulo}
            </button>
            <StatusBadge tone={ESTADO_TONO[leccion.estadoProcesamiento]}>
              {ESTADO_LABEL[leccion.estadoProcesamiento]}
            </StatusBadge>
            <button
              type="button"
              aria-label="Eliminar lección"
              onClick={() => setBorrandoLeccion(leccion)}
              className="flex size-6 items-center justify-center rounded-uva-xs text-uva-text-faint hover:bg-[#27272A] hover:text-uva-text"
            >
              <X className="size-3.5" />
            </button>
          </div>
        ))}

        {agregandoLeccion ? (
          <div className="flex items-center gap-2 pt-1">
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
            <Button type="button" variant="outline" size="sm" onClick={() => setAgregandoLeccion(false)}>
              Cancelar
            </Button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setAgregandoLeccion(true)}
            className="mt-1 flex w-fit items-center gap-1.5 text-xs text-uva-accent-text hover:underline"
          >
            <Plus className="size-3.5" />
            Añadir lección
          </button>
        )}
      </div>

      {editando && (
        <LeccionEditorDialog
          leccion={editando}
          cursoId={cursoId}
          onOpenChange={(open) => {
            if (!open) {
              setEditando(null);
              router.refresh();
            }
          }}
        />
      )}

      <ConfirmDialog
        open={borrandoModulo}
        onOpenChange={setBorrandoModulo}
        title="Eliminar módulo"
        description={`¿Eliminar "${modulo.titulo}" y todas sus lecciones? Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar"
        destructive
        onConfirm={handleEliminarModulo}
      />
      <ConfirmDialog
        open={borrandoLeccion !== null}
        onOpenChange={(open) => !open && setBorrandoLeccion(null)}
        title="Eliminar lección"
        description={`¿Eliminar "${borrandoLeccion?.titulo}"? Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar"
        destructive
        onConfirm={handleEliminarLeccion}
      />
    </div>
  );
}
