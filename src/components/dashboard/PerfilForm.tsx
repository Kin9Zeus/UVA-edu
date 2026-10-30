"use client";

// Banderas en SVG, no dependen de la fuente de emoji del SO: sin esto, "🇨🇴"
// cae en texto plano ("CO") en Chrome/Windows. Se importa aquí y no en el
// layout raíz para no bloquear el render de las páginas que no las usan.
import "flag-icons/css/flag-icons.min.css";
import { useActionState, useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { EditorFotoPerfil } from "@/components/perfil/EditorFotoPerfil";
import { LogoUva } from "@/components/home/LogoUva";
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
import { SegundoFactorPerfil, type DatosSegundoFactor } from "@/components/dashboard/SegundoFactorPerfil";
import { LARGO_MAXIMO_NOMBRE } from "@/lib/nombre";
import { ExportarDatosButton } from "@/components/dashboard/ExportarDatosButton";
import { EliminarCuentaCard } from "@/components/dashboard/EliminarCuentaCard";
import type { EstadoAcceso } from "@/lib/estadoAcceso";
import { formatFecha } from "@/lib/admin/format";
import { PRECIOS_HABILITADOS } from "@/lib/features";
import { PAISES, buscarPaisPorCodigo, partirCelular } from "@/lib/paises";
import { cn } from "@/lib/utils";
import { LogOut } from "lucide-react";
import { logout, logoutEnTodos } from "@/actions/auth/logout";

type Certificado = {
  id: string;
  titulo: string;
  fecha: string;
};

/** Etiqueta de la banda del carné: el plan comprado, o el estado del acceso gratuito. */
type Insignia = {
  texto: string;
  /** true la pinta en gris (acceso ya terminado), no en amarillo. */
  atenuada: boolean;
};

/** Campos del formulario: 48 px de alto y letra de 16 px (sin zoom en iPhone). */
export const CLASE_CAMPO_PERFIL =
  "h-12 border-[1.5px] border-uva-line-strong bg-uva-surface text-base sm:text-base placeholder:text-uva-text-muted";
export const CLASE_ETIQUETA_PERFIL = "mb-1.5 text-uva-cuerpo font-semibold text-uva-text";
/** Bloques de la columna del formulario: raya arriba, sin tarjeta. */
export const CLASE_BLOQUE_PERFIL = "grid gap-4 border-t border-uva-divider pt-[22px]";

/**
 * "Mi perfil" con la dirección visual «Carné»: a la izquierda el carné de
 * obra (se actualiza mientras se edita), el acceso y los certificados; a la
 * derecha el formulario, la contraseña, la exportación y la zona de peligro.
 *
 * Las columnas dependen del ancho del contenido (`@container`), no de la
 * ventana: el menú lateral del panel se lleva 256 px. Por debajo de 900 px
 * las dos columnas se "disuelven" (`contents`) y cada bloque se reubica con
 * `order`: carné, datos, acceso, certificados, contraseña, sesión, exportar y
 * eliminar (lo que se viene a mirar antes que lo que casi no se toca).
 */
export function PerfilForm({
  nombre,
  correo,
  celular,
  rolGremio,
  fotoUrl,
  insignia,
  tienePassword,
  certificados,
  estadoAcceso,
  segundoFactor = null,
}: {
  nombre: string;
  correo: string;
  celular: string | null;
  rolGremio: string | null;
  fotoUrl: string | null;
  insignia: Insignia | null;
  tienePassword: boolean;
  certificados: Certificado[];
  estadoAcceso: EstadoAcceso | null;
  /** Solo para administradores (FASE 8.1): sus dispositivos del segundo factor. */
  segundoFactor?: DatosSegundoFactor | null;
}) {
  const [state, formAction, pending] = useActionState<
    ActualizarPerfilState,
    FormData
  >(actualizarPerfil, null);
  const usuario = correo.split("@")[0] ?? "";
  const { pais: paisInicial, numero: numeroInicial } = partirCelular(celular);
  const [paisCodigo, setPaisCodigo] = useState(paisInicial.codigo);
  // Lo que se está escribiendo, para el carné. Al guardar, la página se
  // revalida y los `key` de abajo remontan los campos con lo guardado.
  const [vista, setVista] = useState({ nombre, numero: numeroInicial, rol: rolGremio ?? "" });

  const celularVista = vista.numero.trim()
    ? `${buscarPaisPorCodigo(paisCodigo).indicativo} ${vista.numero.trim()}`
    : null;
  const vigencia =
    estadoAcceso?.vigencia === "SIN_LIMITE"
      ? "Sin fecha de cierre"
      : estadoAcceso && estadoAcceso.vigencia !== "VENCIDO" && estadoAcceso.fechaVigencia
        ? formatFecha(estadoAcceso.fechaVigencia)
        : null;
  const banda = insignia ?? {
    texto: PRECIOS_HABILITADOS ? "Sin plan" : "Sin acceso activo",
    atenuada: true,
  };

  return (
    <div className="@container flex flex-col gap-[22px] lg:gap-7">
      <h1 className="text-uva-titulo-3 text-uva-text">Mi perfil</h1>

      <div className="grid gap-7 @min-[900px]:grid-cols-[400px_minmax(0,1fr)] @min-[900px]:gap-x-14">
        <div className="contents @min-[900px]:grid @min-[900px]:content-start @min-[900px]:gap-6">
          {/* El carné cuelga de una cinta desde 900 px; en celular va solo. */}
          <div className="relative order-1 grid justify-items-center @min-[900px]:order-none @min-[900px]:mb-3 @min-[900px]:pt-[150px]">
            <svg
              aria-hidden="true"
              viewBox="0 0 160 184"
              fill="none"
              strokeLinecap="round"
              className="absolute -top-5 left-1/2 hidden h-[184px] w-40 -translate-x-1/2 @min-[900px]:block"
            >
              <path d="M20 0L76 138M140 0L84 138" strokeWidth={10} className="stroke-uva-btn" />
              <rect x="62" y="130" width="36" height="34" rx="5" strokeWidth={2.5} className="fill-uva-surface-2 stroke-uva-text" />
              <path d="M80 164V184" strokeWidth={3} className="stroke-uva-text" />
            </svg>
            <section
              aria-label="Tu carné, se actualiza mientras editas"
              className="relative flex w-full max-w-[360px] flex-col overflow-hidden rounded-uva-lg border-2 border-uva-text bg-uva-surface @min-[900px]:origin-[50%_-150px] @min-[900px]:-rotate-[2.5deg]"
            >
              <div aria-hidden="true" className="mt-2.5 h-3 w-16 self-center rounded-full border-2 border-uva-text bg-uva-bg @min-[900px]:mt-3.5" />
              <div className="flex items-center justify-between px-[18px] pt-2.5 text-uva-detalle font-semibold text-uva-text-muted @min-[900px]:px-[22px] @min-[900px]:pt-4">
                <LogoUva className="h-6 w-[74px] text-uva-text" />
                <span>Carné de obra</span>
              </div>
              <div className="flex items-start gap-3.5 px-[18px] pt-3 @min-[900px]:gap-4 @min-[900px]:px-[22px] @min-[900px]:pt-5">
                <EditorFotoPerfil nombre={vista.nombre || nombre} fotoUrl={fotoUrl} size="carne" />
                <div className="grid min-w-0 gap-1 pt-1">
                  <span className="text-uva-detalle font-semibold text-uva-text-muted">Nombre</span>
                  <b className="text-uva-titulo-4 font-extrabold break-words text-uva-text">
                    {vista.nombre.trim() || nombre}
                  </b>
                </div>
              </div>
              <dl className="mx-[18px] mt-3 mb-3.5 grid grid-cols-2 gap-x-3.5 gap-y-2 @min-[900px]:mx-[22px] @min-[900px]:mt-[18px] @min-[900px]:mb-5 @min-[900px]:grid-cols-1 @min-[900px]:gap-2.5">
                {vista.rol.trim() && (
                  <DatoCarne etiqueta="Rol en el gremio" ancho>
                    {vista.rol.trim()}
                  </DatoCarne>
                )}
                <DatoCarne etiqueta="Correo" ancho>
                  {correo}
                </DatoCarne>
                {celularVista && <DatoCarne etiqueta="Celular">{celularVista}</DatoCarne>}
                {vigencia && <DatoCarne etiqueta="Vigente hasta">{vigencia}</DatoCarne>}
              </dl>
              <div
                className={cn(
                  "mt-auto flex min-h-11 items-center justify-between gap-2.5 border-t-2 border-uva-text px-[18px] text-uva-detalle font-bold @min-[900px]:px-[22px]",
                  banda.atenuada ? "bg-uva-surface-2 text-uva-text-muted" : "bg-uva-accent-2 text-uva-on-bright",
                )}
              >
                <span className="shrink-0 whitespace-nowrap">{banda.texto}</span>
                <span className="min-w-0 truncate">@{usuario || "tu-usuario"}</span>
              </div>
            </section>
          </div>

          {estadoAcceso && (
            <div className="order-3 @min-[900px]:order-none">
              <EstadoAccesoCard
                tipo={estadoAcceso.tipo}
                fechaVigencia={estadoAcceso.fechaVigencia}
                diasRestantes={estadoAcceso.diasRestantes}
                vigencia={estadoAcceso.vigencia}
              />
            </div>
          )}

          <div className="order-4 grid gap-2.5 @min-[900px]:order-none">
            <div className="flex items-center justify-between gap-2.5">
              <h2 className="text-uva-cuerpo font-extrabold text-uva-text">Mis certificados</h2>
              {certificados.length > 0 && (
                <Link
                  href="/dashboard/certificados"
                  className="inline-flex min-h-11 items-center text-uva-cuerpo font-bold whitespace-nowrap text-uva-accent-ink hover:underline hover:underline-offset-3"
                >
                  Ver todos
                </Link>
              )}
            </div>
            {certificados.length === 0 ? (
              <p className="text-uva-cuerpo text-uva-text-muted">Aún no tienes certificados.</p>
            ) : (
              <ul className="grid gap-2">
                {certificados.map((certificado) => (
                  <li key={certificado.id} className="grid gap-0.5 rounded-uva-md bg-uva-surface-2 px-3.5 py-3">
                    <b className="text-uva-cuerpo leading-snug font-bold text-uva-text">{certificado.titulo}</b>
                    <span className="text-uva-detalle text-uva-text-muted">{certificado.fecha}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="contents @min-[900px]:grid @min-[900px]:content-start @min-[900px]:gap-7">
          <section aria-labelledby="perfil-datos-titulo" className="order-2 grid gap-4 @min-[900px]:order-none">
            <div>
              <h2 id="perfil-datos-titulo" className="text-uva-titulo-4 font-extrabold text-uva-text">
                Tus datos de perfil
              </h2>
              <p className="mt-1 text-uva-cuerpo text-uva-text-muted">
                Lo que cambies aquí se ve en tu carné. Para cambiar la foto, toca la de tu carné.
              </p>
            </div>

            <form
              action={formAction}
              onReset={() => {
                setPaisCodigo(paisInicial.codigo);
                setVista({ nombre, numero: numeroInicial, rol: rolGremio ?? "" });
              }}
              className="grid gap-4"
            >
              {state?.error && (
                <div
                  role="alert"
                  className="rounded-uva-md bg-uva-danger-soft px-3.5 py-2.5 text-uva-detalle text-uva-danger-text"
                >
                  {state.error}
                </div>
              )}

              <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,240px),1fr))]">
                <div>
                  <Label htmlFor="perfil-nombre" className={CLASE_ETIQUETA_PERFIL}>
                    Nombre completo
                  </Label>
                  <Input
                    id="perfil-nombre"
                    name="nombre"
                    key={nombre}
                    defaultValue={nombre}
                    autoComplete="name"
                    maxLength={LARGO_MAXIMO_NOMBRE}
                    onChange={(e) => setVista((v) => ({ ...v, nombre: e.target.value }))}
                    required
                    className={CLASE_CAMPO_PERFIL}
                  />
                </div>
                <div>
                  <Label htmlFor="perfil-correo" className={CLASE_ETIQUETA_PERFIL}>
                    Correo
                  </Label>
                  <Input
                    id="perfil-correo"
                    type="email"
                    key={correo}
                    defaultValue={correo}
                    disabled
                    className={cn(CLASE_CAMPO_PERFIL, "bg-uva-surface-2 disabled:opacity-100 text-uva-text-muted")}
                  />
                </div>
                <div>
                  <Label htmlFor="perfil-celular" className={CLASE_ETIQUETA_PERFIL}>
                    Celular
                  </Label>
                  <div className="flex gap-2">
                    <Select
                      name="pais"
                      value={paisCodigo}
                      onValueChange={(valor) => setPaisCodigo(valor as string)}
                    >
                      <SelectTrigger
                        aria-label="Indicativo del país"
                        className="w-[108px] shrink-0 border-[1.5px] border-uva-line-strong bg-uva-surface text-base font-semibold data-[size=default]:h-12"
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
                      autoComplete="tel-national"
                      placeholder="300 123 4567"
                      onChange={(e) => setVista((v) => ({ ...v, numero: e.target.value }))}
                      className={CLASE_CAMPO_PERFIL}
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="perfil-rol-gremio" className={CLASE_ETIQUETA_PERFIL}>
                    Rol en el gremio
                  </Label>
                  <Input
                    id="perfil-rol-gremio"
                    name="rol_gremio"
                    key={rolGremio ?? ""}
                    defaultValue={rolGremio ?? ""}
                    maxLength={60}
                    placeholder="Arquitecto, residente, presupuestador…"
                    onChange={(e) => setVista((v) => ({ ...v, rol: e.target.value }))}
                    className={CLASE_CAMPO_PERFIL}
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <Button
                  type="submit"
                  variant="uva-primary"
                  size="uva"
                  disabled={pending}
                  className="min-h-12 w-auto px-[22px] text-base"
                >
                  {pending ? "Guardando…" : "Guardar cambios"}
                </Button>
                <Button
                  type="reset"
                  variant="uva-secondary"
                  size="uva"
                  className="min-h-12 w-auto px-[22px] text-base"
                >
                  Cancelar
                </Button>
                {state?.success && (
                  <span role="status" className="text-uva-cuerpo font-bold text-uva-text">
                    Datos actualizados
                  </span>
                )}
              </div>
            </form>
          </section>

          <div className="order-5 @min-[900px]:order-none">
            <CambiarPasswordForm tienePassword={tienePassword} />
          </div>

          {segundoFactor && (
            <div className="order-5 @min-[900px]:order-none">
              <SegundoFactorPerfil {...segundoFactor} />
            </div>
          )}

          <section aria-labelledby="perfil-sesion-titulo" className={cn(CLASE_BLOQUE_PERFIL, "order-6 @min-[900px]:order-none")}>
            <h2 id="perfil-sesion-titulo" className="flex items-center gap-2.5 text-uva-titulo-4 font-extrabold text-uva-text">
              <LogOut className="size-5 text-uva-text-muted" strokeWidth={1.8} aria-hidden />
              Sesión
            </h2>
            <p className="max-w-[68ch] text-uva-cuerpo text-uva-text-muted">
              Cierra la sesión en este dispositivo. Tu avance queda guardado.
            </p>
            {/* Formulario y no onClick: funciona aunque el JavaScript no haya cargado. */}
            <form action={logout}>
              <Button type="submit" variant="uva-secondary" size="uva" className="min-h-12 w-auto gap-2 px-[22px] text-base">
                <LogOut className="size-[18px]" strokeWidth={1.8} aria-hidden />
                Cerrar sesión
              </Button>
            </form>
            <p className="max-w-[68ch] text-uva-cuerpo text-uva-text-muted">
              Si crees que alguien más entró a tu cuenta, ciérrala en todos tus dispositivos a la vez.
            </p>
            <form action={logoutEnTodos}>
              <Button type="submit" variant="uva-secondary" size="uva" className="min-h-12 w-auto gap-2 px-[22px] text-base">
                <LogOut className="size-[18px]" strokeWidth={1.8} aria-hidden />
                Cerrar sesión en todos los dispositivos
              </Button>
            </form>
          </section>

          <section aria-labelledby="perfil-exportar-titulo" className={cn(CLASE_BLOQUE_PERFIL, "order-7 @min-[900px]:order-none")}>
            <h2 id="perfil-exportar-titulo" className="text-uva-titulo-4 font-extrabold text-uva-text">
              Tus datos
            </h2>
            <p className="max-w-[68ch] text-uva-cuerpo text-uva-text-muted">
              Descarga una copia de todos los datos personales asociados a tu
              cuenta (Ley 1581 / Habeas Data).
            </p>
            <ExportarDatosButton />
          </section>

          <div className="order-8 @min-[900px]:order-none">
            <EliminarCuentaCard correo={correo} tienePassword={tienePassword} />
          </div>
        </div>
      </div>
    </div>
  );
}

function DatoCarne({ etiqueta, ancho = false, children }: { etiqueta: string; ancho?: boolean; children: React.ReactNode }) {
  return (
    <div className={cn("min-w-0", ancho && "col-span-2 @min-[900px]:col-span-1")}>
      <dt className="text-uva-detalle font-semibold text-uva-text-muted">{etiqueta}</dt>
      <dd className="mt-0.5 text-uva-detalle font-semibold break-words text-uva-text @min-[900px]:text-uva-cuerpo">{children}</dd>
    </div>
  );
}
