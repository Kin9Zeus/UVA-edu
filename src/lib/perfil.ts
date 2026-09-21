import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

/**
 * Usuario de la sesión actual, reducido a lo que realmente consume la app.
 *
 * P2-4 (AUDIT-2026-09-15): antes esto era el `User` completo de Supabase,
 * traído con `auth.getUser()` (un GET a /auth/v1/user en CADA render que
 * necesitara saber quién está mirando — layouts de dashboard y admin, header
 * de las públicas, páginas de curso...). Se revisó a todos los consumidores y
 * ninguno usa más que `id` y `email`, los dos claims estándar del JWT, así
 * que el tipo se estrecha a propósito: si mañana alguien necesita un campo
 * que solo existe en el `User` del servidor (p. ej. `email_confirmed_at`,
 * que NO viaja en el token), va a fallar el typecheck en vez de leer
 * `undefined` en silencio. Ese caso debe pedir `auth.getUser()` por su
 * cuenta, como hace `(public)/verificar-correo/page.tsx`.
 */
export type UsuarioActual = {
  id: string;
  email: string | undefined;
};

/**
 * Quién está haciendo la petición, SIN tocar la red.
 *
 * `getClaims()` verifica la firma del JWT en local con WebCrypto contra el
 * JWKS ES256 del proyecto (cacheado en proceso). La confianza en `sub` es la
 * misma que daba `getUser()`: el token está criptográficamente validado, no
 * solo decodificado. Ver el comentario largo en `src/lib/supabase/proxy.ts`
 * para el detalle del mecanismo y de por qué el refresco de cookies de sesión
 * sigue funcionando igual.
 *
 * Esto es lo que deben usar las Server Actions y los data loaders que solo
 * necesitan el `id` (que es, además, lo único en lo que RLS confía: las
 * policies filtran por `auth.uid()`, que sale de ESTE mismo token). Cada
 * `auth.getUser()` que se evita son ~190 ms de ida y vuelta a Supabase —
 * medido en producción, ver guardia-sesion.ts.
 *
 * Quien necesite un campo que solo existe en el `User` del servidor (p. ej.
 * `email_confirmed_at`, que NO viaja en el token) debe seguir pidiendo
 * `auth.getUser()` por su cuenta, como hace
 * `(public)/verificar-correo/page.tsx`.
 *
 * Va envuelto en `cache()` de React: dentro de un mismo render, el layout, la
 * página y cada data loader comparten una sola resolución.
 */
export const getUsuarioActual = cache(async (): Promise<UsuarioActual | null> => {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims;

  if (!claims) return null;

  return { id: claims.sub, email: claims.email };
});

export const getPerfilActual = cache(async () => {
  const supabase = await createClient();

  const user = await getUsuarioActual();

  if (!user) {
    return { user: null, perfil: null };
  }

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("nombre, correo, celular, pais, rol, estado, foto_url")
    .eq("id", user.id)
    .single();

  return { user, perfil };
});
