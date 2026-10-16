"use client";

import { useId, useState, type ChangeEvent } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { EyeIcon, EyeOffIcon } from "@/components/auth/icons";

interface PasswordInputProps {
  id: string;
  name: string;
  placeholder?: string;
  autoComplete?: string;
  value?: string;
  onChange?: (event: ChangeEvent<HTMLInputElement>) => void;
  inputClassName?: string;
  required?: boolean;
  /** id del mensaje de error que describe el campo, si lo hay. */
  describedBy?: string;
  /** Marca el campo como inválido (aria-invalid). */
  invalid?: boolean;
  /**
   * `"icono"` (el ojo, por defecto) o `"texto"` ("Mostrar" / "Ocultar"),
   * el del login rediseñado (Login lab 7).
   */
  alternar?: "icono" | "texto";
}

export function PasswordInput({
  id,
  name,
  placeholder,
  autoComplete,
  value,
  onChange,
  inputClassName,
  required,
  describedBy,
  invalid,
  alternar = "icono",
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false);
  const toggleId = useId();
  const conTexto = alternar === "texto";

  return (
    <div className="relative">
      <Input
        id={id}
        name={name}
        type={visible ? "text" : "password"}
        placeholder={placeholder}
        autoComplete={autoComplete}
        value={value}
        onChange={onChange}
        required={required}
        aria-describedby={describedBy}
        aria-invalid={invalid || undefined}
        className={`${conTexto ? "pr-24" : "pr-11"} ${inputClassName ?? ""}`}
      />
      {conTexto ? (
        // El texto visible cambia ("Mostrar" / "Ocultar"), así que no lleva
        // aria-pressed: un botón conmutable con nombre cambiante se anuncia
        // dos veces. El nombre accesible contiene el texto visible (WCAG 2.5.3).
        <button
          type="button"
          id={toggleId}
          className="absolute top-0.5 right-0.5 bajo:top-0 bajo:right-0 inline-flex h-11 min-w-11 items-center justify-center rounded-uva-md px-2.5 text-sm font-semibold text-uva-accent-ink hover:bg-uva-text/8"
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
        >
          {visible ? "Ocultar" : "Mostrar"}
        </button>
      ) : (
        <Button
          type="button"
          variant="uva-icon"
          size="auto"
          id={toggleId}
          className="absolute inset-y-0 right-0 h-auto w-11 rounded-uva-md"
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
          aria-pressed={visible}
        >
          {visible ? <EyeOffIcon /> : <EyeIcon />}
        </Button>
      )}
    </div>
  );
}
