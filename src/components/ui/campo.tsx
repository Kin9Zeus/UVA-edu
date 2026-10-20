import * as React from "react"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { MensajeError } from "@/components/auth/MensajeError"
import { PasswordInput } from "@/components/auth/PasswordInput"
import { cn } from "@/lib/utils"

type CampoProps = Omit<React.ComponentProps<"input">, "id" | "name"> & {
  /** Obligatorios: la etiqueta es siempre visible, nunca solo el placeholder. */
  id: string
  name: string
  etiqueta: string
  /** Texto de apoyo bajo el campo; el lector lo lee junto con la etiqueta. */
  ayuda?: string
  /** Mensaje de error: marca el campo como inválido y se anuncia al aparecer. */
  error?: string
}

/**
 * Etiqueta + campo + ayuda + error, ya cableados (`htmlFor`, `aria-describedby`,
 * `aria-invalid`, `role="alert"`). Con `type="password"` agrega el botón de
 * mostrar/ocultar. El error se monta solo cuando existe: así `role="alert"` lo
 * anuncia al aparecer.
 */
function Campo({
  id,
  name,
  etiqueta,
  ayuda,
  error,
  required,
  className,
  type = "text",
  ...props
}: CampoProps) {
  const ayudaId = ayuda ? `${id}-ayuda` : undefined
  const errorId = error ? `${id}-error` : undefined
  const describedBy = [ayudaId, errorId].filter(Boolean).join(" ") || undefined

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={id} className="mb-0 text-uva-detalle font-medium text-uva-text">
        {etiqueta}
        {required && (
          <span aria-hidden="true" className="ml-0.5 text-uva-accent-ink">
            *
          </span>
        )}
      </Label>
      {type === "password" ? (
        <PasswordInput
          id={id}
          name={name}
          required={required}
          describedBy={describedBy}
          invalid={!!error}
          autoComplete={props.autoComplete}
          placeholder={props.placeholder}
          value={props.value as string | undefined}
          onChange={props.onChange}
          alternar="texto"
        />
      ) : (
        <Input
          id={id}
          name={name}
          type={type}
          required={required}
          aria-describedby={describedBy}
          aria-invalid={error ? true : undefined}
          {...props}
        />
      )}
      {ayuda && (
        <p id={ayudaId} className="text-uva-detalle text-uva-text-muted">
          {ayuda}
        </p>
      )}
      {error && <MensajeError id={errorId!}>{error}</MensajeError>}
    </div>
  )
}

export { Campo }
