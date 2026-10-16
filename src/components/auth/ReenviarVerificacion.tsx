"use client";

import { useActionState, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MensajeError } from "@/components/auth/MensajeError";
import { ACCESO_INPUT, ACCESO_LABEL } from "@/components/auth/acceso";
import {
  reenviarVerificacion,
  type ReenviarVerificacionState,
} from "@/actions/auth/reenviar-verificacion";

const COOLDOWN_SEGUNDOS = 60;

function formatoEspera(segundos: number): string {
  return `${Math.floor(segundos / 60)}:${String(segundos % 60).padStart(2, "0")}`;
}

/**
 * Botón de reenviar el enlace de verificación (Crear cuenta lab 6). Con
 * `email` vacío (el enlace del correo no lo traía) pide el correo antes de
 * enviar. `variante="primario"` es el CTA de "Este enlace ya venció";
 * `secundario`, el de "¡Ya casi!" y "Verifica tu correo".
 */
export function ReenviarVerificacion({
  email,
  variante = "secundario",
  etiqueta = "Reenviar enlace de verificación",
}: {
  email: string;
  variante?: "primario" | "secundario";
  etiqueta?: string;
}) {
  const [state, formAction, pending] = useActionState<
    ReenviarVerificacionState,
    FormData
  >(reenviarVerificacion, null);
  const [cooldown, setCooldown] = useState(0);
  const [correo, setCorreo] = useState(email);
  const pideCorreo = !email;

  // El límite real lo aplica el servidor (rate limit por correo); esta
  // cuenta regresiva es solo UX para no dejar el botón clicable de
  // inmediato tras cualquier respuesta, sea éxito o "espera un minuto".
  // Se ajusta durante el render (no en un efecto) siguiendo el patrón
  // recomendado por React para derivar estado a partir de un cambio de
  // prop/estado externo: https://react.dev/learn/you-might-not-need-an-effect
  const [prevState, setPrevState] = useState(state);
  if (state !== prevState) {
    setPrevState(state);
    if (state) {
      setCooldown(COOLDOWN_SEGUNDOS);
    }
  }

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => {
      setCooldown((actual) => Math.max(0, actual - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  return (
    <form action={formAction} className="grid grid-cols-1 gap-2.5 bajo:gap-2">
      {pideCorreo ? (
        <div>
          <Label htmlFor="reenviar-email" className={ACCESO_LABEL}>
            Correo electrónico
          </Label>
          <Input
            id="reenviar-email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="Ingresa tu correo electrónico"
            required
            value={correo}
            onChange={(event) => setCorreo(event.target.value)}
            className={ACCESO_INPUT}
          />
        </div>
      ) : (
        <input type="hidden" name="email" value={email} />
      )}

      {state?.error && <MensajeError id="reenviar-error">{state.error}</MensajeError>}
      {state?.success && (
        <p role="status" className="text-uva-detalle font-semibold text-uva-text">
          Te reenviamos el enlace a{" "}
          <strong className="[overflow-wrap:anywhere]">{email || correo}</strong>.
        </p>
      )}

      <Button
        type="submit"
        variant={variante === "primario" ? "uva-primary" : "uva-secondary"}
        size="uva"
        disabled={pending || cooldown > 0}
        // "Puedes reenviarlo de nuevo en 0:59" no cabe en una línea a 320 px:
        // el botón crece en alto en vez de salirse.
        className={`h-auto min-h-12 whitespace-normal py-2.5 bajo:min-h-11 ${
          variante === "primario"
            ? "text-uva-cuerpo"
            : "border-[1.5px] border-uva-muted-2 text-uva-cuerpo"
        }`}
      >
        {pending
          ? "Enviando…"
          : cooldown > 0
            ? `Puedes reenviarlo de nuevo en ${formatoEspera(cooldown)}`
            : etiqueta}
      </Button>
    </form>
  );
}
