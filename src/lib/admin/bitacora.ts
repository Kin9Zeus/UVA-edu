import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { logError } from "@/lib/log";
import { lanzarSiFalla } from "@/lib/supabase/errores";
import { accionEnFrase, esSensible, tipoDeAccion, type TipoBitacora } from "@/lib/admin/bitacora-tipos";

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

/**
 * Cuántas acciones se traen como máximo por consulta. Los filtros por tipo,
 * "solo sensibles" y la búsqueda se aplican en memoria sobre ellas.
 */
// ponytail: filtrado en memoria sobre las 2000 más recientes del rango; si la
// bitácora crece hasta rozarlo, pasar tipo/sensibles/búsqueda a una función
// SQL (como admin_listar_usuarios) y paginar allá.
export const BITACORA_VENTANA = 2000;

/** Cuántas acciones más muestra cada "Cargar más". */
export const BITACORA_POR_TANDA = 30;

/** Días que cubre la gráfica de arriba. */
export const BITACORA_DIAS_RESUMEN = 30;

const ZONA = "America/Bogota";

/**
 * Tipos de `entidad_afectada` que guardan un id de USUARIO en
 * `id_entidad_afectada` (perfiles.id directo, o el usuario dueño de la
 * suscripción/inscripción — ver otorgarMembresia, quitarCortesia,
 * revocarMembresia en src/actions/admin/usuarios.ts) y `intentos_examen`.
 * Lecciones, módulos y exámenes guardan el id del CURSO.
 */
const ENTIDADES_DE_USUARIO: ReadonlySet<string> = new Set(["perfiles", "suscripciones", "inscripciones", "intentos_examen"]);
const ENTIDADES_DE_CURSO: ReadonlySet<string> = new Set(["cursos", "modulos", "lecciones", "examenes"]);
const ENTIDADES_DE_POST: ReadonlySet<string> = new Set(["comunidad_posts"]);

export type FiltrosBitacora = {
  tipo: TipoBitacora | null;
  /** id del administrador */
  admin: string | null;
  sensibles: boolean;
  busqueda: string | null;
  /** "YYYY-MM-DD", día de Colombia */
  desde?: string;
  hasta?: string;
  /** Cuántas entradas mostrar (crece con "Cargar más"). */
  mostrar: number;
};

export type EntradaBitacora = {
  id: string;
  creadoEn: string;
  /** "YYYY-MM-DD" en hora de Colombia: agrupa la línea de tiempo y la gráfica. */
  dia: string;
  adminNombre: string;
  accion: string;
  entidadAfectada: string;
  tipo: TipoBitacora;
  sensible: boolean;
  detalles: string | null;
  /** El id crudo tal como quedó guardado (usuario, curso, publicación...). */
  idEntidadAfectada: string | null;
  /** Slug de la ficha a la que enlaza (curso, usuario o publicación), si existe. */
  slugEntidad: string | null;
  /** Sobre quién o qué: nombre de la persona, título del curso o de la publicación. */
  sujeto: string | null;
};

export type DiaBitacora = {
  dia: string;
  total: number;
  sensibles: number;
  porTipo: Partial<Record<TipoBitacora, number>>;
};

export type ResultadoBitacora = {
  entradas: EntradaBitacora[];
  /** Total que cumple los filtros (dentro de la ventana). */
  total: number;
  /** El rango tiene más de BITACORA_VENTANA acciones: las más viejas no entraron. */
  truncada: boolean;
  resumen: {
    dias: DiaBitacora[];
    semana: number;
    sensiblesSemana: number;
    ultima: string | null;
  };
  admins: { id: string; nombre: string }[];
};

const formatoDia = new Intl.DateTimeFormat("en-CA", { timeZone: ZONA, year: "numeric", month: "2-digit", day: "2-digit" });

/** "YYYY-MM-DD" del instante en hora de Colombia. */
export function diaEnColombia(instante: string | Date): string {
  return formatoDia.format(new Date(instante));
}

/** Suma días a un "YYYY-MM-DD" (aritmética de calendario, sin zona). */
export function sumarDias(dia: string, dias: number): string {
  const fecha = new Date(`${dia}T12:00:00Z`);
  fecha.setUTCDate(fecha.getUTCDate() + dias);
  return fecha.toISOString().slice(0, 10);
}

/** Inicio del día en Colombia como instante (UTC−5 todo el año, sin horario de verano). */
function inicioDelDia(dia: string): string {
  return `${dia}T00:00:00-05:00`;
}

function normalizar(texto: string): string {
  return texto.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("es");
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type FilaBitacora = {
  id: string;
  creado_en: string;
  accion: string;
  entidad_afectada: string;
  id_entidad_afectada: string | null;
  detalles: string | null;
  admin: { nombre: string } | { nombre: string }[] | null;
};

async function consultar(
  supabase: SupabaseClient,
  rango: { desde?: string; hasta?: string },
  admin: string | null,
): Promise<FilaBitacora[]> {
  let consulta = supabase
    .from("bitacora_administrativa")
    .select("id, creado_en, accion, entidad_afectada, id_entidad_afectada, detalles, admin:perfiles(nombre)")
    .order("creado_en", { ascending: false })
    .limit(BITACORA_VENTANA);
  if (rango.desde) consulta = consulta.gte("creado_en", inicioDelDia(rango.desde));
  // `hasta` es un día completo: todo lo que pasó antes de que empiece el siguiente.
  if (rango.hasta) consulta = consulta.lt("creado_en", inicioDelDia(sumarDias(rango.hasta, 1)));
  if (admin) consulta = consulta.eq("id_admin", admin);

  const { data, error } = await consulta;
  // Un fallo aquí NO es "no hay acciones": la pantalla mostraría un historial
  // vacío y el administrador creería que nadie hizo nada (CLAUDE.md 3.2).
  lanzarSiFalla(error, "bitacora:listar");
  return (data ?? []) as FilaBitacora[];
}

/** IN() por tandas: una página puede traer cientos de ids y la URL de PostgREST tiene límite. */
async function enTandas<T>(ids: string[], traer: (tanda: string[]) => PromiseLike<{ data: T[] | null; error: { message?: string; code?: string } | null }>, contexto: string): Promise<T[]> {
  const resultado: T[] = [];
  for (let i = 0; i < ids.length; i += 100) {
    const { data, error } = await traer(ids.slice(i, i + 100));
    lanzarSiFalla(error, contexto);
    resultado.push(...(data ?? []));
  }
  return resultado;
}

/**
 * Nombre y slug de lo afectado. Consultas aparte, no un join:
 * `id_entidad_afectada` no es una FK real (según la fila apunta a perfiles,
 * cursos, publicaciones...), así que PostgREST no puede resolverlo solo.
 */
async function enriquecer(supabase: SupabaseClient, filas: FilaBitacora[]): Promise<EntradaBitacora[]> {
  const idsDe = (entidades: ReadonlySet<string>) => [
    ...new Set(filas.filter((f) => entidades.has(f.entidad_afectada) && f.id_entidad_afectada).map((f) => f.id_entidad_afectada as string)),
  ];
  const [perfiles, cursos, posts] = await Promise.all([
    enTandas(idsDe(ENTIDADES_DE_USUARIO), (t) => supabase.from("perfiles").select("id, nombre, slug").in("id", t), "bitacora:perfiles"),
    enTandas(idsDe(ENTIDADES_DE_CURSO), (t) => supabase.from("cursos").select("id, titulo, slug").in("id", t), "bitacora:cursos"),
    enTandas(idsDe(ENTIDADES_DE_POST), (t) => supabase.from("comunidad_posts").select("id, titulo, slug").in("id", t), "bitacora:comunidad_posts"),
  ]);
  const ficha = new Map<string, { nombre: string; slug: string }>();
  for (const p of perfiles as { id: string; nombre: string; slug: string }[]) ficha.set(p.id, { nombre: p.nombre, slug: p.slug });
  for (const c of [...cursos, ...posts] as { id: string; titulo: string; slug: string }[]) ficha.set(c.id, { nombre: c.titulo, slug: c.slug });

  return filas.map((fila) => {
    const admin = Array.isArray(fila.admin) ? fila.admin[0] : fila.admin;
    const encontrada = fila.id_entidad_afectada ? ficha.get(fila.id_entidad_afectada) : undefined;
    const esDeUsuario = ENTIDADES_DE_USUARIO.has(fila.entidad_afectada) && fila.id_entidad_afectada;
    return {
      id: fila.id,
      creadoEn: fila.creado_en,
      dia: diaEnColombia(fila.creado_en),
      adminNombre: admin?.nombre ?? "Administrador eliminado",
      accion: fila.accion,
      entidadAfectada: fila.entidad_afectada,
      tipo: tipoDeAccion(fila.accion, fila.entidad_afectada),
      sensible: esSensible(fila.accion),
      detalles: fila.detalles,
      idEntidadAfectada: fila.id_entidad_afectada,
      slugEntidad: encontrada?.slug ?? null,
      sujeto: encontrada?.nombre ?? (esDeUsuario ? "Usuario eliminado" : null),
    };
  });
}

/** Tipo, "solo sensibles" y búsqueda (sin tildes ni mayúsculas). El administrador y las fechas ya filtran en la consulta. */
export function cumpleFiltros(entrada: EntradaBitacora, filtros: Pick<FiltrosBitacora, "tipo" | "sensibles" | "busqueda">): boolean {
  if (filtros.tipo && entrada.tipo !== filtros.tipo) return false;
  if (filtros.sensibles && !entrada.sensible) return false;
  if (filtros.busqueda) {
    const texto = normalizar([entrada.adminNombre, accionEnFrase(entrada.accion), entrada.detalles ?? "", entrada.sujeto ?? ""].join(" "));
    if (!texto.includes(normalizar(filtros.busqueda))) return false;
  }
  return true;
}

/** Una fila por día de los últimos `BITACORA_DIAS_RESUMEN`, con lo de hoy al final. */
export function resumirPorDia(entradas: EntradaBitacora[], hoy: string): DiaBitacora[] {
  const dias: DiaBitacora[] = Array.from({ length: BITACORA_DIAS_RESUMEN }, (_, i) => ({
    dia: sumarDias(hoy, i - (BITACORA_DIAS_RESUMEN - 1)),
    total: 0,
    sensibles: 0,
    porTipo: {},
  }));
  const porClave = new Map(dias.map((d) => [d.dia, d]));
  for (const entrada of entradas) {
    const dia = porClave.get(entrada.dia);
    if (!dia) continue;
    dia.total++;
    if (entrada.sensible) dia.sensibles++;
    dia.porTipo[entrada.tipo] = (dia.porTipo[entrada.tipo] ?? 0) + 1;
  }
  return dias;
}

/**
 * La bitácora filtrada, más reciente primero, y el resumen de los últimos 30
 * días con los mismos filtros (menos las fechas: la gráfica siempre muestra
 * el mes, para ver dónde cae el rango elegido). RLS (`bitacora_solo_admin`)
 * ya la restringe a administradores; esta función hereda esa comprobación
 * del cliente de sesión, igual que el resto de `lib/admin/*`.
 */
export async function getBitacora(filtros: FiltrosBitacora): Promise<ResultadoBitacora> {
  const supabase = await createClient();
  const admin = filtros.admin && UUID.test(filtros.admin) ? filtros.admin : null;
  const hoy = diaEnColombia(new Date());
  const inicioResumen = sumarDias(hoy, -(BITACORA_DIAS_RESUMEN - 1));

  const [filas, filasResumen, { data: admins, error: errorAdmins }] = await Promise.all([
    consultar(supabase, { desde: filtros.desde, hasta: filtros.hasta }, admin),
    consultar(supabase, { desde: inicioResumen }, admin),
    supabase.from("perfiles").select("id, nombre").eq("rol", "ADMINISTRADOR").order("nombre"),
  ]);
  lanzarSiFalla(errorAdmins, "bitacora:administradores");

  const [entradas, entradasResumen] = await Promise.all([enriquecer(supabase, filas), enriquecer(supabase, filasResumen)]);
  const filtradas = entradas.filter((e) => cumpleFiltros(e, filtros));
  const delMes = entradasResumen.filter((e) => cumpleFiltros(e, filtros));
  const dias = resumirPorDia(delMes, hoy);
  const ultimaSemana = dias.slice(-7);

  return {
    entradas: filtradas.slice(0, Math.max(BITACORA_POR_TANDA, filtros.mostrar)),
    total: filtradas.length,
    truncada: filas.length === BITACORA_VENTANA,
    resumen: {
      dias,
      semana: ultimaSemana.reduce((suma, d) => suma + d.total, 0),
      sensiblesSemana: ultimaSemana.reduce((suma, d) => suma + d.sensibles, 0),
      ultima: delMes[0]?.creadoEn ?? null,
    },
    admins: admins ?? [],
  };
}
