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
  // Cuenta desechable exclusiva para la prueba de supresión (075). No se
  // reutiliza ninguna de las otras porque la anonimización es irreversible:
  // después de correrla, esa cuenta ya no sirve para probar nada más.
  const correoAnonimizar = `rls-test-anonimizar-${sufijo}@uva.test`;
  // Se declara aquí, no dentro del try, para que la limpieza del finally pueda
  // borrar los pagos de prueba aunque una aserción falle antes.
  const refPagoPrueba = `ref_rls_test_${sufijo}`;
  // Mismo motivo: el lote de códigos (044/045) se crea dentro del try, pero
  // su id hay que conocerlo en el finally para borrar también sus códigos.
  let idLotePrueba: string | null = null;
  // Mismo motivo: el certificado que emite el trigger (047) hay que
  // conocerlo en el finally para borrar también su archivo de Storage.
  let idCertificadoPrueba: string | null = null;
  // Mismo motivo: el curso y el examen de la sesión de exámenes (066/067)
  // se crean dentro del try, pero hay que borrarlos en el finally — y los
  // intentos ANTES que los usuarios, porque intentos_examen.id_usuario es
  // ON DELETE RESTRICT (un intento es evidencia de evaluación, no se borra
  // en cascada con el perfil).
  let idCursoExamen: string | null = null;
  let idExamenPrueba: string | null = null;

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

  const { data: userAnonimizar, error: errAnonimizar } = await admin.auth.admin.createUser({
    email: correoAnonimizar,
    password,
    email_confirm: true,
  });
  if (errAnonimizar || !userAnonimizar.user) {
    throw new Error(`No pude crear el usuario para anonimizar: ${errAnonimizar?.message}`);
  }
  // Datos personales que la supresión tiene que dejar sin rastro. Se
  // escriben con service role: lo que se prueba es la anonimización, no si
  // este usuario podría haberlos escrito por su cuenta.
  const { error: errPerfilAnonimizar } = await admin
    .from("perfiles")
    .update({ celular: "+57 300 1234567", pais: "CO", especialidad: "Dato personal de prueba" })
    .eq("id", userAnonimizar.user.id);
  if (errPerfilAnonimizar) {
    throw new Error(`No pude sembrar los datos del usuario a anonimizar: ${errPerfilAnonimizar.message}`);
  }

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
      // `cursos.slug` es NOT NULL y UNIQUE desde la migración
      // 20260903010000_agrega_slug_a_cursos_y_lecciones. La app lo genera con
      // slugificar() al crear el curso; acá se escribe a mano con el mismo
      // sufijo aleatorio que el título, para que dos corridas simultáneas
      // (p. ej. dos jobs de CI) no choquen contra el índice único.
      slug: `curso-rls-test-borrador-${sufijo}`,
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
      slug: `curso-rls-test-reproduccion-${sufijo}`,
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
      // `lecciones.slug` también es NOT NULL (misma migración). No es UNIQUE
      // global —se particiona por curso vía el módulo—, pero el sufijo no
      // estorba.
      slug: `leccion-reproduccion-rls-test-${sufijo}`,
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

  // --------------------------------------------------------------------
  // Fixture propio para D-1 (070_progreso_exige_acceso.sql).
  //
  // NO se reutiliza cursoReproduccion a propósito: ese curso tiene
  // exactamente UNA lección, y de eso depende la prueba de emisión de
  // certificados de más abajo ("completar la única lección del curso emite
  // el certificado"). Añadirle una segunda lección para poder probar la
  // excepción de lección introductoria tendría dos efectos colaterales: la
  // lección de reproducción pasaría a SER la introductoria (es la de menor
  // orden), y completarla ya no alcanzaría el 100% del curso. Es decir,
  // rompería dos pruebas existentes para arreglar una nueva.
  //
  // Este curso tiene DOS lecciones para que private.es_leccion_introductoria
  // pueda distinguirlas: esa función exige count(*) > 1 y solo devuelve true
  // para la primera por (modulo.orden, leccion.orden).
  // --------------------------------------------------------------------
  const { data: cursoAcceso, error: errCursoAcceso } = await admin
    .from("cursos")
    .insert({
      titulo: `Curso RLS test (acceso a progreso) ${sufijo}`,
      slug: `curso-rls-test-acceso-${sufijo}`,
      descripcion: "x",
      imagen_portada: "x",
      id_instructor: instructor.id,
      mostrado: true,
      id_admin_creador: adminPerfil.id,
    })
    .select("id")
    .single();
  if (errCursoAcceso || !cursoAcceso) {
    throw new Error(`No pude crear el curso de acceso a progreso: ${errCursoAcceso?.message}`);
  }

  const { data: moduloAcceso, error: errModuloAcceso } = await admin
    .from("modulos")
    .insert({ id_curso: cursoAcceso.id, titulo: "Módulo acceso RLS test", orden: 10 })
    .select("id")
    .single();
  if (errModuloAcceso || !moduloAcceso) {
    throw new Error(`No pude crear el módulo de acceso a progreso: ${errModuloAcceso?.message}`);
  }

  const { data: leccionesAcceso, error: errLeccionesAcceso } = await admin
    .from("lecciones")
    .insert([
      {
        id_modulo: moduloAcceso.id,
        titulo: "Clase 1 (introductoria, gratuita)",
        slug: `leccion-acceso-intro-${sufijo}`,
        orden: 10,
        estado_procesamiento: "LISTO",
      },
      {
        id_modulo: moduloAcceso.id,
        titulo: "Clase 2 (de pago)",
        slug: `leccion-acceso-pago-${sufijo}`,
        orden: 20,
        estado_procesamiento: "LISTO",
      },
    ])
    .select("id, orden")
    .order("orden");
  if (errLeccionesAcceso || leccionesAcceso?.length !== 2) {
    throw new Error(`No pude crear las lecciones de acceso a progreso: ${errLeccionesAcceso?.message}`);
  }
  const idLeccionIntroductoria: string = leccionesAcceso[0].id;
  const idLeccionDePago: string = leccionesAcceso[1].id;

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

    // D-15 (074): `instructores` tenía `using (true)` — las filas visibles
    // para cualquiera, incluida id_perfil_profesor, que es el UUID de una
    // cuenta real. La tabla quedó vestigial tras 20260903000000_multi_instructores
    // (nada en src/ la lee; los datos públicos salen de
    // curso_instructores_publico), así que se cerró del todo en vez de acotarla.
    await esperarBloqueado(
      "anon no puede leer instructores (074)",
      clienteAnonimo.from("instructores").select("*"),
    );

    // D-5 (074): la vista de autores es SECURITY DEFINER de hecho
    // (security_barrier sin security_invoker), así que salta la RLS de
    // `perfiles` — a propósito, para poder pintar el nombre del autor de un
    // comentario. Lo que NO debía exponer es `rol`: le decía a cualquier
    // visitante sin sesión qué cuentas son ADMINISTRADOR. Se comprueba que la
    // columna ya no existe, no que venga vacía: un select de una columna
    // inexistente falla en PostgREST, que es justo la señal que se busca.
    const { error: errRolExpuesto } = await clienteAnonimo
      .from("comentarios_autor_publico")
      .select("rol")
      .limit(1);
    registrar(
      "comentarios_autor_publico ya NO expone la columna `rol` a anon (074)",
      !!errRolExpuesto,
      errRolExpuesto ? errRolExpuesto.message : "la columna `rol` sigue disponible",
    );

    await esperarPermitido(
      "comentarios_autor_publico sigue exponiendo nombre/pais/es_profesor (lo que la interfaz necesita)",
      clienteAnonimo.from("comentarios_autor_publico").select("id, nombre, pais, es_profesor").limit(1),
    );
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
    // Endurecida en 050 (Certificado.md): antes era pública, ahora solo
    // service_role — el límite por IP de la página pública sería
    // decorativo si cualquiera pudiera seguir llamándola directo por
    // PostgREST. La prueba de "responde valido=false" vive más abajo, en
    // la sesión de CERTIFICADOS, usando el cliente admin.
    await esperarBloqueado(
      "anon YA NO puede llamar verificar_certificado directo (endurecida en 050)",
      clienteAnonimo.rpc("verificar_certificado", { p_codigo: "codigo-que-no-existe" }),
    );
    await esperarBloqueado(
      "anon no puede llamar verificar_limite_certificado (RPC solo service_role, 050)",
      clienteAnonimo.rpc("verificar_limite_certificado", { p_ip: "127.0.0.1" }),
    );
    await esperarBloqueado(
      "anon no puede llamar registrar_intento_verificar_certificado (RPC solo service_role, 050)",
      clienteAnonimo.rpc("registrar_intento_verificar_certificado", { p_ip: "127.0.0.1" }),
    );

    await esperarPermitido("anon SÍ puede leer el catálogo público (categorías activas)", clienteAnonimo.from("categorias").select("id").eq("activo", true));
    await esperarPermitido(
      "anon SÍ puede leer curso_categorias de cursos publicados",
      clienteAnonimo.from("curso_categorias").select("id_curso, id_categoria").limit(1),
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

    // Escritura directa de contenido (014_separa_politicas_for_all.sql):
    // Revision.md — "Intentar crear, editar o borrar contenido desde una
    // cuenta de estudiante. Debe fallar." — probado aquí contra el curso NO
    // publicado (el update/delete no depende de que el curso sea visible:
    // RLS de escritura y de lectura son policies independientes).
    await esperarBloqueado(
      "estudiante sin acceso no puede editar un curso",
      clienteSinAcceso.from("cursos").update({ titulo: "hackeado" }).eq("id", cursoNoPublicado.id).select(),
    );
    await esperarBloqueado(
      "estudiante sin acceso no puede publicar un curso ajeno (mostrado=true)",
      clienteSinAcceso.from("cursos").update({ mostrado: true }).eq("id", cursoNoPublicado.id).select(),
    );
    await esperarBloqueado(
      "estudiante sin acceso no puede borrar un curso",
      clienteSinAcceso.from("cursos").delete().eq("id", cursoNoPublicado.id).select(),
    );
    await esperarBloqueado(
      "estudiante sin acceso no puede crear un curso",
      clienteSinAcceso
        .from("cursos")
        .insert({
          titulo: "curso colado",
          // Con `slug` NOT NULL, omitirlo hacía que este INSERT fallara por la
          // restricción de columna y no por RLS — la aserción pasaba por el
          // motivo equivocado, que es peor que fallar. Se manda completo para
          // que lo único que pueda rechazarlo sea `cursos_admin_insert` (014).
          slug: `curso-colado-${sufijo}`,
          descripcion: "x",
          imagen_portada: "x",
          id_instructor: instructor.id,
          mostrado: true,
          id_admin_creador: adminPerfil.id,
        })
        .select(),
    );
    await esperarBloqueado(
      "estudiante sin acceso no puede editar un módulo",
      clienteSinAcceso.from("modulos").update({ titulo: "hackeado" }).eq("id", moduloReproduccion.id).select(),
    );
    await esperarBloqueado(
      "estudiante sin acceso no puede borrar un módulo",
      clienteSinAcceso.from("modulos").delete().eq("id", moduloReproduccion.id).select(),
    );
    await esperarBloqueado(
      "estudiante sin acceso no puede editar una lección (ej. cambiar el playback id de Mux)",
      clienteSinAcceso.from("lecciones").update({ id_video_mux: "playback-robado" }).eq("id", idLeccionReproduccion).select(),
    );
    await esperarBloqueado(
      "estudiante sin acceso no puede borrar una lección",
      clienteSinAcceso.from("lecciones").delete().eq("id", idLeccionReproduccion).select(),
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

    // Misma prueba que arriba, pero con una suscripción ACTIVA real: pagar no
    // otorga ningún permiso de escritura sobre el catálogo — solo lectura del
    // contenido al que da acceso.
    await esperarBloqueado(
      "estudiante con acceso (pagando) no puede editar un curso publicado",
      clienteConAcceso.from("cursos").update({ titulo: "hackeado" }).eq("id", cursoReproduccion.id).select(),
    );
    await esperarBloqueado(
      "estudiante con acceso no puede borrar el curso al que está suscrito",
      clienteConAcceso.from("cursos").delete().eq("id", cursoReproduccion.id).select(),
    );
    await esperarBloqueado(
      "estudiante con acceso no puede editar la lección que está viendo (ej. cambiar el playback id de Mux)",
      clienteConAcceso.from("lecciones").update({ id_video_mux: "playback-robado" }).eq("id", idLeccionReproduccion).select(),
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
      .insert({
        id_modulo: moduloDespublicado.id,
        titulo: "Lección RLS test",
        slug: `leccion-rls-test-${sufijo}`,
        orden: 10,
      })
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
    // D-1: escribir progreso exige acceso vigente al curso
    // (070_progreso_exige_acceso.sql — AUDIT-2026-09-08-base-de-datos.md)
    //
    // El hueco de la prueba y el hueco de la policy eran el mismo. Este
    // archivo cubría la LECTURA cruzada de `progreso` (arriba) y la
    // ESCRITURA de `inscripciones` desde un usuario sin acceso, pero nunca
    // la escritura de `progreso`: el único upsert lo hacía clienteConAcceso.
    // Por eso 124/124 en verde convivían con un P0 abierto.
    // ------------------------------------------------------------------
    console.log("\n=== Sesión: ACCESO PARA ESCRIBIR PROGRESO (070) ===\n");

    await esperarBloqueado(
      "estudiante sin acceso NO puede insertar progreso en una lección de pago",
      clienteSinAcceso
        .from("progreso")
        .insert({ id_usuario: userSinAcceso.user!.id, id_leccion: idLeccionDePago, completado: false })
        .select(),
    );

    await esperarBloqueado(
      "estudiante sin acceso NO puede marcar completada una lección de pago",
      clienteSinAcceso
        .from("progreso")
        .upsert(
          { id_usuario: userSinAcceso.user!.id, id_leccion: idLeccionDePago, completado: true },
          { onConflict: "id_usuario,id_leccion" },
        )
        .select(),
    );

    // La excepción deliberada: la clase gratuita del catálogo. Sin esto,
    // `iniciarProgresoLeccion` no puede escribir la fila que crea al ABRIR
    // una clase y el visitante no puede ni empezar el curso gratuito.
    await esperarPermitido(
      "estudiante sin acceso SÍ puede registrar progreso en la lección introductoria",
      clienteSinAcceso
        .from("progreso")
        .insert({ id_usuario: userSinAcceso.user!.id, id_leccion: idLeccionIntroductoria, completado: true })
        .select(),
    );

    // La cadena completa del P0: aunque el estudiante logre marcar la
    // introductoria, no puede completar el curso, así que el trigger 047/068
    // no tiene nada que emitir. Se comprueba con el service role porque la
    // policy de SELECT de `certificados` ya acota por usuario y un 0 filas
    // ahí no distinguiría "no se emitió" de "no lo puedo ver".
    const { count: certificadosSinAcceso } = await admin
      .from("certificados")
      .select("id", { count: "exact", head: true })
      .eq("id_usuario", userSinAcceso.user!.id)
      .eq("id_curso", cursoAcceso.id);
    registrar(
      "un estudiante sin acceso NO obtiene certificado por marcar lecciones completadas",
      certificadosSinAcceso === 0,
      `certificados=${certificadosSinAcceso}`,
    );

    // --- Regresiones: el arreglo no puede romper el producto ---

    await esperarPermitido(
      "estudiante CON acceso sigue pudiendo registrar y completar progreso (regresión)",
      clienteConAcceso
        .from("progreso")
        .upsert(
          { id_usuario: userConAcceso.user!.id, id_leccion: idLeccionDePago, completado: true },
          { onConflict: "id_usuario,id_leccion" },
        )
        .select(),
    );

    // Regresión de 030_acceso_curso_despublicado.sql: una membresía vigente
    // conserva el acceso a un curso retirado del catálogo si YA tenía
    // progreso en él ("ya lo estaba viendo"). `leccionDespublicada` y la fila
    // de progreso que la acompaña se sembraron más arriba con el service
    // role; acá se comprueba que el CLIENTE puede seguir escribiendo sobre
    // ella. Si 070 hubiera simplificado la regla a "curso mostrado", este
    // caso fallaría — y es exactamente el estudiante a mitad de curso.
    await esperarPermitido(
      "membresía con progreso en curso despublicado sigue pudiendo guardar progreso (regresión 030)",
      clienteConAcceso
        .from("progreso")
        .upsert(
          { id_usuario: userConAcceso.user!.id, id_leccion: leccionDespublicada.id, completado: false },
          { onConflict: "id_usuario,id_leccion" },
        )
        .select(),
    );

    // ------------------------------------------------------------------
    // Emisión automática de certificados (Certificado.md, 047-050)
    //
    // Reutiliza cursoReproduccion/leccionReproduccion (arriba): tiene
    // exactamente UNA lección LISTO, así que marcarla completada para
    // userConAcceso alcanza el 100% del curso de un solo golpe — el caso
    // más simple para probar la emisión sin tener que armar un curso nuevo
    // de varios módulos.
    // ------------------------------------------------------------------
    console.log("\n=== Sesión: EMISIÓN DE CERTIFICADOS (047-050) ===\n");

    await esperarBloqueado(
      "un estudiante NO puede insertar directo en certificados (solo el trigger, vía SECURITY DEFINER)",
      clienteConAcceso
        .from("certificados")
        .insert({ id_usuario: userConAcceso.user!.id, id_curso: cursoReproduccion.id, codigo_verificacion: `RLSCERT${sufijo}` })
        .select(),
    );

    const { error: errCompletarLeccion } = await clienteConAcceso
      .from("progreso")
      .upsert(
        { id_usuario: userConAcceso.user!.id, id_leccion: idLeccionReproduccion, completado: true },
        { onConflict: "id_usuario,id_leccion" },
      );
    if (errCompletarLeccion) throw new Error(`No pude completar la lección de prueba: ${errCompletarLeccion.message}`);

    const { data: certificadoEmitido } = await admin
      .from("certificados")
      .select("id, codigo_verificacion, archivo_pdf")
      .eq("id_usuario", userConAcceso.user!.id)
      .eq("id_curso", cursoReproduccion.id)
      .maybeSingle();
    registrar(
      "completar la única lección del curso emite el certificado automáticamente (trigger 047)",
      !!certificadoEmitido && /^[A-Z2-9]{5}-[A-Z2-9]{5}$/.test(certificadoEmitido.codigo_verificacion),
      certificadoEmitido ? `codigo=${certificadoEmitido.codigo_verificacion}` : "no se emitió ningún certificado",
    );
    idCertificadoPrueba = certificadoEmitido!.id;

    const { error: errReinsertar } = await admin.from("progreso").upsert(
      { id_usuario: userConAcceso.user!.id, id_leccion: idLeccionReproduccion, completado: true },
      { onConflict: "id_usuario,id_leccion" },
    );
    const { count: certificadosTrasRepetir } = await admin
      .from("certificados")
      .select("id", { count: "exact", head: true })
      .eq("id_usuario", userConAcceso.user!.id)
      .eq("id_curso", cursoReproduccion.id);
    registrar(
      "volver a marcar la lección completada NO duplica el certificado (unique id_usuario+id_curso)",
      !errReinsertar && certificadosTrasRepetir === 1,
      `certificados=${certificadosTrasRepetir}`,
    );

    const { data: verificacionOk } = await admin.rpc("verificar_certificado", {
      p_codigo: certificadoEmitido!.codigo_verificacion,
    });
    const [filaOk] = (verificacionOk ?? []) as { valido: boolean; nombre_curso: string | null }[];
    registrar(
      "verificar_certificado (vía service_role) confirma el certificado recién emitido",
      filaOk?.valido === true,
      JSON.stringify(filaOk),
    );

    const { data: verificacionInexistente } = await admin.rpc("verificar_certificado", {
      p_codigo: `NOEXISTE-${sufijo}`,
    });
    const [filaInexistente] = (verificacionInexistente ?? []) as { valido: boolean }[];
    registrar(
      "verificar_certificado responde valido=false para un código inexistente, sin distinguir formato",
      filaInexistente?.valido === false,
      JSON.stringify(filaInexistente),
    );

    await esperarBloqueado(
      "un estudiante distinto no puede registrar el archivo PDF de un certificado ajeno",
      clienteSinAcceso.rpc("registrar_archivo_certificado", {
        p_certificado_id: idCertificadoPrueba,
        p_archivo_pdf: `${userSinAcceso.user!.id}/intento-ajeno.pdf`,
      }),
    );
    const { data: certificadoTrasIntentoAjeno } = await admin
      .from("certificados")
      .select("archivo_pdf")
      .eq("id", idCertificadoPrueba)
      .maybeSingle();
    registrar(
      "el intento ajeno no modificó archivo_pdf (0 filas afectadas, no un error ruidoso)",
      certificadoTrasIntentoAjeno?.archivo_pdf === null,
      `archivo_pdf=${certificadoTrasIntentoAjeno?.archivo_pdf ?? "null"}`,
    );

    await esperarPermitido(
      "el dueño SÍ puede registrar el archivo PDF de su propio certificado",
      clienteConAcceso.rpc("registrar_archivo_certificado", {
        p_certificado_id: idCertificadoPrueba,
        p_archivo_pdf: `${userConAcceso.user!.id}/${idCertificadoPrueba}.pdf`,
      }),
    );
    const { data: certificadoConArchivo } = await admin
      .from("certificados")
      .select("archivo_pdf")
      .eq("id", idCertificadoPrueba)
      .maybeSingle();
    registrar(
      "registrar_archivo_certificado sí guardó la ruta cuando el dueño lo llama",
      certificadoConArchivo?.archivo_pdf === `${userConAcceso.user!.id}/${idCertificadoPrueba}.pdf`,
      `archivo_pdf=${certificadoConArchivo?.archivo_pdf ?? "null"}`,
    );

    // ==================================================================
    // Sesión: EXÁMENES FINALES (066/067)
    //
    // Lo que se prueba acá no es "¿el estudiante ve lo que debe?" sino las
    // dos cosas que, si fallan, regalan un certificado:
    //   1. que NO pueda leer las respuestas correctas;
    //   2. que NO pueda escribir su propia nota.
    // Y, del otro lado, que el examen bloquee de verdad la certificación
    // mientras no esté aprobado (Revf5).
    // ==================================================================
    console.log("\n=== Sesión: EXÁMENES FINALES (066/067) ===\n");

    const { data: cursoExamen, error: errCursoExamen } = await admin
      .from("cursos")
      .insert({
        titulo: `Curso RLS test (examen) ${sufijo}`,
        slug: `curso-rls-test-examen-${sufijo}`,
        descripcion: "x",
        imagen_portada: "x",
        id_instructor: instructor.id,
        mostrado: true,
        id_admin_creador: adminPerfil.id,
      })
      .select("id")
      .single();
    if (errCursoExamen || !cursoExamen) {
      throw new Error(`No pude crear el curso de examen de prueba: ${errCursoExamen?.message}`);
    }
    idCursoExamen = cursoExamen.id;

    const { data: moduloExamen } = await admin
      .from("modulos")
      .insert({ id_curso: cursoExamen.id, titulo: "Módulo examen RLS test", orden: 10 })
      .select("id")
      .single();

    const { data: leccionExamen } = await admin
      .from("lecciones")
      .insert({
        id_modulo: moduloExamen!.id,
        titulo: "Lección examen RLS test",
        slug: `leccion-examen-rls-test-${sufijo}`,
        orden: 10,
        id_video_mux: `rls-test-examen-${sufijo}`,
        estado_procesamiento: "LISTO",
      })
      .select("id")
      .single();

    // Nota por debajo del piso de negocio: la restricción de la base tiene que
    // rechazarla aunque el Server Action no esté en medio.
    const { error: errNotaBaja } = await admin
      .from("examenes")
      .insert({ id_curso: cursoExamen.id, titulo: "Examen inválido", nota_aprobatoria: 60 });
    registrar(
      "la base rechaza un examen con nota aprobatoria por debajo de 75% (no solo el formulario)",
      errNotaBaja?.code === "23514",
      errNotaBaja?.code ?? "se insertó igual",
    );

    const { data: examenPrueba, error: errExamen } = await admin
      .from("examenes")
      .insert({
        id_curso: cursoExamen.id,
        titulo: "Examen final RLS test",
        nota_aprobatoria: 75,
        intentos_maximos: 3,
        publicado: true,
      })
      .select("id, nota_aprobatoria")
      .single();
    if (errExamen || !examenPrueba) throw new Error(`No pude crear el examen de prueba: ${errExamen?.message}`);
    idExamenPrueba = examenPrueba.id;

    const { error: errPregunta } = await admin.from("preguntas_examen").insert({
      id_examen: examenPrueba.id,
      tipo: "OPCION_UNICA",
      enunciado: { type: "doc", content: [] },
      puntos: 1,
      orden: 10,
      opciones: [
        { id: "op-correcta", texto: "La correcta", correcta: true },
        { id: "op-falsa", texto: "La otra", correcta: false },
      ],
    });
    if (errPregunta) throw new Error(`No pude crear la pregunta de prueba: ${errPregunta.message}`);

    // ---------- Lectura ----------
    const { data: examenVistoPorEstudiante } = await clienteConAcceso
      .from("examenes")
      .select("id, titulo, nota_aprobatoria")
      .eq("id_curso", cursoExamen.id);
    registrar(
      "el estudiante con acceso SÍ ve la ficha del examen publicado (título, nota, intentos)",
      (examenVistoPorEstudiante ?? []).length === 1,
      `filas=${(examenVistoPorEstudiante ?? []).length}`,
    );

    await esperarBloqueado(
      "un estudiante SIN acceso al curso no ve ni la ficha del examen",
      clienteSinAcceso.from("examenes").select("*").eq("id_curso", cursoExamen.id),
    );

    // La prueba que más importa de todo el bloque: `preguntas_examen` guarda
    // cuál opción es la correcta. Un SELECT desde el navegador sería el examen
    // resuelto.
    await esperarBloqueado(
      "un estudiante NO puede leer preguntas_examen (contiene las respuestas correctas)",
      clienteConAcceso.from("preguntas_examen").select("*").eq("id_examen", examenPrueba.id),
    );

    // ---------- El gate de certificación ----------
    const { error: errCompletarExamen } = await clienteConAcceso.from("progreso").upsert(
      { id_usuario: userConAcceso.user!.id, id_leccion: leccionExamen!.id, completado: true },
      { onConflict: "id_usuario,id_leccion" },
    );
    if (errCompletarExamen) {
      throw new Error(`No pude completar la lección del curso con examen: ${errCompletarExamen.message}`);
    }

    const { count: certSinExamen } = await admin
      .from("certificados")
      .select("id", { count: "exact", head: true })
      .eq("id_usuario", userConAcceso.user!.id)
      .eq("id_curso", cursoExamen.id);
    registrar(
      "Revf5: terminar el 100% de las clases NO emite certificado si el curso exige examen",
      certSinExamen === 0,
      `certificados=${certSinExamen}`,
    );

    const { data: leccionesListas } = await clienteConAcceso.rpc("lecciones_completas_curso", {
      p_id_curso: cursoExamen.id,
    });
    registrar(
      "lecciones_completas_curso() sí reconoce las clases terminadas (el examen se desbloquea)",
      leccionesListas === true,
      `resultado=${leccionesListas}`,
    );

    const { data: cursoCompletoAun } = await clienteConAcceso.rpc("curso_esta_completo", {
      p_id_curso: cursoExamen.id,
    });
    registrar(
      "curso_esta_completo() distingue 'clases terminadas' de 'curso completo' (falta el examen)",
      cursoCompletoAun === false,
      `resultado=${cursoCompletoAun}`,
    );

    // ---------- Escritura de intentos ----------
    await esperarBloqueado(
      "un estudiante NO puede insertar su propio intento (no hay policy de INSERT: pasa por Server Action)",
      clienteConAcceso
        .from("intentos_examen")
        .insert({
          id_examen: examenPrueba.id,
          id_usuario: userConAcceso.user!.id,
          nota_requerida: 75,
          preguntas_congeladas: [],
        })
        .select(),
    );

    const { data: intentoPrueba, error: errIntento } = await admin
      .from("intentos_examen")
      .insert({
        id_examen: examenPrueba.id,
        id_usuario: userConAcceso.user!.id,
        nota_requerida: 75,
        preguntas_congeladas: [],
      })
      .select("id")
      .single();
    if (errIntento || !intentoPrueba) throw new Error(`No pude crear el intento de prueba: ${errIntento?.message}`);

    const { data: intentoPropio } = await clienteConAcceso
      .from("intentos_examen")
      .select("id, estado")
      .eq("id", intentoPrueba.id);
    registrar(
      "el estudiante SÍ lee su propio intento (lo necesita para rendir el examen)",
      (intentoPropio ?? []).length === 1,
      `filas=${(intentoPropio ?? []).length}`,
    );

    // ---------- P0-1 (AUDIT-2026-09-08): el examen resuelto ----------
    // `preguntas_congeladas` guarda `respuestasAceptadas` y cuál opción es la
    // correcta. La policy de 067 le da al estudiante su fila ENTERA porque RLS
    // autoriza filas, no columnas; lo que cierra la columna es el GRANT de
    // supabase/sql/081.
    //
    // Se comprueba el CÓDIGO de error, no solo que falle: `esperarBloqueado`
    // daría verde también con "0 filas", que es lo que devolvería la policy de
    // fila si el intento fuera ajeno. Aquí el intento es SUYO y la fila sí le
    // corresponde — la única razón válida para que esto falle es 42501,
    // privilegio de columna denegado. Sin esa distinción la prueba pasaría
    // aunque alguien revirtiera el 081.
    const lecturaSolucion = await clienteConAcceso
      .from("intentos_examen")
      .select("preguntas_congeladas")
      .eq("id", intentoPrueba.id);
    const codigoSolucion = (lecturaSolucion.error as { code?: string } | null)?.code;
    registrar(
      "el estudiante NO puede leer preguntas_congeladas ni de su propio intento (GRANT por columna, 081)",
      codigoSolucion === "42501",
      lecturaSolucion.error
        ? `code=${codigoSolucion} ${lecturaSolucion.error.message}`
        : `SIN ERROR — ${(lecturaSolucion.data ?? []).length} fila(s) con el examen resuelto`,
    );

    // La otra mitad: el GRANT tiene que dejar pasar lo que las pantallas del
    // estudiante sí necesitan. Sin esta aserción, revocar la tabla entera
    // también daría verde arriba y rompería el producto.
    await esperarPermitido(
      "el estudiante sigue leyendo las columnas no sensibles de su intento (la lista del GRANT alcanza)",
      clienteConAcceso
        .from("intentos_examen")
        .select("id, estado, puntaje_pct, nota_requerida, respuestas, iniciado_en, finalizado_en, expira_en")
        .eq("id", intentoPrueba.id),
    );

    await esperarBloqueado(
      "otro estudiante no puede leer un intento ajeno",
      clienteSinAcceso.from("intentos_examen").select("*").eq("id", intentoPrueba.id),
    );

    // El escenario de fraude concreto: PATCH directo contra PostgREST para
    // autoaprobarse y disparar el trigger de certificación.
    const { data: autoaprobado, error: errAutoaprobar } = await clienteConAcceso
      .from("intentos_examen")
      .update({ estado: "APROBADO", puntaje_pct: 100, finalizado_en: new Date().toISOString() })
      .eq("id", intentoPrueba.id)
      .select();
    const { data: intentoTrasIntento } = await admin
      .from("intentos_examen")
      .select("estado, puntaje_pct")
      .eq("id", intentoPrueba.id)
      .single();
    registrar(
      "un estudiante NO puede escribirse su propia nota (PATCH estado=APROBADO no toca nada)",
      (errAutoaprobar !== null || (autoaprobado ?? []).length === 0) &&
        intentoTrasIntento?.estado === "EN_CURSO",
      `filas=${(autoaprobado ?? []).length} estado=${intentoTrasIntento?.estado}`,
    );

    const { count: certTrasFraude } = await admin
      .from("certificados")
      .select("id", { count: "exact", head: true })
      .eq("id_usuario", userConAcceso.user!.id)
      .eq("id_curso", cursoExamen.id);
    registrar(
      "el intento de autoaprobarse tampoco emitió certificado",
      certTrasFraude === 0,
      `certificados=${certTrasFraude}`,
    );

    // ---------- Aprobar de verdad (como lo hace el Server Action) ----------
    const { error: errAprobar } = await admin
      .from("intentos_examen")
      .update({ estado: "APROBADO", puntaje_pct: 100, finalizado_en: new Date().toISOString() })
      .eq("id", intentoPrueba.id);
    if (errAprobar) throw new Error(`No pude aprobar el intento de prueba: ${errAprobar.message}`);

    const { data: certificadoTrasExamen } = await admin
      .from("certificados")
      .select("id, codigo_verificacion")
      .eq("id_usuario", userConAcceso.user!.id)
      .eq("id_curso", cursoExamen.id)
      .maybeSingle();
    registrar(
      "aprobar el examen SÍ emite el certificado (trigger intento_examen_emite_certificado, 067)",
      !!certificadoTrasExamen && /^[A-Z2-9]{5}-[A-Z2-9]{5}$/.test(certificadoTrasExamen.codigo_verificacion),
      certificadoTrasExamen ? `codigo=${certificadoTrasExamen.codigo_verificacion}` : "no se emitió",
    );

    const { data: cursoCompletoYa } = await clienteConAcceso.rpc("curso_esta_completo", {
      p_id_curso: cursoExamen.id,
    });
    registrar(
      "curso_esta_completo() pasa a true con las dos condiciones cumplidas",
      cursoCompletoYa === true,
      `resultado=${cursoCompletoYa}`,
    );

    // Un segundo intento aprobado del mismo curso no puede duplicar el
    // certificado: el unique (id_usuario, id_curso) es el que manda.
    const { data: segundoIntento } = await admin
      .from("intentos_examen")
      .insert({
        id_examen: examenPrueba.id,
        id_usuario: userConAcceso.user!.id,
        nota_requerida: 75,
        preguntas_congeladas: [],
      })
      .select("id")
      .single();
    await admin
      .from("intentos_examen")
      .update({ estado: "APROBADO", puntaje_pct: 100, finalizado_en: new Date().toISOString() })
      .eq("id", segundoIntento!.id);
    const { count: certificadosDelCurso } = await admin
      .from("certificados")
      .select("id", { count: "exact", head: true })
      .eq("id_usuario", userConAcceso.user!.id)
      .eq("id_curso", cursoExamen.id);
    registrar(
      "aprobar dos veces no duplica el certificado (unique id_usuario+id_curso)",
      certificadosDelCurso === 1,
      `certificados=${certificadosDelCurso}`,
    );

    // Índice parcial `intentos_examen_uno_en_curso`: dos pestañas abiertas no
    // pueden gastar dos intentos.
    await admin
      .from("intentos_examen")
      .update({ estado: "EN_CURSO", puntaje_pct: null, finalizado_en: null })
      .eq("id", intentoPrueba.id);
    const { error: errDosEnCurso } = await admin.from("intentos_examen").insert({
      id_examen: examenPrueba.id,
      id_usuario: userConAcceso.user!.id,
      nota_requerida: 75,
      preguntas_congeladas: [],
    });
    registrar(
      "no se pueden tener dos intentos EN_CURSO del mismo examen (índice parcial)",
      errDosEnCurso?.code === "23505",
      errDosEnCurso?.code ?? "se insertó igual",
    );

    await esperarBloqueado(
      "un estudiante no puede publicar/despublicar un examen",
      clienteConAcceso.from("examenes").update({ publicado: false }).eq("id", examenPrueba.id).select(),
    );

    await esperarBloqueado(
      "un estudiante no puede crear preguntas",
      clienteConAcceso
        .from("preguntas_examen")
        .insert({
          id_examen: examenPrueba.id,
          tipo: "OPCION_UNICA",
          enunciado: { type: "doc", content: [] },
        })
        .select(),
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

    // Simula "la fecha de renovación ya pasó", no "la suscripción nació
    // vencida": hay que mover fecha_inicio hacia atrás junto con
    // fecha_renovacion, o el UPDATE choca contra
    // suscripciones_renovacion_posterior (071_restricciones_faltantes.sql,
    // D-6) — que exige fecha_renovacion > fecha_inicio siempre, como hace
    // src/actions/admin/usuarios.ts al calcularla (fecha_inicio +
    // duracion_dias, nunca al revés). El CHECK hizo su trabajo: esta fila
    // sintética habría sido un dato imposible en producción.
    const { error: errVencer } = await admin
      .from("suscripciones")
      .update({
        fecha_inicio: new Date(Date.now() - 40 * 86_400_000).toISOString(),
        fecha_renovacion: new Date(Date.now() - 10 * 86_400_000).toISOString(),
      })
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

    // ------------------------------------------------------------------
    // Comentarios: qué columnas puede tocar el autor de su propia fila
    // (064_comentarios_columnas_y_moderacion.sql — P2-1, AUDIT-2026-09-04.md)
    //
    // La policy `comentarios_update_propio_o_admin` (052, redefinida por 056)
    // autoriza la FILA, no las columnas: sin 064, el autor podía deshacer la
    // moderación de un administrador devolviendo `eliminado` a false, y mover
    // su comentario a otra lección con un PATCH directo a PostgREST. Se prueba
    // acá, con la suscripción ya restaurada, porque comentar exige acceso
    // vigente al curso.
    // ------------------------------------------------------------------
    const { data: comentario, error: errComentario } = await clienteConAcceso
      .from("comentarios")
      .insert({
        id_leccion: idLeccionReproduccion,
        id_usuario: userConAcceso.user!.id,
        contenido: "Comentario de prueba RLS",
      })
      .select("id")
      .single();
    if (errComentario || !comentario) {
      throw new Error(`No pude crear el comentario de prueba: ${errComentario?.message}`);
    }

    await esperarBloqueado(
      "el autor NO puede mover su comentario a otra lección",
      clienteConAcceso
        .from("comentarios")
        // Una lección del curso despublicado: destino al que el autor no
        // debería poder empujar contenido suyo.
        .update({ id_leccion: leccionDespublicada.id })
        .eq("id", comentario.id)
        .select(),
    );

    await esperarBloqueado(
      "el autor NO puede reescribir el contenido de su comentario publicado",
      clienteConAcceso
        .from("comentarios")
        .update({ contenido: "reescrito" })
        .eq("id", comentario.id)
        .select(),
    );

    // No-regresión: borrar lo propio tiene que seguir funcionando. Es la única
    // escritura sobre `comentarios` que hace la app
    // (src/actions/comentarios/eliminar.ts), y 064 la deja intacta.
    await esperarPermitido(
      "el autor SÍ puede eliminar (lógicamente) su propio comentario",
      clienteConAcceso
        .from("comentarios")
        .update({ eliminado: true })
        .eq("id", comentario.id)
        .select(),
    );

    await esperarBloqueado(
      "el autor NO puede revivir un comentario eliminado (moderación irreversible para él)",
      clienteConAcceso
        .from("comentarios")
        .update({ eliminado: false })
        .eq("id", comentario.id)
        .select(),
    );

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

    // Hasta 074_endurece_exposicion.sql (D-16) esta función era SECURITY
    // INVOKER sin ninguna comprobación propia: un estudiante SÍ podía
    // llamarla, y lo único que lo protegía era que la RLS de `perfiles`
    // recortaba el resultado a su propia fila por debajo — sin fuga, pero
    // dependiendo enteramente de que nadie ampliara esa RLS más adelante. La
    // función ahora comprueba el rol explícitamente y rechaza con un error de
    // permisos, en vez de devolver un resultado filtrado.
    const { error: errRpcEstudiante } = await clienteConAcceso.rpc("admin_listar_usuarios", {
      p_limite: 100,
      p_offset: 0,
    });
    registrar(
      "estudiante que invoca admin_listar_usuarios es rechazado (D-16, 074)",
      errRpcEstudiante?.code === "42501",
      errRpcEstudiante ? `${errRpcEstudiante.code}: ${errRpcEstudiante.message}` : "el RPC no falló",
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

    // 069: la bitácora es append-only DE VERDAD, no solo en el comentario de
    // schema.prisma. Hasta 069 las policies de 014 le daban al administrador
    // las cuatro operaciones, así que el único control frente a un admin que
    // abusa de sus permisos podía ser borrado por el propio admin del que
    // protege. Sin estas pruebas, "append-only" vuelve a ser una afirmación
    // de un comentario y de nadie más: una policy de UPDATE o DELETE que
    // alguien reintroduzca en un script futuro pasaría sin que nada chille.
    //
    // La fila de prueba se limpia en el `finally` con service role (que sí
    // pasa por encima de RLS, y debe): si sobreviviera, la FK
    // bitacora_administrativa.id_admin → perfiles haría fallar el deleteUser
    // del admin de prueba y la corrida dejaría un usuario colgado.
    const filaBitacora = (await esperarPermitido(
      "administrador SÍ puede escribir en la bitácora firmando con su propio id",
      clienteAdmin
        .from("bitacora_administrativa")
        .insert({
          id_admin: userAdmin.user!.id,
          accion: "PRUEBA_RLS",
          entidad_afectada: "prueba",
        })
        .select()
        .single(),
    )) as { id: string } | null;

    // Sin esto las dos pruebas de abajo pasan por el motivo equivocado: con un
    // id vacío, Postgres corta en «invalid input syntax for type uuid» antes de
    // que RLS opine, y `esperarBloqueado` cuenta ese error como bloqueo. Se
    // veían dos ✅ verdes que no habían probado nada.
    if (!filaBitacora?.id) {
      throw new Error("La bitácora de prueba no devolvió id; sin ella, las pruebas de UPDATE/DELETE no significan nada.");
    }

    await esperarBloqueado(
      "administrador NO puede firmar una entrada de bitácora con el id de otro",
      clienteAdmin
        .from("bitacora_administrativa")
        .insert({
          id_admin: userConAcceso.user!.id,
          accion: "PRUEBA_RLS_SUPLANTACION",
          entidad_afectada: "prueba",
        })
        .select(),
    );

    // Contra la fila de prueba, no contra las reales: el resultado es el mismo
    // (no hay policy, RLS deniega) y una suite que apunta un DELETE a la
    // auditoría de producción es una mala idea aunque esté bloqueado.
    await esperarBloqueado(
      "administrador NO puede editar una entrada de bitácora ya escrita",
      clienteAdmin
        .from("bitacora_administrativa")
        .update({ accion: "PRUEBA_RLS_EDITADA" })
        .eq("id", filaBitacora.id)
        .select(),
    );

    await esperarBloqueado(
      "administrador NO puede borrar una entrada de bitácora",
      clienteAdmin
        .from("bitacora_administrativa")
        .delete()
        .eq("id", filaBitacora.id)
        .select(),
    );

    // D-7 (074): hasta esta migración, "append-only" era una afirmación que
    // solo valía para `anon` y `authenticated`. `service_role` salta RLS por
    // completo y es el cliente con el que la aplicación ejecuta las
    // operaciones administrativas — es decir, la garantía no cubría al único
    // actor con capacidad real de alterar la auditoría. El trigger sí lo
    // alcanza. Estas dos pruebas son las que distinguen 069 de 074: contra
    // 069 ambas fallan.
    await esperarBloqueado(
      "ni el service role puede editar una entrada de bitácora (trigger 074)",
      admin
        .from("bitacora_administrativa")
        .update({ accion: "PRUEBA_RLS_EDITADA_POR_SERVICE_ROLE" })
        .eq("id", filaBitacora.id)
        .select(),
    );

    await esperarBloqueado(
      "ni el service role puede borrar una entrada de bitácora con un DELETE normal (trigger 074)",
      admin
        .from("bitacora_administrativa")
        .delete()
        .eq("id", filaBitacora.id)
        .select(),
    );

    await esperarBloqueado(
      "un administrador NO puede llamar purgar_bitacora_de_admin (solo service_role)",
      clienteAdmin.rpc("purgar_bitacora_de_admin", { p_id_admin: userAdmin.user!.id }),
    );

    // La otra mitad de 064 (P2-1): el trigger prohíbe revivir un comentario
    // eliminado, pero deja hacerlo a un administrador a propósito — puede
    // haber moderado por error y no debería necesitar SQL a mano. El
    // comentario sigue con `eliminado = true` desde la sesión de más arriba;
    // nada intermedio lo toca. Sin esta prueba, "el admin sí puede" sería una
    // afirmación del comentario del SQL y de nadie más.
    await esperarPermitido(
      "administrador SÍ puede restaurar un comentario eliminado",
      clienteAdmin.from("comentarios").update({ eliminado: false }).eq("id", comentario.id).select(),
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

    // fecha_inicio se aleja también, no solo fecha_renovacion: esta fila
    // nació con fecha_inicio=ahora (línea ~1822) y fechaLimite es AYER, así
    // que sin mover fecha_inicio el update chocaría contra
    // suscripciones_renovacion_posterior (071, D-6). Lo que se está probando
    // aquí es la comparación de zona horaria sobre fecha_renovacion; a
    // fecha_inicio no la lee ninguna aserción de este bloque.
    const { error: errFijarLimite } = await admin
      .from("suscripciones")
      .update({
        fecha_inicio: new Date(Date.now() - 40 * 86_400_000).toISOString(),
        fecha_renovacion: fechaLimite,
      })
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

    // ------------------------------------------------------------------
    // D-4: supresión de datos personales (075_anonimizar_usuario.sql)
    //
    // ------------------------------------------------------------------
    // Generación de exámenes con IA (083)
    //
    // `transcripciones_video` es la superficie nueva que más importa cerrar:
    // guarda la clase entera en texto plano. Es el MISMO contenido por el que
    // se paga la suscripción, pero sin el candado que lo protege en su forma
    // nativa — el video solo se reproduce con una URL firmada de Mux que
    // caduca, mientras que un SELECT sobre esta tabla devuelve el curso
    // completo en una petición, copiable y redistribuible.
    //
    // Por eso la prueba clave es NEGATIVA y sobre el estudiante CON acceso
    // vigente: es el caso que uno estaría tentado de abrir ("total, ya pagó").
    // Si alguien agrega mañana una policy de `tiene_acceso_vigente_curso`
    // sobre esta tabla, esta prueba es la que lo detecta.
    // ------------------------------------------------------------------
    console.log("\n=== Sesión: GENERACIÓN DE EXÁMENES CON IA (083) ===\n");

    const { error: errSembrarTranscripcion } = await admin
      .from("transcripciones_video")
      .insert({
        id_leccion: leccionExamen!.id,
        id_curso: idCursoExamen!,
        id_asset_mux: `rls-test-asset-${sufijo}`,
        id_track_mux: `rls-test-track-${sufijo}`,
        transcripcion: "la subdivisión de la luz controla el ruido de la imagen",
        idioma: "es",
        actualizado_en: new Date().toISOString(),
      });
    if (errSembrarTranscripcion) {
      throw new Error(`No pude sembrar la transcripción de prueba: ${errSembrarTranscripcion.message}`);
    }

    await esperarBloqueado(
      "anon no puede leer transcripciones_video",
      clienteAnonimo.from("transcripciones_video").select("transcripcion"),
    );
    await esperarBloqueado(
      "estudiante SIN acceso no puede leer transcripciones_video",
      clienteSinAcceso.from("transcripciones_video").select("transcripcion"),
    );
    // La que de verdad importa: pagar da derecho a VER el video, no a
    // descargarse su transcripción completa.
    await esperarBloqueado(
      "estudiante CON suscripción vigente TAMPOCO lee la transcripción del curso",
      clienteConAcceso.from("transcripciones_video").select("transcripcion"),
    );
    await esperarPermitido(
      "un administrador sí lee la transcripción (es quien revisa las preguntas generadas)",
      clienteAdmin.from("transcripciones_video").select("transcripcion").eq("id_curso", idCursoExamen!),
    );

    // Sin política de INSERT/UPDATE/DELETE: con RLS activo y sin policy,
    // Postgres deniega incluso al administrador. Solo el Service Role escribe
    // (el webhook de Mux). Mismo criterio que `intentos_examen` en 067.
    const { error: errEscribirTranscripcion } = await clienteAdmin
      .from("transcripciones_video")
      .update({ transcripcion: "manipulada" })
      .eq("id_curso", idCursoExamen!);
    registrar(
      "ni un administrador puede escribir transcripciones_video desde el cliente (solo el webhook)",
      errEscribirTranscripcion !== null,
      errEscribirTranscripcion?.message ?? "la escritura pasó",
    );

    await esperarBloqueado(
      "estudiante no puede leer trabajos_generacion_examen",
      clienteConAcceso.from("trabajos_generacion_examen").select("id"),
    );

    // Idempotencia en la BASE, no en TypeScript: dos clics simultáneos son dos
    // procesos que no se ven entre sí, así que el cerrojo tiene que ser el
    // índice parcial único y no una comprobación en la app.
    const { error: errPrimerTrabajo } = await admin
      .from("trabajos_generacion_examen")
      .insert({ id_curso: idCursoExamen!, disparado_por: "ADMIN_MANUAL", actualizado_en: new Date().toISOString() });
    registrar(
      "se registra un trabajo de generación PENDIENTE",
      errPrimerTrabajo === null,
      errPrimerTrabajo?.message ?? "ok",
    );

    const { error: errSegundoTrabajo } = await admin
      .from("trabajos_generacion_examen")
      .insert({ id_curso: idCursoExamen!, disparado_por: "ADMIN_MANUAL", actualizado_en: new Date().toISOString() });
    registrar(
      "un SEGUNDO trabajo PENDIENTE para el mismo curso choca — es el cerrojo de idempotencia",
      errSegundoTrabajo?.code === "23505",
      errSegundoTrabajo?.code ?? "se insertó igual",
    );

    // Cerrado el primero, la siguiente corrida sí puede empezar: el índice es
    // PARCIAL sobre `estado = PENDIENTE`, para que el historial se acumule.
    await admin
      .from("trabajos_generacion_examen")
      .update({ estado: "COMPLETADO", finalizado_en: new Date().toISOString() })
      .eq("id_curso", idCursoExamen!)
      .eq("estado", "PENDIENTE");

    const { error: errTercerTrabajo } = await admin
      .from("trabajos_generacion_examen")
      .insert({ id_curso: idCursoExamen!, disparado_por: "VIDEO_AGREGADO", actualizado_en: new Date().toISOString() });
    registrar(
      "cerrado el anterior, sí se puede registrar una corrida nueva (el índice es parcial)",
      errTercerTrabajo === null,
      errTercerTrabajo?.message ?? "ok",
    );

    const { error: errDisparadorInvalido } = await admin
      .from("trabajos_generacion_examen")
      .insert({ id_curso: idCursoExamen!, disparado_por: "LO_QUE_SEA", actualizado_en: new Date().toISOString() });
    registrar(
      "un disparador fuera de DISPARADORES_GENERACION se rechaza en la base",
      errDisparadorInvalido?.code === "23514",
      errDisparadorInvalido?.code ?? "se insertó igual",
    );

    // Una pregunta "validada" sin fragmento sería una afirmación que nadie
    // puede revisar — justo la clase de fila que este módulo existe para evitar.
    const { error: errValidadaSinOrigen } = await admin.from("preguntas_examen").insert({
      id_examen: idExamenPrueba!,
      tipo: "OPCION_UNICA",
      enunciado: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "x" }] }] },
      puntos: 1,
      orden: 999,
      opciones: [
        { id: "a", texto: "a", correcta: true },
        { id: "b", texto: "b", correcta: false },
      ],
      respuestas_aceptadas: [],
      validada: true,
      actualizado_en: new Date().toISOString(),
    });
    registrar(
      "no se puede marcar una pregunta como validada sin decir contra qué se validó",
      errValidadaSinOrigen?.code === "23514",
      errValidadaSinOrigen?.code ?? "se insertó igual",
    );

    // La base hacía imposible cumplir lo que docs/legal ya promete: diez
    // tablas referencian `perfiles` con ON DELETE RESTRICT y basta una fila
    // en `suscripciones` para volver la cuenta indeleble. Y como
    // `perfiles.id -> auth.users` es ON DELETE CASCADE, un deleteUser
    // cascadea al borrado del perfil y choca con el primer RESTRICT. Por eso
    // se anonimiza en vez de borrar, y por eso auth.users se limpia en vez
    // de eliminarse.
    // ------------------------------------------------------------------
    console.log("\n=== Sesión: SUPRESIÓN DE DATOS PERSONALES (075) ===\n");

    // Rastro personal a suprimir. Se siembra con service role: lo que se
    // prueba es la supresión, no la escritura.
    const { data: comentarioAnonimizar, error: errComentarioAnon } = await admin
      .from("comentarios")
      .insert({
        id_leccion: idLeccionIntroductoria,
        id_usuario: userAnonimizar.user!.id,
        contenido: "Comentario con datos personales de prueba",
      })
      .select("id")
      .single();
    if (errComentarioAnon || !comentarioAnonimizar) {
      throw new Error(`No pude sembrar el comentario a anonimizar: ${errComentarioAnon?.message}`);
    }
    const { error: errProgresoAnon } = await admin
      .from("progreso")
      .insert({ id_usuario: userAnonimizar.user!.id, id_leccion: idLeccionIntroductoria, completado: true });
    if (errProgresoAnon) throw new Error(`No pude sembrar el progreso a anonimizar: ${errProgresoAnon.message}`);

    await esperarBloqueado(
      "un estudiante NO puede anonimizar a otro usuario",
      clienteConAcceso.rpc("anonimizar_usuario", { p_id_usuario: userAnonimizar.user!.id }),
    );

    await esperarBloqueado(
      "anon no puede llamar anonimizar_usuario",
      clienteAnonimo.rpc("anonimizar_usuario", { p_id_usuario: userAnonimizar.user!.id }),
    );

    // Guardia contra el pie en el que es fácil dispararse: un administrador
    // que se anonimiza pierde el acceso con el que está operando, y si es el
    // último deja la plataforma sin ninguno. No hay vuelta desde la interfaz.
    await esperarBloqueado(
      "un administrador NO puede anonimizar su propia cuenta",
      clienteAdmin.rpc("anonimizar_usuario", { p_id_usuario: userAdmin.user!.id }),
    );

    await esperarPermitido(
      "un administrador SÍ puede anonimizar la cuenta de otro usuario",
      clienteAdmin.rpc("anonimizar_usuario", { p_id_usuario: userAnonimizar.user!.id }),
    );

    const { data: perfilAnonimizado } = await admin
      .from("perfiles")
      .select("nombre, correo, celular, pais, especialidad, estado, anonimizado_en")
      .eq("id", userAnonimizar.user!.id)
      .single();
    const sinDatosPersonales =
      perfilAnonimizado?.nombre === "Usuario eliminado" &&
      perfilAnonimizado?.correo === `anon+${userAnonimizar.user!.id.replace(/-/g, "")}@uva.invalid` &&
      perfilAnonimizado?.celular === null &&
      perfilAnonimizado?.pais === null &&
      perfilAnonimizado?.especialidad === null &&
      perfilAnonimizado?.estado === "SUSPENDIDO" &&
      perfilAnonimizado?.anonimizado_en !== null;
    registrar(
      "la supresión no deja ningún dato personal en `perfiles`",
      sinDatosPersonales,
      JSON.stringify(perfilAnonimizado),
    );

    const { count: progresoTrasAnonimizar } = await admin
      .from("progreso")
      .select("id", { count: "exact", head: true })
      .eq("id_usuario", userAnonimizar.user!.id);
    registrar(
      "la supresión borra el progreso del titular",
      progresoTrasAnonimizar === 0,
      `progreso=${progresoTrasAnonimizar}`,
    );

    // El comentario NO se borra: cascadearía a las respuestas de otras
    // personas, que no pidieron nada. Se vacía, que es lo que el trigger
    // comentarios_contenido_solo_se_vacia (064) permite.
    const { data: comentarioTrasAnonimizar } = await admin
      .from("comentarios")
      .select("contenido, eliminado")
      .eq("id", comentarioAnonimizar.id)
      .maybeSingle();
    registrar(
      "la supresión conserva el hilo del comentario pero vacía su contenido",
      comentarioTrasAnonimizar?.contenido === "" && comentarioTrasAnonimizar?.eliminado === true,
      JSON.stringify(comentarioTrasAnonimizar),
    );

    // Idempotencia: repetir no debe fallar NI mover la fecha. Esa fecha es
    // el dato que habría que poder demostrar ante una reclamación; si cada
    // corrida la reescribe, deja de significar cuándo se atendió la
    // solicitud.
    const fechaPrimeraSupresion = perfilAnonimizado?.anonimizado_en;
    await esperarPermitido(
      "repetir la supresión no falla (idempotente)",
      clienteAdmin.rpc("anonimizar_usuario", { p_id_usuario: userAnonimizar.user!.id }),
    );
    const { data: perfilRepetido } = await admin
      .from("perfiles")
      .select("anonimizado_en")
      .eq("id", userAnonimizar.user!.id)
      .single();
    registrar(
      "repetir la supresión NO reescribe la fecha en que se hizo",
      perfilRepetido?.anonimizado_en === fechaPrimeraSupresion,
      `antes=${fechaPrimeraSupresion} despues=${perfilRepetido?.anonimizado_en}`,
    );

    // ------------------------------------------------------------------
    // Comunidad (F1 del plan, supabase/sql/083_comunidad.sql +
    // 084_comunidad_gate_sin_requisito_temporal.sql)
    //
    // Por decisión de negocio, el gate quedó reducido a "suscripción
    // vigente O administrador", sin ventana de tiempo ni certificado — ver
    // 084. Lo que se prueba acá: que sigue exigiendo suscripción de verdad
    // (no basta con estar autenticado), que el bypass de admin sigue
    // funcionando, y que un certificado por sí solo YA NO otorga acceso
    // (regresión: antes de 084 sí lo hacía).
    // ------------------------------------------------------------------
    console.log("\n=== Sesión: COMUNIDAD (083/084) ===\n");

    await esperarBloqueado("anon no puede leer comunidad_posts", clienteAnonimo.from("comunidad_posts").select("*"));

    await esperarBloqueado(
      "estudiante sin suscripción no puede leer comunidad_posts",
      clienteSinAcceso.from("comunidad_posts").select("*"),
    );

    await esperarBloqueado(
      "estudiante sin suscripción no puede publicar en comunidad_posts",
      clienteSinAcceso
        .from("comunidad_posts")
        .insert({ id_usuario: userSinAcceso.user!.id, categoria: "PREGUNTAS", titulo: "x", contenido: "x" })
        .select(),
    );

    await esperarPermitido(
      "estudiante con suscripción vigente SÍ puede leer comunidad_posts",
      clienteConAcceso.from("comunidad_posts").select("*"),
    );

    await esperarPermitido(
      "administrador SÍ puede leer comunidad_posts sin suscripción ni certificado (bypass)",
      clienteAdmin.from("comunidad_posts").select("*"),
    );

    const postComunidad = (await esperarPermitido(
      "estudiante con acceso SÍ puede publicar en una categoría normal",
      clienteConAcceso
        .from("comunidad_posts")
        .insert({
          id_usuario: userConAcceso.user!.id,
          categoria: "PROYECTOS",
          titulo: `Post RLS test ${sufijo}`,
          contenido: "Contenido de prueba",
        })
        .select()
        .single(),
    )) as { id: string } | null;
    if (!postComunidad?.id) {
      throw new Error("El post de prueba de Comunidad no devolvió id; las pruebas de UPDATE de abajo no significan nada.");
    }

    await esperarBloqueado(
      "estudiante con acceso NO puede publicar en ANUNCIOS (solo admin)",
      clienteConAcceso
        .from("comunidad_posts")
        .insert({ id_usuario: userConAcceso.user!.id, categoria: "ANUNCIOS", titulo: "x", contenido: "x" })
        .select(),
    );

    await esperarBloqueado(
      "estudiante con acceso NO puede crear un post ya fijado",
      clienteConAcceso
        .from("comunidad_posts")
        .insert({ id_usuario: userConAcceso.user!.id, categoria: "PROYECTOS", titulo: "x", contenido: "x", fijado: true })
        .select(),
    );

    await esperarPermitido(
      "administrador SÍ puede publicar en ANUNCIOS",
      clienteAdmin
        .from("comunidad_posts")
        .insert({ id_usuario: userAdmin.user!.id, categoria: "ANUNCIOS", titulo: `Anuncio RLS test ${sufijo}`, contenido: "x" })
        .select(),
    );

    // Privilegio por columna + trigger (mismo criterio que 064/065 sobre
    // comentarios): la policy de UPDATE autoriza la FILA (es la suya), pero
    // ni fijar ni revivir son transiciones que le correspondan al propio
    // autor. Reescribir contenido/título SÍ, desde 087 — es la edición real
    // pedida por el usuario — pero solo mientras el post siga vivo y solo
    // el propio autor, nunca un admin (087_comunidad_editar_publicacion.sql).
    await esperarBloqueado(
      "el autor NO puede fijar su propio post",
      clienteConAcceso.from("comunidad_posts").update({ fijado: true }).eq("id", postComunidad.id).select(),
    );

    await esperarPermitido(
      "el autor SÍ puede editar el título y el contenido de su propio post (087)",
      clienteConAcceso
        .from("comunidad_posts")
        .update({ titulo: "Título editado", contenido: "Contenido editado" })
        .eq("id", postComunidad.id)
        .select(),
    );

    await esperarBloqueado(
      "un administrador NO puede reescribir el contenido de la publicación de otro (solo vaciarlo al moderar)",
      clienteAdmin.from("comunidad_posts").update({ contenido: "texto puesto por el admin" }).eq("id", postComunidad.id).select(),
    );

    await esperarPermitido(
      "el autor SÍ puede eliminar (lógicamente) su propio post",
      clienteConAcceso.from("comunidad_posts").update({ eliminado: true }).eq("id", postComunidad.id).select(),
    );

    await esperarBloqueado(
      "el autor NO puede revivir su propio post eliminado (moderación irreversible para él)",
      clienteConAcceso.from("comunidad_posts").update({ eliminado: false }).eq("id", postComunidad.id).select(),
    );

    await esperarBloqueado(
      "el contenido de un post ELIMINADO no se puede reescribir, ni por su propio autor",
      clienteConAcceso.from("comunidad_posts").update({ contenido: "texto reescrito" }).eq("id", postComunidad.id).select(),
    );

    await esperarPermitido(
      "administrador SÍ puede fijar el post de otro usuario",
      clienteAdmin.from("comunidad_posts").update({ fijado: true }).eq("id", postComunidad.id).select(),
    );

    await esperarPermitido(
      "administrador SÍ puede restaurar el post eliminado de otro usuario",
      clienteAdmin.from("comunidad_posts").update({ eliminado: false }).eq("id", postComunidad.id).select(),
    );

    // Reacciones: una por usuario por objetivo, y a exactamente un post O una
    // respuesta — nunca ambos ni ninguno (constraint check, no policy).
    await esperarPermitido(
      "estudiante con acceso SÍ puede reaccionar a un post",
      clienteConAcceso
        .from("comunidad_reacciones")
        .insert({ id_usuario: userConAcceso.user!.id, id_post: postComunidad.id })
        .select(),
    );

    const { error: errReaccionDuplicada } = await clienteConAcceso
      .from("comunidad_reacciones")
      .insert({ id_usuario: userConAcceso.user!.id, id_post: postComunidad.id });
    registrar(
      "reaccionar dos veces al mismo post por el mismo usuario choca con el índice único",
      errReaccionDuplicada?.code === "23505",
      errReaccionDuplicada ? `${errReaccionDuplicada.code}` : "el insert pasó: el índice único parcial no está",
    );

    const { error: errReaccionSinObjetivo } = await clienteConAcceso
      .from("comunidad_reacciones")
      .insert({ id_usuario: userConAcceso.user!.id });
    registrar(
      "una reacción sin post ni respuesta se rechaza (CHECK num_nonnulls)",
      errReaccionSinObjetivo?.code === "23514",
      errReaccionSinObjetivo ? `${errReaccionSinObjetivo.code}` : "el insert pasó: el CHECK de exclusividad no está",
    );

    await esperarPermitido(
      "estudiante con acceso SÍ puede quitar su propia reacción",
      clienteConAcceso
        .from("comunidad_reacciones")
        .delete()
        .eq("id_usuario", userConAcceso.user!.id)
        .eq("id_post", postComunidad.id),
    );

    // Respuestas: mismo gate que los posts, sin `fijado`.
    const respuestaComunidad = (await esperarPermitido(
      "estudiante con acceso SÍ puede responder un post",
      clienteConAcceso
        .from("comunidad_respuestas")
        .insert({ id_usuario: userConAcceso.user!.id, id_post: postComunidad.id, contenido: "Respuesta de prueba" })
        .select()
        .single(),
    )) as { id: string } | null;
    if (!respuestaComunidad?.id) {
      throw new Error("La respuesta de prueba de Comunidad no devolvió id.");
    }

    await esperarBloqueado(
      "estudiante sin suscripción no puede responder un post",
      clienteSinAcceso
        .from("comunidad_respuestas")
        .insert({ id_usuario: userSinAcceso.user!.id, id_post: postComunidad.id, contenido: "x" })
        .select(),
    );

    // Adjuntos (086): un archivo o imagen por post/respuesta, solo sobre lo
    // propio, borrable por el autor o por un administrador moderando.
    await esperarBloqueado(
      "estudiante sin suscripción no puede leer comunidad_adjuntos",
      clienteSinAcceso.from("comunidad_adjuntos").select("*"),
    );

    const otroPostAdmin = (await esperarPermitido(
      "administrador SÍ puede publicar en ANUNCIOS (post ajeno para la prueba de adjuntos)",
      clienteAdmin
        .from("comunidad_posts")
        .insert({ id_usuario: userAdmin.user!.id, categoria: "ANUNCIOS", titulo: `Otro anuncio RLS ${sufijo}`, contenido: "x" })
        .select()
        .single(),
    )) as { id: string } | null;
    if (!otroPostAdmin?.id) {
      throw new Error("El segundo post de prueba (admin) no devolvió id; las pruebas de adjuntos no significan nada.");
    }

    await esperarBloqueado(
      "estudiante con acceso NO puede adjuntar un archivo al post de otro usuario",
      clienteConAcceso
        .from("comunidad_adjuntos")
        .insert({
          id_post: otroPostAdmin.id,
          id_usuario: userConAcceso.user!.id,
          ruta_storage: `${userConAcceso.user!.id}/intruso.webp`,
          nombre_original: "intruso.webp",
          tipo_archivo: "image/webp",
          es_imagen: true,
          tamano_bytes: 1,
        })
        .select(),
    );

    const adjuntoComunidad = (await esperarPermitido(
      "estudiante con acceso SÍ puede adjuntar un archivo a su propio post",
      clienteConAcceso
        .from("comunidad_adjuntos")
        .insert({
          id_post: postComunidad.id,
          id_usuario: userConAcceso.user!.id,
          ruta_storage: `${userConAcceso.user!.id}/${postComunidad.id}.webp`,
          nombre_original: "captura.webp",
          tipo_archivo: "image/webp",
          es_imagen: true,
          ancho: 800,
          alto: 600,
          tamano_bytes: 12_345,
        })
        .select()
        .single(),
    )) as { id: string } | null;
    if (!adjuntoComunidad?.id) {
      throw new Error("El adjunto de prueba de Comunidad no devolvió id; las pruebas de abajo no significan nada.");
    }

    // Desde que se decidió permitir varias imágenes/archivos incrustados en
    // el mismo post (uno por cada `[[adjunto:id]]` en el texto), un segundo
    // adjunto en el mismo post ya no debe chocar con nada — el único índice
    // único parcial que existió para esto se quitó explícitamente en 086.
    await esperarPermitido(
      "un segundo adjunto en el mismo post SÍ se puede insertar (ya no hay límite de uno por post)",
      clienteConAcceso
        .from("comunidad_adjuntos")
        .insert({
          id_post: postComunidad.id,
          id_usuario: userConAcceso.user!.id,
          ruta_storage: `${userConAcceso.user!.id}/${postComunidad.id}/segunda.webp`,
          nombre_original: "segunda.webp",
          tipo_archivo: "image/webp",
          es_imagen: true,
          ancho: 400,
          alto: 300,
          tamano_bytes: 1,
        })
        .select(),
    );

    await esperarBloqueado(
      "un estudiante que no es el autor ni admin NO puede borrar el adjunto de otro",
      clienteSinAcceso.from("comunidad_adjuntos").delete().eq("id", adjuntoComunidad.id),
    );

    await esperarPermitido(
      "administrador SÍ puede borrar el adjunto de otro usuario (moderación)",
      clienteAdmin.from("comunidad_adjuntos").delete().eq("id", adjuntoComunidad.id),
    );

    // Moderación: evidencia sensible, cerrada a todo el que no sea admin —
    // mismo criterio que comentario_moderacion (065), calcado.
    await esperarBloqueado(
      "estudiante con acceso no puede leer comunidad_moderacion",
      clienteConAcceso.from("comunidad_moderacion").select("*"),
    );

    await esperarBloqueado(
      "estudiante con acceso no puede insertar en comunidad_moderacion ni con su propio id",
      clienteConAcceso
        .from("comunidad_moderacion")
        .insert({ id_post: postComunidad.id, contenido_original: "x", id_eliminado_por: userConAcceso.user!.id })
        .select(),
    );

    await esperarBloqueado(
      "administrador NO puede firmar una moderación con el id de otro usuario",
      clienteAdmin
        .from("comunidad_moderacion")
        .insert({ id_post: postComunidad.id, contenido_original: "x", id_eliminado_por: userConAcceso.user!.id })
        .select(),
    );

    await esperarPermitido(
      "administrador SÍ puede insertar en comunidad_moderacion firmando con su propio id",
      clienteAdmin
        .from("comunidad_moderacion")
        .insert({ id_post: postComunidad.id, contenido_original: "Contenido de prueba", id_eliminado_por: userAdmin.user!.id })
        .select(),
    );

    // Regresión de 084: un certificado reciente YA NO otorga acceso por sí
    // solo (antes de 084 sí lo hacía, vía private.comunidad_activo_por_certificado,
    // que sigue existiendo sin usarse). Se siembra directo (service role),
    // no por el trigger de emisión — lo que se prueba es el gate, no el
    // flujo de emisión (eso ya lo cubre la sesión de 047-050).
    const { error: errCertificadoFresco } = await admin.from("certificados").insert({
      id_usuario: userSinAcceso.user!.id,
      id_curso: cursoReproduccion.id,
      codigo_verificacion: `RLSCOM${sufijo}`,
      nombre_estudiante: "RLS Test Comunidad",
      nombre_curso: "RLS Test Comunidad",
      fecha_emision: new Date(Date.now() - 5 * 86_400_000).toISOString(),
    });
    if (errCertificadoFresco) {
      throw new Error(`No pude sembrar el certificado de prueba de Comunidad: ${errCertificadoFresco.message}`);
    }

    await esperarBloqueado(
      "certificado emitido hace 5 días YA NO otorga acceso a comunidad_posts sin suscripción (084)",
      clienteSinAcceso.from("comunidad_posts").select("*"),
    );

    // cuenta_activa() (019) en la escritura: mismo cinturón de seguridad que
    // el resto del proyecto exige en todo INSERT/UPDATE, ahora también en
    // Comunidad. Se suspende y se restaura al propio usuario de prueba
    // (nunca la fila compartida de configuración) para no dejar el efecto
    // secundario a medio camino si una aserción de más abajo fallara.
    const { error: errSuspender } = await admin
      .from("perfiles")
      .update({ estado: "SUSPENDIDO" })
      .eq("id", userConAcceso.user!.id);
    if (errSuspender) throw new Error(`No pude suspender al usuario de prueba: ${errSuspender.message}`);

    await esperarBloqueado(
      "un usuario suspendido no puede publicar en comunidad_posts aunque tenga suscripción vigente",
      clienteConAcceso
        .from("comunidad_posts")
        .insert({ id_usuario: userConAcceso.user!.id, categoria: "PROYECTOS", titulo: "x", contenido: "x" })
        .select(),
    );

    const { error: errReactivarComunidad } = await admin
      .from("perfiles")
      .update({ estado: "ACTIVO" })
      .eq("id", userConAcceso.user!.id);
    if (errReactivarComunidad) {
      throw new Error(`No pude reactivar al usuario de prueba: ${errReactivarComunidad.message}`);
    }
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
    // userAnonimizar va en la lista aunque su cuenta esté anonimizada: la
    // supresión borra progreso, likes e intentos, pero conserva el
    // comentario (vacío), y `comentarios.id_usuario` es una FK RESTRICT que
    // haría fallar el deleteUser. El bucle de abajo ya lo limpia todo.
    const usuariosDePrueba = [
      userSinAcceso.user!,
      userConAcceso.user!,
      userAdmin.user!,
      userAnonimizar.user!,
    ];

    // Los pagos van antes que las suscripciones: `pagos.id_suscripcion` es una
    // FK sin cascada.
    await admin.from("pagos").delete().eq("ref_transaccion_externa", refPagoPrueba);
    if (idCertificadoPrueba) {
      await admin.storage.from("certificados").remove([`${userConAcceso.user!.id}/${idCertificadoPrueba}.pdf`]);
    }
    for (const usuario of usuariosDePrueba) {
      // Comunidad (083): moderación y reacciones antes que respuestas y
      // posts, aunque casi todo esto ya cascadea desde comunidad_posts — no
      // se depende de esa cascada, mismo criterio que el resto de este
      // bucle. `id_eliminado_por` es la única columna de moderación que un
      // usuario de prueba puede tener (solo el admin firma moderaciones);
      // `id_post`/`id_respuesta` no hacen falta acá porque cascadean con el
      // post/respuesta cuando se borra más abajo.
      await admin.from("comunidad_moderacion").delete().eq("id_eliminado_por", usuario.id);
      await admin.from("comunidad_reacciones").delete().eq("id_usuario", usuario.id);
      await admin.from("comunidad_respuestas").delete().eq("id_usuario", usuario.id);
      await admin.from("comunidad_posts").delete().eq("id_usuario", usuario.id);
      await admin.from("certificados").delete().eq("id_usuario", usuario.id);
      await admin.from("progreso").delete().eq("id_usuario", usuario.id);
      await admin.from("inscripciones").delete().eq("id_usuario", usuario.id);
      await admin.from("suscripciones").delete().eq("id_usuario", usuario.id);
      // Explícito aunque `comentarios` cascadee desde `lecciones`: la FK a
      // `perfiles` NO lleva onDelete, así que un comentario superviviente
      // haría fallar el deleteUser de más abajo con una violación de FK, y la
      // corrida dejaría un usuario de prueba colgado — exactamente el problema
      // que este `finally` existe para evitar. No se depende del orden en que
      // caen las cascadas.
      await admin.from("intentos_examen").delete().eq("id_usuario", usuario.id);
      await admin.from("comentarios").delete().eq("id_usuario", usuario.id);
      // 069 + 074: la fila que dejó la prueba de bitácora append-only. Tiene
      // que irse antes del deleteUser (`bitacora_administrativa.id_admin` es
      // una FK a `perfiles` sin cascada), pero desde 074 un DELETE normal ya
      // no funciona ni con el service role: el trigger lo bloquea. La única
      // puerta es esta RPC, que declara la intención en vez de borrar de
      // tapadillo. Es exactamente lo que se comprobó dos veces más arriba.
      await admin.rpc("purgar_bitacora_de_admin", { p_id_admin: usuario.id });
    }

    await admin.from("recursos_descargables").delete().eq("nombre", "Material RLS test.pdf");
    await admin.from("modulos").delete().eq("id_curso", cursoReproduccion.id);
    await admin.from("cursos").delete().eq("id", cursoReproduccion.id);
    // Fixture de D-1 (070). Va después del bucle de usuarios de arriba, que
    // ya borró su progreso: `progreso.id_leccion` cascadea desde `lecciones`,
    // pero `modulos.id_curso` es RESTRICT y el curso no cae si queda algo.
    await admin.from("modulos").delete().eq("id_curso", cursoAcceso.id);
    await admin.from("cursos").delete().eq("id", cursoAcceso.id);
    await admin.from("modulos").delete().eq("id_curso", cursoNoPublicado.id);
    await admin.from("inscripciones").delete().eq("id_curso", cursoNoPublicado.id);
    await admin.from("cursos").delete().eq("id", cursoNoPublicado.id);
    if (idExamenPrueba) await admin.from("examenes").delete().eq("id", idExamenPrueba);
    if (idCursoExamen) {
      await admin.from("modulos").delete().eq("id_curso", idCursoExamen);
      await admin.from("cursos").delete().eq("id", idCursoExamen);
    }
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
