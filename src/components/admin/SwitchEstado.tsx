"use client";

import { Switch } from "@/components/ui/switch";

/**
 * Switch de estado de los listados del panel admin.
 *
 * El mockup deja el switch mudo en la tabla de Categorias, pero en el
 * formulario de Configuracion del curso siempre lo acompana de una palabra
 * ("Curso visible", "Curso destacado"). Un switch suelto no dice ni que
 * alterna ni hacia donde esta encendido, asi que aqui se aplica esa misma
 * convencion a los tres listados: el componente es el de siempre y a su
 * derecha va la etiqueta del estado actual, que cambia al alternar.
 *
 * La logica no vive aqui: `onCheckedChange` recibe el handler que ya tenia
 * cada pantalla.
 */
export function SwitchEstado({
  checked,
  onCheckedChange,
  etiquetas,
  acciones,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  /** Texto que se muestra: `[encendido, apagado]`. */
  etiquetas: [string, string];
  /** Lo que hace el clic, para el lector de pantalla: `[activar, desactivar]`. */
  acciones: [string, string];
}) {
  return (
    <div className="flex items-center gap-2.5">
      <Switch
        checked={checked}
        onCheckedChange={onCheckedChange}
        aria-label={checked ? acciones[1] : acciones[0]}
      />
      {/* El estado apagado se atenua para que el encendido pese mas al barrer
          la columna con la vista. */}
      <span
        className={
          checked ? "text-[13px] text-uva-text" : "text-[13px] text-uva-muted-2"
        }
      >
        {checked ? etiquetas[0] : etiquetas[1]}
      </span>
    </div>
  );
}
