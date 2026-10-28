import { createClient } from "@/lib/supabase/server";
import { lanzarSiFalla } from "@/lib/supabase/errores";

/**
 * KPIs del panel de usuarios (RevUsuariof4). Todo se agrega en Postgres:
 * la vista `metricas_panel_usuarios` (supabase/sql/036) devuelve una sola
 * fila y esta función solo la lee.
 *
 * Los KPIs NO respetan el filtro de rango de fechas de la tabla, a
 * propósito: "cupos disponibles" es un saldo, no un flujo, y acotarlo a un
 * periodo no significa nada (docs/fase4-panel-usuarios.md §6.0).
 *
 * Nota de vocabulario: aquí y en el SQL se dice "cupo" porque es el término
 * de RevUsuariof4.md y de las columnas de la vista. **La interfaz dice
 * "invitaciones"**, que es el objeto que el administrador realmente crea y
 * reparte; "cupo" no se entendía sin explicación. Los nombres internos no se
 * renombraron para no separarlos de la especificación ni de la base.
 */
export type MetricasPanel = {
  /** Suma de `limite_usos` de todos los códigos emitidos. */
  cuposTotales: number;
  /** Suscripciones que nacieron de un código. Se cuenta por la llave foránea, no por `veces_usado`. */
  cuposCanjeados: number;
  /** Usos que todavía se pueden canjear: códigos activos y no vencidos. */
  cuposDisponibles: number;
  /** Usos que ya nadie puede canjear porque el código se venció o se desactivó. */
  cuposCaducados: number;
  /** Accesos que un admin otorgó a mano, sin código de por medio: no consumen cupo. */
  accesosOtorgadosAdmin: number;
  usuariosRegistrados: number;
  usuariosAccesoVigente: number;
  usuariosAccesoVencido: number;
  usuariosSinAcceso: number;
  usuariosActivos7d: number;
};

const METRICAS_VACIAS: MetricasPanel = {
  cuposTotales: 0,
  cuposCanjeados: 0,
  cuposDisponibles: 0,
  cuposCaducados: 0,
  accesosOtorgadosAdmin: 0,
  usuariosRegistrados: 0,
  usuariosAccesoVigente: 0,
  usuariosAccesoVencido: 0,
  usuariosSinAcceso: 0,
  usuariosActivos7d: 0,
};

export async function getMetricasPanel(): Promise<MetricasPanel> {
  const supabase = await createClient();

  const { data, error: errorData } = await supabase.from("metricas_panel_usuarios").select("*").maybeSingle();
  lanzarSiFalla(errorData, "metricas:metricas_panel_usuarios");
  if (!data) return METRICAS_VACIAS;

  return {
    cuposTotales: Number(data.cupos_totales),
    cuposCanjeados: Number(data.cupos_canjeados),
    cuposDisponibles: Number(data.cupos_disponibles),
    cuposCaducados: Number(data.cupos_caducados),
    accesosOtorgadosAdmin: Number(data.accesos_otorgados_admin),
    usuariosRegistrados: Number(data.usuarios_registrados),
    usuariosAccesoVigente: Number(data.usuarios_acceso_vigente),
    usuariosAccesoVencido: Number(data.usuarios_acceso_vencido),
    usuariosSinAcceso: Number(data.usuarios_sin_acceso),
    usuariosActivos7d: Number(data.usuarios_activos_7d),
  };
}
