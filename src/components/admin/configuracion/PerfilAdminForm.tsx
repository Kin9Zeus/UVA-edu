"use client";

import { useActionState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { EditorFotoPerfil } from "@/components/perfil/EditorFotoPerfil";
import { actualizarPerfil, type ActualizarPerfilState } from "@/actions/perfil/actualizar";

export function PerfilAdminForm({
  nombre,
  correo,
  fotoUrl,
}: {
  nombre: string;
  correo: string;
  fotoUrl: string | null;
}) {
  const [state, formAction, pending] = useActionState<ActualizarPerfilState, FormData>(actualizarPerfil, null);

  return (
    <form action={formAction} className="flex flex-col gap-3.5">
      <div className="flex items-center gap-3.5">
        <EditorFotoPerfil nombre={nombre} fotoUrl={fotoUrl} />
        <p className="text-xs text-uva-muted-2">Clic en la foto para cambiarla.</p>
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
