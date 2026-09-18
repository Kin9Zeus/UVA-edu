import { NextResponse } from "next/server";

/**
 * Envelope de error único para Route Handlers (P3-2, AUDIT-2026-09-15.md).
 *
 * Los 5 Route Handlers que ya existen hoy (webhooks de Stripe/Wompi/Mux/
 * Supabase Auth, /api/health) NO se migraron a esto a propósito: son el
 * código que procesa pagos reales y el pipeline de video en producción, y
 * ninguna pasarela externa lee el body de una respuesta de error — solo el
 * status code. Migrar esos 32 sitios no corrige ningún bug, solo agrega
 * riesgo al código más sensible de la plataforma por un cambio cosmético.
 * Ver la anotación de P3-2 en AUDIT-2026-09-15.md.
 *
 * Usar esto en cualquier Route Handler NUEVO (recordá: `/api/` es solo para
 * webhooks externos y `/api/health`, CLAUDE.md §3.1 — todo lo demás va por
 * Server Actions).
 */
export function errorApi(mensaje: string, status: number, extra?: Record<string, unknown>) {
  return NextResponse.json({ error: mensaje, ...extra }, { status });
}
