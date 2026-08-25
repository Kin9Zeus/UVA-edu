/**
 * Prueba de integración para canjear_codigo_invitacion() (P2-7 Fase B,
 * AUDIT-2026-08-24.md — recorrido 3 de 3: "estudiante canjea un código de
 * invitación").
 *
 * No es Playwright: no existe ninguna pantalla que llame a
 * canjearCodigoInvitacion() todavía (src/actions/codigos-invitacion/
 * canjear.ts no lo usa ningún componente), así que no hay UI que manejar.
 * Tampoco se puede llamar ese Server Action directo desde un test de
 * Node/Vitest: usa createClient() de src/lib/supabase/server.ts, que lee
 * cookies() de next/headers y solo funciona dentro de una request real de
 * Next.js — fuera de eso lanza. La lógica real (vigencia, límite de uso,
 * doble canje, creación atómica de la suscripción) vive entera en la
 * función de Postgres, así que se prueba ahí directamente, mismo patrón
 * que scripts/rls-test.ts.
 *
 * Uso: npm run test:canje
 * Sale con código 1 si algo falló, para poder usarse como gate de CI.
 */

process.loadEnvFile(".env.local");

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!URL || !SERVICE_KEY) {
  throw new Error("Faltan variables de entorno de Supabase en .env.local.");
}

type Resultado = { nombre: string; ok: boolean; detalle?: string };
const resultados: Resultado[] = [];

function registrar(nombre: string, ok: boolean, detalle?: string) {
  resultados.push({ nombre, ok, detalle });
  console.log(`${ok ? "✅" : "❌"} ${nombre}${detalle ? ` — ${detalle}` : ""}`);
}

type RespuestaCanje = { ok: boolean; motivo: string | null };

async function canjear(admin: SupabaseClient, codigo: string, usuarioId: string) {
  const { data, error } = await admin
    .rpc("canjear_codigo_invitacion", { p_codigo: codigo, p_usuario_id: usuarioId })
    .single();
  if (error) throw new Error(`RPC canjear_codigo_invitacion falló: ${error.message}`);
  return data as RespuestaCanje;
}

function esperarMotivo(nombre: string, respuesta: RespuestaCanje, motivoEsperado: string) {
  registrar(
    nombre,
    respuesta.ok === false && respuesta.motivo === motivoEsperado,
    `ok=${respuesta.ok} motivo=${respuesta.motivo ?? "null"}`,
  );
}

async function main() {
  const admin: SupabaseClient = createClient(URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const sufijo = Date.now();
  const password = "CanjeTest2026!";
  const ahora = Date.now();

  console.log("Preparando datos de prueba desechables...\n");

  const { data: plan, error: errPlan } = await admin
    .from("planes")
    .insert({ nombre: `Plan canje test ${sufijo}`, precio_centavos: 0, moneda: "COP", duracion_dias: 30, activo: false })
    .select("id")
    .single();
  if (errPlan || !plan) throw new Error(`No pude crear el plan de prueba: ${errPlan?.message}`);
  const planId = plan.id; // TS no propaga el narrowing de "plan" dentro de crearCodigo()

  async function crearUsuario(etiqueta: string) {
    const email = `canje-test-${etiqueta}-${sufijo}@uva.test`;
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (error || !data.user) throw new Error(`No pude crear el usuario "${etiqueta}": ${error?.message}`);
    return data.user;
  }

  async function crearCodigo(sufijoCodigo: string, overrides: Partial<{
    activo: boolean;
    fecha_vencimiento: string;
    limite_usos: number | null;
    veces_usado: number;
  }>) {
    const { data, error } = await admin
      .from("codigos_invitacion")
      .insert({
        codigo: `CANJE-TEST-${sufijoCodigo}-${sufijo}`,
        id_plan: planId,
        activo: true,
        fecha_vencimiento: new Date(ahora + 30 * 86_400_000).toISOString(),
        limite_usos: null,
        veces_usado: 0,
        ...overrides,
      })
      .select("*")
      .single();
    if (error || !data) throw new Error(`No pude crear el código de prueba "${sufijoCodigo}": ${error?.message}`);
    return data;
  }

  const usuarioExito = await crearUsuario("exito");
  const usuarioAgotado = await crearUsuario("agotado");

  const codigoValido = await crearCodigo("valido", {});
  const codigoInactivo = await crearCodigo("inactivo", { activo: false });
  const codigoVencido = await crearCodigo("vencido", { fecha_vencimiento: new Date(ahora - 86_400_000).toISOString() });
  const codigoAgotado = await crearCodigo("agotado", { limite_usos: 1, veces_usado: 1 });
  // Segundo código perfectamente válido, para comprobar que un usuario que
  // YA quedó con suscripción activa no puede canjear otro (ver
  // 027_canje_valida_suscripcion_activa.sql).
  const codigoSegundo = await crearCodigo("segundo", {});

  const idsUsuarios = [usuarioExito.id, usuarioAgotado.id];
  const idsCodigos = [
    codigoValido.id,
    codigoInactivo.id,
    codigoVencido.id,
    codigoAgotado.id,
    codigoSegundo.id,
  ];

  try {
    console.log("\n=== Casos de rechazo ===\n");

    esperarMotivo(
      "código que no existe -> codigo_invalido",
      await canjear(admin, "CODIGO-QUE-NO-EXISTE", usuarioExito.id),
      "codigo_invalido",
    );
    esperarMotivo(
      "código inactivo -> codigo_inactivo",
      await canjear(admin, codigoInactivo.codigo, usuarioExito.id),
      "codigo_inactivo",
    );
    esperarMotivo(
      "código vencido -> codigo_vencido",
      await canjear(admin, codigoVencido.codigo, usuarioExito.id),
      "codigo_vencido",
    );
    esperarMotivo(
      "código con limite_usos agotado (usado por otro usuario) -> codigo_agotado",
      await canjear(admin, codigoAgotado.codigo, usuarioAgotado.id),
      "codigo_agotado",
    );

    console.log("\n=== Canje exitoso y su efecto ===\n");

    const respuestaExito = await canjear(admin, codigoValido.codigo, usuarioExito.id);
    registrar("código válido, primer canje -> ok:true", respuestaExito.ok === true, `motivo=${respuestaExito.motivo ?? "null"}`);

    const { data: suscripcionCreada, error: errSuscripcion } = await admin
      .from("suscripciones")
      .select("estado, id_plan, id_codigo_invitacion, acceso_manual")
      .eq("id_usuario", usuarioExito.id)
      .eq("id_codigo_invitacion", codigoValido.id)
      .maybeSingle();
    registrar(
      "el canje exitoso creó una Suscripción ACTIVA vinculada al código",
      !errSuscripcion && suscripcionCreada?.estado === "ACTIVA" && suscripcionCreada?.id_plan === plan.id,
      errSuscripcion?.message,
    );

    const { data: codigoTrasCanje, error: errCodigoTrasCanje } = await admin
      .from("codigos_invitacion")
      .select("veces_usado")
      .eq("id", codigoValido.id)
      .single();
    registrar(
      "veces_usado se incrementó atómicamente tras el canje exitoso",
      !errCodigoTrasCanje && codigoTrasCanje?.veces_usado === 1,
      `veces_usado=${codigoTrasCanje?.veces_usado}`,
    );

    console.log("\n=== Reintento del mismo usuario ===\n");

    esperarMotivo(
      "el mismo usuario reintenta el mismo código ya canjeado -> ya_canjeado (no codigo_agotado)",
      await canjear(admin, codigoValido.codigo, usuarioExito.id),
      "ya_canjeado",
    );

    console.log("\n=== Usuario que ya tiene suscripción activa ===\n");

    // Regresión de 027: antes de ese script esto reventaba con SQLSTATE
    // 23505 contra suscripcion_activa_unica_por_usuario, la función abortaba
    // y el usuario veía "No pudimos procesar el código. Intenta de nuevo."
    // en vez de un motivo que explicara que su código sí sirve.
    esperarMotivo(
      "un código DISTINTO y válido, con suscripción activa -> ya_tiene_suscripcion (no un error 23505)",
      await canjear(admin, codigoSegundo.codigo, usuarioExito.id),
      "ya_tiene_suscripcion",
    );

    const { data: segundoTrasIntento } = await admin
      .from("codigos_invitacion")
      .select("veces_usado")
      .eq("id", codigoSegundo.id)
      .single();
    registrar(
      "el canje rechazado NO consumió un uso del código",
      segundoTrasIntento?.veces_usado === 0,
      `veces_usado=${segundoTrasIntento?.veces_usado}`,
    );
  } finally {
    console.log("\nLimpiando datos de prueba...");
    await admin.from("suscripciones").delete().in("id_usuario", idsUsuarios);
    await admin.from("codigos_invitacion").delete().in("id", idsCodigos);
    await admin.from("planes").delete().eq("id", plan.id);
    for (const id of idsUsuarios) await admin.auth.admin.deleteUser(id);
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
  console.error("\nError inesperado corriendo la prueba de canje de código:", error);
  process.exitCode = 1;
});
