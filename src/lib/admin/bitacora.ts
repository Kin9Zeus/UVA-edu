import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

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

/** Filas por página en la pantalla de bitácora. */
export const BITACORA_POR_PAGINA = 30;

/**
 * Tipos de `entidad_afectada` que guardan un id de USUARIO en
 * `id_entidad_afectada` (perfiles.id directo, o el usuario dueño de la
 * suscripción/inscripción — ver otorgarMembresia, quitarCortesia,
 * revocarMembresia en src/actions/admin/usuarios.ts). Son los únicos donde
 * vale la pena resolver un nombre y un enlace a /admin/usuarios/[id]: el
 * resto de entidades (cursos, categorías...) no lo necesita para esta
 * pantalla.
 */
const ENTIDADES_DE_USUARIO = new Set(["perfiles", "suscripciones", "inscripciones"]);

export type EntradaBitacora = {
  id: string;
  creadoEn: string;
  adminNombre: string;
  adminCorreo: string;
  accion: string;
  entidadAfectada: string;
  detalles: string | null;
  /** Solo cuando `entidadAfectada` es de usuario y se pudo resolver el nombre — ver ENTIDADES_DE_USUARIO. */
  usuarioAfectadoId: string | null;
  usuarioAfectadoNombre: string | null;
};

export type ResultadoBitacora = {
  entradas: EntradaBitacora[];
  total: number;
  pagina: number;
  totalPaginas: number;
};

/**
 * Trae una página de la bitácora, más reciente primero. RLS
 * (`bitacora_solo_admin`, 003_rls_membresia_y_gestion.sql) ya la restringe a
 * administradores — esta función no repite esa comprobación, la hereda del
 * cliente de sesión igual que el resto de `lib/admin/*`.
 */
export async function getBitacora(pagina: number = 1): Promise<ResultadoBitacora> {
  const supabase = await createClient();
  const paginaSegura = Math.max(1, pagina);
  const desde = (paginaSegura - 1) * BITACORA_POR_PAGINA;
  const hasta = desde + BITACORA_POR_PAGINA - 1;

  const { data, count, error } = await supabase
    .from("bitacora_administrativa")
    .select(
      "id, creado_en, accion, entidad_afectada, id_entidad_afectada, detalles, admin:perfiles(nombre, correo)",
      { count: "exact" },
    )
    .order("creado_en", { ascending: false })
    .range(desde, hasta);

  if (error || !data) {
    return { entradas: [], total: 0, pagina: paginaSegura, totalPaginas: 1 };
  }

  // Segunda consulta, no un join: `id_entidad_afectada` no es una FK real
  // hacia `perfiles` (según la fila, apunta a perfiles, suscripciones,
  // cursos...), así que PostgREST no puede resolverlo en el embed de
  // arriba. Se resuelve a mano solo para las entidades donde SÍ es un id de
  // usuario, en un solo IN() para toda la página.
  const idsUsuario = [
    ...new Set(
      data
        .filter((fila) => ENTIDADES_DE_USUARIO.has(fila.entidad_afectada) && fila.id_entidad_afectada)
        .map((fila) => fila.id_entidad_afectada as string),
    ),
  ];

  const nombresPorId = new Map<string, string>();
  if (idsUsuario.length > 0) {
    const { data: perfiles } = await supabase.from("perfiles").select("id, nombre").in("id", idsUsuario);
    for (const perfil of perfiles ?? []) nombresPorId.set(perfil.id, perfil.nombre);
  }

  const entradas: EntradaBitacora[] = data.map((fila) => {
    const admin = Array.isArray(fila.admin) ? fila.admin[0] : fila.admin;
    const esDeUsuario = ENTIDADES_DE_USUARIO.has(fila.entidad_afectada) && fila.id_entidad_afectada;
    return {
      id: fila.id,
      creadoEn: fila.creado_en,
      adminNombre: admin?.nombre ?? "Administrador eliminado",
      adminCorreo: admin?.correo ?? "",
      accion: fila.accion,
      entidadAfectada: fila.entidad_afectada,
      detalles: fila.detalles,
      usuarioAfectadoId: esDeUsuario ? (fila.id_entidad_afectada as string) : null,
      usuarioAfectadoNombre: esDeUsuario
        ? (nombresPorId.get(fila.id_entidad_afectada as string) ?? "Usuario eliminado")
        : null,
    };
  });

  const total = count ?? entradas.length;
  return {
    entradas,
    total,
    pagina: paginaSegura,
    totalPaginas: Math.max(1, Math.ceil(total / BITACORA_POR_PAGINA)),
  };
}
