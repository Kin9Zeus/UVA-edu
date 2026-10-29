"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { GripVertical, Pencil, Plus, Trash2 } from "lucide-react";
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
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
import { BotonesMover, CLASE_RECIEN_MOVIDO, useRecienMovido } from "@/components/admin/BotonesMover";
import { moverA } from "@/lib/admin/reordenar";
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
/** D1 (docs/notas-leccion.md): borrar la lección borra también las notas privadas de los estudiantes. */
function avisoNotas(estudiantes: number, donde: string): string {
  return `${estudiantes === 1 ? "1 estudiante tiene" : `${estudiantes} estudiantes tienen`} notas personales en ${donde} — se eliminarán.`;
}

export function ModuloCard({
  modulo,
  posicion,
  totalModulos,
  recienMovido,
  onMover,
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
  totalModulos: number;
  /** Se acaba de mover con subir/bajar o arrastrando: resalta la cabecera. */
  recienMovido: boolean;
  /** Mueve el módulo a la posición `destino` (0..N-1). Lo resuelve ContenidoTab. */
  onMover: (destino: number) => void;
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
  const [leccionMovidaId, marcarLeccionMovida] = useRecienMovido();

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
    const resultado = await eliminarModulo(modulo.id);
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
        estudiantesConNotas: 0,
        terminaron: 0,
        seQuedaron: 0,
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

  // Arrastre y botones subir/bajar terminan aquí: los dos guardan igual.
  async function moverLeccionA(leccionId: string, destino: number) {
    const movimiento = moverA(lecciones, leccionId, destino);
    if (!movimiento) return;
    if (!(await confirmarSalirSinGuardar())) return;

    const anteriores = lecciones;
    onLeccionesChange(modulo.id, movimiento.lista);
    marcarLeccionMovida(leccionId);

    const resultado = await moverLeccion(
      cursoId,
      modulo.id,
      leccionId,
      movimiento.idAnterior,
      movimiento.idSiguiente,
    );
    if (resultado.error) {
      showToast(resultado.error, "error");
      // Reversión visible: el servidor no guardó el nuevo orden, así que
      // la lista vuelve a como estaba antes del movimiento.
      onLeccionesChange(modulo.id, anteriores);
      return;
    }
    showToast(`Lección movida a la posición ${destino + 1} de ${movimiento.lista.length}.`);
  }

  function handleLeccionDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    moverLeccionA(String(active.id), lecciones.findIndex((leccion) => leccion.id === over.id));
  }

  return (
    <AdminCard flush ref={setModuloNodeRef} style={moduloStyle}>
      {/* Franja de cabecera del módulo: `background:var(--surface-2)`. En
          celular los botones bajan a su propia línea antes de apretar el
          título (flex-wrap + min-w del título). */}
      <div
        className={cn(
          "flex flex-wrap items-center gap-x-2.5 gap-y-1 bg-uva-surface-2 px-4 py-2 transition-colors duration-700 motion-reduce:transition-none",
          recienMovido && CLASE_RECIEN_MOVIDO,
        )}
      >
        {/* El asa es el único punto de arrastre (no la tarjeta entera): así
            el resto de la cabecera sigue siendo tocable sin competir con el
            gesto. `touch-action:none` evita que el navegador tome el primer
            roce como scroll antes de que la pulsación larga active el
            arrastre. En celular se oculta: subir/bajar hacen lo mismo con un
            toque. */}
        <button
          type="button"
          {...moduloAttributes}
          {...moduloListeners}
          aria-label={`Arrastrar el módulo ${modulo.titulo}`}
          className="-m-1.5 cursor-grab touch-none p-1.5 text-uva-muted-2 active:cursor-grabbing max-sm:hidden pointer-coarse:-m-3 pointer-coarse:p-3"
        >
          <GripVertical className="size-4 shrink-0" strokeWidth={2} />
        </button>
        {/* Índice del curso: aquí el orden es el contenido de la pantalla,
            así que el número es información (cambia al mover). */}
        <span className="w-6 shrink-0 font-mono text-uva-detalle font-bold text-uva-accent-text tabular-nums">
          {String(posicion).padStart(2, "0")}
        </span>
        <div className="min-w-40 flex-1">
          {editandoTitulo ? (
            <Input
              autoFocus
              aria-label="Nombre del módulo"
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
              className="max-w-[320px] font-bold"
            />
          ) : (
            <span className="text-uva-detalle font-bold text-uva-text">{modulo.titulo}</span>
          )}
        </div>
        <div className="ml-auto flex items-center gap-1">
          <BotonesMover
            nombre={`el módulo ${modulo.titulo}`}
            posicion={posicion - 1}
            total={totalModulos}
            onMover={onMover}
          />
          {!editandoTitulo && (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`Renombrar el módulo ${modulo.titulo}`}
              title="Renombrar módulo"
              className="text-uva-muted-2 hover:text-uva-accent-ink"
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
            aria-label={`Eliminar el módulo ${modulo.titulo}`}
            title="Eliminar módulo"
            className="text-uva-muted-2 hover:text-uva-error-text"
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
                    indice={`${posicion}.${index + 1}`}
                    posicion={index}
                    total={lecciones.length}
                    recienMovida={leccionMovidaId === leccion.id}
                    onMover={(destino) => moverLeccionA(leccion.id, destino)}
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
              aria-label="Nombre de la lección"
              className="sm:max-w-[280px]"
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
            className="flex min-h-11 w-full items-center gap-2 border-t border-uva-divider px-4 text-left text-uva-detalle text-uva-muted hover:bg-uva-hover hover:text-uva-text sm:pointer-fine:min-h-9"
          >
            <Plus className="size-4" aria-hidden="true" />
            Añadir lección
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
            {modulo.lecciones.some((leccion) => leccion.idVideoMux) && " Sus videos también se borrarán de Mux."}
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
            {modulo.estudiantesConNotas > 0 && (
              <>
                {" "}
                <strong className="text-uva-error-text">
                  {avisoNotas(modulo.estudiantesConNotas, "estas lecciones")}
                </strong>
              </>
            )}
          </>
        }
        confirmText={modulo.titulo}
        confirmLabel="Eliminar módulo"
        destructive
        onConfirm={handleEliminarModulo}
      />
      <ConfirmDialog
        open={borrandoLeccion !== null}
        onOpenChange={(open) => !open && setBorrandoLeccion(null)}
        title="Eliminar lección"
        description={
          <>
            ¿Eliminar &quot;{borrandoLeccion?.titulo}&quot;? Esta acción no se puede deshacer.
            {borrandoLeccion?.idVideoMux && " Su video también se borrará de Mux."}
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
            {!!borrandoLeccion && borrandoLeccion.estudiantesConNotas > 0 && (
              <>
                {" "}
                <strong className="text-uva-error-text">
                  {avisoNotas(borrandoLeccion.estudiantesConNotas, "esta lección")}
                </strong>
              </>
            )}
          </>
        }
        confirmText={borrandoLeccion?.titulo}
        confirmLabel="Eliminar lección"
        destructive
        onConfirm={handleEliminarLeccion}
      />
    </AdminCard>
  );
}

/**
 * Fila de lección, ordenable por separado del módulo (dnd-kit necesita un
 * `useSortable` por elemento, y los hooks no se pueden llamar dentro de un
 * `.map`). Mismo criterio que el asa del módulo: solo el asa dispara el
 * arrastre, y subir/bajar hacen lo mismo con un toque o con teclado.
 */
function LeccionRow({
  leccion,
  indice,
  posicion,
  total,
  recienMovida,
  onMover,
  activa,
  esIntroduccion,
  onSeleccionar,
  onEliminar,
}: {
  leccion: LeccionDetalle;
  /** "2.3": módulo y lección. */
  indice: string;
  posicion: number;
  total: number;
  recienMovida: boolean;
  onMover: (destino: number) => void;
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
        // En celular, dos líneas: número y título arriba (el título se lleva
        // todo el ancho), insignias y botones abajo. En una sola, los tres
        // botones de 44 px dejaban el título en una columna de 80 px.
        "flex flex-wrap items-center gap-x-2.5 border-t border-uva-divider py-1.5 pr-2 pl-4 transition-colors duration-700 hover:bg-uva-hover motion-reduce:transition-none",
        activa && "bg-uva-hover",
        recienMovida && CLASE_RECIEN_MOVIDO,
      )}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label={`Arrastrar la lección ${leccion.titulo}`}
        className="-m-1.5 cursor-grab touch-none p-1.5 text-uva-muted-2 active:cursor-grabbing max-sm:hidden pointer-coarse:-m-3 pointer-coarse:p-3"
      >
        <GripVertical className="size-4 shrink-0" strokeWidth={2} />
      </button>
      <span className="w-8 shrink-0 font-mono text-uva-etiqueta text-uva-muted tabular-nums">{indice}</span>
      <button
        type="button"
        onClick={onSeleccionar}
        aria-expanded={activa}
        className="min-h-11 min-w-0 flex-1 text-left text-uva-detalle text-uva-text max-sm:basis-[calc(100%-2.625rem)] sm:pointer-fine:min-h-9"
      >
        {leccion.titulo}
      </button>
      <span className="flex shrink-0 items-center gap-2 max-sm:pl-[2.625rem]">
        {/* Vista previa pública del curso: el que lo arma necesita saber
            cuál es antes de subir el video. */}
        {esIntroduccion && <StatusBadge tone="accent">Introducción</StatusBadge>}
        {/* Sin video todavía no hay duración: la insignia de estado ya lo
            dice, un "—" no agrega nada. */}
        {leccion.duracion ? (
          <span className="font-mono text-uva-etiqueta text-uva-muted-2 tabular-nums">
            {formatDuracion(leccion.duracion)}
          </span>
        ) : null}
        <StatusBadge tone={ESTADO_TONO[leccion.estadoProcesamiento]}>
          {ESTADO_LABEL[leccion.estadoProcesamiento]}
        </StatusBadge>
      </span>
      <div className="ml-auto flex shrink-0 items-center gap-1">
        <BotonesMover
          nombre={`la lección ${leccion.titulo}`}
          posicion={posicion}
          total={total}
          onMover={onMover}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={`Eliminar la lección ${leccion.titulo}`}
          title="Eliminar lección"
          className="text-uva-muted-2 hover:text-uva-error-text"
          onClick={onEliminar}
        >
          <Trash2 className="size-4" />
        </Button>
      </div>
    </div>
  );
}
