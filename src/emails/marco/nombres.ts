/** "Laura Mejía" → "Laura". Vacío si no hay nombre: la plantilla decide el saludo. */
export function primerNombre(nombre: string | null | undefined): string {
  return (nombre ?? "").trim().split(/\s+/)[0] ?? "";
}
