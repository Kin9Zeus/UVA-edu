"use client";

import { useActionState, useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { CLASE_BLOQUE_PERFIL, CLASE_CAMPO_PERFIL, CLASE_ETIQUETA_PERFIL } from "@/components/dashboard/PerfilForm";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CampoCodigoSegundoFactor } from "@/components/auth/CampoCodigoSegundoFactor";
import { cn } from "@/lib/utils";
import type { IniciarActivacionState } from "@/actions/seguridad/segundo-factor";
import {
  confirmarOtroDispositivo,
  iniciarOtroDispositivo,
  quitarDispositivo,
  type ConfirmarDispositivoState,
} from "@/actions/seguridad/dispositivos";

export type DispositivoSegundoFactor = {
  id: string;
  /** El que se le puso al añadirlo; el primero (desde /seguridad/activar) no tiene. */
  nombre: string | null;
  /** Fecha ya formateada en el servidor, para que no cambie con la zona del navegador. */
  registrado: string;
};

export type DatosSegundoFactor = {
  dispositivos: DispositivoSegundoFactor[];
  /** Ver o cambiar los dispositivos exige haber escrito el código en esta sesión. */
  sesionAal2: boolean;
};

const RUTA_PERFIL = "/dashboard/perfil";

/**
 * Verificación en dos pasos en Mi perfil — FASE 8.1. Solo se muestra a
 * administradores (la página no la pinta para los demás).
 *
 * Su razón de ser es el SEGUNDO dispositivo: con uno solo, perder el celular
 * deja al administrador fuera del panel. Aquí se añade otro (otra app o el
 * gestor de contraseñas) y se quita uno que ya no se use, nunca el último.
 */
export function SegundoFactorPerfil({ dispositivos, sesionAal2 }: DatosSegundoFactor) {
  const titulo = (
    <h2 id="perfil-2fa-titulo" className="flex items-center gap-2.5 text-uva-titulo-4 font-extrabold text-uva-text">
      <ShieldCheck className="size-5 text-uva-text-muted" strokeWidth={1.8} aria-hidden />
      Verificación en dos pasos
    </h2>
  );

  if (!sesionAal2) {
    const pantalla = dispositivos.length > 0 ? "verificar" : "activar";
    return (
      <section aria-labelledby="perfil-2fa-titulo" className={CLASE_BLOQUE_PERFIL}>
        {titulo}
        <p className="max-w-[68ch] text-uva-cuerpo text-uva-text-muted">
          {dispositivos.length > 0
            ? "Para ver o cambiar tus dispositivos, primero escribe el código de tu app."
            : "Aún no tienes una app de autenticación registrada. La necesitas para entrar al panel de administración."}
        </p>
        <Link
          href={`/seguridad/${pantalla}?redirect=${encodeURIComponent(RUTA_PERFIL)}`}
          className={cn(buttonVariants({ variant: "uva-secondary", size: "uva" }), "min-h-12 w-auto justify-self-start px-[22px] text-base")}
        >
          {dispositivos.length > 0 ? "Escribir mi código" : "Activar la verificación"}
        </Link>
      </section>
    );
  }

  return (
    <section aria-labelledby="perfil-2fa-titulo" className={CLASE_BLOQUE_PERFIL}>
      {titulo}
      <p className="max-w-[68ch] text-uva-cuerpo text-uva-text-muted">
        Con dos dispositivos, perder el celular no te deja fuera del panel. Puede ser otra app de autenticación o
        tu gestor de contraseñas.
      </p>

      <ul className="grid gap-2" aria-label="Tus dispositivos">
        {dispositivos.map((dispositivo) => (
          <FilaDispositivo key={dispositivo.id} dispositivo={dispositivo} esElUnico={dispositivos.length <= 1} />
        ))}
      </ul>

      <AnadirDispositivo />
    </section>
  );
}

function FilaDispositivo({ dispositivo, esElUnico }: { dispositivo: DispositivoSegundoFactor; esElUnico: boolean }) {
  const [confirmando, setConfirmando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciarTransicion] = useTransition();
  const nombre = dispositivo.nombre ?? "App de autenticación";

  function quitar() {
    setError(null);
    iniciarTransicion(async () => {
      const resultado = await quitarDispositivo(dispositivo.id);
      if ("error" in resultado) setError(resultado.error);
      setConfirmando(false);
    });
  }

  return (
    <li className="grid gap-2 rounded-uva-md border border-uva-divider px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div>
          <p className="text-uva-cuerpo font-semibold text-uva-text">{nombre}</p>
          <p className="text-uva-detalle text-uva-text-muted">Registrado el {dispositivo.registrado}</p>
        </div>

        {esElUnico ? (
          <p className="text-uva-detalle text-uva-text-muted">Es tu único dispositivo: añade otro antes de quitarlo.</p>
        ) : confirmando ? (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="uva-secondary"
              size="uva"
              onClick={quitar}
              disabled={pendiente}
              className="min-h-11 w-auto px-4 text-base"
            >
              {pendiente ? "Quitando…" : `Sí, quitar «${nombre}»`}
            </Button>
            <Button
              type="button"
              variant="uva-ghost"
              size="uva"
              onClick={() => setConfirmando(false)}
              disabled={pendiente}
              className="min-h-11 w-auto px-4 text-base"
            >
              Cancelar
            </Button>
          </div>
        ) : (
          <Button
            type="button"
            variant="uva-secondary"
            size="uva"
            onClick={() => setConfirmando(true)}
            className="min-h-11 w-auto px-4 text-base"
          >
            Quitar
          </Button>
        )}
      </div>
      {error && (
        <p role="alert" className="text-uva-detalle font-semibold text-uva-danger-text">
          {error}
        </p>
      )}
    </li>
  );
}

/**
 * Añadir un dispositivo: nombre → QR y clave → primer código. Al terminar se
 * vuelve a montar desde cero (cambia la `key`), así el siguiente empieza limpio
 * y la lista de arriba ya trae el nuevo (la acción revalida la página).
 */
function AnadirDispositivo() {
  const [vuelta, setVuelta] = useState(0);
  const [listo, setListo] = useState(false);

  return (
    <div className="grid gap-3">
      {listo && (
        <p role="status" className="text-uva-cuerpo font-bold text-uva-text">
          Listo: añadimos tu dispositivo.
        </p>
      )}
      <PasosAnadir
        key={vuelta}
        onListo={() => {
          setListo(true);
          setVuelta((n) => n + 1);
        }}
      />
    </div>
  );
}

function PasosAnadir({ onListo }: { onListo: () => void }) {
  const [inicio, iniciar, iniciando] = useActionState<IniciarActivacionState, FormData>(iniciarOtroDispositivo, null);
  const [confirmacion, confirmar, confirmando] = useActionState<ConfirmarDispositivoState, FormData>(
    async (estadoAnterior, datos) => {
      const resultado = await confirmarOtroDispositivo(estadoAnterior, datos);
      if (resultado?.exito) onListo();
      return resultado;
    },
    null,
  );

  if (!inicio?.factorId) {
    return (
      <form action={iniciar} className="grid gap-3" noValidate>
        <div className="max-w-sm">
          <Label htmlFor="perfil-2fa-nombre" className={CLASE_ETIQUETA_PERFIL}>
            Nombre del nuevo dispositivo
          </Label>
          <Input
            id="perfil-2fa-nombre"
            name="nombre"
            maxLength={40}
            placeholder="Por ejemplo: Bóveda"
            required
            aria-invalid={inicio?.error ? true : undefined}
            aria-describedby={inicio?.error ? "perfil-2fa-nombre-error" : undefined}
            className={CLASE_CAMPO_PERFIL}
          />
        </div>
        {inicio?.error && (
          <p id="perfil-2fa-nombre-error" role="alert" className="text-uva-detalle font-semibold text-uva-danger-text">
            {inicio.error}
          </p>
        )}
        <Button
          type="submit"
          variant="uva-secondary"
          size="uva"
          disabled={iniciando}
          className="min-h-12 w-auto justify-self-start px-[22px] text-base"
        >
          {iniciando ? "Preparando…" : "Añadir otro dispositivo"}
        </Button>
      </form>
    );
  }

  return (
    <div className="grid gap-4 rounded-uva-md border border-uva-divider p-4">
      <p className="text-uva-cuerpo text-uva-text">
        Escanea el código con el nuevo dispositivo, o escribe la clave, y luego escribe el código de 6 dígitos que te
        muestre.
      </p>
      <div className="grid justify-items-start gap-3">
        {/* Mismo QR que en /seguridad/activar (lib/auth/qr.ts): trae su fondo
            blanco y su margen, y su lado es múltiplo entero de los módulos. */}
        <div className="max-w-full overflow-hidden rounded-uva-md border border-uva-divider">
          <Image
            src={inicio.qr}
            alt="Código QR para añadir U.V.A. al nuevo dispositivo"
            width={inicio.ladoQr}
            height={inicio.ladoQr}
            unoptimized
            className="block h-auto max-w-full"
          />
        </div>
        <p className="text-uva-detalle text-uva-text-muted">Clave para escribirla a mano:</p>
        <code className="select-all break-all rounded-uva-sm bg-uva-chip px-2 py-1 font-codigo text-uva-detalle text-uva-text">
          {inicio.secreto}
        </code>
      </div>

      <form action={confirmar} className="grid max-w-sm gap-3" noValidate>
        <input type="hidden" name="factorId" value={inicio.factorId} />
        <CampoCodigoSegundoFactor id="perfil-2fa-codigo" error={confirmacion?.error} />
        <Button type="submit" variant="uva-primary" size="uva" disabled={confirmando} className="min-h-12 w-auto px-[22px] text-base">
          {confirmando ? "Confirmando…" : "Confirmar dispositivo"}
        </Button>
        <p className="text-uva-detalle text-uva-text-muted">Al confirmarlo, cerramos tus otras sesiones abiertas.</p>
      </form>
    </div>
  );
}
