"use client";

import { useCallback, useRef, useState } from "react";
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
import { SortableContext, arrayMove, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAdminToast } from "@/components/admin/Toast";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { ModuloCard } from "@/components/admin/cursos/ModuloCard";
import { crearModulo, moverModulo } from "@/actions/admin/cursos";
import type { ModuloDetalle, LeccionDetalle, RecursoDetalle } from "@/lib/admin/cursoDetalle";

/**
 * Pestaña Contenido del panel admin.
 *
 * Deviación deliberada del mockup (`design-spec/project/Uva - Panel
 * Admin.dc.html`, líneas 255-286: dos columnas, la derecha una columna
 * sticky de 260-340px con el editor): acá el editor de una lección se abre
 * EN LÍNEA, justo debajo de su fila dentro de su propio módulo — ver
 * ModuloCard.tsx — y no en un panel aparte. El editor de texto enriquecido
 * quedaba ilegible a 300px de ancho; ver también el comentario de
 * LeccionEditorPanel.tsx.
 *
 * La lección elegida vive en este componente (no en ModuloCard) para que la
 * fila de la lista y el editor miren siempre el mismo dato, y para que solo
 * pueda haber una lección abierta a la vez entre todos los módulos.
 */
export function ContenidoTab({
  cursoId,
  modulosIniciales,
  onDirtyChange,
}: {
  cursoId: string;
  modulosIniciales: ModuloDetalle[];
  /** Avisa a CursoDetalleView cuando hay una lección con cambios sin
   * guardar, para que también bloquee la navegación fuera de la pantalla
   * (Volver a cursos, menú lateral) — no solo el cambio de lección dentro
   * de esta pestaña. */
  onDirtyChange: (dirty: boolean) => void;
}) {
  const [modulos, setModulos] = useState(modulosIniciales);
  const [leccionActivaId, setLeccionActivaId] = useState<string | null>(null);
  const [agregando, setAgregando] = useState(false);
  const [nombreModulo, setNombreModulo] = useState("");
  const [pending, setPending] = useState(false);
  // PointerSensor cubre mouse (mismo gesto de siempre: clic y arrastra desde
  // el grip). TouchSensor exige mantener presionado 200ms antes de activar
  // el arrastre — sin ese delay, el primer roce con el dedo se interpretaría
  // como el inicio de un drag en vez de scroll de la página.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
  );
  // Reportado por LeccionEditorPanel (onDirtyChange): si hay título/duración/
  // resumen sin guardar, cambiar de lección o cerrar el editor los pierde en
  // silencio. Con esto se confirma antes en vez de después.
  const [edicionSinGuardar, setEdicionSinGuardar] = useState(false);
  // Diálogo propio para reemplazar el window.confirm() nativo del navegador
  // (que aparecía como "localhost:3000 dice" en vez de un modal de la app).
  // confirmarSalirSinGuardar() es la única llamadora: cuando no hay nada sin
  // guardar resuelve `true` de inmediato; si hay, abre el diálogo y deja la
  // resolución de la promesa pendiente en resolverSalirRef hasta que el
  // usuario elija un botón.
  const [dialogSalirAbierto, setDialogSalirAbierto] = useState(false);
  const resolverSalirRef = useRef<((continuar: boolean) => void) | null>(null);
  const showToast = useAdminToast();
  const router = useRouter();

  const handleDirtyChange = useCallback(
    (dirty: boolean) => {
      setEdicionSinGuardar(dirty);
      onDirtyChange(dirty);
    },
    [onDirtyChange],
  );

  function confirmarSalirSinGuardar(): Promise<boolean> {
    if (!edicionSinGuardar) return Promise.resolve(true);
    return new Promise((resolve) => {
      resolverSalirRef.current = resolve;
      setDialogSalirAbierto(true);
    });
  }

  function resolverDialogSalir(continuar: boolean) {
    setDialogSalirAbierto(false);
    // Si acepta descartar, se limpia ya: algunos llamadores (crear/renombrar/
    // eliminar módulo o lección) terminan en router.refresh(), que remonta
    // este panel sin volver a pasar por seleccionarLeccion()/cerrarEditor()
    // — sin esto el aviso quedaría prendido de por vida aunque ya no haya
    // nada sin guardar.
    if (continuar) {
      setEdicionSinGuardar(false);
      onDirtyChange(false);
    }
    resolverSalirRef.current?.(continuar);
    resolverSalirRef.current = null;
  }

  async function seleccionarLeccion(leccion: LeccionDetalle) {
    if (leccion.id === leccionActivaId) return;
    if (!(await confirmarSalirSinGuardar())) return;
    setEdicionSinGuardar(false);
    onDirtyChange(false);
    setLeccionActivaId(leccion.id);

    // El editor se abre en línea, justo debajo de la fila elegida: sin este
    // scroll, tocar una lección más abajo en una lista larga no da ninguna
    // señal de que sí se seleccionó.
    requestAnimationFrame(() => {
      document
        .getElementById(`leccion-editor-${leccion.id}`)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  async function cerrarEditor() {
    if (!(await confirmarSalirSinGuardar())) return;
    setEdicionSinGuardar(false);
    onDirtyChange(false);
    setLeccionActivaId(null);
  }

  function handleLeccionesChange(moduloId: string, lecciones: LeccionDetalle[]) {
    setModulos((current) =>
      current.map((modulo) => (modulo.id === moduloId ? { ...modulo, lecciones } : modulo)),
    );
  }

  function handleTituloModuloChange(moduloId: string, titulo: string) {
    setModulos((current) =>
      current.map((modulo) => (modulo.id === moduloId ? { ...modulo, titulo } : modulo)),
    );
  }

  function handleLeccionGuardada(cambios: Partial<LeccionDetalle>) {
    setModulos((current) =>
      current.map((modulo) => ({
        ...modulo,
        lecciones: modulo.lecciones.map((leccion) =>
          leccion.id === leccionActivaId ? { ...leccion, ...cambios } : leccion,
        ),
      })),
    );
  }

  function handleRecursosChange(recursos: RecursoDetalle[]) {
    setModulos((current) =>
      current.map((modulo) => ({
        ...modulo,
        lecciones: modulo.lecciones.map((leccion) =>
          leccion.id === leccionActivaId ? { ...leccion, recursos } : leccion,
        ),
      })),
    );
  }

  async function handleAgregarModulo() {
    const nombre = nombreModulo.trim();
    if (!nombre) return;
    // Crear un módulo termina en router.refresh(), que remonta este panel
    // (la key de <ContenidoTab> depende de los ids de módulos/lecciones) y
    // con él el editor de lección — se perdería cualquier cambio sin
    // guardar en la lección abierta, en silencio.
    if (!(await confirmarSalirSinGuardar())) return;

    setPending(true);
    const resultado = await crearModulo(cursoId, nombre);
    setPending(false);

    if (resultado.error) {
      showToast(resultado.error, "error");
      return;
    }
    showToast("Módulo creado.");
    setNombreModulo("");
    setAgregando(false);
    router.refresh();
  }

  async function handleModuloDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    if (!(await confirmarSalirSinGuardar())) return;

    const anteriores = modulos;
    const origenIndex = modulos.findIndex((modulo) => modulo.id === active.id);
    const targetIndex = modulos.findIndex((modulo) => modulo.id === over.id);
    if (origenIndex === -1 || targetIndex === -1) return;

    const reordenados = arrayMove(modulos, origenIndex, targetIndex);
    setModulos(reordenados);

    const idAnterior = reordenados[targetIndex - 1]?.id ?? null;
    const idSiguiente = reordenados[targetIndex + 1]?.id ?? null;

    moverModulo(cursoId, String(active.id), idAnterior, idSiguiente).then((resultado) => {
      if (resultado.error) {
        showToast(resultado.error, "error");
        // Reversión visible: sin esto el orden en pantalla queda mintiendo
        // sobre lo que de verdad quedó guardado.
        setModulos(anteriores);
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <h4 className="font-heading text-[15px] font-bold tracking-[-0.02em] text-uva-text">
          Módulos y lecciones
        </h4>
        {agregando ? (
          <div className="flex flex-col gap-2 sm:ml-auto sm:flex-row sm:items-center">
            <Input
              autoFocus
              placeholder="Nombre del módulo"
              value={nombreModulo}
              onChange={(event) => setNombreModulo(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && handleAgregarModulo()}
              className="h-8 text-sm sm:max-w-[240px]"
            />
            <div className="flex items-center gap-2">
              <Button type="button" size="sm" disabled={pending} onClick={handleAgregarModulo}>
                Agregar
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setAgregando(false)}>
                Cancelar
              </Button>
            </div>
          </div>
        ) : (
          <Button type="button" size="sm" className="sm:ml-auto" onClick={() => setAgregando(true)}>
            + Módulo
          </Button>
        )}
      </div>

      {modulos.length === 0 && (
        <p className="text-sm text-uva-muted-2">Este curso todavía no tiene módulos.</p>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleModuloDragEnd}>
        <SortableContext items={modulos.map((modulo) => modulo.id)} strategy={verticalListSortingStrategy}>
          {modulos.map((modulo, index) => (
            <ModuloCard
              key={modulo.id}
              modulo={modulo}
              posicion={index + 1}
              totalLeccionesCurso={modulos.reduce((total, m) => total + m.lecciones.length, 0)}
              cursoId={cursoId}
              leccionActivaId={leccionActivaId}
              onSeleccionarLeccion={seleccionarLeccion}
              onLeccionesChange={handleLeccionesChange}
              onTituloChange={handleTituloModuloChange}
              confirmarSalirSinGuardar={confirmarSalirSinGuardar}
              onCerrarEditor={cerrarEditor}
              onLeccionGuardada={handleLeccionGuardada}
              onRecursosChange={handleRecursosChange}
              onDirtyChangeLeccion={handleDirtyChange}
            />
          ))}
        </SortableContext>
      </DndContext>

      <ConfirmDialog
        open={dialogSalirAbierto}
        onOpenChange={(open) => !open && resolverDialogSalir(false)}
        title="Cambios sin guardar"
        description="Tienes cambios sin guardar en esta lección. ¿Salir sin guardarlos?"
        confirmLabel="Salir sin guardar"
        cancelLabel="Seguir editando"
        onConfirm={() => resolverDialogSalir(true)}
      />
    </div>
  );
}
