import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

/**
 * Nivel de seguridad de la sesión (Authenticator Assurance Level) — FASE 8.1
 * del plan de blindaje: 2FA obligatorio para administradores.
 *
 *   aal1  la persona demostró algo que SABE: la contraseña (o entró con Google).
 *   aal2  además demostró algo que TIENE: el código de su app de autenticación.
 *
 * Supabase escribe el nivel en el claim `aal` del token de acceso. Un token sin
 * ese claim es aal1 (así lo documenta Supabase).
 */
export type NivelAal = "aal1" | "aal2";

/**
 * Nivel que declaran unos claims ya verificados.
 *
 * Falla CERRADO: solo el valor exacto "aal2" cuenta como aal2. Un claim
 * ausente, de otro tipo o con un valor que no conocemos es aal1, porque quien
 * llama usa esto para DECIDIR si deja pasar a un administrador. Equivocarse
 * hacia aal1 manda a alguien a escribir su código; equivocarse hacia aal2 le
 * abre el panel sin segundo factor.
 */
export function nivelAalDeClaims(claims: { aal?: unknown } | null | undefined): NivelAal {
  return claims?.aal === "aal2" ? "aal2" : "aal1";
}

/**
 * Nivel de la sesión actual, SIN tocar la red.
 *
 * Es la misma lectura que `getUsuarioActual()` (src/lib/perfil.ts):
 * `getClaims()` verifica la firma del JWT en local, así que el claim `aal` es
 * de fiar, no solo está decodificado. `null` = no hay sesión.
 *
 * Va en `cache()` de React por la misma razón que `getUsuarioActual()`: el
 * layout, la página y cada data loader de un mismo render comparten una sola
 * resolución.
 *
 * OJO: el nivel de un token ya emitido no cambia hasta que se renueva. Al
 * verificar el código, Supabase entrega un token nuevo con aal2; al quitar un
 * factor, el token viejo sigue diciendo aal2 hasta que venza o se refresque.
 */
export const getNivelAalActual = cache(async (): Promise<NivelAal | null> => {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims;

  if (!claims) return null;

  return nivelAalDeClaims(claims);
});

/** `true` solo si hay sesión y es aal2. Sin sesión o en aal1, `false`. */
export async function sesionEsAal2(): Promise<boolean> {
  return (await getNivelAalActual()) === "aal2";
}
