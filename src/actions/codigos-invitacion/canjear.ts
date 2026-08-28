"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type CanjearCodigoResult = {
  error?: string;
  success?: true;
  /**
   * Solo presente cuando `error` viene del rate limit (P2-2): cuántos
   * segundos faltan para que `verificar_limite_canjear_codigo` vuelva a
   * permitir un intento. El cliente lo usa para deshabilitar el formulario
   * con una cuenta regresiva en vez de dejar que seguir dando clic muestre
   * el mismo error una y otra vez.
   */
  segundosEspera?: number;
};

const MOTIVO_ERROR: Record<string, string> = {
  codigo_invalido: "Ese código no existe.",
  codigo_inactivo: "Ese código ya no está activo.",
  codigo_vencido: "Ese código venció.",
  codigo_agotado: "Ese código ya alcanzó su límite de usos.",
  ya_canjeado: "Ya canjeaste este código antes.",
  // Ver 027_canje_valida_suscripcion_activa.sql: el código está bien, lo
  // que sobra es la suscripción vigente. El mensaje lo dice así para que
  // nadie crea que su código no sirve y lo descarte.
  ya_tiene_suscripcion:
    "Ya tienes una suscripción activa. Podrás canjear este código cuando termine, si sigue vigente.",
  // Ya no existe 'plan_no_encontrado': desde
  // 035_canje_codigo_por_dias.sql el código lleva sus propios
  // `duracion_dias` y el canje no consulta ningún plan.
};

/**
 * Canjea un código de invitación por acceso completo a la plataforma.
 * La validación (vigencia, límite de uso, doble canje) y la creación de
 * la Suscripción viven en public.canjear_codigo_invitacion() (Service
 * Role Key, ver supabase/sql/035_canje_codigo_por_dias.sql) — nunca
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

  // Límite por usuario (no por código): el atacante es una sesión ya
  // autenticada probando códigos, y su id sale de auth.getUser() en el
  // servidor, no de un valor que él controle. Ver AUDIT-2026-08-24.md,
  // hallazgo P2-2.
  const { data: limite, error: limiteError } = await admin
    .rpc("verificar_limite_canjear_codigo", { p_usuario_id: user.id })
    .single();

  if (limiteError) {
    return { error: "No pudimos procesar el código. Intenta de nuevo." };
  }

  const { permitido, segundos_espera } = limite as { permitido: boolean; segundos_espera: number };
  if (!permitido) {
    return {
      error: "Demasiados intentos. Espera un momento antes de volver a intentar.",
      segundosEspera: segundos_espera,
    };
  }

  const { data, error } = await admin
    .rpc("canjear_codigo_invitacion", { p_codigo: codigoLimpio, p_usuario_id: user.id })
    .single();

  if (error) {
    await admin.rpc("registrar_canje_fallido", { p_usuario_id: user.id });
    return { error: "No pudimos procesar el código. Intenta de nuevo." };
  }

  const resultado = data as { ok: boolean; motivo: string | null };
  if (!resultado.ok) {
    await admin.rpc("registrar_canje_fallido", { p_usuario_id: user.id });
    return { error: MOTIVO_ERROR[resultado.motivo ?? ""] ?? "No pudimos canjear el código." };
  }

  await admin.rpc("limpiar_intentos_canjear_codigo", { p_usuario_id: user.id });
  revalidatePath("/dashboard", "layout");
  return { success: true };
}
