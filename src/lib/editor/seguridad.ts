/** Esquemas de URL que el editor y el renderer aceptan en un enlace.
 * Cualquier otro esquema explícito (`javascript:`, `data:`, `vbscript:`,
 * etc.) se rechaza — ver FASE 10/14 del pedido original. Una URL relativa
 * (`/cursos/...`, `#ancla`, sin esquema) siempre se permite. */
const ESQUEMA_SEGURO = /^(https?:|mailto:)/i;
const TIENE_ESQUEMA = /^[a-z][a-z0-9+.-]*:/i;

export function esUrlSegura(href: string): boolean {
  const limpio = href.trim();
  if (!limpio) return false;
  if (TIENE_ESQUEMA.test(limpio)) return ESQUEMA_SEGURO.test(limpio);
  return true;
}
