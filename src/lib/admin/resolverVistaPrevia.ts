import { createAdminClient } from "@/lib/supabase/admin";
import { evaluarToken, hashToken, type EstadoTokenVistaPrevia } from "@/lib/vistaPrevia";
import { resolverContenidoLeccion, type DocumentoContenido } from "@/lib/editor/tipos";

/**
 * ⚠️  ÚNICO punto de la aplicación que lee un curso NO publicado sin sesión.
 *
 * Por qué usa el cliente de service role
 * --------------------------------------
 * CLAUDE.md prohíbe saltarse RLS, y con razón. Aquí hay una excepción
 * deliberada y acotada, no un descuido:
 *
 *   - Quien abre el enlace es `anon`. RLS le niega `cursos` con
 *     `mostrado = false` (001_rls_policies.sql), que es exactamente lo que
 *     hay que enseñarle. No hay forma de resolverlo desde la policy: el
 *     token viaja en la URL de Next.js, no en el JWT que ve Postgres.
 *   - La alternativa era una función SECURITY DEFINER que devolviera el
 *     curso entero armado en SQL. Duplicaría en plpgsql toda la forma que
 *     ya construye getCursoPublico (módulos, lecciones, recursos,
 *     instructor) y las dos copias se desincronizarían a la primera.
 *
 * Revcurso pide "sin desactivar RLS globalmente", y no se desactiva: sigue
 * activa para todas las demás rutas. Es este módulo el que actúa de puerta
 * estrecha.
 *
 * Reglas para quien modifique este archivo
 * ----------------------------------------
 *   1. El cliente de service role NO sale de aquí. No lo exportes.
 *   2. Toda consulta va acotada por `.eq("id", <id que salió de la fila del
 *      token>)`. Nunca por un id que venga del visitante.
 *   3. Lo único que entra desde fuera es el token, y se hashea antes de
 *      tocar la base.
 */

export type ResultadoVistaPrevia =
  | { valido: true; idCurso: string; expiraEn: Date }
  | { valido: false; motivo: "INEXISTENTE" | "REVOCADO" | "EXPIRADO" };

/**
 * Valida un token de vista previa y devuelve el curso al que da acceso.
 *
 * No distingue hacia fuera entre "no existe", "revocado" y "expirado" más
 * allá del mensaje que se le muestra al visitante: los tres son un no.
 */
export async function resolverTokenVistaPrevia(token: string): Promise<ResultadoVistaPrevia> {
  // Un token vacío o absurdamente largo no llega a consultar la base.
  if (!token || token.length > 200) {
    return { valido: false, motivo: "INEXISTENTE" };
  }

  const supabase = createAdminClient();

  const { data } = await supabase
    .from("tokens_vista_previa")
    .select("id, id_curso, expira_en, revocado_en, veces_usado")
    .eq("token_hash", hashToken(token))
    .maybeSingle();

  const estado: EstadoTokenVistaPrevia = evaluarToken(
    data
      ? {
          idCurso: data.id_curso as string,
          expiraEn: new Date(data.expira_en as string),
          revocadoEn: data.revocado_en ? new Date(data.revocado_en as string) : null,
        }
      : null,
    new Date(),
  );

  if (!estado.valido) return estado;

  // Contador de uso, para que el panel muestre si el enlace se abrió. Es
  // informativo: si falla, la vista previa sigue funcionando.
  await supabase
    .from("tokens_vista_previa")
    .update({ veces_usado: ((data?.veces_usado as number) ?? 0) + 1 })
    .eq("id", data!.id);

  return estado;
}

/** Curso en borrador tal como lo verá quien abra el enlace. */
export type CursoVistaPrevia = {
  id: string;
  titulo: string;
  descripcion: string;
  imagenPortada: string;
  nivel: "BASICO" | "INTERMEDIO" | "AVANZADO";
  /** 1 o más profesores; vacío si el curso todavía no tiene ninguno asignado. */
  instructores: { id: string; nombre: string }[];
  mostrado: boolean;
  modulos: {
    id: string;
    titulo: string;
    lecciones: { id: string; titulo: string; duracion: number | null }[];
  }[];
};

/**
 * Lee el curso de un enlace de vista previa.
 *
 * `idCurso` DEBE venir de resolverTokenVistaPrevia(), nunca de la URL: es la
 * regla 2 de la cabecera de este archivo.
 */
export async function getCursoVistaPrevia(idCurso: string): Promise<CursoVistaPrevia | null> {
  const supabase = createAdminClient();

  const { data: curso } = await supabase
    .from("cursos")
    .select(
      "id, titulo, descripcion, imagen_portada, nivel, mostrado, modulos(id, titulo, orden, lecciones(id, titulo, orden, duracion))",
    )
    .eq("id", idCurso)
    .maybeSingle();

  if (!curso) return null;

  // Únicos instructores que NO se leen por `curso_instructores_publico`: esa
  // vista solo deja pasar cursos publicados, de un administrador o con acceso
  // vigente, y aquí quien mira es `anon` frente a un curso en borrador —
  // exactamente el caso que esta puerta estrecha existe para cubrir (ver la
  // cabecera del archivo). Va por service role, acotado por `idCurso`, que
  // salió de la fila del token (regla 2).
  //
  // El hint `!curso_instructores_id_instructor_fkey` desambigua la relación:
  // sin él, PostgREST puede responder PGRST201 en cuanto exista más de un
  // camino entre estas tablas y la consulta falla en silencio. El nombre del
  // constraint es el de la migración 20260903000000_multi_instructores.
  const { data: filasInstructores } = await supabase
    .from("curso_instructores")
    .select("perfil:perfiles!curso_instructores_id_instructor_fkey(id, nombre)")
    .eq("id_curso", idCurso);

  const instructores = (filasInstructores ?? [])
    .map((fila) => {
      const perfil = Array.isArray(fila.perfil) ? fila.perfil[0] : fila.perfil;
      return perfil ? { id: perfil.id as string, nombre: perfil.nombre as string } : null;
    })
    .filter((perfil): perfil is { id: string; nombre: string } => perfil !== null)
    .sort((a, b) => a.nombre.localeCompare(b.nombre));

  const modulos = (curso.modulos ?? [])
    .sort((a, b) => a.orden - b.orden)
    .map((modulo) => ({
      id: modulo.id,
      titulo: modulo.titulo,
      lecciones: (modulo.lecciones ?? [])
        .sort((a, b) => a.orden - b.orden)
        .map((leccion) => ({
          id: leccion.id,
          titulo: leccion.titulo,
          duracion: leccion.duracion,
        })),
    }));

  return {
    id: curso.id,
    titulo: curso.titulo,
    descripcion: curso.descripcion,
    imagenPortada: curso.imagen_portada,
    nivel: curso.nivel,
    instructores,
    mostrado: curso.mostrado,
    modulos,
  };
}

/** Una clase dentro de la lista "Clases y progreso" de la vista previa del reproductor. */
export type LeccionEnListaVistaPrevia = {
  id: string;
  numero: number;
  titulo: string;
  duracion: number | null;
  moduloId: string;
  moduloTitulo: string;
};

/** Cómo se ve una clase del curso para quien abre el enlace, sin sesión ni progreso. */
export type LeccionVistaPrevia = {
  cursoId: string;
  cursoTitulo: string;
  publicado: boolean;
  leccionId: string;
  leccionTitulo: string;
  numero: number;
  totalClases: number;
  contenido: DocumentoContenido | null;
  recursos: { id: string; nombre: string; tipoArchivo: string; tamanoBytes: number | null }[];
  lecciones: LeccionEnListaVistaPrevia[];
  anteriorId: string | null;
  siguienteId: string | null;
};

/**
 * Lee una clase de un enlace de vista previa.
 *
 * `idCurso` DEBE venir de resolverTokenVistaPrevia(), igual que en
 * getCursoVistaPrevia() (regla 2 de la cabecera). `leccionId` sí es del
 * visitante (viene de qué clase del temario clickeó), pero nunca toca la
 * base sin antes verificar —vía el propio getCursoVistaPrevia(idCurso), que
 * ya está acotado por el token— que esa clase pertenece a este curso: el
 * `findIndex` de abajo es esa verificación. Si no aparece en `plano`, es que
 * el visitante intentó colar el id de una clase de OTRO curso, y se corta
 * ahí devolviendo null (404 en la página).
 */
export async function getLeccionVistaPrevia(
  idCurso: string,
  leccionId: string,
): Promise<LeccionVistaPrevia | null> {
  const curso = await getCursoVistaPrevia(idCurso);
  if (!curso) return null;

  const plano = curso.modulos.flatMap((modulo) =>
    modulo.lecciones.map((leccion) => ({ ...leccion, moduloId: modulo.id, moduloTitulo: modulo.titulo })),
  );
  const indice = plano.findIndex((leccion) => leccion.id === leccionId);
  if (indice === -1) return null;
  const actual = plano[indice];

  const supabase = createAdminClient();

  const [{ data: detalle }, { data: recursos }] = await Promise.all([
    supabase.from("lecciones").select("resumen, contenido").eq("id", leccionId).maybeSingle(),
    supabase
      .from("recursos_descargables")
      .select("id, nombre, tipo_archivo, tamano_bytes")
      .eq("id_leccion", leccionId)
      .order("creado_en"),
  ]);

  return {
    cursoId: curso.id,
    cursoTitulo: curso.titulo,
    publicado: curso.mostrado,
    leccionId: actual.id,
    leccionTitulo: actual.titulo,
    numero: indice + 1,
    totalClases: plano.length,
    contenido: resolverContenidoLeccion(detalle?.contenido ?? null, detalle?.resumen ?? null),
    recursos: (recursos ?? []).map((recurso) => ({
      id: recurso.id,
      nombre: recurso.nombre,
      tipoArchivo: recurso.tipo_archivo,
      tamanoBytes: recurso.tamano_bytes,
    })),
    lecciones: plano.map((leccion, i) => ({
      id: leccion.id,
      numero: i + 1,
      titulo: leccion.titulo,
      duracion: leccion.duracion,
      moduloId: leccion.moduloId,
      moduloTitulo: leccion.moduloTitulo,
    })),
    anteriorId: indice > 0 ? plano[indice - 1].id : null,
    siguienteId: indice < plano.length - 1 ? plano[indice + 1].id : null,
  };
}
