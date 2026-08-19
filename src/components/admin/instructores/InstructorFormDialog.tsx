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
import { crearInstructor, actualizarInstructor } from "@/actions/admin/instructores";
import { useAdminToast } from "@/components/admin/Toast";

export type InstructorEditable = {
  id: string;
  nombre: string;
  especialidad: string | null;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  instructor?: InstructorEditable | null;
  nombreInicial?: string;
  onCreado?: (id: string, nombre: string) => void;
};

/**
 * El mockup de Claude Design no diseña este modal: su botón
 * "+ Nuevo instructor" solo dispara un toast de ejemplo
 * (`openInstructorModal` en Uva - Panel Admin.dc.html). Se modela sobre el
 * modal de categoría, que es su equivalente más cercano — mismo ancho, mismos
 * dos campos, mismo pie.
 *
 * Sirve para las dos pantallas: el listado de instructores y el formulario de
 * curso, que lo abre para dar de alta uno sin perder lo que llevaba escrito.
 * De ahí `onCreado`, que devuelve el id recién creado al llamador.
 */
export function InstructorFormDialog({ open, onOpenChange, ...resto }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {/* El formulario se remonta cuando cambia el instructor objetivo, así
            los campos arrancan siempre con los valores correctos sin
            sincronizar estado desde un efecto. */}
        {open && (
          <Formulario
            key={resto.instructor?.id ?? `nuevo:${resto.nombreInicial ?? ""}`}
            onOpenChange={onOpenChange}
            {...resto}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function Formulario({
  onOpenChange,
  instructor,
  nombreInicial,
  onCreado,
}: Omit<Props, "open">) {
  const [nombre, setNombre] = useState(instructor?.nombre ?? nombreInicial ?? "");
  const [especialidad, setEspecialidad] = useState(instructor?.especialidad ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const showToast = useAdminToast();

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);

    if (instructor) {
      const resultado = await actualizarInstructor(instructor.id, {
        nombre,
        especialidad,
      });
      setPending(false);
      if (resultado.error) {
        setError(resultado.error);
        return;
      }
      showToast("Instructor actualizado.");
    } else {
      const resultado = await crearInstructor({ nombre, especialidad });
      setPending(false);
      if (resultado.error) {
        setError(resultado.error);
        return;
      }
      showToast("Instructor creado.");
      if (resultado.id) onCreado?.(resultado.id, nombre.trim());
    }

    onOpenChange(false);
  }

  return (
    <form onSubmit={handleSubmit}>
      <DialogHeader>
        <DialogTitle>{instructor ? "Editar instructor" : "Nuevo instructor"}</DialogTitle>
      </DialogHeader>

      <div className="flex flex-col gap-4 py-2">
        {error && (
          <div
            role="alert"
            className="rounded-uva-md bg-uva-error-soft px-3.5 py-2.5 text-sm text-uva-error-text"
          >
            {error}
          </div>
        )}
        <div>
          <Label htmlFor="instructor-nombre">Nombre</Label>
          <Input
            id="instructor-nombre"
            value={nombre}
            onChange={(event) => setNombre(event.target.value)}
            placeholder="Mariana Ospina"
            required
          />
        </div>
        <div>
          <Label htmlFor="instructor-especialidad">Especialidad</Label>
          <Input
            id="instructor-especialidad"
            value={especialidad}
            onChange={(event) => setEspecialidad(event.target.value)}
            placeholder="Presupuestos y AIU"
          />
        </div>
      </div>

      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          onClick={() => onOpenChange(false)}
          disabled={pending}
        >
          Cancelar
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Guardando…" : "Guardar"}
        </Button>
      </DialogFooter>
    </form>
  );
}
