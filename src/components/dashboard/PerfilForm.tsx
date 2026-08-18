"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Copy, Check } from "lucide-react";
import {
  actualizarPerfil,
  type ActualizarPerfilState,
} from "@/actions/perfil/actualizar";

function iniciales(nombre: string) {
  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  const letras = partes.slice(0, 2).map((parte) => parte[0]?.toUpperCase() ?? "");
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
  certificados,
  totalCertificados,
}: {
  nombre: string;
  correo: string;
  certificados: Certificado[];
  totalCertificados: number;
}) {
  const [state, formAction, pending] = useActionState<
    ActualizarPerfilState,
    FormData
  >(actualizarPerfil, null);
  const [usuario, setUsuario] = useState(correo.split("@")[0] ?? "");
  const [copiado, setCopiado] = useState(false);

  const enlacePublico = `uva.co/p/${usuario || "tu-usuario"}`;

  async function copiarEnlace() {
    try {
      await navigator.clipboard.writeText(`https://${enlacePublico}`);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // Portapapeles no disponible (permiso denegado o navegador sin soporte); no hay nada más que hacer.
    }
  }

  return (
    <div className="mx-auto grid max-w-[1080px] grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(300px,340px)]">
      <div className="flex flex-col gap-6">
        <Card>
          <CardContent className="flex flex-col gap-6">
            <div className="flex items-center gap-4">
              <Avatar size="lg" className="size-16 bg-uva-divider">
                <AvatarFallback className="bg-uva-divider text-lg text-uva-text">
                  {iniciales(nombre)}
                </AvatarFallback>
              </Avatar>
              <div>
                <h1 className="text-lg text-uva-text">{nombre}</h1>
                <p className="font-mono text-xs text-uva-text-faint">
                  @{usuario || "tu-usuario"}
                </p>
              </div>
              <Badge variant="secondary" className="ml-auto">
                Plan gratuito
              </Badge>
            </div>

            <form action={formAction} className="flex flex-col gap-5">
              {state?.error && (
                <div
                  role="alert"
                  className="rounded-uva-md bg-uva-danger-soft px-3.5 py-2.5 text-sm text-uva-danger-text"
                >
                  {state.error}
                </div>
              )}
              {state?.success && (
                <div
                  role="status"
                  className="rounded-uva-md bg-uva-valid-soft px-3.5 py-2.5 text-sm text-uva-valid"
                >
                  Datos actualizados.
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]">
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
                  <Input id="perfil-correo" key={correo} defaultValue={correo} disabled />
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
                  <Label htmlFor="perfil-celular">Celular</Label>
                  <Input
                    id="perfil-celular"
                    name="celular"
                    type="tel"
                    placeholder="+57 300 000 0000"
                  />
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
                <div>
                  <Label htmlFor="perfil-software">Software que dominas</Label>
                  <Input
                    id="perfil-software"
                    name="software"
                    placeholder="AutoCAD, Revit, Presto…"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="perfil-bio">Sobre ti</Label>
                <Textarea
                  id="perfil-bio"
                  name="bio"
                  rows={4}
                  placeholder="Cuéntale al gremio a qué te dedicas."
                />
              </div>

              <div className="flex gap-3">
                <Button type="submit" variant="uva-primary" size="uva" disabled={pending} className="w-auto px-6">
                  {pending ? "Guardando…" : "Guardar cambios"}
                </Button>
                <Button type="reset" variant="uva-secondary" size="uva" className="w-auto px-6">
                  Cancelar
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Actividad</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="font-mono text-lg text-uva-text tabular-nums">4.820</p>
              <p className="text-xs text-uva-text-faint">Puntos</p>
            </div>
            <div>
              <p className="font-mono text-lg text-uva-text tabular-nums">32</p>
              <p className="text-xs text-uva-text-faint">Respuestas</p>
            </div>
            <div>
              <p className="font-mono text-lg text-uva-text tabular-nums">8</p>
              <p className="text-xs text-uva-text-faint">Preguntas</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Mis certificados</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {certificados.length === 0 && (
              <p className="text-sm text-uva-text-faint">
                Aún no tienes certificados.
              </p>
            )}
            {certificados.map((certificado) => (
              <div key={certificado.id} className="flex items-center justify-between text-sm">
                <span className="text-uva-text-muted">{certificado.titulo}</span>
                <span className="font-mono text-xs text-uva-text-faint">
                  {certificado.fecha}
                </span>
              </div>
            ))}
            {totalCertificados > 0 && (
              <Link
                href="/dashboard/certificados"
                className="text-xs text-uva-accent-text"
              >
                Ver todos ({totalCertificados})
              </Link>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Perfil público</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="font-mono text-sm text-uva-text-muted">
              {enlacePublico}
            </p>
            <Button
              type="button"
              variant="uva-secondary"
              size="uva"
              className="w-auto px-4"
              onClick={copiarEnlace}
            >
              {copiado ? <Check className="size-4" /> : <Copy className="size-4" />}
              {copiado ? "Copiado" : "Copiar enlace"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
