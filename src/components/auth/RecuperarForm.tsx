"use client";

import { useState, type ChangeEvent, type FormEvent } from "react";

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
      <div className="alert-success" role="status">
        Si el correo existe en nuestra base de datos, te llegará un enlace en
        unos minutos.
      </div>
    );
  }

  return (
    <form className="form-fields" onSubmit={handleSubmit} noValidate>
      <div className="field">
        <label htmlFor="recuperar-email">Correo</label>
        <input
          className="input"
          id="recuperar-email"
          name="email"
          type="email"
          placeholder="Ingresa tu correo electronico"
          autoComplete="email"
          value={email}
          onChange={handleChange}
        />
        {error && <p className="field-error">{error}</p>}
      </div>

      <button
        type="submit"
        className="btn btn-primary"
        disabled={status === "loading"}
      >
        {status === "loading" ? (
          <>
            <span className="btn-spinner" aria-hidden="true" />
            Enviando…
          </>
        ) : (
          "Enviar enlace"
        )}
      </button>
    </form>
  );
}
