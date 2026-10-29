import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MensajeError } from "@/components/auth/MensajeError";
import { ACCESO_INPUT, ACCESO_LABEL } from "@/components/auth/acceso";
import { cn } from "@/lib/utils";

/**
 * Campo del código de 6 dígitos de la app de autenticación, común a activar y
 * a verificar.
 *
 * `inputMode="numeric"` abre el teclado de números en el celular sin los
 * problemas de `type="number"` (que quita ceros a la izquierda y añade
 * flechas). `autoComplete="one-time-code"` deja que el teléfono o el gestor de
 * contraseñas rellenen el código. La letra del campo es de 16 px o más: si es
 * menor, el iPhone hace zoom al tocar.
 *
 * El `maxLength` es 7 y no 6 a propósito: las apps muestran «123 456» y quien
 * copia se lleva el espacio; el servidor lo limpia.
 */
export function CampoCodigoSegundoFactor({
  id,
  error,
}: {
  id: string;
  error: string | undefined;
}) {
  const errorId = `${id}-error`;

  return (
    <div>
      <Label htmlFor={id} className={ACCESO_LABEL}>
        Código de 6 dígitos
      </Label>
      <Input
        id={id}
        name="codigo"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9 ]*"
        maxLength={7}
        placeholder="000 000"
        required
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={cn(ACCESO_INPUT, "text-center font-mono tracking-widest")}
      />
      {error && (
        <div className="mt-2">
          <MensajeError id={errorId}>{error}</MensajeError>
        </div>
      )}
    </div>
  );
}
