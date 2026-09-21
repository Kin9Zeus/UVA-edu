/**
 * Caché en proceso del par de comprobaciones que `src/proxy.ts` hace en CADA
 * petición a una ruta protegida: `email_confirmed_at` (que no viaja en el
 * JWT) y `perfiles.estado` (para sacar a una cuenta recién suspendida).
 *
 * El porqué, medido en producción y no supuesto: Railway corre en US-West y
 * Supabase en US-East, así que cada llamada a Supabase desde el servidor
 * cuesta ~190 ms de ida y vuelta (aislado con la caché de 30 s de
 * `/api/health`: 374 ms con una consulta contra 182 ms sin ninguna). Esas dos
 * comprobaciones iban además en SERIE, así que sumaban ~380 ms de peaje fijo
 * a todo lo que pasa por el proxy — no solo a cargar una página, también a
 * cada Server Action (dar "me gusta", publicar un comentario), a cada
 * navegación del cliente y a cada latido de `/api/progreso/beacon`. Un "me
 * gusta" pagaba ese peaje tres veces: en la acción, y otra vez en la recarga
 * del feed que la acción dispara.
 *
 * ¿Por qué se puede cachear sin abrir un hueco? Porque ninguna de las dos
 * comprobaciones es la frontera de seguridad — las dos son comodidad de UX
 * por encima de una guardia que ya vive en la base de datos:
 *
 *   - Suspensión: `private.cuenta_activa()` (019_cuenta_activa_rls.sql) está
 *     en el WITH CHECK de toda policy de ESCRITURA, en 7 archivos de SQL. Una
 *     cuenta suspendida no puede escribir nada, ni siquiera usando su JWT
 *     directo contra PostgREST saltándose la app entera. Y sus LECTURAS están
 *     permitidas a propósito (ver el comentario de cabecera de 019: debe poder
 *     seguir viendo su progreso y sus certificados). O sea que lo único que
 *     esta caché puede retrasar es el redirect a /login, hasta 30 s.
 *   - Correo verificado: `private.correo_verificado()`
 *     (008_correo_verificado_rls.sql) hace lo mismo en RLS, y con "Confirm
 *     email" activo en Supabase el login ya rechaza la cuenta antes de crear
 *     sesión (src/actions/auth/login.ts) — el propio proxy documentaba que
 *     este caso "casi nunca se alcanza".
 *
 * La caché es por proceso, igual que la de `/api/health` y con el mismo
 * caveat: se pierde en cada despliegue y, con más de una instancia, cada una
 * lleva la suya. Da igual para lo que hace — no es un dato que deba ser
 * consistente entre instancias, es un amortiguador.
 *
 * No se cachea el caso "el usuario ya no existe": eso se vuelve a comprobar
 * siempre, porque es el único desenlace del que no hay vuelta atrás.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type GuardiaSesion = {
  correoVerificado: boolean;
  suspendido: boolean;
};

/** 30 s: cómodamente por debajo de lo que un humano tarda en notar que sigue
 *  dentro tras ser suspendido, y suficiente para que una ráfaga de peticiones
 *  (cargar una pantalla + sus acciones) pague la red una sola vez. */
const TTL_MS = 30_000;

/** Tope de entradas para que esto no crezca sin límite en un proceso de larga
 *  vida. Cuando se llena se vacía entero en vez de aplicar LRU: la caché se
 *  rehace sola en la siguiente petición de cada usuario y el coste de esa
 *  purga es como mucho una consulta por usuario activo. */
const MAX_ENTRADAS = 5_000;

const cache = new Map<string, { valor: GuardiaSesion; expiraEn: number }>();

/**
 * Invalida la entrada de un usuario. La llama `suspenderUsuario` para que la
 * suspensión no espere al TTL en el proceso que la ejecuta.
 *
 * Con varias instancias de Railway, las demás siguen con su copia hasta 30 s
 * — que es exactamente el caso descrito arriba, y es inocuo.
 */
export function olvidarGuardiaSesion(usuarioId: string) {
  cache.delete(usuarioId);
}

export async function getGuardiaSesion(
  supabase: SupabaseClient,
  usuarioId: string,
): Promise<GuardiaSesion | null> {
  const enCache = cache.get(usuarioId);
  if (enCache && enCache.expiraEn > Date.now()) {
    return enCache.valor;
  }

  // En PARALELO, no en serie: aunque haya fallo de caché, esto cuesta un
  // round-trip y no dos. Antes se encadenaban (getUser y después perfiles),
  // que era la mitad de los ~380 ms.
  const [{ data: usuario }, { data: perfil }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from("perfiles").select("estado").eq("id", usuarioId).single(),
  ]);

  // Sesión inválida del lado del servidor de Auth: no se cachea, el llamador
  // manda a /login.
  if (!usuario.user) {
    cache.delete(usuarioId);
    return null;
  }

  const valor: GuardiaSesion = {
    correoVerificado: Boolean(usuario.user.email_confirmed_at),
    suspendido: perfil?.estado === "SUSPENDIDO",
  };

  if (cache.size >= MAX_ENTRADAS) {
    cache.clear();
  }
  cache.set(usuarioId, { valor, expiraEn: Date.now() + TTL_MS });

  return valor;
}
