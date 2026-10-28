import { createClient } from "@/lib/supabase/server";
import { lanzarSiFalla } from "@/lib/supabase/errores";
import { PROVEEDORES_PASARELA } from "@/lib/pagos/proveedores";

/** Filas por página en la tabla de usuarios del panel. */
export const USUARIOS_POR_PAGINA = 25;

export type EstadoSuscripcionListado = "ACTIVA" | "PAST_DUE" | "VENCIDA" | "CANCELADA";

/** De dónde salió el acceso: un código, un administrador a mano o un pago. */
export type OrigenAcceso = "INVITACION" | "MANUAL" | "PAGO";

/** El acceso actual de una persona, para decir de dónde viene y cuándo se acaba. */
export type AccesoListado = {
  /**
   * Estado EFECTIVO, no el crudo de `suscripciones.estado`: el RPC (127) ya
   * reporta VENCIDA cuando la fecha pasó aunque nada haya actualizado la fila.
   */
  estado: EstadoSuscripcionListado;
  origen: OrigenAcceso;
  inicio: string;
  /** null en una suscripción sin fecha de fin. */
  fin: string | null;
  /** null en un acceso por código, que no compra ningún plan. */
  plan: string | null;
  montoCentavos: number | null;
  moneda: string | null;
  proveedor: string;
};

export type UsuarioListado = {
  id: string;
  slug: string;
  nombre: string;
  correo: string;
  rol: "ESTUDIANTE" | "ADMINISTRADOR" | "PROFESOR";
  estado: "ACTIVO" | "SUSPENDIDO";
  fechaRegistro: string;
  cursosInscritos: number;
  /** null = nunca tuvo ninguno. */
  acceso: AccesoListado | null;
  /**
   * Máximo `progreso.actualizado_en` del usuario: la última vez que vio una
   * clase, no la última vez que entró. null = nunca vio ninguna.
   */
  ultimaActividad: string | null;
};

export type FiltroEstudio = "SEMANA" | "PARADOS" | "NUNCA";

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
  estudio?: string;
  origen?: string;
  pagina?: number;
  /** Para contar sin traer filas: el total viene en cada una. */
  porPagina?: number;
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

export function origenDe(proveedor: string): OrigenAcceso {
  if ((PROVEEDORES_PASARELA as readonly string[]).includes(proveedor)) return "PAGO";
  return proveedor === "manual" ? "MANUAL" : "INVITACION";
}

/**
 * Una fila por usuario de la página pedida, con búsqueda, filtros y rango de
 * fechas resueltos en Postgres (`admin_listar_usuarios`, 127). El total de
 * resultados viene en cada fila para armar la paginación sin otra consulta.
 */
export async function getUsuarios(filtros: FiltrosUsuarios = {}): Promise<ResultadoUsuarios> {
  const supabase = await createClient();

  const porPagina = filtros.porPagina ?? USUARIOS_POR_PAGINA;
  const pagina = Math.max(1, filtros.pagina ?? 1);
  const offset = (pagina - 1) * porPagina;

  const { data, error } = await supabase.rpc("admin_listar_usuarios", {
    p_query: filtros.query?.trim() || null,
    p_desde: filtros.desde || null,
    p_hasta: filtros.hasta || null,
    p_rol: limpiar(filtros.rol),
    p_estado: limpiar(filtros.estado),
    p_suscripcion: limpiar(filtros.suscripcion),
    p_estudio: limpiar(filtros.estudio),
    p_origen: limpiar(filtros.origen),
    p_limite: porPagina,
    p_offset: offset,
  });

  // Un fallo no es "no hay usuarios": el admin vería una lista en 0 y tomaría
  // decisiones sobre un dato que no leyó.
  lanzarSiFalla(error, "usuarios:admin_listar_usuarios");
  if (!data) {
    return { usuarios: [], total: 0, pagina, totalPaginas: 1 };
  }

  const filas = data as Array<{
    id: string;
    slug: string | null;
    nombre: string;
    correo: string;
    rol: UsuarioListado["rol"];
    estado: UsuarioListado["estado"];
    fecha_registro: string;
    cursos_inscritos: number;
    suscripcion_estado: EstadoSuscripcionListado | null;
    suscripcion_proveedor: string | null;
    suscripcion_inicio: string | null;
    suscripcion_fin: string | null;
    suscripcion_plan: string | null;
    suscripcion_monto: number | null;
    suscripcion_moneda: string | null;
    ultima_actividad: string | null;
    total_resultados: number;
  }>;

  const total = Number(filas[0]?.total_resultados ?? 0);

  return {
    usuarios: filas.map((fila) => ({
      id: fila.id,
      slug: fila.slug ?? fila.id,
      nombre: fila.nombre,
      correo: fila.correo,
      rol: fila.rol,
      estado: fila.estado,
      fechaRegistro: fila.fecha_registro,
      cursosInscritos: Number(fila.cursos_inscritos),
      acceso:
        fila.suscripcion_estado && fila.suscripcion_proveedor && fila.suscripcion_inicio
          ? {
              estado: fila.suscripcion_estado,
              origen: origenDe(fila.suscripcion_proveedor),
              inicio: fila.suscripcion_inicio,
              fin: fila.suscripcion_fin,
              plan: fila.suscripcion_plan,
              montoCentavos: fila.suscripcion_monto === null ? null : Number(fila.suscripcion_monto),
              moneda: fila.suscripcion_moneda,
              proveedor: fila.suscripcion_proveedor,
            }
          : null,
      ultimaActividad: fila.ultima_actividad,
    })),
    total,
    pagina,
    totalPaginas: Math.max(1, Math.ceil(total / porPagina)),
  };
}

/** Cuántos usuarios cumplen un filtro, sin traerlos. */
export async function contarUsuarios(filtros: Omit<FiltrosUsuarios, "pagina" | "porPagina">): Promise<number> {
  return (await getUsuarios({ ...filtros, porPagina: 1 })).total;
}
