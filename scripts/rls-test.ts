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
// Import dinámico, no estático: un `import` de nivel superior se eleva por
// encima del `process.loadEnvFile(".env.local")` de arriba (los ESM izan
// TODOS los imports antes de cualquier otra sentencia, sin importar el
// orden en el código fuente). `resolverTokenReproduccion` arrastra
// `@/lib/mux/client`, que construye el cliente de Mux al cargarse — con un
// import estático, esa construcción ocurriría con `process.env` todavía
// vacío y el token saldría sin firmar ("Signing key required"), un fallo de
// configuración del script, no del control de acceso. Con `await import()`
// dentro de `main()`, el módulo se evalúa después de que el .env ya cargó.
type ResolverTokenReproduccion = typeof import("../src/lib/video/reproduccion").resolverTokenReproduccion;
type BuscarMembresiaVigente = typeof import("../src/lib/admin/membresiaManual").buscarMembresiaVigente;
type SuscripcionDaAcceso = typeof import("../src/lib/estadoAcceso").suscripcionDaAcceso;

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
  const { resolverTokenReproduccion }: { resolverTokenReproduccion: ResolverTokenReproduccion } =
    await import("../src/lib/video/reproduccion");
  // Mismo import diferido por coherencia con el de arriba, aunque este módulo
  // no dependa de ninguna variable de entorno (solo tipos de supabase-js).
  const { buscarMembresiaVigente }: { buscarMembresiaVigente: BuscarMembresiaVigente } =
    await import("../src/lib/admin/membresiaManual");
  // La gemela en TypeScript de private.suscripcion_da_acceso(). Se importa
  // para poder comprobar que las DOS dicen lo mismo, que es lo que exige la
  // cabecera de 038 y lo que dejó de cumplirse mientras la columna fue
  // `timestamp` sin zona. `estadoAcceso` solo trae `calcularDiasGracia` y un
  // `import type`, así que no arrastra `next/headers` a este script.
  const { suscripcionDaAcceso }: { suscripcionDaAcceso: SuscripcionDaAcceso } =
    await import("../src/lib/estadoAcceso");

  const admin = createClient(URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const sufijo = Date.now();
  const password = "RlsTest2026!";
  const correoSinAcceso = `rls-test-sin-acceso-${sufijo}@uva.test`;
  const correoConAcceso = `rls-test-con-acceso-${sufijo}@uva.test`;
  const correoAdmin = `rls-test-admin-${sufijo}@uva.test`;
  // Se declara aquí, no dentro del try, para que la limpieza del finally pueda
  // borrar los pagos de prueba aunque una aserción falle antes.
  const refPagoPrueba = `ref_rls_test_${sufijo}`;
  // Mismo motivo: el lote de códigos (044/045) se crea dentro del try, pero
  // su id hay que conocerlo en el finally para borrar también sus códigos.
  let idLotePrueba: string | null = null;

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

  // Curso PUBLICADO (`mostrado = true`) para la prueba de reproducción: así
  // la lectura de la lección no depende de RLS de visibilidad de curso (eso
  // ya lo prueba el bloque de "curso despublicado"), y el resultado aísla
  // justo lo que hay que probar — la vigencia de la suscripción.
  const { data: cursoReproduccion, error: errCursoReproduccion } = await admin
    .from("cursos")
    .insert({
      titulo: `Curso RLS test (reproducción) ${sufijo}`,
      descripcion: "x",
      imagen_portada: "x",
      id_instructor: instructor.id,
      mostrado: true,
      id_admin_creador: adminPerfil.id,
    })
    .select("id")
    .single();
  if (errCursoReproduccion || !cursoReproduccion) {
    throw new Error(`No pude crear el curso de reproducción de prueba: ${errCursoReproduccion?.message}`);
  }

  const { data: moduloReproduccion, error: errModuloReproduccion } = await admin
    .from("modulos")
    .insert({ id_curso: cursoReproduccion.id, titulo: "Módulo reproducción RLS test", orden: 10 })
    .select("id")
    .single();
  if (errModuloReproduccion || !moduloReproduccion) {
    throw new Error(`No pude crear el módulo de reproducción de prueba: ${errModuloReproduccion?.message}`);
  }

  // `id_video_mux` no necesita ser un asset real: firmar el JWT es una
  // operación puramente criptográfica con la private key de Mux, sin
  // llamada de red — no hace falta que el playback ID exista en Mux para
  // probar la DECISIÓN de acceso, que es lo único que interesa aquí.
  const { data: leccionReproduccion, error: errLeccionReproduccion } = await admin
    .from("lecciones")
    .insert({
      id_modulo: moduloReproduccion.id,
      titulo: "Lección reproducción RLS test",
      orden: 10,
      id_video_mux: `rls-test-playback-${sufijo}`,
      estado_procesamiento: "LISTO",
    })
    .select("id")
    .single();
  if (errLeccionReproduccion || !leccionReproduccion) {
    throw new Error(`No pude crear la lección de reproducción de prueba: ${errLeccionReproduccion?.message}`);
  }
  // TS no arrastra el `!leccionReproduccion` de arriba hasta dentro de la
  // función definida más abajo (verificarReproduccion): con una constante
  // aparte que ya no es nullable, no hace falta un `!` en cada uso.
  const idLeccionReproduccion: string = leccionReproduccion.id;

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

    // Revocar (f4accesos.md): quitarCortesia() ya no borra la fila, la
    // marca `activo = false` — esta es la prueba de que
    // 039_revocacion_cortesia.sql realmente deja de contarla en
    // private.tiene_acceso_vigente_curso(). Antes de esa migración, la fila
    // seguía siendo tipo_acceso = 'CORTESIA' y el acceso NUNCA se cortaba.
    const { error: errRevocarCortesia } = await admin
      .from("inscripciones")
      .update({
        activo: false,
        revocado_en: new Date().toISOString(),
        motivo_revocacion: "prueba RLS",
        revocado_por: adminPerfil.id,
      })
      .eq("id_usuario", userSinAcceso.user!.id)
      .eq("id_curso", cursoNoPublicado.id);
    if (errRevocarCortesia) throw new Error(`No pude revocar la cortesía de prueba: ${errRevocarCortesia.message}`);

    await esperarBloqueado(
      "cortesía revocada NO ve un curso despublicado",
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
    // REPRODUCCIÓN (RevAccesof4, "Definición de terminado": las 3 cuentas
    // probadas en catálogo, detalle de curso Y reproducción, vía API
    // directa, no solo desde la interfaz).
    //
    // El resto de este archivo prueba RLS — la segunda capa. Esto prueba la
    // PRIMERA: `resolverTokenReproduccion()` (src/lib/video/reproduccion.ts),
    // la función que de verdad decide si se firma el JWT de Mux. No es
    // invocable como Server Action fuera de una petición de Next (depende de
    // `cookies()`), así que se llama a la función ya extraída, pasándole un
    // cliente autenticado a mano — exactamente lo que hace este script con
    // el resto de sesiones. Los fixtures (curso/módulo/lección) se crean
    // antes del `try`, junto al resto — así el `finally` también puede
    // limpiarlos.
    // ------------------------------------------------------------------
    async function verificarReproduccion(
      nombre: string,
      cliente: SupabaseClient,
      esperado: "permitido" | "bloqueado",
    ) {
      const resultado = await resolverTokenReproduccion(cliente, idLeccionReproduccion);
      const tieneToken = "token" in resultado;
      const ok = esperado === "permitido" ? tieneToken : !tieneToken;
      registrar(
        nombre,
        ok,
        tieneToken ? "token firmado" : (resultado as { error: string }).error,
      );
    }

    await verificarReproduccion(
      "reproducción: sin acceso NO obtiene token de video",
      clienteSinAcceso,
      "bloqueado",
    );
    await verificarReproduccion(
      "reproducción: con acceso vigente SÍ obtiene token de video",
      clienteConAcceso,
      "permitido",
    );

    // Cortesía otorgada y luego revocada (f4accesos.md) sobre el MISMO
    // curso publicado que usa la prueba de arriba: confirma que
    // resolverTokenReproduccion() — que ahora exige `activo = true` en su
    // consulta a `inscripciones` — deja de firmar el token en cuanto se
    // revoca, sin esperar a que expire el token de 15 minutos ya emitido
    // (la mitigación aceptada para ese, documentada en
    // src/lib/video/reproduccion.ts).
    const { error: errCortesiaReproduccion } = await admin.from("inscripciones").insert({
      id_usuario: userSinAcceso.user!.id,
      id_curso: cursoReproduccion.id,
      tipo_acceso: "CORTESIA",
      otorgado_por: adminPerfil.id,
    });
    if (errCortesiaReproduccion) {
      throw new Error(`No pude otorgar la cortesía de reproducción de prueba: ${errCortesiaReproduccion.message}`);
    }

    await verificarReproduccion(
      "reproducción: cortesía activa SÍ obtiene token de video",
      clienteSinAcceso,
      "permitido",
    );

    const { error: errRevocarCortesiaReproduccion } = await admin
      .from("inscripciones")
      .update({ activo: false, revocado_en: new Date().toISOString(), motivo_revocacion: "prueba RLS" })
      .eq("id_usuario", userSinAcceso.user!.id)
      .eq("id_curso", cursoReproduccion.id);
    if (errRevocarCortesiaReproduccion) {
      throw new Error(`No pude revocar la cortesía de reproducción de prueba: ${errRevocarCortesiaReproduccion.message}`);
    }

    await verificarReproduccion(
      "reproducción: cortesía revocada NO obtiene token de video",
      clienteSinAcceso,
      "bloqueado",
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

    // El caso exacto del P0 original: una ACTIVA con la fecha ya pasada
    // seguía firmando el JWT de Mux para siempre, porque nada movía la fila
    // a VENCIDA. Esta es la prueba que lo habría detectado.
    await verificarReproduccion(
      "reproducción: acceso vencido (ACTIVA con fecha pasada) NO obtiene token de video",
      clienteConAcceso,
      "bloqueado",
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

    // Revocar una membresía manual (f4accesos.md, revocarMembresia): pone
    // estado = 'CANCELADA'. No hace falta ninguna regla nueva de RLS para
    // esto — private.suscripcion_da_acceso() (038) ya solo da acceso a
    // ACTIVA/PAST_DUE, así que CANCELADA cae sola por la rama que falta.
    // Esta prueba confirma que ese camino, ya existente, sigue cerrado.
    const { error: errCancelar } = await admin
      .from("suscripciones")
      .update({ estado: "CANCELADA", motivo_cancelacion: "prueba RLS", cancelado_por: adminPerfil.id })
      .eq("id_usuario", userConAcceso.user!.id);
    if (errCancelar) throw new Error(`No pude cancelar la suscripción de prueba: ${errCancelar.message}`);

    await esperarBloqueado(
      "membresía manual revocada (CANCELADA) NO descarga los materiales",
      clienteConAcceso.from("recursos_descargables").select("id").eq("id", recurso.id),
    );
    await verificarReproduccion(
      "reproducción: membresía manual revocada (CANCELADA) NO obtiene token de video",
      clienteConAcceso,
      "bloqueado",
    );

    const { error: errReactivar } = await admin
      .from("suscripciones")
      .update({ estado: "ACTIVA", motivo_cancelacion: null, cancelado_por: null })
      .eq("id_usuario", userConAcceso.user!.id);
    if (errReactivar) throw new Error(`No pude reactivar la suscripción de prueba: ${errReactivar.message}`);

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

    // ------------------------------------------------------------------
    // admin_listar_usuarios usa vigencia real, no el estado crudo (040)
    //
    // Mismo caso del P0 de 038 (ACTIVA con fecha_renovacion pasada), pero
    // visto desde la tabla del panel en vez del acceso al contenido: antes
    // de 040 la fila de este usuario seguía diciendo "Activa" aquí aunque
    // metricas_panel_usuarios ya lo contara como vencido — el panel
    // contradiciéndose a sí mismo, justo lo que RevUsuariof4 pide evitar.
    // ------------------------------------------------------------------
    const { error: errVencerPanel } = await admin
      .from("suscripciones")
      .update({ fecha_renovacion: new Date(Date.now() - 10 * 86_400_000).toISOString() })
      .eq("id_usuario", userConAcceso.user!.id);
    if (errVencerPanel) throw new Error(`No pude vencer la suscripción para el panel: ${errVencerPanel.message}`);

    const { data: filaVencida } = await clienteAdmin.rpc("admin_listar_usuarios", {
      p_query: correoConAcceso,
      p_limite: 5,
      p_offset: 0,
    });
    const filaDelUsuario = (filaVencida ?? []).find(
      (fila: { id: string }) => fila.id === userConAcceso.user!.id,
    );
    registrar(
      "admin_listar_usuarios reporta VENCIDA para una ACTIVA con fecha pasada, no el estado crudo",
      filaDelUsuario?.suscripcion_estado === "VENCIDA",
      `suscripcion_estado=${filaDelUsuario?.suscripcion_estado ?? "fila no encontrada"}`,
    );

    const { data: filtroVencida } = await clienteAdmin.rpc("admin_listar_usuarios", {
      p_query: correoConAcceso,
      p_suscripcion: "VENCIDA",
      p_limite: 5,
      p_offset: 0,
    });
    registrar(
      "filtro suscripcion=VENCIDA SÍ encuentra al acceso vencido por fecha",
      (filtroVencida ?? []).some((fila: { id: string }) => fila.id === userConAcceso.user!.id),
      `${(filtroVencida ?? []).length} fila(s)`,
    );

    const { data: filtroActiva } = await clienteAdmin.rpc("admin_listar_usuarios", {
      p_query: correoConAcceso,
      p_suscripcion: "ACTIVA",
      p_limite: 5,
      p_offset: 0,
    });
    registrar(
      "filtro suscripcion=ACTIVA YA NO incluye al acceso vencido por fecha",
      !(filtroActiva ?? []).some((fila: { id: string }) => fila.id === userConAcceso.user!.id),
      `${(filtroActiva ?? []).length} fila(s)`,
    );

    // ------------------------------------------------------------------
    // otorgarMembresia puede chocar contra el mismo índice único que
    // canjear_codigo_invitacion ya resolvió — para la otra puerta (041)
    //
    // El usuario sigue con `estado = 'ACTIVA'` y `fecha_renovacion` vencida
    // desde el bloque de arriba (nadie la cerró: no volvió a canjear). Es
    // exactamente el estado en el que `otorgarMembresia` chocaba contra
    // `suscripcion_activa_unica_por_usuario` con un 23505 crudo.
    // ------------------------------------------------------------------
    await esperarBloqueado(
      "un NO administrador no puede llamar cerrar_suscripcion_caducada_admin (ni sobre sí mismo)",
      clienteConAcceso.rpc("cerrar_suscripcion_caducada_admin", {
        p_usuario_id: userConAcceso.user!.id,
      }),
    );

    await esperarPermitido(
      "administrador SÍ puede llamar cerrar_suscripcion_caducada_admin",
      clienteAdmin.rpc("cerrar_suscripcion_caducada_admin", {
        p_usuario_id: userConAcceso.user!.id,
      }),
    );

    const { data: filaCerrada } = await admin
      .from("suscripciones")
      .select("estado")
      .eq("id_usuario", userConAcceso.user!.id)
      .order("fecha_inicio", { ascending: false })
      .limit(1)
      .maybeSingle();
    registrar(
      "cerrar_suscripcion_caducada_admin puso VENCIDA la fila caducada",
      filaCerrada?.estado === "VENCIDA",
      `estado=${filaCerrada?.estado ?? "sin fila"}`,
    );

    // Antes de 041 este insert reventaba con 23505 contra
    // suscripcion_activa_unica_por_usuario, porque la fila vieja seguía
    // contando como ACTIVA para el índice. Es el mismo insert que hace
    // otorgarMembresia (src/actions/admin/usuarios.ts) justo después del RPC
    // de arriba.
    const { error: errOtorgarTrasCierre } = await admin.from("suscripciones").insert({
      id_usuario: userConAcceso.user!.id,
      id_plan: plan.id,
      fecha_inicio: new Date().toISOString(),
      fecha_renovacion: new Date(Date.now() + 30 * 86_400_000).toISOString(),
      estado: "ACTIVA",
      proveedor: "manual",
      monto_centavos: 0,
      moneda: "COP",
      acceso_manual: true,
      otorgado_por: adminPerfil.id,
    });
    registrar(
      "otorgar una membresía nueva tras cerrar la caducada YA NO choca con el índice único",
      !errOtorgarTrasCierre,
      errOtorgarTrasCierre?.message,
    );

    // ------------------------------------------------------------------
    // El OTRO caso del cupo ocupado: la suscripción sigue vigente de verdad
    //
    // Tras el insert de arriba, el usuario tiene una ACTIVA con fecha futura
    // — acceso legítimo ahora mismo. 041 no aplica aquí (no hay nada
    // caducado que cerrar), así que `otorgarMembresia` llegaba igual al
    // insert y moría contra el índice único con un 23505 que el catch
    // genérico convertía en "No pudimos otorgar la membresía." Es justo el
    // caso de uso "alguien que perdió su código" cuando su acceso sigue vivo.
    // ------------------------------------------------------------------
    await esperarPermitido(
      "cerrar_suscripcion_caducada_admin sobre una vigente no falla (no tiene nada que cerrar)",
      clienteAdmin.rpc("cerrar_suscripcion_caducada_admin", {
        p_usuario_id: userConAcceso.user!.id,
      }),
    );

    const { data: filaVigenteTrasRpc } = await admin
      .from("suscripciones")
      .select("estado")
      .eq("id_usuario", userConAcceso.user!.id)
      .in("estado", ["ACTIVA", "PAST_DUE"])
      .maybeSingle();
    registrar(
      "una suscripción VIGENTE sobrevive al cierre de caducadas — por eso hace falta el guard",
      filaVigenteTrasRpc?.estado === "ACTIVA",
      `estado=${filaVigenteTrasRpc?.estado ?? "sin fila vigente"}`,
    );

    // ------------------------------------------------------------------
    // Lote de códigos de invitación (rev.md / 044-045): la opción "N
    // códigos individuales" de un clic, alternativa a "código único con
    // cupo N". Mismo criterio de exposición que
    // cerrar_suscripcion_caducada_admin: SECURITY DEFINER + chequeo interno
    // de private.es_administrador(), llamado con la sesión real del admin.
    // ------------------------------------------------------------------
    console.log("\n=== Sesión: LOTE DE CÓDIGOS DE INVITACIÓN (044/045) ===\n");

    await esperarBloqueado(
      "un NO administrador no puede llamar crear_lote_codigos_invitacion",
      clienteConAcceso.rpc("crear_lote_codigos_invitacion", {
        p_codigos: [`RLSLOTE${sufijo}X1`],
        p_duracion_dias: 30,
        p_fecha_vencimiento: new Date(Date.now() + 30 * 86_400_000).toISOString(),
      }),
    );

    const { data: loteId, error: errCrearLote } = await clienteAdmin.rpc(
      "crear_lote_codigos_invitacion",
      {
        p_codigos: [`RLSLOTE${sufijo}A`, `RLSLOTE${sufijo}B`, `RLSLOTE${sufijo}C`],
        p_duracion_dias: 30,
        p_fecha_vencimiento: new Date(Date.now() + 30 * 86_400_000).toISOString(),
      },
    );
    registrar(
      "administrador SÍ puede generar un lote de códigos",
      !errCrearLote && !!loteId,
      errCrearLote?.message,
    );
    idLotePrueba = (loteId as string | null) ?? null;

    const { data: codigosDelLote } = await admin
      .from("codigos_invitacion")
      .select("codigo, limite_usos")
      .eq("id_lote", idLotePrueba ?? "");
    registrar(
      "el lote insertó exactamente los 3 códigos pedidos, cada uno de uso único",
      (codigosDelLote ?? []).length === 3 &&
        (codigosDelLote ?? []).every((fila) => fila.limite_usos === 1),
      `${(codigosDelLote ?? []).length} código(s)`,
    );

    const { data: cabeceraLote } = await admin
      .from("lotes_codigos_invitacion")
      .select("cantidad")
      .eq("id", idLotePrueba ?? "")
      .maybeSingle();
    registrar(
      "la cabecera del lote guarda la cantidad pedida",
      cabeceraLote?.cantidad === 3,
      `cantidad=${cabeceraLote?.cantidad ?? "sin fila"}`,
    );

    // Atomicidad (rev.md: "si falla a la mitad, no deben quedar códigos
    // sueltos"): "A" ya existe (el lote de arriba), así que el insert
    // completo debe revertir — cabecera nueva incluida — y no dejar ni
    // "NUEVO1" ni "NUEVO2" sueltos.
    const { count: lotesAntesDelChoque } = await admin
      .from("lotes_codigos_invitacion")
      .select("id", { count: "exact", head: true });

    const { error: errChoque } = await clienteAdmin.rpc("crear_lote_codigos_invitacion", {
      p_codigos: [`RLSLOTE${sufijo}NUEVO1`, `RLSLOTE${sufijo}A`, `RLSLOTE${sufijo}NUEVO2`],
      p_duracion_dias: 30,
      p_fecha_vencimiento: new Date(Date.now() + 30 * 86_400_000).toISOString(),
    });
    registrar(
      "un código que choca con uno ya existente hace fallar la llamada completa",
      !!errChoque,
      errChoque?.message,
    );

    const { data: coladoTrasChoque } = await admin
      .from("codigos_invitacion")
      .select("id")
      .eq("codigo", `RLSLOTE${sufijo}NUEVO1`)
      .maybeSingle();
    const { count: lotesTrasChoque } = await admin
      .from("lotes_codigos_invitacion")
      .select("id", { count: "exact", head: true });
    registrar(
      "el choque no dejó ni un código suelto ni una cabecera de lote huérfana",
      !coladoTrasChoque && lotesTrasChoque === lotesAntesDelChoque,
      `código colado=${!!coladoTrasChoque} lotes antes=${lotesAntesDelChoque} lotes después=${lotesTrasChoque}`,
    );

    await esperarBloqueado(
      "un estudiante no puede leer lotes_codigos_invitacion",
      clienteConAcceso.from("lotes_codigos_invitacion").select("*"),
    );
    await esperarPermitido(
      "administrador SÍ puede leer lotes_codigos_invitacion",
      clienteAdmin.from("lotes_codigos_invitacion").select("id").eq("id", idLotePrueba ?? ""),
    );

    // El guard que ahora corre dentro de otorgarMembresia, llamado con la
    // sesión real del admin (depende de `suscripciones_select_propio`, 003,
    // para poder leer la suscripción de OTRO usuario).
    const vigenteVistaPorElGuard = await buscarMembresiaVigente(
      clienteAdmin,
      userConAcceso.user!.id,
    );
    registrar(
      "buscarMembresiaVigente ve la membresía que ocupa el cupo (y sabe que es manual)",
      vigenteVistaPorElGuard?.estado === "ACTIVA" && vigenteVistaPorElGuard.esManual === true,
      vigenteVistaPorElGuard
        ? `estado=${vigenteVistaPorElGuard.estado} manual=${vigenteVistaPorElGuard.esManual} plan=${vigenteVistaPorElGuard.planNombre ?? "—"}`
        : "no encontró ninguna vigente",
    );

    // El error que el guard le evita al admin: sin él, ESTO es lo que
    // otorgarMembresia recibía de la base.
    const { error: errOtorgarSobreVigente } = await admin.from("suscripciones").insert({
      id_usuario: userConAcceso.user!.id,
      id_plan: plan.id,
      fecha_inicio: new Date().toISOString(),
      fecha_renovacion: new Date(Date.now() + 30 * 86_400_000).toISOString(),
      estado: "ACTIVA",
      proveedor: "manual",
      monto_centavos: 0,
      moneda: "COP",
      acceso_manual: true,
      otorgado_por: adminPerfil.id,
    });
    registrar(
      "otorgar sobre una membresía vigente SÍ choca con el índice único (23505) — el guard llega antes",
      errOtorgarSobreVigente?.code === "23505",
      errOtorgarSobreVigente ? `${errOtorgarSobreVigente.code}: ${errOtorgarSobreVigente.message}` : "el insert pasó, el cupo único no se respetó",
    );

    const { error: errRestaurarPanel } = await admin
      .from("suscripciones")
      .update({ fecha_renovacion: new Date(Date.now() + 30 * 86_400_000).toISOString() })
      .eq("id_usuario", userConAcceso.user!.id);
    if (errRestaurarPanel) {
      throw new Error(`No pude restaurar la suscripción tras la prueba del panel: ${errRestaurarPanel.message}`);
    }

    console.log("\n=== Sesión: ESQUEMA LISTO PARA COBRO (042/043) ===\n");

    // --- Regresión de la vigencia (043) -----------------------------------
    //
    // El caso que fallaba: una fecha de renovación fijada a las 3:00 p.m. hora
    // de Colombia. Mientras `fecha_renovacion` fue `timestamp` sin zona, la
    // app guardaba las 20:00 UTC desnudas y 038 las reinterpretaba como hora
    // de Bogotá — sumando cinco horas en vez de restarlas, y corriendo el día
    // civil al siguiente. Resultado: SQL decía "vigente" sobre una suscripción
    // que TypeScript ya daba por vencida, y el estudiante conservaba las
    // descargas un día después de perder el video.
    //
    // Se elige AYER a las 3:00 p.m. de Bogotá porque es el instante donde las
    // dos capas discrepaban: TS lo ve vencido (ayer < hoy) y el SQL viejo lo
    // veía vigente (su cuenta daba hoy).
    const ayer3pmBogota = new Date();
    ayer3pmBogota.setUTCDate(ayer3pmBogota.getUTCDate() - 1);
    ayer3pmBogota.setUTCHours(20, 0, 0, 0); // 20:00 UTC = 15:00 en Bogotá
    const fechaLimite = ayer3pmBogota.toISOString();

    // A estas alturas el usuario arrastra DOS suscripciones: la que quedó
    // VENCIDA al probar el cierre de caducadas y la que se otorgó después. Hay
    // que quedarse con el id de la vigente y operar sobre esa: un update por
    // `id_usuario` tocaría las dos y pondría dos filas en ACTIVA, que es justo
    // lo que el índice único parcial prohíbe.
    const { data: suscripcionVigente } = await admin
      .from("suscripciones")
      .select("id")
      .eq("id_usuario", userConAcceso.user!.id)
      .in("estado", ["ACTIVA", "PAST_DUE"])
      .maybeSingle();
    if (!suscripcionVigente) {
      throw new Error("No encontré la suscripción vigente para la prueba de fechas.");
    }

    const { error: errFijarLimite } = await admin
      .from("suscripciones")
      .update({ fecha_renovacion: fechaLimite })
      .eq("id", suscripcionVigente.id);
    if (errFijarLimite) {
      throw new Error(`No pude fijar la fecha límite de la prueba de vigencia: ${errFijarLimite.message}`);
    }

    const tsDiceVigente = suscripcionDaAcceso({
      estado: "ACTIVA",
      fechaRenovacion: fechaLimite,
    });
    registrar(
      "TypeScript da por VENCIDA una renovación de ayer 3:00 p.m. hora de Colombia",
      tsDiceVigente === false,
      `suscripcionDaAcceso = ${tsDiceVigente}`,
    );

    // `private.suscripcion_da_acceso` no está expuesta a PostgREST, así que se
    // observa a través de quien la usa: el cierre de caducadas solo marca
    // VENCIDA cuando esa función dice que ya no hay acceso.
    await esperarPermitido(
      "cerrar_suscripcion_caducada_admin corre sobre la fecha límite",
      clienteAdmin.rpc("cerrar_suscripcion_caducada_admin", { p_usuario_id: userConAcceso.user!.id }),
    );
    const { data: filaTrasLimite } = await admin
      .from("suscripciones")
      .select("estado")
      .eq("id", suscripcionVigente.id)
      .maybeSingle();
    const sqlDiceVigente = filaTrasLimite?.estado === "ACTIVA";
    registrar(
      "SQL coincide con TypeScript en el caso de las 3:00 p.m. (regresión de 043)",
      sqlDiceVigente === tsDiceVigente,
      `TS vigente=${tsDiceVigente}, SQL vigente=${sqlDiceVigente} (estado=${filaTrasLimite?.estado})`,
    );

    const { error: errRestaurarVigencia } = await admin
      .from("suscripciones")
      .update({
        estado: "ACTIVA",
        fecha_renovacion: new Date(Date.now() + 30 * 86_400_000).toISOString(),
      })
      .eq("id", suscripcionVigente.id);
    if (errRestaurarVigencia) {
      throw new Error(`No pude restaurar la vigencia tras la prueba de fechas: ${errRestaurarVigencia.message}`);
    }

    // --- Restricciones de dinero y procedencia (042) ----------------------
    //
    // Se prueban con Service Role, que ignora RLS: lo que tiene que frenar
    // aquí es el CHECK de la base, no una policy. 23514 = check_violation.
    const suscripcionBase = {
      id_usuario: userSinAcceso.user!.id,
      id_plan: null,
      fecha_inicio: new Date().toISOString(),
      fecha_renovacion: new Date(Date.now() + 30 * 86_400_000).toISOString(),
      estado: "VENCIDA" as const, // VENCIDA para no chocar con el índice único parcial
      proveedor: "manual",
      monto_centavos: 0,
      moneda: "COP",
      acceso_manual: true,
    };

    const { error: errMonedaMinuscula } = await admin
      .from("suscripciones")
      .insert({ ...suscripcionBase, moneda: "usd" });
    registrar(
      "moneda en minúsculas se rechaza — es lo que envía Stripe y lo que tumbaba formatMoneda",
      errMonedaMinuscula?.code === "23514",
      errMonedaMinuscula ? `${errMonedaMinuscula.code}` : "el insert pasó: el CHECK de ISO-4217 no está",
    );

    const { error: errMontoNegativo } = await admin
      .from("suscripciones")
      .insert({ ...suscripcionBase, monto_centavos: -1 });
    registrar(
      "un monto negativo se rechaza — un reembolso se modela con estado, no con signo",
      errMontoNegativo?.code === "23514",
      errMontoNegativo ? `${errMontoNegativo.code}` : "el insert pasó: el CHECK de monto no está",
    );

    const { error: errProveedorMayuscula } = await admin
      .from("suscripciones")
      .insert({ ...suscripcionBase, proveedor: "Stripe", acceso_manual: false });
    registrar(
      "'Stripe' con mayúscula se rechaza — el typo que rompería la conciliación en silencio",
      errProveedorMayuscula?.code === "23514",
      errProveedorMayuscula ? `${errProveedorMayuscula.code}` : "el insert pasó: la lista cerrada no está",
    );

    const { error: errManualIncoherente } = await admin
      .from("suscripciones")
      .insert({ ...suscripcionBase, proveedor: "manual", acceso_manual: false });
    registrar(
      "acceso_manual ya no puede contradecir a proveedor",
      errManualIncoherente?.code === "23514",
      errManualIncoherente ? `${errManualIncoherente.code}` : "el insert pasó: las dos columnas pueden separarse",
    );

    const { error: errSuscripcionStripe } = await admin
      .from("suscripciones")
      .insert({ ...suscripcionBase, proveedor: "stripe", acceso_manual: false });
    registrar(
      "'stripe' SÍ es un origen válido hoy, aunque no exista el cobro — el requisito de la tarea",
      !errSuscripcionStripe,
      errSuscripcionStripe?.message,
    );

    // --- Idempotencia compuesta de pagos (042 + migración) ----------------
    const pagoBase = {
      id_suscripcion: suscripcionVigente.id,
      estado: "EXITOSO" as const,
      monto_centavos: 8_990_000,
      moneda: "COP",
      ref_transaccion_externa: refPagoPrueba,
    };

    const { error: errPagoMux } = await admin
      .from("pagos")
      .insert({ ...pagoBase, proveedor: "mux" });
    registrar(
      "pagos rechaza 'mux' aunque eventos_webhook lo admita — por eso no es un enum compartido",
      errPagoMux?.code === "23514",
      errPagoMux ? `${errPagoMux.code}` : "el insert pasó: pagos admite un proveedor que no cobra",
    );

    await esperarPermitido(
      "un pago de Stripe se registra",
      admin.from("pagos").insert({ ...pagoBase, proveedor: "stripe" }),
    );
    await esperarPermitido(
      "la MISMA referencia bajo otra pasarela también, porque la clave es (proveedor, referencia)",
      admin.from("pagos").insert({ ...pagoBase, proveedor: "wompi" }),
    );

    const { error: errPagoDuplicado } = await admin
      .from("pagos")
      .insert({ ...pagoBase, proveedor: "stripe" });
    registrar(
      "repetir (proveedor, referencia) SÍ choca: es la clave de idempotencia del cobro",
      errPagoDuplicado?.code === "23505",
      errPagoDuplicado ? `${errPagoDuplicado.code}` : "el insert pasó: un reintento duplicaría el pago",
    );

    // --- El muro de acceso sigue siendo agnóstico al origen ---------------
    const { data: reembolsado, error: errReembolso } = await admin
      .from("pagos")
      .update({ estado: "REEMBOLSADO" })
      .eq("ref_transaccion_externa", refPagoPrueba)
      .eq("proveedor", "wompi")
      .select("estado")
      .maybeSingle();
    registrar(
      "un pago se puede marcar REEMBOLSADO sin destruir la fila original",
      !errReembolso && reembolsado?.estado === "REEMBOLSADO",
      errReembolso?.message ?? `estado=${reembolsado?.estado}`,
    );

    await esperarBloqueado(
      "estudiante no puede leer planes_precios inactivos (RLS de la tabla nueva)",
      clienteSinAcceso.from("planes_precios").select("*").eq("activo", false),
    );
    await esperarBloqueado(
      "estudiante no puede escribir en planes_precios",
      clienteSinAcceso
        .from("planes_precios")
        .insert({
          id_plan: plan.id,
          proveedor: "stripe",
          id_precio_externo: "price_rls_test",
          monto_centavos: 8_990_000,
          moneda: "COP",
        })
        .select(),
    );
  } finally {
    console.log("\nLimpiando datos de prueba...");

    // El orden lo dictan las FK, y antes no lo respetaba: los cursos se
    // borraban ANTES que las inscripciones de los usuarios de prueba, así que
    // una inscripción sobre `cursoReproduccion` bloqueaba el borrado del curso
    // y, más abajo, el del propio perfil (la FK es RESTRICT). Como el error de
    // `deleteUser` no se comprobaba, cada corrida dejaba un usuario de prueba
    // vivo en la base sin avisar — se habían acumulado ocho.
    //
    // Ahora va de las hojas al tronco: primero todo lo que cuelga de los
    // usuarios, después el contenido, y los usuarios al final.
    const usuariosDePrueba = [userSinAcceso.user!, userConAcceso.user!, userAdmin.user!];

    // Los pagos van antes que las suscripciones: `pagos.id_suscripcion` es una
    // FK sin cascada.
    await admin.from("pagos").delete().eq("ref_transaccion_externa", refPagoPrueba);
    for (const usuario of usuariosDePrueba) {
      await admin.from("progreso").delete().eq("id_usuario", usuario.id);
      await admin.from("inscripciones").delete().eq("id_usuario", usuario.id);
      await admin.from("suscripciones").delete().eq("id_usuario", usuario.id);
    }

    await admin.from("recursos_descargables").delete().eq("nombre", "Material RLS test.pdf");
    await admin.from("modulos").delete().eq("id_curso", cursoReproduccion.id);
    await admin.from("cursos").delete().eq("id", cursoReproduccion.id);
    await admin.from("modulos").delete().eq("id_curso", cursoNoPublicado.id);
    await admin.from("inscripciones").delete().eq("id_curso", cursoNoPublicado.id);
    await admin.from("cursos").delete().eq("id", cursoNoPublicado.id);
    await admin.from("instructores").delete().eq("id", instructor.id);
    await admin.from("categorias").delete().eq("id", categoria.id);
    await admin.from("planes").delete().eq("id", plan.id);

    if (idLotePrueba) {
      await admin.from("codigos_invitacion").delete().eq("id_lote", idLotePrueba);
      await admin.from("lotes_codigos_invitacion").delete().eq("id", idLotePrueba);
    }

    for (const usuario of usuariosDePrueba) {
      const { error } = await admin.auth.admin.deleteUser(usuario.id);
      // Se avisa en vez de seguir en silencio: si vuelve a quedar algo
      // colgando, el síntoma tiene que ser visible en la corrida que lo causa.
      if (error) {
        console.log(`⚠️  No pude borrar el usuario de prueba ${usuario.email}: ${error.message}`);
      }
    }
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
