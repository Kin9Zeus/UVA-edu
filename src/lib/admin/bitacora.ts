import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Registra una acción administrativa en bitacora_administrativa
 * (docs/functional-spec.md Módulo 8 / Flujo 11 y 13). Se llama después de
 * que la mutación principal tuvo éxito; un fallo aquí no debe tumbar la
 * acción ya realizada, así que los llamadores no esperan su resultado.
 */
export async function registrarBitacora(
  supabase: SupabaseClient,
  params: {
    idAdmin: string;
    accion: string;
    entidadAfectada: string;
    idEntidadAfectada?: string;
    detalles?: string;
  },
) {
  await supabase.from("bitacora_administrativa").insert({
    id_admin: params.idAdmin,
    accion: params.accion,
    entidad_afectada: params.entidadAfectada,
    id_entidad_afectada: params.idEntidadAfectada ?? null,
    detalles: params.detalles ?? null,
  });
}
