import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * La suscripción que ya ocupa el cupo único ACTIVA/PAST_DUE del usuario
 * (índice parcial `suscripcion_activa_unica_por_usuario`).
 */
export type MembresiaVigente = {
  estado: "ACTIVA" | "PAST_DUE";
  /**
   * true si la otorgó un admin a mano o un código de invitación
   * (`acceso_manual`); false si viene de Stripe/Wompi. Decide qué se le puede
   * decir al admin: solo las manuales tienen un flujo de revocación
   * (`revocarMembresia` rechaza explícitamente las de pago).
   */
  esManual: boolean;
  /** null cuando es un acceso por invitación, que no compra ningún plan (035_canje_codigo_por_dias.sql). */
  planNombre: string | null;
};

/**
 * Qué se le dice al admin cuando el usuario ya tiene una membresía vigente y
 * no se le puede otorgar otra. Función aparte y pura para poder probar las dos
 * ramas sin base de datos — el mensaje ES el arreglo: antes el admin solo veía
 * "No pudimos otorgar la membresía." sin ninguna pista de qué hacer.
 */
export function mensajeMembresiaYaVigente(vigente: MembresiaVigente): string {
  const nombre = vigente.planNombre ?? "Acceso por invitación";

  if (vigente.esManual) {
    return `Este usuario ya tiene una membresía activa (${nombre}). Revócala antes de otorgar una nueva.`;
  }

  return `Este usuario ya tiene una suscripción de pago activa (${nombre}). Cancélala desde la pasarela antes de otorgar un acceso manual.`;
}

/**
 * La suscripción que impide otorgar una membresía manual, o null si el cupo
 * está libre.
 *
 * Se llama DESPUÉS de `cerrar_suscripcion_caducada_admin` (supabase/sql/041),
 * así que lo que sobreviva aquí es una suscripción vigente de verdad — no una
 * caducada que nadie había marcado. Ese RPC resuelve el caso "ya venció por
 * fecha pero la columna sigue diciendo ACTIVA"; este chequeo cubre el otro: el
 * usuario tiene acceso legítimo ahora mismo, y el `insert` de `otorgarMembresia`
 * chocaría contra `suscripcion_activa_unica_por_usuario` con un 23505 crudo.
 *
 * Es el mismo guard previo que `ofrecerCortesia` ya hacía contra el índice
 * único de `inscripciones` — `otorgarMembresia` era la única de las cuatro
 * acciones de este flujo que escribía sin mirar el estado existente.
 *
 * Recibe el cliente ya construido (mismo criterio que
 * `resolverTokenReproduccion`): el Server Action le pasa la sesión real del
 * admin, y `scripts/rls-test.ts` le pasa una autenticada a mano para probarlo
 * llamando la API directamente. Depende de que RLS deje al admin leer
 * suscripciones ajenas (`suscripciones_select_propio`, 003).
 */
export async function buscarMembresiaVigente(
  supabase: SupabaseClient,
  usuarioId: string,
): Promise<MembresiaVigente | null> {
  // `.limit(1)` no es una elección arbitraria: el índice parcial garantiza
  // como máximo UNA fila ACTIVA/PAST_DUE por usuario, así que si hay más de
  // una la base ya está corrupta y no es este el sitio donde detectarlo.
  const { data } = await supabase
    .from("suscripciones")
    .select("estado, acceso_manual, plan:planes(nombre)")
    .eq("id_usuario", usuarioId)
    .in("estado", ["ACTIVA", "PAST_DUE"])
    .limit(1)
    .maybeSingle();

  if (!data) return null;

  const plan = Array.isArray(data.plan) ? data.plan[0] : data.plan;

  return {
    estado: data.estado,
    esManual: data.acceso_manual ?? false,
    planNombre: plan?.nombre ?? null,
  };
}
