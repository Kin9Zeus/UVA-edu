"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { crearCategoria, actualizarCategoria } from "@/actions/admin/categorias";
import { useAdminToast } from "@/components/admin/Toast";

export function CategoriaFormDialog({
  open,
  onOpenChange,
  categoria,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categoria?: { id: string; nombre: string; descripcion: string | null } | null;
}) {
  const [nombre, setNombre] = useState(categoria?.nombre ?? "");
  const [descripcion, setDescripcion] = useState(categoria?.descripcion ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const showToast = useAdminToast();

  function resetAndClose() {
    setError(null);
    onOpenChange(false);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const resultado = categoria
      ? await actualizarCategoria(categoria.id, { nombre, descripcion })
      : await crearCategoria({ nombre, descripcion });

    setPending(false);

    if (resultado.error) {
      setError(resultado.error);
      return;
    }

    showToast(categoria ? "Categoría actualizada." : "Categoría creada.");
    resetAndClose();
    if (!categoria) {
      setNombre("");
      setDescripcion("");
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) resetAndClose();
        else onOpenChange(next);
      }}
    >
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{categoria ? "Editar categoría" : "Nueva categoría"}</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-2">
            {error && (
              <div role="alert" className="rounded-uva-md bg-uva-error-soft px-3.5 py-2.5 text-sm text-uva-error-text">
                {error}
              </div>
            )}
            <div>
              <Label htmlFor="categoria-nombre">Nombre</Label>
              <Input
                id="categoria-nombre"
                value={nombre}
                onChange={(event) => setNombre(event.target.value)}
                placeholder="Presupuestos y Costos"
                required
              />
            </div>
            <div>
              <Label htmlFor="categoria-descripcion">Descripción</Label>
              <Textarea
                id="categoria-descripcion"
                value={descripcion}
                onChange={(event) => setDescripcion(event.target.value)}
                rows={3}
                placeholder="Descripción breve de la categoría"
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={resetAndClose} disabled={pending}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Guardando…" : "Guardar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
