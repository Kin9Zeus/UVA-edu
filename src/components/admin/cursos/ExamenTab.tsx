"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronDown, GripVertical, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { useAdminToast } from "@/components/admin/Toast";
import { PreguntaEditor } from "@/components/admin/cursos/PreguntaEditor";
import { IntentoRevisionDialog } from "@/components/admin/cursos/IntentoRevisionDialog";
import { RichTextEditor } from "@/components/editor/RichTextEditor";
import { RichTextRenderer } from "@/components/editor/RichTextRenderer";
import { motivosParaNoPublicarExamen } from "@/lib/examenes/publicacion";
import {
  ETIQUETA_TIPO,
  MAXIMO_PREGUNTAS_POR_EXAMEN,
  NOTA_APROBATORIA_MINIMA,
  TIPOS_IMPLEMENTADOS,
  type PreguntaCompleta,
  type TipoPreguntaImplementado,
} from "@/lib/examenes/tipos";
import {
  actualizarConfiguracionExamen,
  actualizarPregunta,
  alternarPublicacionExamen,
  crearExamen,
  crearPregunta,
  eliminarExamen,
  eliminarPregunta,
  moverPregunta,
  otorgarIntentoExtra,
} from "@/actions/admin/examenes";
import type { EstudianteResumen, ExamenDetalle } from "@/lib/admin/examenDetalle";
import type { DocumentoContenido } from "@/lib/editor/tipos";

const ETIQUETA_ESTADO_INTENTO = {
  EN_CURSO: "En curso",
  APROBADO: "Aprobado",
  REPROBADO: "Reprobado",
  EN_REVISION: "En revisión",
} as const;

/* Estado agregado del estudiante frente al examen — mismo criterio que
   SituacionExamen (src/lib/examen.ts), calculado del lado admin para todos a
   la vez (lib/admin/examenDetalle.ts). EN_ESPERA_LARGA es la única que
   necesita una acción del admin (otorgar intento extra es opcional, no
   obligatorio: la espera se resuelve sola en 5 horas). */
const ESTADO_ESTUDIANTE_BADGE = {
  APROBADO: { tone: "success", etiqueta: "Aprobado" },
  EN_CURSO: { tone: "neutral", etiqueta: "Rindiendo ahora" },
  EN_ESPERA_LARGA: { tone: "error", etiqueta: "Agotó su tanda" },
  EN_ESPERA_CORTA: { tone: "warning", etiqueta: "En espera" },
  DISPONIBLE: { tone: "neutral", etiqueta: "Puede reintentar" },
} as const;

/**
 * Pestaña "Examen" del detalle de curso.
 *
 * Vive dentro del CMS del curso y no como sección aparte del panel porque el
 * examen es del curso: separarlo obligaría a buscar el curso dos veces para
 * armar una sola cosa.
 *
 * Un curso sin examen es el caso normal, no un estado incompleto: la pestaña
 * arranca con un vacío explicativo que deja claro que el curso certifica sin
 * examen y que crear uno es una decisión, no un paso pendiente.
 */
export function ExamenTab({
  cursoId,
  examen,
  onDirtyChange,
}: {
  cursoId: string;
  examen: ExamenDetalle | null;
  onDirtyChange: (dirty: boolean) => void;
}) {
  if (!examen) {
    return <ExamenVacio cursoId={cursoId} />;
  }
  return <ExamenExistente cursoId={cursoId} examen={examen} onDirtyChange={onDirtyChange} />;
}

function ExamenVacio({ cursoId }: { cursoId: string }) {
  const [pending, setPending] = useState(false);
  const showToast = useAdminToast();
  const router = useRouter();

  async function handleCrear() {
    setPending(true);
    const resultado = await crearExamen(cursoId);
    setPending(false);

    if (resultado.error) {
      showToast(resultado.error, "error");
      return;
    }
    showToast("Examen creado en borrador.");
    router.refresh();
  }

  return (
    <div className="max-w-[560px] rounded-uva-md border border-uva-divider bg-uva-surface p-5">
      <h2 className="font-heading text-[16.5px] font-bold tracking-[-0.02em] text-uva-text">
        Este curso no tiene examen final
      </h2>
      <p className="mt-2 text-[13.5px] leading-relaxed text-uva-muted">
        Tal como está, el estudiante completa el curso y recibe su certificado al terminar el 100% de
        las clases. Si creas un examen y lo publicas, además tendrá que aprobarlo para que el curso
        cuente como completo.
      </p>
      <p className="mt-2 text-[13px] leading-relaxed text-uva-text-faint">
        Se crea en borrador: mientras no lo publiques no le aparece a nadie ni bloquea ningún
        certificado.
      </p>
      <Button
        type="button"
        variant="primary"
        size="sm"
        className="mt-4"
        disabled={pending}
        onClick={handleCrear}
      >
        <Plus className="size-4" />
        {pending ? "Creando…" : "Crear examen final"}
      </Button>
    </div>
  );
}

function ExamenExistente({
  cursoId,
  examen,
  onDirtyChange,
}: {
  cursoId: string;
  examen: ExamenDetalle;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const [titulo, setTitulo] = useState(examen.titulo);
  const [instrucciones, setInstrucciones] = useState<DocumentoContenido | null>(examen.instrucciones);
  const [notaAprobatoria, setNotaAprobatoria] = useState(examen.notaAprobatoria);
  const [conLimiteIntentos, setConLimiteIntentos] = useState(examen.intentosMaximos !== null);
  const [intentosMaximos, setIntentosMaximos] = useState(examen.intentosMaximos ?? 3);
  const [conTiempo, setConTiempo] = useState(examen.minutosLimite !== null);
  const [minutosLimite, setMinutosLimite] = useState(examen.minutosLimite ?? 30);
  const [aleatorizarPreguntas, setAleatorizarPreguntas] = useState(examen.aleatorizarPreguntas);
  const [aleatorizarOpciones, setAleatorizarOpciones] = useState(examen.aleatorizarOpciones);

  const [preguntas, setPreguntas] = useState(examen.preguntas);
  const [preguntaAbiertaId, setPreguntaAbiertaId] = useState<string | null>(null);
  const [preguntaSinGuardar, setPreguntaSinGuardar] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialogEliminarExamen, setDialogEliminarExamen] = useState(false);
  const [preguntaAEliminar, setPreguntaAEliminar] = useState<string | null>(null);
  const [estudianteAbiertoId, setEstudianteAbiertoId] = useState<string | null>(null);
  const [intentoRevisionId, setIntentoRevisionId] = useState<string | null>(null);

  const showToast = useAdminToast();
  const router = useRouter();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
  );

  // Se recalcula con los valores en vivo, no con los del servidor: el admin
  // tiene que ver desaparecer el motivo en cuanto lo corrige. El servidor
  // aplica la misma regla al publicar (alternarPublicacionExamen).
  const motivosSinPublicar = motivosParaNoPublicarExamen({
    titulo,
    notaAprobatoria,
    preguntas: preguntas.map((pregunta) => ({ tipo: pregunta.tipo, puntos: pregunta.puntos })),
  });
  const bloqueadoParaPublicar = motivosSinPublicar.length > 0 && !examen.publicado;
  const puntosTotales = preguntas.reduce((suma, pregunta) => suma + pregunta.puntos, 0);

  function marcarPreguntaSucia(dirty: boolean) {
    setPreguntaSinGuardar(dirty);
    onDirtyChange(dirty);
  }

  async function handleGuardarConfiguracion() {
    setPending(true);
    setError(null);
    const resultado = await actualizarConfiguracionExamen(examen.id, cursoId, {
      titulo,
      instrucciones,
      notaAprobatoria,
      intentosMaximos: conLimiteIntentos ? intentosMaximos : null,
      minutosLimite: conTiempo ? minutosLimite : null,
      aleatorizarPreguntas,
      aleatorizarOpciones,
    });
    setPending(false);

    if (resultado.error) {
      setError(resultado.error);
      return;
    }
    showToast("Configuración del examen guardada.");
    router.refresh();
  }

  async function handlePublicar(publicado: boolean) {
    setPending(true);
    setError(null);
    const resultado = await alternarPublicacionExamen(examen.id, cursoId, publicado);
    setPending(false);

    if (resultado.error) {
      setError(resultado.error);
      return;
    }
    showToast(
      publicado
        ? "Examen publicado. A partir de ahora es obligatorio para certificar este curso."
        : "Examen despublicado. El curso vuelve a certificar solo con las clases.",
    );
    router.refresh();
  }

  async function handleAgregarPregunta(tipo: TipoPreguntaImplementado) {
    setPending(true);
    const resultado = await crearPregunta(examen.id, cursoId, tipo);
    setPending(false);

    if (resultado.error) {
      showToast(resultado.error, "error");
      return;
    }
    // Se abre de una: una pregunta recién creada está vacía y no sirve de nada
    // hasta que se le escriba el enunciado.
    if (resultado.id) setPreguntaAbiertaId(resultado.id);
    router.refresh();
  }

  async function handleGuardarPregunta(
    preguntaId: string,
    cambios: Parameters<typeof actualizarPregunta>[2],
  ) {
    setPending(true);
    const resultado = await actualizarPregunta(preguntaId, cursoId, cambios);
    setPending(false);

    if (resultado.error) {
      showToast(resultado.error, "error");
      return;
    }
    marcarPreguntaSucia(false);
    setPreguntas((actuales) =>
      actuales.map((pregunta) =>
        pregunta.id === preguntaId ? { ...pregunta, ...cambios } : pregunta,
      ),
    );
    showToast("Pregunta guardada.");
    router.refresh();
  }

  async function handleEliminarPregunta(preguntaId: string) {
    setPending(true);
    const resultado = await eliminarPregunta(preguntaId, cursoId);
    setPending(false);
    setPreguntaAEliminar(null);

    if (resultado.error) {
      showToast(resultado.error, "error");
      return;
    }
    marcarPreguntaSucia(false);
    setPreguntaAbiertaId(null);
    setPreguntas((actuales) => actuales.filter((pregunta) => pregunta.id !== preguntaId));
    showToast("Pregunta eliminada.");
    router.refresh();
  }

  async function handleEliminarExamen() {
    setPending(true);
    const resultado = await eliminarExamen(examen.id, cursoId);
    setPending(false);
    setDialogEliminarExamen(false);

    if (resultado.error) {
      setError(resultado.error);
      return;
    }
    showToast("Examen eliminado.");
    router.refresh();
  }

  async function handleOtorgarIntentoExtra(usuarioId: string) {
    setPending(true);
    const resultado = await otorgarIntentoExtra(examen.id, cursoId, usuarioId);
    setPending(false);

    if (resultado.error) {
      showToast(resultado.error, "error");
      return;
    }
    showToast("Intento extra otorgado. El estudiante ya puede volver a presentar el examen.");
    router.refresh();
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const anteriores = preguntas;
    const origen = preguntas.findIndex((pregunta) => pregunta.id === active.id);
    const destino = preguntas.findIndex((pregunta) => pregunta.id === over.id);
    if (origen === -1 || destino === -1) return;

    // Optimista: se reordena en pantalla y se revierte si el servidor falla —
    // mismo criterio que el reordenamiento de módulos y lecciones.
    const reordenadas = arrayMove(preguntas, origen, destino);
    setPreguntas(reordenadas);

    const idAnterior = destino > 0 ? reordenadas[destino - 1].id : null;
    const idSiguiente = destino < reordenadas.length - 1 ? reordenadas[destino + 1].id : null;

    const resultado = await moverPregunta(
      examen.id,
      cursoId,
      String(active.id),
      idAnterior,
      idSiguiente,
    );

    if (resultado.error) {
      setPreguntas(anteriores);
      showToast(resultado.error, "error");
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      {error && (
        <div
          role="alert"
          className="max-w-[640px] rounded-uva-md bg-uva-error-soft px-3.5 py-2.5 text-sm text-uva-error-text"
        >
          {error}
        </div>
      )}

      {/* ---------------- Publicación ---------------- */}
      <section className="max-w-[640px] rounded-uva-md border border-uva-divider bg-uva-surface p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2.5">
              <p className="text-sm font-semibold text-uva-text">Examen obligatorio</p>
              <StatusBadge tone={examen.publicado ? "success" : "neutral"}>
                {examen.publicado ? "Publicado" : "Borrador"}
              </StatusBadge>
            </div>
            <p className="mt-1 text-xs text-uva-text-faint">
              {examen.publicado
                ? "Los estudiantes deben aprobarlo para completar el curso y recibir certificado."
                : "Mientras esté en borrador, el curso certifica solo con el 100% de las clases."}
            </p>
          </div>
          <Switch
            checked={examen.publicado}
            onCheckedChange={handlePublicar}
            disabled={pending || bloqueadoParaPublicar}
            aria-label="Examen obligatorio"
            aria-describedby={bloqueadoParaPublicar ? "examen-bloqueo-publicacion" : undefined}
          />
        </div>

        {bloqueadoParaPublicar && (
          <div id="examen-bloqueo-publicacion" className="mt-3 rounded-uva-md bg-uva-surface-2 px-3.5 py-2.5">
            <p className="text-xs font-semibold text-uva-text">Falta esto para poder publicarlo:</p>
            <ul className="mt-1.5 flex list-disc flex-col gap-1 pl-4 text-xs text-uva-muted">
              {motivosSinPublicar.map((motivo) => (
                <li key={motivo}>{motivo}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Despublicar no revoca certificados ya emitidos (Revf3) — se dice
            explícito porque es justo lo que un admin teme al apagar esto. */}
        {examen.publicado && examen.aprobados > 0 && (
          <p className="mt-3 text-xs text-uva-muted">
            {examen.aprobados}{" "}
            {examen.aprobados === 1 ? "estudiante ya lo aprobó" : "estudiantes ya lo aprobaron"}. Si lo
            despublicas conservan su certificado; solo deja de exigirse a quien venga después.
          </p>
        )}
      </section>

      {/* ---------------- Configuración ---------------- */}
      <section className="flex max-w-[640px] flex-col gap-4">
        <h2 className="font-heading text-[15px] font-bold tracking-[-0.02em] text-uva-text">
          Configuración
        </h2>

        <div>
          <Label htmlFor="examen-titulo">Título del examen</Label>
          <Input
            id="examen-titulo"
            value={titulo}
            onChange={(event) => setTitulo(event.target.value)}
            maxLength={200}
          />
        </div>

        <div>
          <Label htmlFor="examen-instrucciones">Instrucciones para el estudiante</Label>
          <p className="mt-0.5 mb-1.5 text-xs text-uva-text-faint">
            Se muestran en la pantalla previa, antes de que inicie el intento.
          </p>
          <div className="rounded-uva-md border border-uva-divider bg-uva-surface">
            <RichTextEditor
              initialContent={instrucciones}
              onChange={setInstrucciones}
              placeholder="Lee cada pregunta con atención…"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-4">
          <div className="w-[150px]">
            <Label htmlFor="examen-nota">Nota para aprobar</Label>
            <div className="flex items-center gap-2">
              <Input
                id="examen-nota"
                type="number"
                min={NOTA_APROBATORIA_MINIMA}
                max={100}
                value={notaAprobatoria}
                onChange={(event) => setNotaAprobatoria(Number(event.target.value))}
              />
              <span className="text-sm text-uva-muted">%</span>
            </div>
            <p className="mt-1 text-xs text-uva-text-faint">
              Mínimo {NOTA_APROBATORIA_MINIMA}%.
            </p>
          </div>

          <div className="w-[150px]">
            <Label htmlFor="examen-intentos">Intentos permitidos</Label>
            <Input
              id="examen-intentos"
              type="number"
              min={1}
              max={20}
              value={intentosMaximos}
              disabled={!conLimiteIntentos}
              onChange={(event) => setIntentosMaximos(Number(event.target.value))}
            />
            <label className="mt-1.5 flex items-center gap-2 text-xs text-uva-muted">
              <input
                type="checkbox"
                checked={!conLimiteIntentos}
                onChange={(event) => setConLimiteIntentos(!event.target.checked)}
                className="size-3.5 accent-uva-accent"
              />
              Sin límite
            </label>
          </div>

          <div className="w-[150px]">
            <Label htmlFor="examen-minutos">Tiempo límite (min)</Label>
            <Input
              id="examen-minutos"
              type="number"
              min={1}
              max={1440}
              value={minutosLimite}
              disabled={!conTiempo}
              onChange={(event) => setMinutosLimite(Number(event.target.value))}
            />
            <label className="mt-1.5 flex items-center gap-2 text-xs text-uva-muted">
              <input
                type="checkbox"
                checked={!conTiempo}
                onChange={(event) => setConTiempo(!event.target.checked)}
                className="size-3.5 accent-uva-accent"
              />
              Sin límite
            </label>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-uva-text">Barajar preguntas</p>
            <p className="text-xs text-uva-text-faint">Cada estudiante las ve en distinto orden.</p>
          </div>
          <Switch
            checked={aleatorizarPreguntas}
            onCheckedChange={setAleatorizarPreguntas}
            aria-label="Barajar preguntas"
          />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-uva-text">Barajar opciones</p>
            <p className="text-xs text-uva-text-faint">
              El orden de las respuestas cambia en cada intento.
            </p>
          </div>
          <Switch
            checked={aleatorizarOpciones}
            onCheckedChange={setAleatorizarOpciones}
            aria-label="Barajar opciones"
          />
        </div>

        <Button
          type="button"
          variant="primary"
          size="sm"
          className="w-fit"
          disabled={pending}
          onClick={handleGuardarConfiguracion}
        >
          {pending ? "Guardando…" : "Guardar configuración"}
        </Button>
      </section>

      {/* ---------------- Preguntas ---------------- */}
      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-heading text-[15px] font-bold tracking-[-0.02em] text-uva-text">
            Preguntas
          </h2>
          <p className="text-xs text-uva-text-faint">
            {preguntas.length} {preguntas.length === 1 ? "pregunta" : "preguntas"} · {puntosTotales}{" "}
            {puntosTotales === 1 ? "punto" : "puntos"} en total
          </p>
        </div>

        {/* El aviso de navegación (useAvisoNavegacionSinGuardar, en
            CursoDetalleView) ya bloquea salir de la pantalla, pero no se ve
            hasta que se intenta salir: esto lo hace visible mientras se edita. */}
        {preguntaSinGuardar && (
          <p role="status" className="text-xs text-uva-warn">
            Tienes cambios sin guardar en una pregunta.
          </p>
        )}

        {preguntas.length === 0 ? (
          <p className="rounded-uva-md border border-dashed border-uva-divider px-4 py-6 text-center text-[13.5px] text-uva-text-faint">
            Todavía no hay preguntas. Agrega la primera con los botones de abajo.
          </p>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext
              items={preguntas.map((pregunta) => pregunta.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="flex flex-col gap-2.5">
                {preguntas.map((pregunta, indice) => (
                  <PreguntaFila
                    key={pregunta.id}
                    pregunta={pregunta}
                    numero={indice + 1}
                    abierta={preguntaAbiertaId === pregunta.id}
                    pending={pending}
                    onAbrir={() =>
                      setPreguntaAbiertaId((actual) => (actual === pregunta.id ? null : pregunta.id))
                    }
                    onGuardar={(cambios) => handleGuardarPregunta(pregunta.id, cambios)}
                    onEliminar={() => setPreguntaAEliminar(pregunta.id)}
                    onDirtyChange={marcarPreguntaSucia}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}

        {preguntas.length < MAXIMO_PREGUNTAS_POR_EXAMEN && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-uva-text-faint">Agregar:</span>
            {TIPOS_IMPLEMENTADOS.map((tipo) => (
              <Button
                key={tipo}
                type="button"
                variant="ghost"
                size="sm"
                disabled={pending}
                onClick={() => handleAgregarPregunta(tipo)}
              >
                <Plus className="size-4" />
                {ETIQUETA_TIPO[tipo]}
              </Button>
            ))}
          </div>
        )}
      </section>

      {/* ---------------- Estudiantes ---------------- */}
      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-[15px] font-bold tracking-[-0.02em] text-uva-text">
          Estudiantes
        </h2>

        {examen.estudiantes.length === 0 ? (
          <p className="text-[13.5px] text-uva-text-faint">Nadie ha presentado este examen todavía.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {examen.estudiantes.map((estudiante) => (
              <EstudianteFila
                key={estudiante.usuarioId}
                estudiante={estudiante}
                intentosMaximos={examen.intentosMaximos}
                expandido={estudianteAbiertoId === estudiante.usuarioId}
                pending={pending}
                onAbrir={() =>
                  setEstudianteAbiertoId((actual) =>
                    actual === estudiante.usuarioId ? null : estudiante.usuarioId,
                  )
                }
                onOtorgarIntentoExtra={() => handleOtorgarIntentoExtra(estudiante.usuarioId)}
                onVerRevision={setIntentoRevisionId}
              />
            ))}
          </div>
        )}
      </section>

      <IntentoRevisionDialog intentoId={intentoRevisionId} onClose={() => setIntentoRevisionId(null)} />

      {/* ---------------- Zona peligrosa ---------------- */}
      <section className="max-w-[640px]">
        <Button
          type="button"
          variant="destructive"
          size="sm"
          disabled={pending}
          onClick={() => setDialogEliminarExamen(true)}
        >
          Eliminar examen
        </Button>
        <p className="mt-1.5 text-xs text-uva-text-faint">
          Solo si nadie lo ha presentado todavía. Si ya hay intentos, despublícalo en vez de borrarlo.
        </p>
      </section>

      <ConfirmDialog
        open={dialogEliminarExamen}
        onOpenChange={setDialogEliminarExamen}
        title="Eliminar el examen final"
        description={
          <>
            Se borran también sus {preguntas.length}{" "}
            {preguntas.length === 1 ? "pregunta" : "preguntas"}. El curso volverá a certificar solo
            con el 100% de las clases. Esta acción no se puede deshacer.
          </>
        }
        confirmLabel="Eliminar examen"
        onConfirm={handleEliminarExamen}
      />

      <ConfirmDialog
        open={preguntaAEliminar !== null}
        onOpenChange={(open) => !open && setPreguntaAEliminar(null)}
        title="Eliminar la pregunta"
        description="Los intentos ya presentados conservan la pregunta tal como se la mostraron al estudiante; solo desaparece de los intentos futuros."
        confirmLabel="Eliminar pregunta"
        onConfirm={async () => {
          if (preguntaAEliminar) await handleEliminarPregunta(preguntaAEliminar);
        }}
      />
    </div>
  );
}

/**
 * Fila arrastrable de una pregunta, con el editor colapsable debajo.
 * Componente aparte porque `useSortable` es un hook y no se puede llamar
 * dentro del `.map()` del padre — mismo motivo que la fila de lección en
 * ModuloCard.
 */
function PreguntaFila({
  pregunta,
  numero,
  abierta,
  pending,
  onAbrir,
  onGuardar,
  onEliminar,
  onDirtyChange,
}: {
  pregunta: PreguntaCompleta;
  numero: number;
  abierta: boolean;
  pending: boolean;
  onAbrir: () => void;
  onGuardar: (cambios: Parameters<typeof actualizarPregunta>[2]) => Promise<void>;
  onEliminar: () => void;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: pregunta.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };

  const sinEnunciado = !pregunta.enunciado.content?.length;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="rounded-uva-md border border-uva-divider bg-uva-surface"
    >
      <div className="flex items-center gap-2.5 px-3.5 py-2.5">
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label={`Reordenar la pregunta ${numero}`}
          className="cursor-grab text-uva-text-faint hover:text-uva-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-uva-accent"
        >
          <GripVertical className="size-4" />
        </button>

        <button
          type="button"
          onClick={onAbrir}
          aria-expanded={abierta}
          className="flex min-w-0 flex-1 items-center gap-2.5 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-uva-accent"
        >
          <span className="shrink-0 font-mono text-[12px] text-uva-text-faint">{numero}.</span>
          <span className="min-w-0 flex-1 truncate text-[13.5px] text-uva-text">
            {sinEnunciado ? (
              <span className="text-uva-text-faint italic">Pregunta sin enunciado</span>
            ) : (
              <RichTextRenderer contenido={pregunta.enunciado} className="[&_p]:!m-0 [&_p]:truncate" />
            )}
          </span>
          <span className="hidden shrink-0 text-xs text-uva-text-faint sm:inline">
            {ETIQUETA_TIPO[pregunta.tipo]}
          </span>
          <span className="shrink-0 font-mono text-xs text-uva-text-faint">
            {pregunta.puntos} {pregunta.puntos === 1 ? "pt" : "pts"}
          </span>
          <ChevronDown
            className={`size-4 shrink-0 text-uva-text-faint transition-transform ${abierta ? "rotate-180" : ""}`}
          />
        </button>
      </div>

      {abierta && (
        <div className="border-t border-uva-divider p-3.5">
          <PreguntaEditor
            pregunta={pregunta}
            numero={numero}
            pending={pending}
            onGuardar={onGuardar}
            onEliminar={onEliminar}
            onDirtyChange={onDirtyChange}
          />
        </div>
      )}
    </div>
  );
}

/**
 * Fila colapsable de un estudiante en la sección "Estudiantes" del examen:
 * un resumen (mejor puntaje, estado actual) y, al expandir, la lista de
 * TODOS sus intentos con acceso a la revisión pregunta por pregunta de cada
 * uno. Reemplaza la tabla plana de intentos (una fila por intento, nombre
 * repetido) — acá el estudiante es la unidad, sus intentos son su historial.
 */
function EstudianteFila({
  estudiante,
  intentosMaximos,
  expandido,
  pending,
  onAbrir,
  onOtorgarIntentoExtra,
  onVerRevision,
}: {
  estudiante: EstudianteResumen;
  intentosMaximos: number | null;
  expandido: boolean;
  pending: boolean;
  onAbrir: () => void;
  onOtorgarIntentoExtra: () => void;
  onVerRevision: (intentoId: string) => void;
}) {
  const badge = ESTADO_ESTUDIANTE_BADGE[estudiante.estado];

  return (
    <div className="rounded-uva-md border border-uva-divider bg-uva-surface">
      <button
        type="button"
        onClick={onAbrir}
        aria-expanded={expandido}
        className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-uva-accent"
      >
        <span className="min-w-0 flex-1 truncate text-[13.5px] text-uva-text">{estudiante.nombre}</span>
        <span className="shrink-0 font-mono text-xs text-uva-text-faint">
          {estudiante.intentos.length} {estudiante.intentos.length === 1 ? "intento" : "intentos"}
        </span>
        <span className="shrink-0 font-mono text-xs text-uva-muted">
          {estudiante.mejorPuntaje === null ? "—" : `mejor: ${estudiante.mejorPuntaje}%`}
        </span>
        <StatusBadge tone={badge.tone} className="shrink-0">
          {badge.etiqueta}
        </StatusBadge>
        <ChevronDown
          className={`size-4 shrink-0 text-uva-text-faint transition-transform ${expandido ? "rotate-180" : ""}`}
        />
      </button>

      {expandido && (
        <div className="border-t border-uva-divider">
          {estudiante.estado === "EN_ESPERA_LARGA" && (
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-uva-divider bg-uva-warning-soft px-3.5 py-2.5">
              <p className="text-[12.5px] text-uva-text">
                Agotó sus {intentosMaximos} intentos sin aprobar. Se le habilita una tanda nueva sola
                cuando pase la espera larga — o puedes saltártela.
              </p>
              <Button
                type="button"
                variant="default"
                size="sm"
                disabled={pending}
                onClick={onOtorgarIntentoExtra}
              >
                Dar un intento extra
              </Button>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-left text-[13px]">
              <thead className="bg-uva-surface-2 text-uva-muted">
                <tr>
                  <th scope="col" className="px-3.5 py-2 font-semibold">Intento</th>
                  <th scope="col" className="px-3.5 py-2 font-semibold">Estado</th>
                  <th scope="col" className="px-3.5 py-2 font-semibold">Puntaje</th>
                  <th scope="col" className="px-3.5 py-2 font-semibold">Fecha</th>
                  <th scope="col" className="px-3.5 py-2 font-semibold sr-only">Revisión</th>
                </tr>
              </thead>
              <tbody>
                {estudiante.intentos.map((intento) => (
                  <tr key={intento.id} className="border-t border-uva-divider">
                    <td className="px-3.5 py-2 font-mono text-uva-muted">
                      {intento.numeroIntento} de {intentosMaximos ?? "∞"}
                    </td>
                    <td className="px-3.5 py-2">
                      <StatusBadge
                        tone={
                          intento.estado === "APROBADO"
                            ? "success"
                            : intento.estado === "REPROBADO"
                              ? "error"
                              : "neutral"
                        }
                      >
                        {ETIQUETA_ESTADO_INTENTO[intento.estado]}
                      </StatusBadge>
                    </td>
                    <td className="px-3.5 py-2 font-mono text-uva-muted">
                      {intento.puntajePct === null ? "—" : `${intento.puntajePct}%`}
                    </td>
                    <td className="px-3.5 py-2 text-uva-muted">
                      {new Date(intento.finalizadoEn ?? intento.iniciadoEn).toLocaleDateString("es-CO")}
                    </td>
                    <td className="px-3.5 py-2 text-right">
                      {intento.estado !== "EN_CURSO" && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => onVerRevision(intento.id)}
                        >
                          Ver revisión
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
