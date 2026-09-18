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
type UsuarioActual = {
  id: string;
  email: string | undefined;
};

export const getPerfilActual = cache(async () => {
  const supabase = await createClient();

  // `getClaims()` verifica la firma del JWT en local con WebCrypto contra el
  // JWKS ES256 del proyecto (cacheado en proceso), sin red. La confianza en
  // `sub` es la misma que daba `getUser()`: el token está criptográficamente
  // validado, no solo decodificado. Ver el comentario largo en
  // `src/lib/supabase/proxy.ts` para el detalle del mecanismo y de por qué el
  // refresco de cookies de sesión sigue funcionando igual.
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims;

  if (!claims) {
    return { user: null, perfil: null };
  }

  const user: UsuarioActual = { id: claims.sub, email: claims.email };

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("nombre, correo, celular, pais, rol, estado, foto_url")
    .eq("id", user.id)
    .single();

  return { user, perfil };
});
