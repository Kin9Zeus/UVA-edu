"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { GripVertical, Pencil, Trash2 } from "lucide-react";
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
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
import { LeccionEditorPanel } from "@/components/admin/cursos/LeccionEditorPanel";
import type { ModuloDetalle, LeccionDetalle, RecursoDetalle } from "@/lib/admin/cursoDetalle";

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
  totalLeccionesCurso,
  cursoId,
  leccionActivaId,
  onSeleccionarLeccion,
  onLeccionesChange,
  onTituloChange,
  confirmarSalirSinGuardar,
  onCerrarEditor,
  onLeccionGuardada,
  onRecursosChange,
  onDirtyChangeLeccion,
}: {
  modulo: ModuloDetalle;
  /** Posición 1..N en la lista; el mockup la pinta junto al nombre del módulo. */
  posicion: number;
  /** Total de lecciones del curso completo (todos los módulos), no solo
   * este — determina si la primera lección cuenta como vista previa
   * pública (ver la etiqueta "Introducción" más abajo). */
  totalLeccionesCurso: number;
  cursoId: string;
  leccionActivaId: string | null;
  onSeleccionarLeccion: (leccion: LeccionDetalle) => void;
  onLeccionesChange: (moduloId: string, lecciones: LeccionDetalle[]) => void;
  onTituloChange: (moduloId: string, titulo: string) => void;
  /** true si se puede seguir (no había cambios sin guardar, o el usuario
   * confirmó descartarlos en el diálogo de ContenidoTab). Toda mutación de
   * acá abajo termina en router.refresh(), que remonta el editor de lección
   * — hay que preguntar antes, igual que al cambiar de lección o salir de
   * la pantalla. */
  confirmarSalirSinGuardar: () => Promise<boolean>;
  /** Props que se reenvían tal cual a LeccionEditorPanel cuando una de las
   * lecciones de este módulo es la activa (ver el render en línea, abajo). */
  onCerrarEditor: () => void;
  onLeccionGuardada: (cambios: Partial<LeccionDetalle>) => void;
  onRecursosChange: (recursos: RecursoDetalle[]) => void;
  onDirtyChangeLeccion: (dirty: boolean) => void;
}) {
  const [agregandoLeccion, setAgregandoLeccion] = useState(false);
  const [nombreLeccion, setNombreLeccion] = useState("");
  const [borrandoModulo, setBorrandoModulo] = useState(false);
  const [borrandoLeccion, setBorrandoLeccion] = useState<LeccionDetalle | null>(null);
  const [editandoTitulo, setEditandoTitulo] = useState(false);
  const [tituloEditado, setTituloEditado] = useState(modulo.titulo);
  const [guardandoTitulo, setGuardandoTitulo] = useState(false);
  const showToast = useAdminToast();
  const router = useRouter();

  // Mismos sensores que ContenidoTab (mouse via PointerSensor, dedo con
  // long-press via TouchSensor) — cada módulo tiene su propia lista de
  // lecciones, así que cada uno arma su propio DndContext en vez de
  // compartir el de módulos.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
  );

  const {
    attributes: moduloAttributes,
    listeners: moduloListeners,
    setNodeRef: setModuloNodeRef,
    transform: moduloTransform,
    transition: moduloTransition,
    isDragging: moduloIsDragging,
  } = useSortable({ id: modulo.id });

  const moduloStyle = {
    transform: CSS.Transform.toString(moduloTransform),
    transition: moduloTransition,
    opacity: moduloIsDragging ? 0.5 : 1,
  };

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
    // Se pregunta ANTES de guardar (no se descarta el título escrito): si
    // cancela, el input se queda como estaba para reintentar después de
    // resolver la lección abierta.
    if (!(await confirmarSalirSinGuardar())) return;

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
    if (!(await confirmarSalirSinGuardar())) return;

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
        contenido: null,
        estadoProcesamiento: "SUBIENDO",
        errorProcesamiento: null,
        idMuxUploadId: null,
        idVideoMux: null,
        recursos: [],
        estudiantesConProgreso: 0,
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

  async function handleLeccionDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    if (!(await confirmarSalirSinGuardar())) return;

    const anteriores = lecciones;
    const origenIndex = lecciones.findIndex((leccion) => leccion.id === active.id);
    const targetIndex = lecciones.findIndex((leccion) => leccion.id === over.id);
    if (origenIndex === -1 || targetIndex === -1) return;

    const reordenadas = arrayMove(lecciones, origenIndex, targetIndex);
    onLeccionesChange(modulo.id, reordenadas);

    const idAnterior = reordenadas[targetIndex - 1]?.id ?? null;
    const idSiguiente = reordenadas[targetIndex + 1]?.id ?? null;

    moverLeccion(cursoId, modulo.id, String(active.id), idAnterior, idSiguiente).then((resultado) => {
      if (resultado.error) {
        showToast(resultado.error, "error");
        // Reversión visible: el servidor no guardó el nuevo orden, así que
        // la lista vuelve a como estaba antes del arrastre.
        onLeccionesChange(modulo.id, anteriores);
      }
    });
  }

  return (
    <AdminCard flush ref={setModuloNodeRef} style={moduloStyle}>
      {/* Franja de cabecera del módulo: `background:var(--surface-2)` */}
      <div className="flex items-center gap-2.5 bg-uva-surface-2 px-4 py-[13px]">
        {/* El grip es el único punto de arrastre (no la tarjeta entera): así
            el resto de la cabecera — renombrar, eliminar — sigue siendo
            tocable/cliqueable sin competir con el gesto de reordenar.
            `touch-action:none` evita que el navegador interprete el primer
            roce como scroll de la página antes de que el long-press active
            el drag. */}
        <button
          type="button"
          {...moduloAttributes}
          {...moduloListeners}
          aria-label={`Reordenar el módulo ${modulo.titulo}`}
          className="-m-1.5 cursor-grab touch-none p-1.5 text-uva-muted-2 active:cursor-grabbing pointer-coarse:-m-3 pointer-coarse:p-3"
        >
          <GripVertical className="size-[15px] shrink-0" strokeWidth={2} />
        </button>
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
        {/* Índice decorativo (1..N): en mobile se quita para darle más
            espacio al título, que ya lo dice todo lo que hace falta. */}
        <span className="hidden font-mono text-[11.5px] text-uva-muted-2 sm:inline">{posicion}</span>
        <div className="ml-auto flex items-center gap-1">
          {!editandoTitulo && (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`Renombrar el modulo ${modulo.titulo}`}
              title="Renombrar módulo"
              className="text-uva-muted-2 hover:text-uva-accent pointer-coarse:p-3"
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
            className="text-uva-muted-2 hover:text-uva-accent pointer-coarse:p-3"
            onClick={async () => {
              if (await confirmarSalirSinGuardar()) setBorrandoModulo(true);
            }}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>

      <div>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleLeccionDragEnd}>
          <SortableContext items={lecciones.map((leccion) => leccion.id)} strategy={verticalListSortingStrategy}>
            {lecciones.map((leccion, index) => {
              const activa = leccion.id === leccionActivaId;
              return (
                <div key={leccion.id}>
                  <LeccionRow
                    leccion={leccion}
                    activa={activa}
                    // Vista previa pública del curso (Revcurso: "que la
                    // primera lección sea visible"): esta es la que ve
                    // cualquiera sin acceso, así que el profesor/admin que
                    // arma el curso necesita saber cuál es antes de subir
                    // el video.
                    esIntroduccion={posicion === 1 && index === 0 && totalLeccionesCurso > 1}
                    onSeleccionar={() => onSeleccionarLeccion(leccion)}
                    onEliminar={async () => {
                      if (await confirmarSalirSinGuardar()) setBorrandoLeccion(leccion);
                    }}
                  />
                  {/* Editor en línea: se despliega justo debajo de la fila de
                      la lección elegida, dentro de este mismo módulo, y las
                      lecciones que siguen quedan debajo — ver el comentario
                      de ContenidoTab.tsx sobre la deviación del mockup. El
                      id es el punto de scroll que usa seleccionarLeccion(). */}
                  {activa && (
                    <div
                      id={`leccion-editor-${leccion.id}`}
                      className="border-t border-uva-divider bg-uva-surface-2/40 px-4 py-4"
                    >
                      <LeccionEditorPanel
                        key={leccion.id}
                        leccion={leccion}
                        cursoId={cursoId}
                        onCerrar={onCerrarEditor}
                        onGuardado={onLeccionGuardada}
                        onRecursosChange={onRecursosChange}
                        onDirtyChange={onDirtyChangeLeccion}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </SortableContext>
        </DndContext>

        {agregandoLeccion ? (
          <div className="flex flex-col gap-2 border-t border-uva-divider px-4 py-2.5 sm:flex-row sm:items-center">
            <Input
              autoFocus
              placeholder="Nombre de la lección"
              value={nombreLeccion}
              onChange={(event) => setNombreLeccion(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && handleAgregarLeccion()}
              className="h-8 text-sm sm:max-w-[280px]"
            />
            <div className="flex items-center gap-2">
              <Button type="button" size="sm" onClick={handleAgregarLeccion}>
                Agregar
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setAgregandoLeccion(false)}>
                Cancelar
              </Button>
            </div>
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
        description={
          <>
            ¿Eliminar &quot;{modulo.titulo}&quot; y todas sus lecciones? Esta acción no se puede
            deshacer.
            {modulo.estudiantesConProgreso > 0 && (
              <>
                {" "}
                <strong className="text-uva-error-text">
                  {modulo.estudiantesConProgreso === 1
                    ? "1 estudiante tiene"
                    : `${modulo.estudiantesConProgreso} estudiantes tienen`}{" "}
                  progreso guardado en estas lecciones — se perderá.
                </strong>
              </>
            )}
          </>
        }
        confirmText={modulo.titulo}
        onConfirm={handleEliminarModulo}
      />
      <ConfirmDialog
        open={borrandoLeccion !== null}
        onOpenChange={(open) => !open && setBorrandoLeccion(null)}
        title="Eliminar lección"
        description={
          <>
            ¿Eliminar &quot;{borrandoLeccion?.titulo}&quot;? Esta acción no se puede deshacer.
            {!!borrandoLeccion && borrandoLeccion.estudiantesConProgreso > 0 && (
              <>
                {" "}
                <strong className="text-uva-error-text">
                  {borrandoLeccion.estudiantesConProgreso === 1
                    ? "1 estudiante tiene"
                    : `${borrandoLeccion.estudiantesConProgreso} estudiantes tienen`}{" "}
                  progreso guardado en esta lección — se perderá.
                </strong>
              </>
            )}
          </>
        }
        confirmText={borrandoLeccion?.titulo}
        onConfirm={handleEliminarLeccion}
      />
    </AdminCard>
  );
}

/**
 * Fila de lección, ordenable por separado del módulo (dnd-kit necesita un
 * `useSortable` por elemento, y los hooks no se pueden llamar dentro de un
 * `.map`). Mismo criterio que el grip del módulo: solo el ícono de arrastre
 * dispara el drag, el resto de la fila sigue siendo tocable normalmente.
 */
function LeccionRow({
  leccion,
  activa,
  esIntroduccion,
  onSeleccionar,
  onEliminar,
}: {
  leccion: LeccionDetalle;
  activa: boolean;
  /** true en la primera lección del primer módulo: vista previa pública del curso. */
  esIntroduccion: boolean;
  onSeleccionar: () => void;
  onEliminar: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: leccion.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-[11px] border-t border-uva-divider px-4 py-[11px] hover:bg-uva-hover",
        activa && "bg-uva-hover",
      )}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label={`Reordenar la lección ${leccion.titulo}`}
        className="-m-1.5 cursor-grab touch-none p-1.5 text-uva-muted-2 active:cursor-grabbing pointer-coarse:-m-3 pointer-coarse:p-3"
      >
        <GripVertical className="size-[14px] shrink-0" strokeWidth={2} />
      </button>
      {/* El esquema no distingue tipos de lección todavía: toda lección es un
          video de Mux (id_video_mux / duracion / estado). Puramente
          decorativo — se quita en mobile junto con la duración para darle
          más aire al título, que es lo único que hace falta para elegir la
          lección; ambos siguen visibles en el editor de la derecha. */}
      <span className="hidden w-[14px] shrink-0 font-mono text-xs text-uva-muted sm:inline">
        &#9654;
      </span>
      <button
        type="button"
        onClick={onSeleccionar}
        className="flex-1 truncate text-left text-[13px] text-uva-text"
      >
        {leccion.titulo}
      </button>
      {esIntroduccion && (
        <span className="shrink-0 rounded-uva-xs bg-uva-accent-soft px-1.5 py-0.5 font-mono text-[9px] font-semibold tracking-[.1em] text-uva-accent-text uppercase">
          Introducción
        </span>
      )}
      <span className="hidden shrink-0 font-mono text-[11.5px] text-uva-muted-2 sm:inline">
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
        className="shrink-0 text-uva-muted-2 hover:text-uva-accent pointer-coarse:p-3"
        onClick={onEliminar}
      >
        <Trash2 className="size-4" />
      </Button>
    </div>
  );
}
