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
    <form action={formAction} className="flex flex-col gap-3.5">
      <div className="flex items-center gap-3.5">
        <Avatar className="size-12 shrink-0 bg-uva-divider after:hidden">
          <AvatarFallback className="bg-uva-divider font-heading text-sm font-bold text-uva-muted">
            {iniciales(nombre)}
          </AvatarFallback>
        </Avatar>
        {/* TODO(Fase 2): subida de avatar. El mockup dibuja el botón; hasta que
            exista el almacenamiento, las iniciales se derivan del nombre. */}
        <Button
          type="button"
          size="sm"
          disabled
          title="Disponible cuando se habilite la subida de imágenes"
        >
          Cambiar avatar
        </Button>
        <p className="text-xs text-uva-muted-2">Las iniciales se generan a partir de tu nombre.</p>
      </div>

      {state?.error && (
        <div role="alert" className="rounded-uva-md bg-uva-error-soft px-3.5 py-2.5 text-sm text-uva-error-text">
          {state.error}
        </div>
      )}
      {state?.success && (
        <div role="status" className="rounded-uva-md bg-uva-badge-success-bg px-3.5 py-2.5 text-sm text-uva-badge-success-fg">
          Perfil actualizado.
        </div>
      )}

      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
        <div>
          <Label htmlFor="admin-nombre">Nombre</Label>
          <Input id="admin-nombre" name="nombre" key={nombre} defaultValue={nombre} required />
        </div>
        <div>
          <Label htmlFor="admin-correo">Correo</Label>
          <Input id="admin-correo" key={correo} defaultValue={correo} disabled />
        </div>
      </div>

      <Button type="submit" variant="primary" disabled={pending} className="w-auto self-start">
        {pending ? "Guardando…" : "Guardar cambios"}
      </Button>
    </form>
  );
}
