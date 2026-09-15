import { createClient } from "@/lib/supabase/server";
import { getMetricasPanel } from "@/lib/admin/metricas";
import { suscripcionDaAcceso } from "@/lib/estadoAcceso";

export type ActividadItem = {
  id: string;
  texto: string;
  fecha: string;
  tono: "accent" | "success" | "warning";
};

type CursoPopular = {
  id: string;
  slug: string;
  titulo: string;
  categoria: string;
  estudiantes: number;
  porcentajeFinalizacion: number;
  mostrado: boolean;
};

export async function getDashboardData() {
  const supabase = await createClient();

  const [
    panel,
    { count: cursosPublicados },
    { count: cursosBorrador },
    { count: cortesiasActivas },
    { data: suscripcionesVivas },
  ] = await Promise.all([
    // Registrados y acceso vigente salen de la MISMA vista que alimenta
    // /admin/usuarios (`metricas_panel_usuarios`, supabase/sql/036), no de
    // un conteo propio. Antes esta función contaba los perfiles por su
    // cuenta, y basta con que una de las dos definiciones cambie para que el
    // dashboard y el panel de usuarios discrepen sobre la misma cifra — es
    // exactamente lo que ya pasó con el porcentaje de avance.
    getMetricasPanel(),
    supabase.from("cursos").select("id", { count: "exact", head: true }).eq("mostrado", true),
    supabase.from("cursos").select("id", { count: "exact", head: true }).eq("mostrado", false),
    // `activo`: revocar una cortesía no borra la fila, la marca inactiva
    // (ver el comentario de `Inscripciones.activo` en schema.prisma). Sin
    // este filtro la cifra sumaba también las cortesías ya retiradas y solo
    // podía subir, nunca bajar.
    supabase.from("inscripciones").select("id", { count: "exact", head: true }).eq("activo", true),
    supabase
      .from("suscripciones")
      .select("estado, fecha_renovacion, acceso_manual")
      .in("estado", ["ACTIVA", "PAST_DUE"]),
  ]);

  // Cuántos de los que tienen acceso lo están pagando. `acceso_manual` es
  // equivalente a `proveedor IN ('manual','invitacion')` —lo sella un CHECK
  // en supabase/sql/042—, así que su negación es justo el acceso comprado.
  //
  // La vigencia la decide `suscripcionDaAcceso`, la única regla de la
  // plataforma: `estado IN (ACTIVA, PAST_DUE)` a secas contaría periodos que
  // ya terminaron, porque nada mueve la fila a VENCIDA cuando vence.
  const accesoDePago = (suscripcionesVivas ?? []).filter(
    (fila) =>
      fila.acceso_manual === false &&
      suscripcionDaAcceso({
        estado: fila.estado as "ACTIVA" | "PAST_DUE",
        fechaRenovacion: fila.fecha_renovacion as string | null,
      }),
  ).length;

  // El resto se deriva por resta del total de la vista, no se cuenta aparte:
  // así las dos cifras de la tarjeta siempre suman su propio valor. Contarlas
  // por separado deja que "12 de pago" conviva con un total de 10.
  const conAcceso = panel.usuariosAccesoVigente;
  const accesoSinCobro = Math.max(0, conAcceso - accesoDePago);

  const [{ data: perfilesRecientes }, { data: certificadosRecientes }] = await Promise.all([
    supabase
      .from("perfiles")
      .select("id, nombre, fecha_registro:creado_en")
      .order("creado_en", { ascending: false })
      .limit(4),
    supabase
      .from("certificados")
      .select("id, fecha_emision, nombre_estudiante, nombre_curso")
      .order("fecha_emision", { ascending: false })
      .limit(4),
  ]);

  const actividad: ActividadItem[] = [
    ...(perfilesRecientes ?? []).map((perfil) => ({
      id: `perfil-${perfil.id}`,
      texto: `${perfil.nombre} se registró en la plataforma`,
      fecha: perfil.fecha_registro,
      tono: "accent" as const,
    })),
    ...(certificadosRecientes ?? []).map((cert) => {
      return {
        id: `cert-${cert.id}`,
        texto: `${cert.nombre_estudiante} obtuvo el certificado de ${cert.nombre_curso}`,
        fecha: cert.fecha_emision,
        tono: "success" as const,
      };
    }),
  ]
    .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
    .slice(0, 6);

  // El avance por curso lo calcula Postgres en la vista `avance_cursos`
  // (supabase/sql/036), no este archivo.
  //
  // Antes se hacía aquí con `completados / total de filas de progreso`, que
  // inflaba la cifra: ignoraba las lecciones que nadie tocó, así que un curso
  // de 20 lecciones donde una persona vio y completó una sola marcaba 100%.
  // Es el mismo bug que ya habían corregido usuarioDetalle.ts y
  // cursoDetalle.ts; este era el último sitio que lo conservaba, y hacía que
  // /admin y /admin/usuarios mostraran números distintos para lo mismo.
  //
  // De paso desaparece el N+1: había una consulta de progreso por cada curso
  // del top, dentro de un Promise.all.
  const [{ data: cursos }, { data: avances }] = await Promise.all([
    supabase
      .from("cursos")
      .select("id, slug, titulo, mostrado, curso_categorias(categoria:categorias(nombre))")
      .order("creado_en", { ascending: false })
      .limit(20),
    supabase
      .from("avance_cursos")
      .select("curso_id, participantes, avance_promedio")
      .order("participantes", { ascending: false })
      .limit(20),
  ]);

  const avancePorCurso = new Map(
    (avances ?? []).map((fila) => [
      fila.curso_id as string,
      {
        estudiantes: Number(fila.participantes),
        porcentaje: Number(fila.avance_promedio),
      },
    ]),
  );

  const cursosPopulares: CursoPopular[] = (cursos ?? [])
    .map((curso) => {
      const avance = avancePorCurso.get(curso.id);
      // Todas las categorías del curso, no solo la primera. Acá se unen en
      // una cadena porque esta tabla del panel es un resumen de una línea
      // por curso; el listado de /admin/cursos sí las pinta como chips.
      const nombresCategorias = (curso.curso_categorias ?? [])
        .map((fila) => {
          const categoria = Array.isArray(fila.categoria) ? fila.categoria[0] : fila.categoria;
          return categoria?.nombre;
        })
        .filter((nombre): nombre is string => !!nombre)
        .sort((a, b) => a.localeCompare(b));

      return {
        id: curso.id,
        slug: curso.slug,
        titulo: curso.titulo,
        categoria: nombresCategorias.join(", ") || "Sin categoría",
        estudiantes: avance?.estudiantes ?? 0,
        porcentajeFinalizacion: avance?.porcentaje ?? 0,
        mostrado: curso.mostrado,
      };
    })
    .sort((a, b) => b.estudiantes - a.estudiantes)
    .slice(0, 5);

  return {
    metricas: {
      usuariosRegistrados: panel.usuariosRegistrados,
      usuariosActivos7d: panel.usuariosActivos7d,
      conAcceso,
      accesoDePago,
      accesoSinCobro,
      cursosPublicados: cursosPublicados ?? 0,
      cursosBorrador: cursosBorrador ?? 0,
      cursosTotal: (cursosPublicados ?? 0) + (cursosBorrador ?? 0),
      cortesiasActivas: cortesiasActivas ?? 0,
    },
    actividad,
    cursosPopulares,
  };
}
