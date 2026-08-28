"use server";

import { createClient } from "@/lib/supabase/server";
import { resolverTokenReproduccion, type TokenReproduccionResultado } from "@/lib/video/reproduccion";

export type { TokenReproduccionResultado };

/**
 * Genera el token firmado para reproducir el video de una lección.
 *
 * Envoltorio delgado a propósito: `createClient()` depende de `cookies()`
 * de `next/headers`, que solo existe dentro de una petición real de Next —
 * por eso no puede probarse llamándolo directo desde un script (como sí se
 * hace con RLS en scripts/rls-test.ts). La lógica real —la que decide si
 * hay acceso vigente y firma el JWT— vive en
 * `resolverTokenReproduccion()` (src/lib/video/reproduccion.ts), que recibe
 * el cliente ya construido y por eso sí es invocable directamente con un
 * cliente autenticado a mano, como hace `scripts/rls-test.ts`.
 */
export async function obtenerTokenReproduccion(leccionId: string): Promise<TokenReproduccionResultado> {
  const supabase = await createClient();
  return resolverTokenReproduccion(supabase, leccionId);
}
