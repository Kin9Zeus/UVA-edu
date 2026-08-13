"use client";

import { useId, useState, type ChangeEvent } from "react";
import { EyeIcon, EyeOffIcon } from "@/components/auth/icons";

interface PasswordInputProps {
  id: string;
  name: string;
  placeholder?: string;
  autoComplete?: string;
  value?: string;
  onChange?: (event: ChangeEvent<HTMLInputElement>) => void;
}

export function PasswordInput({
  id,
  name,
  placeholder,
  autoComplete,
  value,
  onChange,
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false);
  const toggleId = useId();

  return (
    <div className="password-field">
      <input
        className="input"
        id={id}
        name={name}
        type={visible ? "text" : "password"}
        placeholder={placeholder}
        autoComplete={autoComplete}
        value={value}
        onChange={onChange}
      />
      <button
        type="button"
        id={toggleId}
        className="password-toggle"
        onClick={() => setVisible((current) => !current)}
        aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
        aria-pressed={visible}
      >
        {visible ? <EyeOffIcon /> : <EyeIcon />}
      </button>
    </div>
  );
}
