import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logError } from "@/lib/log";

/**
 * "Monitoreo, alertas, respaldo de base de datos y plan de reversión" —
 * "Chequeo de disponibilidad del sitio cada pocos minutos, con alerta si
 * cae". Pensado para que un servicio externo (UptimeRobot, BetterUptime,
 * etc.) le pegue cada pocos minutos; si el servicio detecta caídas
 * consecutivas dispara su propia alerta (fuera de este repo).
 *
 * Excepción deliberada a la regla de CLAUDE.md "Route Handlers (/api/):
 * reservados únicamente para Webhooks externos" — un healthcheck no es un
 * webhook, pero un monitor externo solo puede pegarle a una URL con GET
 * simple (ni Server Actions ni Middleware sirven para eso). Documentado acá
 * y en CLAUDE.md para que no se lea como un descuido.
 *
 * Solo confirma que Supabase responde de verdad (la causa de caída más
 * probable y la única que un ping HTTP normal no detectaría por sí solo,
 * ya que el proceso de Next.js puede seguir "arriba" mientras la base no
 * responde). Mux/Resend son solo un chequeo de que las variables existen
 * -no una llamada de red a su API- para no gastar cuota de esos servicios
 * en cada ping de un monitor que puede correr cada 1-5 min.
 */

export const dynamic = "force-dynamic";

async function verificarSupabase(): Promise<{ ok: boolean; error?: string }> {
  try {
    const admin = createAdminClient();
    const { error } = await admin.from("categorias").select("id").limit(1);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export async function GET() {
  const supabase = await verificarSupabase();
  const mux = Boolean(process.env.MUX_TOKEN_ID && process.env.MUX_TOKEN_SECRET);
  const resend = Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL);

  const ok = supabase.ok && mux && resend;
  const checks = {
    supabase: { ok: supabase.ok },
    mux: { ok: mux },
    resend: { ok: resend },
  };

  if (!ok) {
    // El mensaje de error de Supabase (supabase.error) se manda a Sentry,
    // nunca a la respuesta pública: un healthcheck sin autenticación no
    // debería filtrar detalles internos a quien le pegue.
    logError("health", "chequeo de salud falló", null, { area: "health", ...checks, supabaseError: supabase.error });
  }

  return NextResponse.json({ ok, timestamp: new Date().toISOString(), checks }, { status: ok ? 200 : 503 });
}
