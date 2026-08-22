"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  actualizarPerfil,
  type ActualizarPerfilState,
} from "@/actions/perfil/actualizar";

function iniciales(nombre: string) {
  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  const letras = partes
    .slice(0, 2)
    .map((parte) => parte[0]?.toUpperCase() ?? "");
  return letras.join("") || "U";
}

type Certificado = {
  id: string;
  titulo: string;
  fecha: string;
};

export function PerfilForm({
  nombre,
  correo,
  celular,
  planNombre,
  certificados,
}: {
  nombre: string;
  correo: string;
  celular: string | null;
  planNombre: string | null;
  certificados: Certificado[];
}) {
  const [state, formAction, pending] = useActionState<
    ActualizarPerfilState,
    FormData
  >(actualizarPerfil, null);
  const [usuario, setUsuario] = useState(correo.split("@")[0] ?? "");

  return (
    <div
      className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(300px,340px)]"
      style={{ maxWidth: 1080 }}
    >
      <div className="flex flex-col gap-[18px]">
        <h1 className="text-[36px] text-uva-text">Mi perfil</h1>

        <div className="flex flex-col gap-[18px] rounded-uva-md border border-uva-divider bg-uva-surface p-6">
          <div className="flex items-center gap-4">
            <Avatar className="size-[68px] bg-uva-divider">
              <AvatarFallback className="bg-uva-divider font-heading text-[22px] font-bold text-uva-text">
                {iniciales(nombre)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <div className="font-heading text-[22px] leading-[1.15] text-uva-text">
                {nombre}
              </div>
              <div className="font-mono text-xs text-uva-muted">
                @{usuario || "tu-usuario"}
              </div>
            </div>
            {planNombre ? (
              <span className="ml-auto shrink-0 rounded-full bg-uva-accent-soft px-2.5 py-1 text-[11px] text-uva-accent-text">
                {planNombre}
              </span>
            ) : (
              <span className="ml-auto shrink-0 rounded-full bg-uva-hover px-2.5 py-1 text-[11px] text-uva-text-muted">
                Sin plan
              </span>
            )}
          </div>

          <div className="h-px bg-uva-divider" />

          <form action={formAction} className="flex flex-col gap-[18px]">
            {state?.error && (
              <div
                role="alert"
                className="rounded-uva-md bg-uva-danger-soft px-3.5 py-2.5 text-sm text-uva-danger-text"
              >
                {state.error}
              </div>
            )}

            <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]">
              <div>
                <Label htmlFor="perfil-nombre">Nombre completo</Label>
                <Input
                  id="perfil-nombre"
                  name="nombre"
                  key={nombre}
                  defaultValue={nombre}
                  required
                />
              </div>
              <div>
                <Label htmlFor="perfil-correo">Correo</Label>
                <Input
                  id="perfil-correo"
                  type="email"
                  key={correo}
                  defaultValue={correo}
                  disabled
                />
              </div>
              <div>
                <Label htmlFor="perfil-celular">Celular</Label>
                <Input
                  id="perfil-celular"
                  name="celular"
                  type="tel"
                  key={celular}
                  defaultValue={celular ?? ""}
                  placeholder="+57 300 123 4567"
                />
              </div>
              <div>
                <Label htmlFor="perfil-rol-gremio">Rol en el gremio</Label>
                <Input
                  id="perfil-rol-gremio"
                  name="rol_gremio"
                  placeholder="Arquitecto, residente, presupuestador…"
                />
              </div>
              <div>
                <Label htmlFor="perfil-pais">País</Label>
                <Input id="perfil-pais" name="pais" placeholder="Colombia" />
              </div>
              <div>
                <Label htmlFor="perfil-usuario">Usuario público</Label>
                <Input
                  id="perfil-usuario"
                  name="usuario"
                  value={usuario}
                  onChange={(event) => setUsuario(event.target.value)}
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button
                type="submit"
                variant="uva-primary"
                size="uva"
                disabled={pending}
                className="w-auto px-6"
              >
                {pending ? "Guardando…" : "Guardar cambios"}
              </Button>
              <Button
                type="reset"
                variant="uva-secondary"
                size="uva"
                className="w-auto px-6"
              >
                Cancelar
              </Button>
              {state?.success && (
                <span
                  role="status"
                  className="rounded-full bg-uva-accent-2-soft px-2.5 py-1 text-[11px] text-uva-accent-2-text"
                >
                  Datos actualizados
                </span>
              )}
            </div>
          </form>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 rounded-uva-md border border-uva-divider bg-uva-surface p-[22px]">
          <div className="flex items-center gap-2.5">
            <h4 className="font-heading text-[17px] text-uva-text">
              Mis certificados
            </h4>
            {certificados.length > 0 && (
              <Link
                href="/dashboard/certificados"
                className="ml-auto text-[12.5px] text-uva-accent-text"
              >
                Ver todos
              </Link>
            )}
          </div>
          <div className="flex flex-col gap-2">
            {certificados.length === 0 && (
              <p className="text-sm text-uva-text-faint">
                Aún no tienes certificados.
              </p>
            )}
            {certificados.map((certificado) => (
              <div
                key={certificado.id}
                className="flex items-center gap-2.5 rounded-[10px] bg-uva-divider px-3 py-2.5"
              >
                <span className="flex-1 text-[12.5px] text-uva-text">
                  {certificado.titulo}
                </span>
                <span className="font-mono text-[11px] text-uva-muted">
                  {certificado.fecha}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
