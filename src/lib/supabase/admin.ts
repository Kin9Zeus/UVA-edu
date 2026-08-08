import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Cliente con Service Role Key: se salta RLS por diseño.
 * Uso exclusivo en Route Handlers de webhooks (Stripe/Wompi/Mux) y Server
 * Actions de administrador que ya validaron el rol ADMINISTRADOR.
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
