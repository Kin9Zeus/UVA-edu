import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { lanzarSiFalla } from "@/lib/supabase/errores";

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
 * Cuánto dura el código escrito — FASE 8.3, tarea 4 del plan de blindaje.
 *
 * El cierre por inactividad de Supabase es de plan de pago, y una sesión de
 * Supabase no caduca sola: una cookie de sesión robada valdría para siempre.
 * El plan prevé la alternativa: que la app limite cuánto vale el segundo
 * factor. Pasadas estas horas desde que se escribió el código, la sesión cuenta
 * como aal1 y el administrador vuelve a /seguridad/verificar.
 *
 * Doce horas: una jornada de trabajo completa sin pedir el código a media
 * tarde, y nunca de un día para otro.
 *
 * El mismo límite está en la base (`private.segundo_factor_vigente()`,
 * supabase/sql/131_admin_exige_aal2.sql, en segundos). Si cambia aquí, cambia
 * allá: lo comprueba aal.test.ts.
 */
export const HORAS_MAXIMAS_SEGUNDO_FACTOR = 12;

/**
 * Nivel que declaran unos claims ya verificados, teniendo en cuenta cuándo se
 * escribió el código.
 *
 * Falla CERRADO: solo cuenta como aal2 el claim `aal` exacto "aal2" CON un
 * código reciente. Un claim ausente, de otro tipo o con un valor que no
 * conocemos es aal1, porque quien llama usa esto para DECIDIR si deja pasar a
 * un administrador. Equivocarse hacia aal1 manda a alguien a escribir su
 * código; equivocarse hacia aal2 le abre el panel sin segundo factor.
 */
export function nivelAalDeClaims(
  claims: { aal?: unknown; amr?: unknown } | null | undefined,
  ahoraMs: number = Date.now(),
): NivelAal {
  if (claims?.aal !== "aal2") return "aal1";
  return codigoReciente(claims.amr, ahoraMs) ? "aal2" : "aal1";
}

/**
 * ¿El código de la app se escribió hace menos de HORAS_MAXIMAS_SEGUNDO_FACTOR?
 *
 * El claim `amr` del token lista cómo se autenticó la sesión. Supabase lo emite
 * con la hora de cada método (`[{ method: "totp", timestamp: 1666086056 }]`), o
 * en el formato del RFC 8176, solo con nombres. Con nombres no hay hora que
 * medir: tratarlo como caducado dejaría a los administradores en un bucle
 * (escriben el código y el token sigue sin hora), así que ahí solo vale el
 * nivel aal2, sin límite. Un `amr` vacío o con una forma desconocida en una
 * sesión aal2 es raro, y se trata como no reciente.
 */
function codigoReciente(amr: unknown, ahoraMs: number): boolean {
  if (!Array.isArray(amr) || amr.length === 0) return false;
  if (amr.every((metodo) => typeof metodo === "string")) return true;

  const horasDeCodigo = amr
    .filter(
      (metodo): metodo is { method: string; timestamp: number } =>
        typeof metodo === "object" &&
        metodo !== null &&
        (metodo as { method?: unknown }).method === "totp" &&
        typeof (metodo as { timestamp?: unknown }).timestamp === "number",
    )
    .map((metodo) => metodo.timestamp);

  if (horasDeCodigo.length === 0) return false;

  const segundosDesdeElCodigo = ahoraMs / 1000 - Math.max(...horasDeCodigo);
  return segundosDesdeElCodigo <= HORAS_MAXIMAS_SEGUNDO_FACTOR * 3600;
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
 * Y aunque diga aal2, pasadas HORAS_MAXIMAS_SEGUNDO_FACTOR desde el código esto
 * devuelve aal1 (ver nivelAalDeClaims).
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

/**
 * A qué pantalla se manda a un administrador que llega con sesión aal1:
 *
 *   "verificar"  ya tiene un factor confirmado: solo le falta escribir el código.
 *   "activar"    no tiene ninguno: tiene que registrar su app de autenticación.
 *
 * Esto SÍ cuesta una ida a Supabase (`listFactors` pregunta por el usuario),
 * así que solo se llama cuando la sesión ya se sabe aal1: nunca en el camino
 * normal de un administrador aal2.
 *
 * `data.totp` trae únicamente los factores CONFIRMADOS; uno a medio registrar
 * (el QR se escaneó pero nunca se escribió el código) está en `data.all` y no
 * cuenta: esa persona sigue necesitando activar.
 *
 * Si la consulta falla se lanza: no se sabe a cuál pantalla mandarla, y
 * adivinar mal mandaría a quien YA tiene factor a registrar otro.
 */
export type PantallaSegundoFactor = "activar" | "verificar";

export async function pantallaDeSegundoFactor(): Promise<PantallaSegundoFactor> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.mfa.listFactors();
  lanzarSiFalla(error, "mfa:factores");

  return (data?.totp ?? []).length > 0 ? "verificar" : "activar";
}

/** Ruta de la pantalla del segundo factor, con el destino al que volver. */
export function rutaSegundoFactor(pantalla: PantallaSegundoFactor, destino: string): string {
  return `/seguridad/${pantalla}?redirect=${encodeURIComponent(destino)}`;
}

/**
 * ¿Esta persona puede usar HOY poderes de administrador? Solo si su rol es
 * ADMINISTRADOR **y** su sesión es aal2.
 *
 * Es para las rutas que conceden poder de administrador SIN pasar por
 * `requireAdmin()` (moderar, ver todo el catálogo, publicar anuncios). Un
 * administrador con sesión aal1 —contraseña robada, o recién entrado y aún sin
 * escribir su código— se trata ahí como una persona normal: no recibe el poder,
 * pero tampoco se le rompe nada de lo que sí puede hacer como estudiante.
 *
 * Mira el nivel de la SESIÓN en curso. Úsalo solo para decidir sobre quien hace
 * la petición, nunca sobre otro usuario.
 */
export async function esAdminConSegundoFactor(rol: string | null | undefined): Promise<boolean> {
  return rol === "ADMINISTRADOR" && (await getNivelAalActual()) === "aal2";
}
