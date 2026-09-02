import { createClient } from "@/lib/supabase/server";
import { tipoAccesoGratuito, type TipoAccesoGratuito } from "@/lib/estadoAcceso";

/** Filas por página en la tabla de usuarios del panel. */
export const USUARIOS_POR_PAGINA = 25;

export type EstadoSuscripcionListado = "ACTIVA" | "PAST_DUE" | "VENCIDA" | "CANCELADA";

export type UsuarioListado = {
  id: string;
  nombre: string;
  correo: string;
  rol: "ESTUDIANTE" | "ADMINISTRADOR" | "PROFESOR";
  estado: "ACTIVO" | "SUSPENDIDO";
  fechaRegistro: string;
  cursosInscritos: number;
  /**
   * Estado EFECTIVO, no el crudo de `suscripciones.estado`: el RPC
   * (supabase/sql/040) ya reporta VENCIDA cuando la fecha pasó aunque nada
   * haya actualizado la fila todavía. No hace falta re-derivarlo aquí.
   */
  suscripcionEstado: EstadoSuscripcionListado | null;
  /** null = sin suscripción o de pago. Misma clasificación que ve el estudiante, ver src/lib/estadoAcceso.ts. */
  tipoAccesoSuscripcion: TipoAccesoGratuito | null;
  /**
   * Máximo `progreso.actualizado_en` del usuario. Es actividad DE CONTENIDO,
   * no último ingreso: quien entra, navega el catálogo y se va sin abrir un
   * video sale aquí como `null`. La UI lo rotula en consecuencia.
   */
  ultimaActividad: string | null;
};

export type FiltrosUsuarios = {
  /** Búsqueda por nombre o correo. La escribe el buscador del header y viaja por la URL. */
  query?: string;
  /** Rango sobre la fecha de registro, inclusivo en ambos extremos (YYYY-MM-DD). */
  desde?: string;
  hasta?: string;
  rol?: string;
  estado?: string;
  /** Estado de suscripción, o "SIN_SUSCRIPCION" para quienes no tienen ninguna. */
  suscripcion?: string;
  pagina?: number;
};

export type ResultadoUsuarios = {
  usuarios: UsuarioListado[];
  total: number;
  pagina: number;
  totalPaginas: number;
};

/** "todos" es el valor centinela de los `Select` de la tabla; para el RPC es "sin filtro". */
function limpiar(valor: string | undefined): string | null {
  if (!valor || valor === "todos") return null;
  return valor;
}

/**
 * Una fila por usuario de la página pedida, con búsqueda, filtros y rango de
 * fechas resueltos en Postgres.
 *
 * Antes esta función traía TODAS las filas de `perfiles`, `suscripciones` e
 * `inscripciones` y las cruzaba con `Map` en JavaScript: tres escaneos
 * completos por carga de página. Ahora es una sola llamada a
 * `admin_listar_usuarios` (supabase/sql/037), que además devuelve el total de
 * resultados en cada fila para armar la paginación sin una segunda consulta —
 * mismo patrón que `buscarCatalogo` en src/lib/categoria.ts.
 */
export async function getUsuarios(filtros: FiltrosUsuarios = {}): Promise<ResultadoUsuarios> {
  const supabase = await createClient();

  const pagina = Math.max(1, filtros.pagina ?? 1);
  const offset = (pagina - 1) * USUARIOS_POR_PAGINA;

  const { data, error } = await supabase.rpc("admin_listar_usuarios", {
    p_query: filtros.query?.trim() || null,
    p_desde: filtros.desde || null,
    p_hasta: filtros.hasta || null,
    p_rol: limpiar(filtros.rol),
    p_estado: limpiar(filtros.estado),
    p_suscripcion: limpiar(filtros.suscripcion),
    p_limite: USUARIOS_POR_PAGINA,
    p_offset: offset,
  });

  if (error || !data) {
    return { usuarios: [], total: 0, pagina, totalPaginas: 1 };
  }

  const filas = data as Array<{
    id: string;
    nombre: string;
    correo: string;
    rol: UsuarioListado["rol"];
    estado: UsuarioListado["estado"];
    fecha_registro: string;
    cursos_inscritos: number;
    suscripcion_estado: EstadoSuscripcionListado | null;
    suscripcion_acceso_manual: boolean | null;
    suscripcion_tiene_codigo: boolean | null;
    ultima_actividad: string | null;
    total_resultados: number;
  }>;

  const total = Number(filas[0]?.total_resultados ?? 0);

  return {
    usuarios: filas.map((fila) => ({
      id: fila.id,
      nombre: fila.nombre,
      correo: fila.correo,
      rol: fila.rol,
      estado: fila.estado,
      fechaRegistro: fila.fecha_registro,
      cursosInscritos: Number(fila.cursos_inscritos),
      suscripcionEstado: fila.suscripcion_estado,
      tipoAccesoSuscripcion: fila.suscripcion_estado
        ? tipoAccesoGratuito({
            accesoManual: fila.suscripcion_acceso_manual ?? false,
            tieneCodigoInvitacion: fila.suscripcion_tiene_codigo ?? false,
          })
        : null,
      ultimaActividad: fila.ultima_actividad,
    })),
    total,
    pagina,
    totalPaginas: Math.max(1, Math.ceil(total / USUARIOS_POR_PAGINA)),
  };
}
