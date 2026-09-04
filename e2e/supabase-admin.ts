import { createClient } from "@supabase/supabase-js";

/**
 * Cliente con Service Role Key para preparar y limpiar datos desechables
 * en los specs de Playwright — mismo patrón que scripts/rls-test.ts y
 * scripts/webhook-test.ts: nada de esto pasa por RLS, y todo se borra al
 * final del spec pase o falle. Corre contra el proyecto REAL de Supabase
 * (no hay staging separado, ver Ground Truth de AUDIT-2026-08-24.md).
 */
export function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en .env.local.");
  }
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/** Crea un usuario desechable con el correo ya confirmado (sin pasar por bandeja real). */
export async function crearUsuarioConfirmado(
  admin: ReturnType<typeof adminClient>,
  params: { email: string; password: string; nombre?: string },
) {
  const { data, error } = await admin.auth.admin.createUser({
    email: params.email,
    password: params.password,
    email_confirm: true,
    user_metadata: params.nombre ? { nombre: params.nombre } : undefined,
  });
  if (error || !data.user) {
    throw new Error(`No pude crear el usuario de prueba: ${error?.message}`);
  }
  return data.user;
}

/**
 * Promueve un usuario recién creado a ADMINISTRADOR. Permitido porque
 * private.perfiles_bloquea_autopromocion() (013) trae un bypass explícito
 * para service_role — ver el comentario de ese archivo.
 */
export async function promoverAAdministrador(admin: ReturnType<typeof adminClient>, userId: string) {
  const { error } = await admin.from("perfiles").update({ rol: "ADMINISTRADOR" }).eq("id", userId);
  if (error) throw new Error(`No pude promover el usuario a ADMINISTRADOR: ${error.message}`);
}

/**
 * Promueve un usuario a PROFESOR — el rol que hace falta para que aparezca en
 * el selector de instructores de un curso. Desde la migración
 * `20260903000000_multi_instructores`, instructor y profesor son la misma
 * entidad: no hay forma de fabricar un instructor sin una cuenta real.
 * Mismo bypass de service_role que promoverAAdministrador.
 */
export async function promoverAProfesor(
  admin: ReturnType<typeof adminClient>,
  userId: string,
  especialidad?: string,
) {
  const { error } = await admin
    .from("perfiles")
    .update({ rol: "PROFESOR", especialidad: especialidad ?? null })
    .eq("id", userId);
  if (error) throw new Error(`No pude promover el usuario a PROFESOR: ${error.message}`);
}

/**
 * Genera el enlace de confirmación real que Supabase mandaría por correo,
 * sin depender de una bandeja de entrada.
 *
 * OJO: `properties.action_link` (flujo implícito, tokens en el fragmento
 * `#` de la URL) NO sirve aquí — apunta directo al `redirectTo` sin pasar
 * por `/auth/confirm`, que es la ruta que este recorrido necesita
 * ejercitar. Se usa en cambio `properties.hashed_token` para construir la
 * URL a mano, exactamente como lo hace el propio webhook de
 * supabase-auth (src/app/api/webhooks/supabase-auth/route.ts): así el
 * enlace SÍ llega a `/auth/confirm?token_hash=...&type=...`, que es lo
 * que un correo real de este proyecto manda.
 */
export async function generarEnlaceConfirmacion(
  admin: ReturnType<typeof adminClient>,
  params: { email: string; password: string; origin: string; next: string },
) {
  const { data, error } = await admin.auth.admin.generateLink({
    type: "signup",
    email: params.email,
    password: params.password,
  });
  if (error || !data.properties?.hashed_token) {
    throw new Error(`No pude generar el enlace de confirmación: ${error?.message}`);
  }
  const { hashed_token, verification_type } = data.properties;
  return `${params.origin}/auth/confirm?token_hash=${hashed_token}&type=${verification_type}&next=${encodeURIComponent(params.next)}`;
}

/**
 * Curso semilla real usado como fixture de reproducción/progreso/certificado
 * (e2e/recorrido-critico.spec.ts): "Render Fotorrealista con V-Ray", único
 * módulo, 3 lecciones ya procesadas en Mux con video real y corto (9s, 31s,
 * 9s — ver el propio video de cada una). Se reusa este curso en vez de subir
 * un video nuevo en cada corrida para no tocar la cuenta real de Mux (ni su
 * costo) solo para pruebas: el ID es determinístico porque viene de datos
 * semilla, no de un registro random.
 */
export const CURSO_FIXTURE = {
  id: "0c000000-0000-4000-8000-000000000003",
  titulo: "Render Fotorrealista con V-Ray",
  categoriaSlug: "visualizacion-arquitectonica",
  // Orden real (columna `orden`), no el orden de inserción en la tabla.
  lecciones: [
    { id: "0e000000-0000-4000-8000-000000007595", titulo: "Sol, cielo y HDRI: cuándo usar cada uno", duracionSeg: 9 },
    { id: "b5211deb-0619-476d-bfa6-e6550bf140bd", titulo: "ANDRES", duracionSeg: 31 },
    { id: "0e000000-0000-4000-8000-000000007596", titulo: "Iluminación de interiores sin ruido", duracionSeg: 9 },
  ],
} as const;

/**
 * Falla rápido y con un mensaje claro si el fixture de arriba dejó de
 * existir o de estar LISTO (alguien borró/editó el curso semilla) — mejor
 * eso que specs que fallan más adelante con "el reproductor no carga" sin
 * decir por qué.
 */
export async function verificarCursoFixture(admin: ReturnType<typeof adminClient>) {
  const { data, error } = await admin
    .from("lecciones")
    .select("id, estado_procesamiento, id_video_mux")
    .in("id", CURSO_FIXTURE.lecciones.map((l) => l.id));

  if (error || !data || data.length !== CURSO_FIXTURE.lecciones.length) {
    throw new Error(
      `CURSO_FIXTURE (${CURSO_FIXTURE.titulo}) no tiene las ${CURSO_FIXTURE.lecciones.length} lecciones esperadas — ¿se borró o cambió el curso semilla? ${error?.message ?? ""}`,
    );
  }
  const noListas = data.filter((l) => l.estado_procesamiento !== "LISTO" || !l.id_video_mux);
  if (noListas.length > 0) {
    throw new Error(
      `CURSO_FIXTURE tiene lecciones sin video LISTO: ${noListas.map((l) => l.id).join(", ")}`,
    );
  }
}

/**
 * Slugs reales del curso fixture y sus lecciones — las páginas públicas
 * aceptan el UUID como respaldo (`esUuid()`, src/lib/slug.ts), pero todo
 * `<Link>` real de la app (catálogo, "Comenzar curso", etc.) navega por
 * slug, nunca por id. Se consultan en vez de hardcodearlos a mano para no
 * duplicar el algoritmo de slugificar() ni quedar desactualizados si el
 * curso semilla se renombra.
 */
export async function obtenerSlugsCursoFixture(admin: ReturnType<typeof adminClient>) {
  const { data: curso, error: errorCurso } = await admin
    .from("cursos")
    .select("slug")
    .eq("id", CURSO_FIXTURE.id)
    .single();
  if (errorCurso || !curso) {
    throw new Error(`No pude obtener el slug de CURSO_FIXTURE: ${errorCurso?.message}`);
  }

  const { data: lecciones, error: errorLecciones } = await admin
    .from("lecciones")
    .select("id, slug")
    .in("id", CURSO_FIXTURE.lecciones.map((l) => l.id));
  if (errorLecciones || !lecciones || lecciones.length !== CURSO_FIXTURE.lecciones.length) {
    throw new Error(`No pude obtener los slugs de las lecciones de CURSO_FIXTURE: ${errorLecciones?.message}`);
  }

  const leccionSlugs = Object.fromEntries(lecciones.map((l) => [l.id, l.slug])) as Record<string, string>;
  return { cursoSlug: curso.slug as string, leccionSlugs };
}

/**
 * Formatea un código de prueba con los mismos guiones que
 * formatearCodigoMientrasEscribe (src/lib/codigoInvitacion.ts) produce en el
 * input real: 3-4-4. `normalizarCodigo()` no toca los guiones al enviar el
 * formulario, así que el código guardado en la base y lo que el formulario
 * termina mandando deben traer los guiones en las mismas posiciones, o el
 * canje da "no existe" aunque la fila sí exista.
 */
export function formatearCodigoDePrueba(alfanumerico: string): string {
  const limpio = alfanumerico.toUpperCase().slice(0, 11);
  let resultado = limpio.slice(0, 3);
  if (limpio.length > 3) resultado += `-${limpio.slice(3, 7)}`;
  if (limpio.length > 7) resultado += `-${limpio.slice(7, 11)}`;
  return resultado;
}

/** Crea un código de invitación desechable — mismo patrón que scripts/canje-codigo-test.ts. */
export async function crearCodigoInvitacion(
  admin: ReturnType<typeof adminClient>,
  params: {
    codigo: string;
    duracionDias?: number;
    activo?: boolean;
    fechaVencimiento?: string;
    limiteUsos?: number;
    vecesUsado?: number;
  },
) {
  const ahora = Date.now();
  const { data, error } = await admin
    .from("codigos_invitacion")
    .insert({
      codigo: params.codigo,
      duracion_dias: params.duracionDias ?? 30,
      activo: params.activo ?? true,
      fecha_vencimiento: params.fechaVencimiento ?? new Date(ahora + 30 * 86_400_000).toISOString(),
      limite_usos: params.limiteUsos ?? 1,
      veces_usado: params.vecesUsado ?? 0,
    })
    .select("*")
    .single();
  if (error || !data) throw new Error(`No pude crear el código de prueba "${params.codigo}": ${error?.message}`);
  return data;
}

export async function borrarCodigoInvitacion(admin: ReturnType<typeof adminClient>, id: string) {
  const { error } = await admin.from("codigos_invitacion").delete().eq("id", id);
  if (error) console.error(`No pude borrar el código de prueba ${id}: ${error.message}`);
}

/**
 * Borra todo lo que un usuario de prueba pudo haber generado por su cuenta
 * (progreso, suscripciones, certificados) ANTES de borrar al usuario. No se
 * asume cascada desde `perfiles`: schema.prisma no la declara para estas tres
 * tablas (a diferencia de `progreso.leccion`, que sí es `onDelete: Cascade`
 * hacia `lecciones`), y confiar en una cascada que no existe dejaría filas
 * huérfanas ensuciando el proyecto real (no hay staging separado).
 */
export async function limpiarDatosDeUsuario(admin: ReturnType<typeof adminClient>, usuarioId: string) {
  await admin.from("certificados").delete().eq("id_usuario", usuarioId);
  await admin.from("progreso").delete().eq("id_usuario", usuarioId);
  await admin.from("suscripciones").delete().eq("id_usuario", usuarioId);
}

/**
 * Genera un enlace real de recuperación de contraseña (mismo mecanismo que
 * generarEnlaceConfirmacion, pero `type: "recovery"`), sin depender de una
 * bandeja de entrada real.
 */
export async function generarEnlaceRecuperacion(
  admin: ReturnType<typeof adminClient>,
  params: { email: string; origin: string; next: string },
) {
  const { data, error } = await admin.auth.admin.generateLink({
    type: "recovery",
    email: params.email,
  });
  if (error || !data.properties?.hashed_token) {
    throw new Error(`No pude generar el enlace de recuperación: ${error?.message}`);
  }
  const { hashed_token, verification_type } = data.properties;
  return `${params.origin}/auth/confirm?token_hash=${hashed_token}&type=${verification_type}&next=${encodeURIComponent(params.next)}`;
}

export async function borrarUsuarioPorEmail(admin: ReturnType<typeof adminClient>, email: string) {
  // listUsers no tiene filtro por email en este SDK; se pagina hasta
  // encontrarlo. El volumen de usuarios reales es bajo hoy, así que una
  // sola página (1000) alcanza sin problema.
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (error) return;
  const user = data.users.find((u) => u.email === email);
  if (!user) return;
  const { error: errDelete } = await admin.auth.admin.deleteUser(user.id); // cascada a perfiles (010)
  if (errDelete) {
    // No silenciar: un usuario desechable que no se borra ensucia el
    // proyecto real de Supabase (no hay staging separado).
    console.error(`No pude borrar el usuario de prueba ${email}: ${errDelete.message}`);
  }
}
