"use client";

import { useActionState, useState, type ChangeEvent } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { recuperar, type RecuperarState } from "@/actions/auth/recuperar";

export function RecuperarForm() {
  const [email, setEmail] = useState("");
  const [state, formAction, pending] = useActionState<
    RecuperarState,
    FormData
  >(recuperar, null);

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    setEmail(event.target.value);
  }

  if (state?.success) {
    return (
      <div
        role="status"
        className="mt-4 rounded-uva-md bg-uva-success-soft px-4 py-3.5 text-center text-[13px] leading-[1.5] text-uva-valid"
      >
        Si el correo existe en nuestra base de datos, te llegará un enlace en
        unos minutos.
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-3.5" noValidate>
      <div>
        <Label htmlFor="recuperar-email">Correo</Label>
        <Input
          id="recuperar-email"
          name="email"
          type="email"
          placeholder="Ingresa tu correo electronico"
          autoComplete="email"
          value={email}
          onChange={handleChange}
        />
        {state?.error && (
          <p className="mt-1.5 text-xs text-uva-danger-text">{state.error}</p>
        )}
      </div>

      <Button
        type="submit"
        variant="uva-primary"
        size="uva"
        disabled={pending}
        className="mt-4 min-h-[46px] text-[15px]"
      >
        {pending ? (
          <>
            <span
              aria-hidden="true"
              className="size-4 animate-[uva-btn-spinner-spin_0.7s_linear_infinite] rounded-full border-2 border-[rgba(250,250,250,0.35)] border-t-uva-text"
            />
            Enviando…
          </>
        ) : (
          "Enviar enlace"
        )}
      </Button>
    </form>
  );
}
