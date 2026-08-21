"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { AdminCard } from "@/components/admin/AdminCard";
import { Input } from "@/components/ui/input";
import { useAdminToast } from "@/components/admin/Toast";
import { ModuloCard } from "@/components/admin/cursos/ModuloCard";
import { LeccionEditorPanel } from "@/components/admin/cursos/LeccionEditorPanel";
import { crearModulo, reordenarModulos } from "@/actions/admin/cursos";
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
}: {
  cursoId: string;
  modulosIniciales: ModuloDetalle[];
}) {
  const [modulos, setModulos] = useState(modulosIniciales);
  const [leccionActivaId, setLeccionActivaId] = useState<string | null>(null);
  const [agregando, setAgregando] = useState(false);
  const [nombreModulo, setNombreModulo] = useState("");
  const [pending, setPending] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const showToast = useAdminToast();
  const router = useRouter();

  const leccionActiva =
    modulos.flatMap((modulo) => modulo.lecciones).find((leccion) => leccion.id === leccionActivaId) ??
    null;

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

  function handleLeccionGuardada(cambios: Pick<LeccionDetalle, "titulo" | "duracion" | "resumen">) {
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

  function handleDrop(targetIndex: number) {
    if (draggedIndex === null || draggedIndex === targetIndex) return;

    const reordenados = [...modulos];
    const [movido] = reordenados.splice(draggedIndex, 1);
    reordenados.splice(targetIndex, 0, movido);
    setModulos(reordenados);
    setDraggedIndex(null);

    reordenarModulos(
      cursoId,
      reordenados.map((modulo, index) => ({ id: modulo.id, orden: index })),
    ).then((resultado) => {
      if (resultado.error) showToast(resultado.error, "error");
    });
  }

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(260px,340px)]">
      <div className="flex flex-col gap-3">
        <div className="flex items-center">
          <h4 className="font-heading text-[15px] font-bold tracking-[-0.02em] text-uva-text">
            Módulos y lecciones
          </h4>
          {agregando ? (
            <div className="ml-auto flex items-center gap-2">
              <Input
                autoFocus
                placeholder="Nombre del módulo"
                value={nombreModulo}
                onChange={(event) => setNombreModulo(event.target.value)}
                onKeyDown={(event) => event.key === "Enter" && handleAgregarModulo()}
                className="h-8 max-w-[240px] text-sm"
              />
              <Button type="button" size="sm" disabled={pending} onClick={handleAgregarModulo}>
                Agregar
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setAgregando(false)}>
                Cancelar
              </Button>
            </div>
          ) : (
            <Button type="button" size="sm" className="ml-auto" onClick={() => setAgregando(true)}>
              + Módulo
            </Button>
          )}
        </div>

        {modulos.length === 0 && (
          <p className="text-sm text-uva-muted-2">Este curso todavía no tiene módulos.</p>
        )}

        {modulos.map((modulo, index) => (
          <ModuloCard
            key={modulo.id}
            modulo={modulo}
            posicion={index + 1}
            cursoId={cursoId}
            draggable
            leccionActivaId={leccionActivaId}
            onSeleccionarLeccion={(leccion) => setLeccionActivaId(leccion.id)}
            onLeccionesChange={handleLeccionesChange}
            onTituloChange={handleTituloModuloChange}
            onDragStart={() => setDraggedIndex(index)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={() => handleDrop(index)}
          />
        ))}
      </div>

      {/* Columna derecha fija: `position:sticky;top:88px` en el mockup */}
      <AdminCard className="lg:sticky lg:top-[88px]">
        {leccionActiva ? (
          <LeccionEditorPanel
            key={leccionActiva.id}
            leccion={leccionActiva}
            cursoId={cursoId}
            onCerrar={() => setLeccionActivaId(null)}
            onGuardado={handleLeccionGuardada}
            onRecursosChange={handleRecursosChange}
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
