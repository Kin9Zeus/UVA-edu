import { createAdminClient } from "@/lib/supabase/admin";
import { registrarSiFalla } from "@/lib/supabase/registrar";

/**
 * Cuántos dispositivos confirmados tiene la verificación en dos pasos de un
 * usuario, para la ficha de /admin/usuarios — FASE 8.1.
 *
 * Con la llave de servicio porque la API normal solo lista los factores
 * propios. Solo cuenta los confirmados: uno a medio registrar no protege nada.
 *
 * Es un dato SECUNDARIO de la ficha (la cuenta se ve igual sin él), así que un
 * fallo no rompe la página: devuelve `null`, que la pantalla dice como «no
 * pudimos comprobarlo», y queda registrado.
 */
export async function contarDispositivosSegundoFactor(usuarioId: string): Promise<number | null> {
  const { data, error } = await createAdminClient().auth.admin.mfa.listFactors({ userId: usuarioId });

  if (registrarSiFalla(error, "admin:segundoFactor", "no se pudieron contar los factores", { usuarioId })) {
    return null;
  }

  return (data?.factors ?? []).filter((factor) => factor.status === "verified").length;
}
