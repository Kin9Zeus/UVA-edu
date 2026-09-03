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
import { AdminCard } from "@/components/admin/AdminCard";
import { Input } from "@/components/ui/input";
import { useAdminToast } from "@/components/admin/Toast";
import { ModuloCard } from "@/components/admin/cursos/ModuloCard";
import { LeccionEditorPanel } from "@/components/admin/cursos/LeccionEditorPanel";
import { crearModulo, moverModulo } from "@/actions/admin/cursos";
import type { ModuloDetalle, LeccionDetalle, RecursoDetalle } from "@/lib/admin/cursoDetalle";

/**
 * Pestaña Contenido del mockup del panel admin: dos columnas
 * (`minmax(0,1fr) minmax(260px,340px)`) donde la derecha es una tarjeta fija
 * con el editor de lección — no un modal. La lección elegida vive aquí para
 * que la fila de la lista y el editor miren siempre el mismo dato.
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
  const showToast = useAdminToast();
  const router = useRouter();
  // En desktop el editor es una columna sticky siempre visible; por debajo de
  // `lg` es una tarjeta más abajo en el documento, así que elegir una lección
  // ahí no da ninguna señal si el editor ya quedó fuera de la vista — este
  // scroll es esa señal.
  const editorRef = useRef<HTMLDivElement>(null);

  const leccionActiva =
    modulos.flatMap((modulo) => modulo.lecciones).find((leccion) => leccion.id === leccionActivaId) ??
    null;

  const handleDirtyChange = useCallback(
    (dirty: boolean) => {
      setEdicionSinGuardar(dirty);
      onDirtyChange(dirty);
    },
    [onDirtyChange],
  );

  function confirmarSalirSinGuardar(): boolean {
    if (!edicionSinGuardar) return true;
    const continuar = window.confirm("Tienes cambios sin guardar en esta lección. ¿Salir sin guardarlos?");
    // Si acepta descartar, se limpia ya: algunos llamadores (crear/renombrar/
    // eliminar módulo o lección) terminan en router.refresh(), que remonta
    // este panel sin volver a pasar por seleccionarLeccion()/cerrarEditor()
    // — sin esto el aviso quedaría prendido de por vida aunque ya no haya
    // nada sin guardar.
    if (continuar) {
      setEdicionSinGuardar(false);
      onDirtyChange(false);
    }
    return continuar;
  }

  function seleccionarLeccion(leccion: LeccionDetalle) {
    if (leccion.id === leccionActivaId) return;
    if (!confirmarSalirSinGuardar()) return;
    setEdicionSinGuardar(false);
    onDirtyChange(false);
    setLeccionActivaId(leccion.id);

    // Por debajo de `lg` (el corte de `AdminCard.lg:sticky` en el JSX de
    // abajo) el editor no es sticky: sin este scroll, tocar una lección
    // mientras se sigue viendo la lista de módulos no da ninguna señal de
    // que sí se seleccionó.
    if (window.innerWidth < 1024) {
      requestAnimationFrame(() => {
        editorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  }

  function cerrarEditor() {
    if (!confirmarSalirSinGuardar()) return;
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
    if (!confirmarSalirSinGuardar()) return;

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

  function handleModuloDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    if (!confirmarSalirSinGuardar()) return;

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
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(260px,340px)]">
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
              />
            ))}
          </SortableContext>
        </DndContext>
      </div>

      {/* Columna derecha fija: `position:sticky;top:88px` en el mockup */}
      <AdminCard ref={editorRef} className="lg:sticky lg:top-[88px]">
        {leccionActiva ? (
          <LeccionEditorPanel
            key={leccionActiva.id}
            leccion={leccionActiva}
            cursoId={cursoId}
            onCerrar={cerrarEditor}
            onGuardado={handleLeccionGuardada}
            onRecursosChange={handleRecursosChange}
            onDirtyChange={handleDirtyChange}
          />
        ) : (
          <p className="px-1 py-5 text-center text-[13px] text-uva-muted-2">
            Selecciona una lección para editarla.
          </p>
        )}
      </AdminCard>
    </div>
  );
}
