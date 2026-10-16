import { passwordRules } from "@/lib/password";
import { cn } from "@/lib/utils";

/**
 * Lista de reglas de la contraseña (Crear cuenta lab 6 y Nueva contraseña
 * lab 7): círculo amarillo si se cumple, borde de acento si ya se escribió y
 * falta, gris si aún no se escribe nada. "Cumple" / "Falta" también en texto
 * para el lector de pantalla. Las reglas salen de src/lib/password.ts, las
 * mismas que valida el servidor.
 */
export function ReglasPassword({
  id,
  password,
  className,
}: {
  id: string;
  password: string;
  className?: string;
}) {
  return (
    <ul id={id} className={cn("flex flex-wrap gap-x-3 gap-y-0.5", className)}>
      {passwordRules.map((rule) => {
        const met = rule.test(password);
        const fallando = !met && password.length > 0;
        return (
          <li
            key={rule.id}
            className={cn(
              "flex items-center gap-1.5 text-uva-detalle",
              met ? "text-uva-text" : fallando ? "text-uva-danger-text" : "text-uva-text-muted",
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                "size-3.5 flex-none rounded-full border-2 transition-colors duration-150",
                met
                  ? "border-uva-text bg-uva-accent-2"
                  : fallando
                    ? "border-uva-accent"
                    : "border-uva-muted-2",
              )}
            />
            <span className="sr-only">{met ? "Cumple: " : "Falta: "}</span>
            {rule.label}
          </li>
        );
      })}
    </ul>
  );
}
