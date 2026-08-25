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

process.loadEnvFile(".env.local");

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!URL || !ANON_KEY || !SERVICE_KEY) {
  throw new Error("Faltan variables de entorno de Supabase en .env.local.");
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
    .insert({ nombre: `Categoria RLS test ${sufijo}`, activo: true })
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
    await esperarPermitido(
      "estudiante con acceso SÍ puede auto-inscribirse (MEMBRESIA, tiene suscripción activa)",
      clienteConAcceso.from("inscripciones").insert({ id_usuario: userConAcceso.user!.id, id_curso: cursoNoPublicado.id, tipo_acceso: "MEMBRESIA" }).select(),
    );
  } finally {
    console.log("\nLimpiando datos de prueba...");
    await admin.from("inscripciones").delete().eq("id_curso", cursoNoPublicado.id);
    await admin.from("cursos").delete().eq("id", cursoNoPublicado.id);
    await admin.from("instructores").delete().eq("id", instructor.id);
    await admin.from("categorias").delete().eq("id", categoria.id);
    await admin.from("suscripciones").delete().eq("id_usuario", userConAcceso.user!.id);
    await admin.from("planes").delete().eq("id", plan.id);
    await admin.auth.admin.deleteUser(userSinAcceso.user!.id);
    await admin.auth.admin.deleteUser(userConAcceso.user!.id);
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
