import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { logError } from "@/lib/log";

/**
 * Registra una acción administrativa en bitacora_administrativa
 * (docs/functional-spec.md Módulo 8 / Flujo 11 y 13). Se llama después de
 * que la mutación principal tuvo éxito; un fallo aquí no debe tumbar la
 * acción ya realizada, así que los llamadores no esperan su resultado.
 *
 * Pero "no tumbar la acción" no es lo mismo que "callar": hasta
 * AUDIT-2026-09-08-base-de-datos.md (D-7) el error del insert se descartaba
 * sin mirarlo, así que una operación administrativa podía completarse sin
 * entrada de auditoría y nadie se enteraba — ni en el momento ni después.
 * Un registro de auditoría con huecos silenciosos es peor que no tenerlo:
 * invita a concluir que la acción nunca ocurrió.
 *
 * La política de INSERT (069) exige `es_administrador() and id_admin =
 * auth.uid()`, así que el caso más probable de fallo es que el llamador pase
 * un cliente que no sea el de la sesión del administrador. Eso es un bug de
 * programación, y ahora deja rastro.
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
  const { error } = await supabase.from("bitacora_administrativa").insert({
    id_admin: params.idAdmin,
    accion: params.accion,
    entidad_afectada: params.entidadAfectada,
    id_entidad_afectada: params.idEntidadAfectada ?? null,
    detalles: params.detalles ?? null,
  });

  if (error) {
    logError("bitacora:registrar", "no se pudo registrar la acción administrativa", error, {
      accion: params.accion,
      entidadAfectada: params.entidadAfectada,
      idEntidadAfectada: params.idEntidadAfectada,
    });
  }
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

/**
 * Qué ficha abre el enlace de cada entidad, para resolver su SLUG y que ningún
 * enlace de la bitácora lleve un UUID. `intentos_examen` enlaza al usuario
 * aunque no muestre su nombre; lecciones y exámenes guardan el id del CURSO
 * (ver BitacoraTable).
 */
const ENTIDADES_CON_FICHA_DE_USUARIO: ReadonlySet<string> = new Set([...ENTIDADES_DE_USUARIO, "intentos_examen"]);
const ENTIDADES_CON_FICHA_DE_CURSO: ReadonlySet<string> = new Set(["cursos", "lecciones", "examenes"]);
const ENTIDADES_CON_FICHA_DE_POST: ReadonlySet<string> = new Set(["comunidad_posts"]);

export type EntradaBitacora = {
  id: string;
  creadoEn: string;
  adminNombre: string;
  adminCorreo: string;
  accion: string;
  entidadAfectada: string;
  detalles: string | null;
  /** El id crudo tal como quedó guardado — sirve para armar el enlace
   * "Sobre" de CUALQUIER entidad (curso, examen, lección, comunidad...),
   * no solo las de usuario. */
  idEntidadAfectada: string | null;
  /** Slug de la ficha a la que enlaza la fila (curso, usuario o publicación).
   * `null` si la entidad no tiene ficha o ya no existe: el enlace cae al id, y
   * la ficha redirige al slug o da 404. */
  slugEntidad: string | null;
  /** Solo cuando `entidadAfectada` es de usuario y se pudo resolver el nombre — ver ENTIDADES_DE_USUARIO. */
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
 *
 * `filtroDesde`/`filtroHasta` son fechas "YYYY-MM-DD" (el `<input
 * type="date">` de BitacoraTable) sobre `creado_en`. Mismo criterio que
 * `admin_listar_usuarios` (037_admin_listar_usuarios.sql) para el rango de
 * registro: `hasta` es un día completo, no un instante — comparar con
 * `< hasta + 1 día` en vez de `<= hasta` evita excluir lo que pasó ese
 * mismo día después de las 00:00.
 */
export async function getBitacora(
  pagina: number = 1,
  filtroDesde?: string,
  filtroHasta?: string,
): Promise<ResultadoBitacora> {
  const supabase = await createClient();
  const paginaSegura = Math.max(1, pagina);
  const desde = (paginaSegura - 1) * BITACORA_POR_PAGINA;
  const hasta = desde + BITACORA_POR_PAGINA - 1;

  let consulta = supabase
    .from("bitacora_administrativa")
    .select(
      "id, creado_en, accion, entidad_afectada, id_entidad_afectada, detalles, admin:perfiles(nombre, correo)",
      { count: "exact" },
    )
    .order("creado_en", { ascending: false });

  if (filtroDesde) consulta = consulta.gte("creado_en", filtroDesde);
  if (filtroHasta) {
    const diaSiguiente = new Date(`${filtroHasta}T00:00:00Z`);
    diaSiguiente.setUTCDate(diaSiguiente.getUTCDate() + 1);
    consulta = consulta.lt("creado_en", diaSiguiente.toISOString());
  }

  const { data, count, error } = await consulta.range(desde, hasta);

  if (error || !data) {
    return { entradas: [], total: 0, pagina: paginaSegura, totalPaginas: 1 };
  }

  // Consultas aparte, no un join: `id_entidad_afectada` no es una FK real
  // (según la fila apunta a perfiles, suscripciones, cursos...), así que
  // PostgREST no puede resolverlo en el embed de arriba. Se resuelve a mano
  // con un IN() por tipo de ficha para toda la página: el nombre del usuario
  // afectado y el slug con el que se enlaza cada ficha.
  const idsDe = (entidades: ReadonlySet<string>) => [
    ...new Set(
      data
        .filter((fila) => entidades.has(fila.entidad_afectada) && fila.id_entidad_afectada)
        .map((fila) => fila.id_entidad_afectada as string),
    ),
  ];
  const idsUsuario = idsDe(ENTIDADES_CON_FICHA_DE_USUARIO);
  const idsCurso = idsDe(ENTIDADES_CON_FICHA_DE_CURSO);
  const idsPost = idsDe(ENTIDADES_CON_FICHA_DE_POST);

  const [{ data: perfiles }, { data: cursos }, { data: posts }] = await Promise.all([
    idsUsuario.length
      ? supabase.from("perfiles").select("id, nombre, slug").in("id", idsUsuario)
      : Promise.resolve({ data: [] as { id: string; nombre: string; slug: string }[] }),
    idsCurso.length
      ? supabase.from("cursos").select("id, slug").in("id", idsCurso)
      : Promise.resolve({ data: [] as { id: string; slug: string }[] }),
    idsPost.length
      ? supabase.from("comunidad_posts").select("id, slug").in("id", idsPost)
      : Promise.resolve({ data: [] as { id: string; slug: string }[] }),
  ]);

  const nombresPorId = new Map<string, string>();
  const slugPorId = new Map<string, string>();
  for (const perfil of perfiles ?? []) {
    nombresPorId.set(perfil.id, perfil.nombre);
    slugPorId.set(perfil.id, perfil.slug);
  }
  for (const fila of [...(cursos ?? []), ...(posts ?? [])]) slugPorId.set(fila.id, fila.slug);

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
      idEntidadAfectada: (fila.id_entidad_afectada as string | null) ?? null,
      slugEntidad: fila.id_entidad_afectada ? (slugPorId.get(fila.id_entidad_afectada as string) ?? null) : null,
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
