"use client";

import { useActionState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { actualizarPerfil, type ActualizarPerfilState } from "@/actions/perfil/actualizar";

function iniciales(nombre: string) {
  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  return partes.slice(0, 2).map((parte) => parte[0]?.toUpperCase() ?? "").join("") || "A";
}

export function PerfilAdminForm({ nombre, correo }: { nombre: string; correo: string }) {
  const [state, formAction, pending] = useActionState<ActualizarPerfilState, FormData>(actualizarPerfil, null);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Avatar size="lg" className="bg-uva-divider">
          <AvatarFallback className="bg-uva-divider text-uva-text">{iniciales(nombre)}</AvatarFallback>
        </Avatar>
        <p className="text-xs text-uva-text-faint">Las iniciales se generan a partir de tu nombre.</p>
      </div>

      {state?.error && (
        <div role="alert" className="rounded-uva-md bg-uva-error-soft px-3.5 py-2.5 text-sm text-uva-error-text">
          {state.error}
        </div>
      )}
      {state?.success && (
        <div role="status" className="rounded-uva-md bg-uva-valid-soft px-3.5 py-2.5 text-sm text-uva-valid">
          Perfil actualizado.
        </div>
      )}

      <div>
        <Label htmlFor="admin-nombre">Nombre</Label>
        <Input id="admin-nombre" name="nombre" key={nombre} defaultValue={nombre} required />
      </div>
      <div>
        <Label htmlFor="admin-correo">Correo</Label>
        <Input id="admin-correo" key={correo} defaultValue={correo} disabled />
      </div>

      <Button type="submit" disabled={pending} className="w-auto">
        {pending ? "Guardando…" : "Guardar"}
      </Button>
    </form>
  );
}
