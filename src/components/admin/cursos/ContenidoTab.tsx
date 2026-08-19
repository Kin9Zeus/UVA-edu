"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAdminToast } from "@/components/admin/Toast";
import { ModuloCard } from "@/components/admin/cursos/ModuloCard";
import { crearModulo, reordenarModulos } from "@/actions/admin/cursos";
import type { ModuloDetalle } from "@/lib/admin/cursoDetalle";

export function ContenidoTab({
  cursoId,
  modulosIniciales,
}: {
  cursoId: string;
  modulosIniciales: ModuloDetalle[];
}) {
  const [modulos, setModulos] = useState(modulosIniciales);
  const [agregando, setAgregando] = useState(false);
  const [nombreModulo, setNombreModulo] = useState("");
  const [pending, setPending] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const showToast = useAdminToast();
  const router = useRouter();

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
    <div className="flex flex-col gap-4">
      {agregando ? (
        <div className="flex items-center gap-2">
          <Input
            autoFocus
            placeholder="Nombre del módulo"
            value={nombreModulo}
            onChange={(event) => setNombreModulo(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && handleAgregarModulo()}
            className="max-w-[320px]"
          />
          <Button type="button" size="sm" disabled={pending} onClick={handleAgregarModulo}>
            Agregar
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => setAgregando(false)}>
            Cancelar
          </Button>
        </div>
      ) : (
        <Button type="button" variant="outline" className="w-fit" onClick={() => setAgregando(true)}>
          <Plus className="size-4" />
          Módulo
        </Button>
      )}

      {modulos.length === 0 && (
        <p className="text-sm text-uva-text-faint">Este curso todavía no tiene módulos.</p>
      )}

      <div className="flex flex-col gap-3">
        {modulos.map((modulo, index) => (
          <ModuloCard
            key={modulo.id}
            modulo={modulo}
            cursoId={cursoId}
            draggable
            onDragStart={() => setDraggedIndex(index)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={() => handleDrop(index)}
          />
        ))}
      </div>
    </div>
  );
}
