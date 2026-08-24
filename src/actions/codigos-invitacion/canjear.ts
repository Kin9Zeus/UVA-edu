"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type CanjearCodigoResult = { error?: string; success?: true };

const MOTIVO_ERROR: Record<string, string> = {
  codigo_invalido: "Ese código no existe.",
  codigo_inactivo: "Ese código ya no está activo.",
  codigo_vencido: "Ese código venció.",
  codigo_agotado: "Ese código ya alcanzó su límite de usos.",
  ya_canjeado: "Ya canjeaste este código antes.",
  plan_no_encontrado: "El plan de este código ya no existe.",
};

/**
 * Canjea un código de invitación por acceso completo a la plataforma.
 * La validación (vigencia, límite de uso, doble canje) y la creación de
 * la Suscripción viven en public.canjear_codigo_invitacion() (Service
 * Role Key, ver supabase/sql/017_canjear_codigo_invitacion.sql) — nunca
 * un INSERT directo del cliente contra `codigos_invitacion` ni
 * `suscripciones`, mismo criterio que aplicar un cupón en checkout.
 *
 * El usuario se obtiene de la sesión real (cliente de RLS) antes de
 * llamar a la función con Service Role Key, para no confiar en un id
 * que mande el cliente.
 */
export async function canjearCodigoInvitacion(codigo: string): Promise<CanjearCodigoResult> {
  const codigoLimpio = codigo.trim();
  if (!codigoLimpio) {
    return { error: "Ingresa un código." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Tu sesión expiró. Vuelve a iniciar sesión." };
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .rpc("canjear_codigo_invitacion", { p_codigo: codigoLimpio, p_usuario_id: user.id })
    .single();

  if (error) {
    return { error: "No pudimos procesar el código. Intenta de nuevo." };
  }

  const resultado = data as { ok: boolean; motivo: string | null };
  if (!resultado.ok) {
    return { error: MOTIVO_ERROR[resultado.motivo ?? ""] ?? "No pudimos canjear el código." };
  }

  revalidatePath("/dashboard", "layout");
  return { success: true };
}
