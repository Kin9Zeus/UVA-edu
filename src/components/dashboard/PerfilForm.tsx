"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { EditorFotoPerfil } from "@/components/perfil/EditorFotoPerfil";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  actualizarPerfil,
  type ActualizarPerfilState,
} from "@/actions/perfil/actualizar";
import { EstadoAccesoCard } from "@/components/dashboard/EstadoAccesoCard";
import { CambiarPasswordForm } from "@/components/dashboard/CambiarPasswordForm";
import { ExportarDatosButton } from "@/components/dashboard/ExportarDatosButton";
import { EliminarCuentaCard } from "@/components/dashboard/EliminarCuentaCard";
import type { EstadoAcceso } from "@/lib/estadoAcceso";
import { PAISES, buscarPaisPorCodigo, partirCelular } from "@/lib/paises";

type Certificado = {
  id: string;
  titulo: string;
  fecha: string;
};

/** Etiqueta de la cabecera: el plan comprado, o el estado del acceso gratuito. */
type Insignia = {
  texto: string;
  /** true la pinta en gris (acceso ya terminado), no en magenta. */
  atenuada: boolean;
};

export function PerfilForm({
  nombre,
  correo,
  celular,
  fotoUrl,
  insignia,
  tienePassword,
  certificados,
  estadoAcceso,
}: {
  nombre: string;
  correo: string;
  celular: string | null;
  fotoUrl: string | null;
  insignia: Insignia | null;
  tienePassword: boolean;
  certificados: Certificado[];
  estadoAcceso: EstadoAcceso | null;
}) {
  const [state, formAction, pending] = useActionState<
    ActualizarPerfilState,
    FormData
  >(actualizarPerfil, null);
  const usuario = correo.split("@")[0] ?? "";
  const { pais: paisInicial, numero: numeroInicial } = partirCelular(celular);
  const [paisCodigo, setPaisCodigo] = useState(paisInicial.codigo);

  return (
    <div
      className="grid grid-cols-1 items-start gap-[18px] lg:gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(300px,340px)]"
      style={{ maxWidth: 1080 }}
    >
      {/* En móvil las dos columnas se "disuelven" (`contents`) y cada bloque
          se reubica con `order`: perfil → contraseña → acceso → certificados →
          datos → eliminar. Desde `lg` vuelven a ser dos columnas. */}
      <div className="contents lg:flex lg:flex-col lg:gap-[18px]">
        <h1 className="order-1 text-[36px] text-uva-text lg:order-none">Mi perfil</h1>

        <div className="order-2 flex flex-col gap-[18px] rounded-uva-md border border-uva-divider bg-uva-surface p-6 lg:order-none">
          <div className="flex items-center gap-4">
            <EditorFotoPerfil nombre={nombre} fotoUrl={fotoUrl} size="lg" />
            <div className="min-w-0">
              <div className="font-heading text-[22px] leading-[1.15] text-uva-text">
                {nombre}
              </div>
              <div className="font-mono text-xs text-uva-muted">
                @{usuario || "tu-usuario"}
              </div>
            </div>
            {insignia ? (
              <span
                className={
                  insignia.atenuada
                    ? "ml-auto shrink-0 rounded-full bg-uva-hover px-2.5 py-1 text-[11px] text-uva-text-muted"
                    : "ml-auto shrink-0 rounded-full bg-uva-accent-soft px-2.5 py-1 text-[11px] text-uva-accent-text"
                }
              >
                {insignia.texto}
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
                <div className="flex gap-2">
                  <Select
                    name="pais"
                    value={paisCodigo}
                    onValueChange={(valor) => setPaisCodigo(valor as string)}
                  >
                    <SelectTrigger
                      aria-label="Indicativo del país"
                      className="h-10 w-[104px] shrink-0 bg-uva-surface"
                    >
                      <SelectValue>
                        {(codigo: string) => {
                          const pais = buscarPaisPorCodigo(codigo);
                          return (
                            <>
                              <span aria-hidden className={`fi fi-${pais.codigo.toLowerCase()} rounded-[2px]`} />
                              {pais.indicativo}
                            </>
                          );
                        }}
                      </SelectValue>
                    </SelectTrigger>
                    {/* alignItemWithTrigger=false: el default centra la lista en el país
                        ya seleccionado (como un <select> nativo), lo que la hace "emerger"
                        sin animación desde la mitad de la fila y taparla. Un dropdown
                        anclado normal, con su altura ya acotada al espacio disponible
                        (max-h-(--available-height) en SelectContent), se ve mucho más
                        prolijo y no se sale de la pantalla. */}
                    <SelectContent alignItemWithTrigger={false} className="max-h-72">
                      {PAISES.map((pais) => (
                        <SelectItem key={pais.codigo} value={pais.codigo}>
                          <span aria-hidden className={`fi fi-${pais.codigo.toLowerCase()} rounded-[2px]`} />
                          {pais.indicativo}
                          <span className="text-uva-text-faint">{pais.nombre}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    id="perfil-celular"
                    name="celular"
                    type="tel"
                    key={celular}
                    defaultValue={numeroInicial}
                    placeholder="300 123 4567"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="perfil-rol-gremio">Rol en el gremio</Label>
                <Input
                  id="perfil-rol-gremio"
                  name="rol_gremio"
                  placeholder="Arquitecto, residente, presupuestador…"
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

        <div className="order-3 lg:order-none">
          <CambiarPasswordForm />
        </div>

        <div className="order-6 flex flex-col gap-[18px] rounded-uva-md border border-uva-divider bg-uva-surface p-6 lg:order-none">
          <h2 className="text-base text-uva-text">Tus datos</h2>
          <p className="text-sm text-uva-text-muted">
            Descarga una copia de todos los datos personales asociados a tu
            cuenta (Ley 1581 / Habeas Data).
          </p>
          <ExportarDatosButton />
        </div>

        <div className="order-7 lg:order-none">
          <EliminarCuentaCard correo={correo} tienePassword={tienePassword} />
        </div>
      </div>

      <div className="contents lg:flex lg:flex-col lg:gap-[18px]">
        {/* Espaciador invisible, solo en desktop: iguala la altura del
            título "Mi perfil" (h1) de la columna izquierda + su gap, para
            que "Tu acceso" arranque a la altura de la tarjeta del perfil
            en vez de pegado al borde de arriba de la cuadrícula. En mobile
            (`hidden`) no debe ocupar espacio — las dos columnas se aplanan
            en una sola. No es un <h1> real (evita un encabezado duplicado
            para quien navega por títulos); `aria-hidden` es una segunda
            capa además de `invisible`, que ya lo saca del árbol de
            accesibilidad en los navegadores modernos. */}
        <div aria-hidden className="invisible hidden text-[36px] lg:block">
          Mi perfil
        </div>
        {estadoAcceso && (
          <div className="order-4 lg:order-none">
            <EstadoAccesoCard
              tipo={estadoAcceso.tipo}
              fechaVigencia={estadoAcceso.fechaVigencia}
              diasRestantes={estadoAcceso.diasRestantes}
              vigencia={estadoAcceso.vigencia}
            />
          </div>
        )}

        <div className="order-5 flex flex-col gap-3 lg:order-none rounded-uva-md border border-uva-divider bg-uva-surface p-[22px]">
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
