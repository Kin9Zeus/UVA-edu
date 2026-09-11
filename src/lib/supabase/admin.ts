import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Cliente con Service Role Key: se salta RLS por diseño.
 * Uso exclusivo en Route Handlers de webhooks (Stripe/Wompi/Mux), el
 * healthcheck (src/app/api/health/route.ts, solo lectura), Server Actions
 * de administrador que ya validaron el rol ADMINISTRADOR, y Server Actions
 * de cualquier usuario que YA confirmaron con el cliente de sesión (RLS de
 * una tabla) que tiene acceso a un archivo de Storage antes de firmar su
 * URL con este cliente — nunca para decidir autorización por sí mismo, solo
 * para el permiso de Storage que ese usuario no tiene directo (ver
 * obtenerUrlRecurso en src/actions/cursos/recurso.ts y
 * obtenerUrlAdjuntoComunidad en src/actions/comunidad/adjunto.ts).
 * Nunca exponer ni importar desde código que corra en el cliente.
 */
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
