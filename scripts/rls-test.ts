/**
 * Prueba de RLS con 3 sesiones (anónimo, estudiante sin acceso, estudiante
 * con acceso), llamando la API de Supabase directamente (nunca la UI) con
 * el token de cada rol. Ver auditoría de RLS / checklist de seguridad,
 * "Definición de terminado". Se vuelve a correr en la Fase 7.
 *
 * Uso: npm run test:rls
 *
 * Qué hace:
 *   1. Crea con la Service Role Key dos usuarios desechables (uno sin
 *      ningún acceso, otro con una suscripción ACTIVA) y un curso NO
 *      publicado (mostrado = false) para tener un caso determinista de
 *      "esto nunca debería ser visible", sin depender del estado actual
 *      del catálogo real.
 *   2. Inicia sesión como cada uno con la anon key (igual que lo haría un
 *      navegador) y, para cada sesión, intenta leer/escribir datos que NO
 *      le corresponden. Todos esos intentos deben fallar (error, o éxito
 *      con 0 filas afectadas/devueltas).
 *   3. También verifica que el acceso legítimo SÍ funciona (catálogo
 *      público, perfil propio, progreso propio con acceso), para
 *      distinguir "RLS bloquea todo por accidente" de "RLS bloquea lo que
 *      debe bloquear".
 *   4. Borra todo lo que creó, sin importar si alguna aserción falló.
 *
 * Sale con código 1 si algo falló, para poder usarse como gate de CI.
 */

// .env.local no existe en CI, donde las variables llegan del entorno
// (mismo patrón que scripts/apply-rls.ts, P0-1).
try {
  process.loadEnvFile(".env.local");
} catch {
  // Sin archivo: se usan las variables ya presentes en process.env.
}

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!URL || !ANON_KEY || !SERVICE_KEY) {
  throw new Error("Faltan variables de entorno de Supabase (en .env.local o en el entorno).");
}

type Resultado = { nombre: string; ok: boolean; detalle?: string };
const resultados: Resultado[] = [];

function registrar(nombre: string, ok: boolean, detalle?: string) {
  resultados.push({ nombre, ok, detalle });
  console.log(`${ok ? "✅" : "❌"} ${nombre}${detalle ? ` — ${detalle}` : ""}`);
}

/** El intento DEBE fallar: error de RLS, o éxito con 0 filas. */
async function esperarBloqueado(
  nombre: string,
  promesa: PromiseLike<{ data: unknown; error: { message: string } | null }>,
) {
  const { data, error } = await promesa;
  const filas = Array.isArray(data) ? data.length : data ? 1 : 0;
  const bloqueado = !!error || filas === 0;
  registrar(nombre, bloqueado, error ? error.message : bloqueado ? "0 filas (filtrado por RLS)" : `${filas} fila(s) expuestas`);
}

/** El intento DEBE funcionar (acceso legítimo). */
async function esperarPermitido(
  nombre: string,
  promesa: PromiseLike<{ data: unknown; error: { message: string } | null }>,
) {
  const { data, error } = await promesa;
  registrar(nombre, !error, error?.message);
  return data;
}

async function main() {
  const admin = createClient(URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const sufijo = Date.now();
  const password = "RlsTest2026!";
  const correoSinAcceso = `rls-test-sin-acceso-${sufijo}@uva.test`;
  const correoConAcceso = `rls-test-con-acceso-${sufijo}@uva.test`;
  const correoAdmin = `rls-test-admin-${sufijo}@uva.test`;

  console.log("Preparando datos de prueba desechables...\n");

  const { data: adminPerfil, error: errAdminPerfil } = await admin
    .from("perfiles")
    .select("id")
    .eq("rol", "ADMINISTRADOR")
    .limit(1)
    .single();
  if (errAdminPerfil || !adminPerfil) {
    throw new Error("No hay ningún perfil ADMINISTRADOR en la base (corre prisma/seed.ts primero).");
  }

  const { data: userSinAcceso, error: errSinAcceso } = await admin.auth.admin.createUser({
    email: correoSinAcceso,
    password,
    email_confirm: true,
  });
  if (errSinAcceso || !userSinAcceso.user) throw new Error(`No pude crear el usuario sin acceso: ${errSinAcceso?.message}`);

  const { data: userConAcceso, error: errConAcceso } = await admin.auth.admin.createUser({
    email: correoConAcceso,
    password,
    email_confirm: true,
  });
  if (errConAcceso || !userConAcceso.user) throw new Error(`No pude crear el usuario con acceso: ${errConAcceso?.message}`);

  // Administrador desechable para probar el panel (036/037). No se reutiliza
  // el admin real del seed porque su contraseña no la conoce este script, y
  // hace falta una SESIÓN autenticada: el cliente service_role se salta RLS,
  // que es justo lo que hay que verificar.
  //
  // El trigger de auth.users crea el perfil con rol ESTUDIANTE
  // (000_perfil_desde_auth_users.sql); se promueve con el cliente
  // service_role porque 013_perfiles_bloquea_autopromocion.sql impide que un
  // usuario se cambie el rol a sí mismo.
  const { data: userAdmin, error: errAdmin } = await admin.auth.admin.createUser({
    email: correoAdmin,
    password,
    email_confirm: true,
  });
  if (errAdmin || !userAdmin.user) throw new Error(`No pude crear el admin de prueba: ${errAdmin?.message}`);

  const { error: errPromover } = await admin
    .from("perfiles")
    .update({ rol: "ADMINISTRADOR" })
    .eq("id", userAdmin.user.id);
  if (errPromover) throw new Error(`No pude promover el admin de prueba: ${errPromover.message}`);

  const { data: plan, error: errPlan } = await admin
    .from("planes")
    .insert({ nombre: `Plan RLS test ${sufijo}`, precio_centavos: 0, moneda: "COP", duracion_dias: 30, activo: false })
    .select("id")
    .single();
  if (errPlan || !plan) throw new Error(`No pude crear el plan de prueba: ${errPlan?.message}`);

  const { error: errSuscripcion } = await admin.from("suscripciones").insert({
    id_usuario: userConAcceso.user.id,
    id_plan: plan.id,
    fecha_inicio: new Date().toISOString(),
    fecha_renovacion: new Date(Date.now() + 30 * 86_400_000).toISOString(),
    estado: "ACTIVA",
    proveedor: "manual",
    monto_centavos: 0,
    moneda: "COP",
    acceso_manual: true,
  });
  if (errSuscripcion) throw new Error(`No pude crear la suscripción de prueba: ${errSuscripcion.message}`);

  const { data: categoria, error: errCategoria } = await admin
    .from("categorias")
    // `slug` es NOT NULL y único desde la migración
    // 20260825010000_agrega_slug_a_categorias; el sufijo desechable ya
    // garantiza que no choque con otra corrida.
    .insert({
      nombre: `Categoria RLS test ${sufijo}`,
      slug: `categoria-rls-test-${sufijo}`.toLowerCase(),
      activo: true,
    })
    .select("id")
    .single();
  if (errCategoria || !categoria) throw new Error(`No pude crear la categoría de prueba: ${errCategoria?.message}`);

  const { data: instructor, error: errInstructor } = await admin
    .from("instructores")
    .insert({ nombre: `Instructor RLS test ${sufijo}` })
    .select("id")
    .single();
  if (errInstructor || !instructor) throw new Error(`No pude crear el instructor de prueba: ${errInstructor?.message}`);

  const { data: cursoNoPublicado, error: errCurso } = await admin
    .from("cursos")
    .insert({
      titulo: `Curso RLS test (borrador) ${sufijo}`,
      descripcion: "x",
      imagen_portada: "x",
      id_instructor: instructor.id,
      mostrado: false,
      id_admin_creador: adminPerfil.id,
    })
    .select("id")
    .single();
  if (errCurso || !cursoNoPublicado) throw new Error(`No pude crear el curso de prueba: ${errCurso?.message}`);

  const { error: errCursoCategoria } = await admin
    .from("curso_categorias")
    .insert({ id_curso: cursoNoPublicado.id, id_categoria: categoria.id });
  if (errCursoCategoria) throw new Error(`No pude vincular la categoría del curso de prueba: ${errCursoCategoria.message}`);

  const clienteAnonimo: SupabaseClient = createClient(URL, ANON_KEY);

  const clienteSinAcceso: SupabaseClient = createClient(URL, ANON_KEY);
  const loginSinAcceso = await clienteSinAcceso.auth.signInWithPassword({ email: correoSinAcceso, password });
  if (loginSinAcceso.error) throw new Error(`No pude iniciar sesión (sin acceso): ${loginSinAcceso.error.message}`);

  const clienteConAcceso: SupabaseClient = createClient(URL, ANON_KEY);
  const loginConAcceso = await clienteConAcceso.auth.signInWithPassword({ email: correoConAcceso, password });
  if (loginConAcceso.error) throw new Error(`No pude iniciar sesión (con acceso): ${loginConAcceso.error.message}`);

  try {
    console.log("\n=== Sesión: ANÓNIMO (sin login) ===\n");

    await esperarBloqueado("anon no puede leer perfiles", clienteAnonimo.from("perfiles").select("*"));
    await esperarBloqueado("anon no puede leer progreso", clienteAnonimo.from("progreso").select("*"));
    await esperarBloqueado("anon no puede leer certificados", clienteAnonimo.from("certificados").select("*"));
    await esperarBloqueado("anon no puede leer suscripciones", clienteAnonimo.from("suscripciones").select("*"));
    await esperarBloqueado("anon no puede leer cupones", clienteAnonimo.from("cupones").select("*"));
    await esperarBloqueado("anon no puede leer codigos_invitacion", clienteAnonimo.from("codigos_invitacion").select("*"));
    await esperarBloqueado("anon no puede leer bitacora_administrativa", clienteAnonimo.from("bitacora_administrativa").select("*"));
    await esperarBloqueado("anon no puede leer eventos_webhook", clienteAnonimo.from("eventos_webhook").select("*"));
    // Listar esta tabla sería listar todos los enlaces de vista previa
    // activos de la plataforma. Quien abre un enlace nunca la consulta: la
    // validación pasa por el servidor de Next.js (ver 025_rls_tokens_vista_previa).
    await esperarBloqueado(
      "anon no puede leer tokens_vista_previa",
      clienteAnonimo.from("tokens_vista_previa").select("*"),
    );
    await esperarBloqueado(
      "anon no ve el curso NO publicado",
      clienteAnonimo.from("cursos").select("id").eq("id", cursoNoPublicado.id),
    );
    await esperarBloqueado(
      "anon no ve la categoría del curso NO publicado (curso_categorias)",
      clienteAnonimo.from("curso_categorias").select("id").eq("id_curso", cursoNoPublicado.id),
    );
    await esperarBloqueado(
      "anon no puede insertar en curso_categorias",
      clienteAnonimo.from("curso_categorias").insert({ id_curso: cursoNoPublicado.id, id_categoria: categoria.id }).select(),
    );
    await esperarBloqueado(
      "anon no puede insertar en inscripciones",
      clienteAnonimo.from("inscripciones").insert({ id_usuario: userSinAcceso.user!.id, id_curso: cursoNoPublicado.id, tipo_acceso: "MEMBRESIA" }).select(),
    );
    await esperarBloqueado(
      "anon no puede llamar canjear_codigo_invitacion (RPC solo service_role)",
      clienteAnonimo.rpc("canjear_codigo_invitacion", { p_codigo: "x", p_usuario_id: userSinAcceso.user!.id }),
    );
    await esperarBloqueado(
      "anon no puede llamar verificar_limite_check_email (RPC solo service_role, P2-1)",
      clienteAnonimo.rpc("verificar_limite_check_email", { p_ip: "127.0.0.1" }),
    );
    await esperarBloqueado(
      "anon no puede llamar registrar_intento_check_email (RPC solo service_role, P2-1)",
      clienteAnonimo.rpc("registrar_intento_check_email", { p_ip: "127.0.0.1" }),
    );
    await esperarBloqueado(
      "anon no puede llamar verificar_limite_canjear_codigo (RPC solo service_role, P2-2)",
      clienteAnonimo.rpc("verificar_limite_canjear_codigo", { p_usuario_id: userSinAcceso.user!.id }),
    );
    await esperarBloqueado(
      "anon no puede llamar registrar_canje_fallido (RPC solo service_role, P2-2)",
      clienteAnonimo.rpc("registrar_canje_fallido", { p_usuario_id: userSinAcceso.user!.id }),
    );

    await esperarPermitido("anon SÍ puede leer el catálogo público (categorías activas)", clienteAnonimo.from("categorias").select("id").eq("activo", true));
    await esperarPermitido(
      "anon SÍ puede leer curso_categorias de cursos publicados",
      clienteAnonimo.from("curso_categorias").select("id_curso, id_categoria").limit(1),
    );
    const verificacion = await esperarPermitido(
      "anon SÍ puede llamar verificar_certificado (función pública)",
      clienteAnonimo.rpc("verificar_certificado", { p_codigo: "codigo-que-no-existe" }).select(),
    );
    const filaVerificacion = Array.isArray(verificacion) ? verificacion[0] : verificacion;
    registrar(
      "verificar_certificado responde valido=false para un código inexistente",
      filaVerificacion?.valido === false,
      JSON.stringify(filaVerificacion),
    );

    console.log("\n=== Sesión: ESTUDIANTE SIN ACCESO ===\n");

    await esperarBloqueado(
      "estudiante sin acceso no puede leer el perfil de otro usuario",
      clienteSinAcceso.from("perfiles").select("*").eq("id", userConAcceso.user!.id),
    );
    await esperarBloqueado(
      "estudiante sin acceso NO puede auto-promoverse a ADMINISTRADOR",
      clienteSinAcceso.from("perfiles").update({ rol: "ADMINISTRADOR" }).eq("id", userSinAcceso.user!.id).select(),
    );
    await esperarBloqueado(
      "estudiante sin acceso NO puede cambiar su propio estado",
      clienteSinAcceso.from("perfiles").update({ estado: "SUSPENDIDO" }).eq("id", userSinAcceso.user!.id).select(),
    );
    await esperarBloqueado(
      "estudiante sin acceso no puede leer progreso de otro usuario",
      clienteSinAcceso.from("progreso").select("*").eq("id_usuario", userConAcceso.user!.id),
    );
    await esperarBloqueado(
      "estudiante sin acceso no puede leer certificados de otro usuario",
      clienteSinAcceso.from("certificados").select("*").eq("id_usuario", userConAcceso.user!.id),
    );
    await esperarBloqueado(
      "estudiante sin acceso no puede leer suscripciones de otro usuario",
      clienteSinAcceso.from("suscripciones").select("*").eq("id_usuario", userConAcceso.user!.id),
    );
    await esperarBloqueado("estudiante sin acceso no puede leer cupones", clienteSinAcceso.from("cupones").select("*"));
    await esperarBloqueado("estudiante sin acceso no puede leer codigos_invitacion", clienteSinAcceso.from("codigos_invitacion").select("*"));
    await esperarBloqueado("estudiante sin acceso no puede leer bitacora_administrativa", clienteSinAcceso.from("bitacora_administrativa").select("*"));
    await esperarBloqueado(
      "estudiante sin acceso no puede leer tokens_vista_previa",
      clienteSinAcceso.from("tokens_vista_previa").select("*"),
    );
    await esperarBloqueado(
      "estudiante sin acceso no ve el curso NO publicado",
      clienteSinAcceso.from("cursos").select("id").eq("id", cursoNoPublicado.id),
    );
    await esperarBloqueado(
      "estudiante sin acceso no ve la categoría del curso NO publicado (curso_categorias)",
      clienteSinAcceso.from("curso_categorias").select("id").eq("id_curso", cursoNoPublicado.id),
    );
    await esperarBloqueado(
      "estudiante sin acceso no puede auto-otorgarse una CORTESIA",
      clienteSinAcceso.from("inscripciones").insert({ id_usuario: userSinAcceso.user!.id, id_curso: cursoNoPublicado.id, tipo_acceso: "CORTESIA" }).select(),
    );
    await esperarBloqueado(
      "estudiante sin acceso no puede auto-inscribirse sin suscripción activa",
      clienteSinAcceso.from("inscripciones").insert({ id_usuario: userSinAcceso.user!.id, id_curso: cursoNoPublicado.id, tipo_acceso: "MEMBRESIA" }).select(),
    );

    await esperarPermitido("estudiante sin acceso SÍ puede leer su propio perfil", clienteSinAcceso.from("perfiles").select("*").eq("id", userSinAcceso.user!.id));
    await esperarPermitido(
      "estudiante sin acceso SÍ puede editar su propio nombre",
      clienteSinAcceso.from("perfiles").update({ nombre: "RLS Test Sin Acceso" }).eq("id", userSinAcceso.user!.id).select(),
    );

    console.log("\n=== Sesión: ESTUDIANTE CON ACCESO (suscripción ACTIVA) ===\n");

    await esperarBloqueado(
      "estudiante con acceso no puede leer el perfil de otro usuario",
      clienteConAcceso.from("perfiles").select("*").eq("id", userSinAcceso.user!.id),
    );
    await esperarBloqueado(
      "estudiante con acceso NO puede auto-promoverse a ADMINISTRADOR",
      clienteConAcceso.from("perfiles").update({ rol: "ADMINISTRADOR" }).eq("id", userConAcceso.user!.id).select(),
    );
    await esperarBloqueado(
      "estudiante con acceso no puede leer progreso de otro usuario",
      clienteConAcceso.from("progreso").select("*").eq("id_usuario", userSinAcceso.user!.id),
    );
    await esperarBloqueado("estudiante con acceso no puede leer cupones (no es admin)", clienteConAcceso.from("cupones").select("*"));
    await esperarBloqueado("estudiante con acceso no puede leer codigos_invitacion (no es admin)", clienteConAcceso.from("codigos_invitacion").select("*"));
    await esperarBloqueado(
      "estudiante con acceso no ve el curso NO publicado (su suscripción no lo hace admin)",
      clienteConAcceso.from("cursos").select("id").eq("id", cursoNoPublicado.id),
    );
    await esperarBloqueado(
      "estudiante con acceso no ve la categoría del curso NO publicado (curso_categorias)",
      clienteConAcceso.from("curso_categorias").select("id").eq("id_curso", cursoNoPublicado.id),
    );
    await esperarBloqueado(
      "estudiante con acceso no puede escribir directamente en suscripciones (solo backend/webhooks)",
      clienteConAcceso.from("suscripciones").update({ estado: "CANCELADA" }).eq("id_usuario", userConAcceso.user!.id).select(),
    );

    await esperarPermitido("estudiante con acceso SÍ puede leer su propia suscripción", clienteConAcceso.from("suscripciones").select("*").eq("id_usuario", userConAcceso.user!.id));
    // P0-1 (AUDIT-2026-08-26.md): esto ANTES esperaba "permitido", afirmando
    // como correcto el bypass del muro de pago — un suscriptor podía
    // auto-inscribirse a cualquier curso y conservar el acceso tras
    // cancelar, porque la condición de "suscripción activa" solo se
    // evaluaba una vez, al insertar. 032_revoca_autoinscripcion_membresia.sql
    // elimina esa policy: ningún Server Action ni componente de la
    // aplicación la usaba (el único escritor real de `inscripciones` es
    // ofrecerCortesia(), siempre CORTESIA), así que no hay flujo legítimo
    // que se rompa.
    await esperarBloqueado(
      "estudiante con acceso NO puede auto-inscribirse (MEMBRESIA) ni con suscripción activa — P0-1",
      clienteConAcceso.from("inscripciones").insert({ id_usuario: userConAcceso.user!.id, id_curso: cursoNoPublicado.id, tipo_acceso: "MEMBRESIA" }).select(),
    );

    console.log("\n=== Sesión: ACCESO A CURSO DESPUBLICADO (Revcurso, 030_acceso_curso_despublicado.sql) ===\n");

    // Cortesía: acceso incondicional, publicado o no — es un regalo directo
    // a esa persona a ESE curso, nunca dependió del catálogo.
    const { error: errCortesiaDespublicado } = await admin.from("inscripciones").insert({
      id_usuario: userSinAcceso.user!.id,
      id_curso: cursoNoPublicado.id,
      tipo_acceso: "CORTESIA",
      otorgado_por: adminPerfil.id,
    });
    if (errCortesiaDespublicado) throw new Error(`No pude otorgar la cortesía de prueba: ${errCortesiaDespublicado.message}`);

    await esperarPermitido(
      "cortesía SÍ ve un curso despublicado",
      clienteSinAcceso.from("cursos").select("id").eq("id", cursoNoPublicado.id),
    );

    // Membresía: la prueba de arriba ya confirmó que el cliente no puede
    // crearla por su cuenta (P0-1); acá el admin la siembra directamente
    // (Service Role Key, se salta RLS) solo para poder seguir probando la
    // regla de "ya lo estaba viendo" de tiene_acceso_vigente_curso() sobre
    // una fila MEMBRESIA, sin depender de que exista todavía un flujo de
    // alta automática. userConAcceso debe seguir bloqueado mientras no
    // tenga progreso guardado en este curso. Si esto pasara, sería la
    // regresión exacta que motivó distinguir tipo_acceso dentro de
    // tiene_acceso_vigente_curso().
    const { error: errMembresiaDespublicado } = await admin.from("inscripciones").insert({
      id_usuario: userConAcceso.user!.id,
      id_curso: cursoNoPublicado.id,
      tipo_acceso: "MEMBRESIA",
    });
    if (errMembresiaDespublicado) throw new Error(`No pude sembrar la membresía de prueba: ${errMembresiaDespublicado.message}`);
    const { data: moduloDespublicado, error: errModulo } = await admin
      .from("modulos")
      .insert({ id_curso: cursoNoPublicado.id, titulo: "Módulo RLS test", orden: 10 })
      .select("id")
      .single();
    if (errModulo || !moduloDespublicado) throw new Error(`No pude crear el módulo de prueba: ${errModulo?.message}`);

    const { data: leccionDespublicada, error: errLeccion } = await admin
      .from("lecciones")
      .insert({ id_modulo: moduloDespublicado.id, titulo: "Lección RLS test", orden: 10 })
      .select("id")
      .single();
    if (errLeccion || !leccionDespublicada) throw new Error(`No pude crear la lección de prueba: ${errLeccion?.message}`);

    await esperarBloqueado(
      "membresía sin progreso sigue sin ver el curso despublicado (aunque ya tenga una inscripción MEMBRESIA)",
      clienteConAcceso.from("cursos").select("id").eq("id", cursoNoPublicado.id),
    );

    const { error: errProgreso } = await admin
      .from("progreso")
      .insert({ id_usuario: userConAcceso.user!.id, id_leccion: leccionDespublicada.id, completado: false });
    if (errProgreso) throw new Error(`No pude crear el progreso de prueba: ${errProgreso.message}`);

    await esperarPermitido(
      "membresía CON progreso ya guardado SÍ ve el curso despublicado ('ya lo estaba viendo')",
      clienteConAcceso.from("cursos").select("id").eq("id", cursoNoPublicado.id),
    );

    // ------------------------------------------------------------------
    // Vigencia por fecha (supabase/sql/038)
    //
    // Nada mueve una suscripción a VENCIDA cuando pasa su fecha de
    // renovación, así que la fila sigue diciendo ACTIVA. Antes de 038 eso
    // bastaba para seguir bajando materiales y viendo cursos: una
    // invitación de 30 días daba acceso permanente. Se prueba con la MISMA
    // fila, moviéndole solo la fecha.
    // ------------------------------------------------------------------
    const { data: recurso, error: errRecurso } = await admin
      .from("recursos_descargables")
      .insert({
        id_leccion: leccionDespublicada.id,
        nombre: "Material RLS test.pdf",
        tipo_archivo: "application/pdf",
        url_archivo: "https://example.test/material.pdf",
      })
      .select("id")
      .single();
    if (errRecurso || !recurso) throw new Error(`No pude crear el recurso de prueba: ${errRecurso?.message}`);

    await esperarPermitido(
      "suscripción vigente SÍ descarga los materiales de la lección",
      clienteConAcceso.from("recursos_descargables").select("id").eq("id", recurso.id),
    );

    const { error: errVencer } = await admin
      .from("suscripciones")
      .update({ fecha_renovacion: new Date(Date.now() - 10 * 86_400_000).toISOString() })
      .eq("id_usuario", userConAcceso.user!.id);
    if (errVencer) throw new Error(`No pude vencer la suscripción de prueba: ${errVencer.message}`);

    await esperarBloqueado(
      "acceso vencido (ACTIVA con fecha pasada) NO descarga los materiales",
      clienteConAcceso.from("recursos_descargables").select("id").eq("id", recurso.id),
    );

    await esperarBloqueado(
      "acceso vencido NO ve el curso despublicado, ni con MEMBRESIA y progreso",
      clienteConAcceso.from("cursos").select("id").eq("id", cursoNoPublicado.id),
    );

    await esperarPermitido(
      "el progreso del acceso vencido sigue guardado (vuelve donde iba al renovar)",
      clienteConAcceso.from("progreso").select("id").eq("id_usuario", userConAcceso.user!.id),
    );

    // Se devuelve a vigente: las pruebas del panel de más abajo cuentan
    // usuarios con acceso vigente.
    const { error: errRestaurar } = await admin
      .from("suscripciones")
      .update({ fecha_renovacion: new Date(Date.now() + 30 * 86_400_000).toISOString() })
      .eq("id_usuario", userConAcceso.user!.id);
    if (errRestaurar) throw new Error(`No pude restaurar la suscripción de prueba: ${errRestaurar.message}`);

    // ------------------------------------------------------------------
    // Panel de usuarios (Fase 4, supabase/sql/036 y 037)
    //
    // Estas superficies son admin-only y devuelven el padrón completo, pero
    // el arnés no tenía ninguna sesión de ADMINISTRADOR: se probaban cuatro
    // sesiones y ninguna era la del panel.
    //
    // Lo que más importa es la prueba NEGATIVA. La vista y el RPC son
    // `security_invoker`, así que un estudiante que los invoque directamente
    // por POST solo debería ver lo suyo. Si alguien los convirtiera a
    // SECURITY DEFINER "para que el admin no dependa de la política", estas
    // pruebas son las que lo detectarían.
    // ------------------------------------------------------------------
    console.log("\n=== Sesión: PANEL DE USUARIOS (036/037) ===\n");

    const { data: filasEstudiante, error: errRpcEstudiante } = await clienteConAcceso.rpc(
      "admin_listar_usuarios",
      { p_limite: 100, p_offset: 0 },
    );
    const idsVistos = (filasEstudiante ?? []).map((fila: { id: string }) => fila.id);
    const soloSeVeASiMismo =
      !errRpcEstudiante && idsVistos.every((id: string) => id === userConAcceso.user!.id);
    registrar(
      "estudiante que invoca admin_listar_usuarios NO obtiene el padrón (solo su propia fila)",
      soloSeVeASiMismo,
      errRpcEstudiante
        ? errRpcEstudiante.message
        : `${idsVistos.length} fila(s) visible(s)`,
    );

    const { data: metricasEstudiante } = await clienteConAcceso
      .from("metricas_panel_usuarios")
      .select("cupos_totales, usuarios_registrados")
      .maybeSingle();
    registrar(
      "estudiante NO ve cifras reales en metricas_panel_usuarios (RLS filtra por debajo)",
      Number(metricasEstudiante?.cupos_totales ?? 0) === 0,
      `cupos_totales=${metricasEstudiante?.cupos_totales ?? "sin fila"}`,
    );

    const clienteAdmin: SupabaseClient = createClient(URL, ANON_KEY);
    const loginAdmin = await clienteAdmin.auth.signInWithPassword({
      email: correoAdmin,
      password,
    });
    if (loginAdmin.error) throw new Error(`No pude iniciar sesión como admin: ${loginAdmin.error.message}`);

    await esperarPermitido(
      "administrador SÍ puede listar usuarios por el RPC",
      clienteAdmin.rpc("admin_listar_usuarios", { p_limite: 5, p_offset: 0 }),
    );

    const { data: metricasAdmin } = await clienteAdmin
      .from("metricas_panel_usuarios")
      .select("*")
      .maybeSingle();
    registrar(
      "administrador SÍ ve las métricas del panel",
      !!metricasAdmin && Number(metricasAdmin.usuarios_registrados) > 0,
      `usuarios_registrados=${metricasAdmin?.usuarios_registrados ?? "sin fila"}`,
    );

    // La aritmética de cupos tiene que cerrar: si no, alguna de las cuatro
    // cifras está contando sobre un universo distinto (docs §1.3).
    const cuadra =
      !!metricasAdmin &&
      Number(metricasAdmin.cupos_totales) ===
        Number(metricasAdmin.cupos_canjeados) +
          Number(metricasAdmin.cupos_disponibles) +
          Number(metricasAdmin.cupos_caducados);
    registrar(
      "cupos_totales = canjeados + disponibles + caducados",
      cuadra,
      metricasAdmin
        ? `${metricasAdmin.cupos_totales} = ${metricasAdmin.cupos_canjeados} + ${metricasAdmin.cupos_disponibles} + ${metricasAdmin.cupos_caducados}`
        : "sin fila",
    );

    // registrados = vigentes + vencidos + sin acceso. Los tres cubos parten
    // del mismo universo de estudiantes, así que la suma no puede fallar
    // salvo por un error en la consulta.
    const cubosCuadran =
      !!metricasAdmin &&
      Number(metricasAdmin.usuarios_registrados) ===
        Number(metricasAdmin.usuarios_acceso_vigente) +
          Number(metricasAdmin.usuarios_acceso_vencido) +
          Number(metricasAdmin.usuarios_sin_acceso);
    registrar(
      "usuarios_registrados = vigentes + vencidos + sin acceso",
      cubosCuadran,
      metricasAdmin
        ? `${metricasAdmin.usuarios_registrados} = ${metricasAdmin.usuarios_acceso_vigente} + ${metricasAdmin.usuarios_acceso_vencido} + ${metricasAdmin.usuarios_sin_acceso}`
        : "sin fila",
    );
  } finally {
    console.log("\nLimpiando datos de prueba...");
    await admin.from("recursos_descargables").delete().eq("nombre", "Material RLS test.pdf");
    await admin.from("modulos").delete().eq("id_curso", cursoNoPublicado.id);
    await admin.from("inscripciones").delete().eq("id_curso", cursoNoPublicado.id);
    await admin.from("cursos").delete().eq("id", cursoNoPublicado.id);
    await admin.from("instructores").delete().eq("id", instructor.id);
    await admin.from("categorias").delete().eq("id", categoria.id);
    await admin.from("suscripciones").delete().eq("id_usuario", userConAcceso.user!.id);
    await admin.from("planes").delete().eq("id", plan.id);
    await admin.auth.admin.deleteUser(userSinAcceso.user!.id);
    await admin.auth.admin.deleteUser(userConAcceso.user!.id);
    await admin.auth.admin.deleteUser(userAdmin.user!.id);
  }

  const fallidos = resultados.filter((r) => !r.ok);
  console.log(`\n${resultados.length - fallidos.length}/${resultados.length} pruebas OK.`);
  if (fallidos.length > 0) {
    console.log(`\n${fallidos.length} prueba(s) FALLIDA(S):`);
    for (const f of fallidos) console.log(`  - ${f.nombre}${f.detalle ? ` (${f.detalle})` : ""}`);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("\nError inesperado corriendo la prueba de RLS:", error);
  process.exitCode = 1;
});
