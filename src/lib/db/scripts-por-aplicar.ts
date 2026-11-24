/**
 * Qué scripts de supabase/sql/ aplica `npm run db:rls` (P2-4,
 * AUDIT-2026-11-23.md). Función pura: la usa scripts/apply-rls.ts.
 *
 * Antes se reaplicaban los 140 en una transacción: cientos de
 * `drop/create policy` tomaban bloqueos exclusivos que se soltaban al COMMIT,
 * y la app quedaba esperando todo ese tiempo (más de 2 minutos en producción).
 *
 * La regla:
 * - Desde el PRIMER script nuevo o con contenido distinto al registrado
 *   (sha256 en `private.rls_aplicados`) hasta el final. No solo el cambiado:
 *   scripts posteriores redefinen lo mismo (139 reescribe el trigger de 013 y
 *   110), y reaplicar uno viejo suelto pisaría la versión vigente.
 * - Todos si hubo una migración de Prisma después de la última corrida: una
 *   migración que borra y recrea una tabla se lleva sus políticas, y solo
 *   reaplicarlo todo las devuelve.
 * - Todos con `--todo` (CI contra staging: prueba que aplican desde cero) o
 *   si la base no tiene registro.
 */
export type ScriptSql = { nombre: string; sha256: string };

export function scriptsPorAplicar<T extends ScriptSql>(entrada: {
  scripts: T[];
  /** nombre → sha256 de lo ya aplicado. */
  registrados: Map<string, string>;
  /** Fin de la última migración de Prisma aplicada. */
  ultimaMigracion: Date | null;
  /** Última corrida de db:rls (máximo `aplicado_en`). */
  ultimoRls: Date | null;
  todo: boolean;
}): { scripts: T[]; motivo: string } {
  const { scripts, registrados, ultimaMigracion, ultimoRls, todo } = entrada;
  if (todo) return { scripts, motivo: "--todo" };
  if (!ultimoRls || registrados.size === 0) return { scripts, motivo: "la base no tiene registro de corridas" };
  if (ultimaMigracion && ultimaMigracion > ultimoRls) {
    return { scripts, motivo: "hubo una migración de Prisma después de la última corrida" };
  }
  const primero = scripts.findIndex((s) => registrados.get(s.nombre) !== s.sha256);
  if (primero === -1) return { scripts: [], motivo: "nada cambió" };
  return { scripts: scripts.slice(primero), motivo: `${scripts[primero].nombre} es nuevo o cambió` };
}
