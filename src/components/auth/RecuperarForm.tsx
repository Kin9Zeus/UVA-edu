"use client";

import { useState, type ChangeEvent, type FormEvent } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Status = "idle" | "loading" | "sent";

export function RecuperarForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState<Status>("idle");

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    setEmail(event.target.value);
    if (error) setError("");
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status !== "idle") return;

    if (!EMAIL_PATTERN.test(email)) {
      setError("Ingresa un correo electrónico válido.");
      return;
    }

    setStatus("loading");
    window.setTimeout(() => {
      setStatus("sent");
    }, 900);
  }

  if (status === "sent") {
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
    <form
      className="flex flex-col gap-3.5"
      onSubmit={handleSubmit}
      noValidate
    >
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
        {error && (
          <p className="mt-1.5 text-xs text-uva-danger-text">{error}</p>
        )}
      </div>

      <Button
        type="submit"
        variant="uva-primary"
        size="uva"
        disabled={status === "loading"}
        className="mt-4 min-h-[46px] text-[15px]"
      >
        {status === "loading" ? (
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
