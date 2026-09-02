"use client";

import Link from "next/link";
import { Checkbox } from "@/components/ui/checkbox";

/**
 * Selector de los profesores que dictan un curso. Es múltiple porque
 * `curso_instructores` es una tabla puente muchos-a-muchos: un curso puede
 * dictarlo más de una persona y aparecer con las dos en el catálogo.
 *
 * La lista son cuentas reales con rol PROFESOR (`getPerfilesProfesor()` en
 * lib/admin/profesores.ts), no fichas de catálogo. Por eso ya no hay un botón
 * "+ Nuevo instructor": una fila de `perfiles` solo puede nacer del trigger
 * sobre `auth.users` (supabase/sql/000_trigger_perfiles.sql), así que no se
 * puede crear una cuenta desde un modal de dos campos — la persona se registra
 * y un administrador la asciende desde Usuarios.
 *
 * Mismo patrón visual y de accesibilidad que SelectorCategorias (role="group"
 * + aria-labelledby), para que las dos listas del formulario se comporten
 * igual.
 */
export function SelectorInstructores({
  instructores,
  seleccionados,
  onChange,
  id = "curso-instructores",
}: {
  instructores: { id: string; nombre: string }[];
  seleccionados: string[];
  onChange: (ids: string[]) => void;
  id?: string;
}) {
  function alternar(instructorId: string, marcado: boolean) {
    onChange(
      marcado
        ? [...seleccionados, instructorId]
        : seleccionados.filter((actual) => actual !== instructorId),
    );
  }

  if (instructores.length === 0) {
    return (
      <p className="text-xs text-uva-text-faint">
        Ningún usuario tiene rol Profesor todavía — asciende uno desde{" "}
        <Link href="/admin/usuarios" className="text-uva-accent hover:underline">
          Usuarios
        </Link>
        .
      </p>
    );
  }

  return (
    <div
      role="group"
      aria-labelledby={`${id}-label`}
      className="flex max-h-[180px] flex-col gap-0.5 overflow-auto rounded-uva-md border border-uva-divider p-2"
    >
      {instructores.map((instructor) => {
        const inputId = `${id}-${instructor.id}`;
        return (
          <label
            key={instructor.id}
            htmlFor={inputId}
            className="flex cursor-pointer items-center gap-2.5 rounded-uva-md px-2 py-1.5 text-[13.5px] text-uva-text hover:bg-uva-surface-2"
          >
            <Checkbox
              id={inputId}
              checked={seleccionados.includes(instructor.id)}
              onCheckedChange={(marcado) => alternar(instructor.id, marcado === true)}
            />
            {instructor.nombre}
          </label>
        );
      })}
    </div>
  );
}
