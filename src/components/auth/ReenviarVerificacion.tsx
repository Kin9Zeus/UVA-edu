"use client";

import { useActionState, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  reenviarVerificacion,
  type ReenviarVerificacionState,
} from "@/actions/auth/reenviar-verificacion";

const COOLDOWN_SEGUNDOS = 60;

export function ReenviarVerificacion({ email }: { email: string }) {
  const [state, formAction, pending] = useActionState<
    ReenviarVerificacionState,
    FormData
  >(reenviarVerificacion, null);
  const [cooldown, setCooldown] = useState(0);

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
    <form
      action={formAction}
      className="mt-3 flex flex-col items-center gap-2"
    >
      <input type="hidden" name="email" value={email} />

      {state?.error && (
        <p role="alert" className="text-center text-[12.5px] text-uva-danger-text">
          {state.error}
        </p>
      )}
      {state?.success && (
        <p role="status" className="text-center text-[12.5px] text-uva-valid">
          Te enviamos un nuevo enlace de verificación.
        </p>
      )}

      <Button
        type="submit"
        variant="uva-secondary"
        size="sm"
        disabled={pending || cooldown > 0}
        className="w-auto px-5"
      >
        {pending
          ? "Enviando…"
          : cooldown > 0
            ? `Reenviar en ${cooldown}s`
            : "Reenviar enlace de verificación"}
      </Button>
    </form>
  );
}
