/**
 * Script de prueba manual para las políticas RLS de
 * supabase/sql/003_rls_membresia_y_gestion.sql.
 *
 * No es parte del runtime de la app — es una verificación puntual con
 * un usuario ESTUDIANTE real que tenga una Suscripción en estado ACTIVA
 * o PAST_DUE. Requiere que ese usuario y esa suscripción ya existan en
 * la base de datos (la base está vacía por ahora, así que hay que crear
 * un usuario de prueba vía Supabase Auth + un registro en `suscripciones`
 * antes de correr esto).
 *
 * Uso:
 *   NEXT_PUBLIC_SUPABASE_URL=... \
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY=... \
 *   TEST_STUDENT_EMAIL=estudiante@ejemplo.com \
 *   TEST_STUDENT_PASSWORD=... \
 *   TEST_COURSE_ID=<uuid de un curso existente> \
 *   npx tsx scripts/test-rls-estudiante.ts
 *
 * Variables opcionales:
 *   TEST_OTHER_USER_PAGO_ID=<uuid de un pago que pertenezca a OTRO
 *     usuario> — si se provee, confirma explícitamente que ese pago no
 *     aparece en la consulta del estudiante de prueba (además de la
 *     verificación general con select * / count).
 *   TEST_COURSE_ID_CORTESIA_INTENTO=<uuid de OTRO curso, distinto de
 *     TEST_COURSE_ID> — usado en el caso (f) para intentar insertar una
 *     inscripción con tipo_acceso = 'CORTESIA'. Si no se provee, se
 *     reusa TEST_COURSE_ID, pero entonces un rechazo por el
 *     @@unique([id_usuario, id_curso]) (por la fila que ya insertó el
 *     caso (b)) sería indistinguible de un rechazo por RLS — se
 *     recomienda pasar un curso distinto para que la prueba sea
 *     concluyente.
 */
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const EMAIL = process.env.TEST_STUDENT_EMAIL!;
const PASSWORD = process.env.TEST_STUDENT_PASSWORD!;
const COURSE_ID = process.env.TEST_COURSE_ID!;
const OTHER_USER_PAGO_ID = process.env.TEST_OTHER_USER_PAGO_ID;
const COURSE_ID_CORTESIA_INTENTO =
  process.env.TEST_COURSE_ID_CORTESIA_INTENTO ?? COURSE_ID;

if (!SUPABASE_URL || !ANON_KEY || !EMAIL || !PASSWORD || !COURSE_ID) {
  console.error(
    "Faltan variables de entorno. Revisa el comentario al inicio del script."
  );
  process.exit(1);
}

function report(label: string, pass: boolean, detail?: unknown) {
  console.log(`${pass ? "✅ PASS" : "❌ FAIL"} — ${label}`);
  if (detail !== undefined) console.log("   ", detail);
}

async function main() {
  // (a) Visitante anónimo (sin sesión) puede ver planes.
  const anon = createClient(SUPABASE_URL, ANON_KEY);
  const { data: planesPublicos, error: errPlanesAnon } = await anon
    .from("planes")
    .select("id, nombre, activo");
  report(
    "(a) Anónimo puede leer 'planes' sin estar logueado",
    !errPlanesAnon && Array.isArray(planesPublicos),
    errPlanesAnon ?? `${planesPublicos?.length ?? 0} planes visibles`
  );

  // Sesión del estudiante con suscripción activa/past_due.
  const student = createClient(SUPABASE_URL, ANON_KEY);
  const { data: session, error: errLogin } = await student.auth.signInWithPassword({
    email: EMAIL,
    password: PASSWORD,
  });
  if (errLogin || !session.user) {
    console.error("No se pudo iniciar sesión con el usuario de prueba:", errLogin);
    process.exit(1);
  }
  const userId = session.user.id;

  // (b) Puede insertar su propia inscripción a un curso.
  const { data: inscripcion, error: errInsert } = await student
    .from("inscripciones")
    .insert({
      id_usuario: userId,
      id_curso: COURSE_ID,
      tipo_acceso: "MEMBRESIA",
    })
    .select()
    .single();
  report(
    "(b) Puede insertar su propia inscripción (MEMBRESIA)",
    !errInsert && !!inscripcion,
    errInsert ?? inscripcion
  );

  // (f) NO puede insertar una inscripción con tipo_acceso = 'CORTESIA'
  // (solo inscripciones_admin_gestiona puede crear cortesías; ver el
  // with check de inscripciones_insert_propio en
  // supabase/sql/003_rls_membresia_y_gestion.sql).
  const { data: cortesiaFalsa, error: errCortesia } = await student
    .from("inscripciones")
    .insert({
      id_usuario: userId,
      id_curso: COURSE_ID_CORTESIA_INTENTO,
      tipo_acceso: "CORTESIA",
      otorgado_por: userId,
    })
    .select()
    .single();
  report(
    "(f) NO puede insertar una inscripción propia con tipo_acceso = 'CORTESIA'",
    !!errCortesia && !cortesiaFalsa,
    errCortesia ?? cortesiaFalsa
  );

  // (c) NO puede leer la tabla cupones.
  const { data: cupones, error: errCupones } = await student
    .from("cupones")
    .select("*");
  const cuponesBloqueado = !!errCupones || (cupones?.length ?? 0) === 0;
  report(
    "(c) NO puede leer 'cupones' (debe fallar o devolver vacío)",
    cuponesBloqueado,
    errCupones ?? `${cupones?.length ?? 0} filas devueltas (esperado: 0)`
  );

  // (d) NO puede ver pagos de otro usuario.
  const { data: pagosPropios, error: errPagos } = await student
    .from("pagos")
    .select("*");
  let pagosAjenosBloqueados = !errPagos; // si la query general no truena, seguimos verificando
  if (OTHER_USER_PAGO_ID) {
    const filtrado = pagosPropios?.find((p) => p.id === OTHER_USER_PAGO_ID);
    pagosAjenosBloqueados = pagosAjenosBloqueados && !filtrado;
    report(
      "(d) NO puede ver el pago de otro usuario (TEST_OTHER_USER_PAGO_ID)",
      pagosAjenosBloqueados,
      filtrado ?? "pago ajeno no aparece en el resultado"
    );
  } else {
    report(
      "(d) Pagos visibles limitados a los propios (sin TEST_OTHER_USER_PAGO_ID no se puede confirmar el negativo exacto)",
      !errPagos,
      `${pagosPropios?.length ?? 0} filas devueltas`
    );
  }

  // (e) NO tiene ningún acceso a eventos_webhook.
  const { data: webhooks, error: errWebhooks } = await student
    .from("eventos_webhook")
    .select("*");
  const webhookBloqueado = !!errWebhooks || (webhooks?.length ?? 0) === 0;
  report(
    "(e) NO tiene acceso a 'eventos_webhook' (debe fallar o devolver vacío)",
    webhookBloqueado,
    errWebhooks ?? `${webhooks?.length ?? 0} filas devueltas (esperado: 0)`
  );

  await student.auth.signOut();
}

main();
