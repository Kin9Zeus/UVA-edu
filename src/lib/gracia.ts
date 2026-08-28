/**
 * Días de gracia que Revcurso ofrece a una suscripción PAST_DUE antes de
 * cortar el acceso.
 *
 * Este valor está DUPLICADO en SQL: la vista `metricas_panel_usuarios`
 * (supabase/sql/036_vistas_metricas_panel.sql) decide con `interval '5 days'`
 * quién cuenta como "acceso vigente", y Postgres no puede importar una
 * constante de TypeScript. Si cambias este número, cambia también el de la
 * vista — hay un test que falla si se separan (src/lib/gracia.test.ts).
 */
export const DURACION_GRACIA_DIAS = 5;

/**
 * Días de gracia restantes de una suscripción PAST_DUE, a partir de su
 * fecha de renovación vencida.
 *
 * Separada de `src/app/(student)/dashboard/layout.tsx`, que la llama,
 * para no invocar `Date.now()` desde el cuerpo de un componente — regla
 * `react-hooks/purity` (P2-2, AUDIT-2026-08-26.md). `ahora` es
 * inyectable para poder probarla sin depender del reloj real.
 */
export function calcularDiasGracia(fechaRenovacion: string, ahora: Date = new Date()): number {
  const finGracia = new Date(fechaRenovacion).getTime() + DURACION_GRACIA_DIAS * 86_400_000;
  return Math.max(0, Math.ceil((finGracia - ahora.getTime()) / 86_400_000));
}
