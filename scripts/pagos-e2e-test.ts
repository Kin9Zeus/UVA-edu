/**
 * Prueba de punta a punta del cobro con Wompi, sin cuenta de comercio y sin
 * levantar el servidor.
 *
 * Uso: npm run test:pagos
 *
 * Qué ejercita
 * ------------
 * El camino real completo: se registra un intento como lo hace
 * `iniciarCheckout`, se firma un evento con el MISMO algoritmo que usa Wompi
 * y se entrega al handler de `/api/webhooks/wompi` importándolo directamente
 * (mismo truco que scripts/webhook-test.ts). De ahí en adelante todo es el
 * código de producción: verificación de checksum, idempotencia contra
 * `eventos_webhook`, y `aplicar_pago_wompi`.
 *
 * Los casos, que son los que de verdad pueden costar dinero:
 *   1. APPROVED crea suscripción ACTIVA y registra el pago.
 *   2. El MISMO evento dos veces deja UNA sola suscripción y UN solo pago.
 *   3. Un evento con monto distinto al del intento NO da acceso.
 *   4. DECLINED cierra el intento y NO da acceso.
 *   5. Una referencia que no existe no crea nada.
 *
 * Limpia todo lo que crea, pase o falle. Sale con código 1 si algo falló.
 */

process.loadEnvFile(".env.local");

// ANTES de cualquier import que pueda leerla: esta prueba aprueba pagos
// ficticios sobre perfiles reales de la base, así que el recibo NO debe
// salir. Ver `enviarRecibo` en src/lib/pagos/conciliacion.ts.
process.env.PAGOS_SIN_CORREO = "1";

import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { construirEventoSimulado, CABECERA_SIMULADOR } from "@/lib/pagos/simulador";

const URL_SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL_SUPABASE || !SERVICE_KEY) {
  throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en .env.local.");
}

/**
 * El estrechamiento de un `if (!X) throw` en el ámbito del módulo NO llega al
 * cuerpo de `main()` —el análisis de flujo de TypeScript no cruza límites de
 * función—, así que la comprobación se hace dentro de una función que
 * devuelve un `string` ya garantizado.
 */
const SECRETO: string = (() => {
  const valor = process.env.WOMPI_EVENTS_SECRET;
  if (!valor) throw new Error("Falta WOMPI_EVENTS_SECRET en .env.local.");
  return valor;
})();
// El handler se salta la consulta a la API de Wompi solo con el simulador
// encendido; sin esto intentaría verificar transacciones inexistentes.
if (process.env.WOMPI_SIMULADOR !== "1") {
  throw new Error("Esta prueba necesita WOMPI_SIMULADOR=1 en .env.local.");
}

const admin = createClient(URL_SUPABASE, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

type Handler = (peticion: Request) => Promise<Response>;

const resultados: { nombre: string; ok: boolean; detalle?: string }[] = [];
const referenciasCreadas: string[] = [];

function registrar(nombre: string, ok: boolean, detalle?: string) {
  resultados.push({ nombre, ok, detalle });
  console.log(`${ok ? "OK   " : "FALLA"} ${nombre}${detalle ? ` -- ${detalle}` : ""}`);
}

async function entregar(handler: Handler, evento: unknown): Promise<Response> {
  return handler(
    new Request("https://uva.test/api/webhooks/wompi", {
      method: "POST",
      headers: { "content-type": "application/json", [CABECERA_SIMULADOR]: "1" },
      body: JSON.stringify(evento),
    }),
  );
}

/** Crea un intento PENDIENTE, igual que `iniciarCheckout`. */
async function crearIntento(idUsuario: string, idPlan: string, monto: number) {
  const referencia = `uva_test_${randomUUID().replace(/-/g, "")}`;
  referenciasCreadas.push(referencia);

  const { error } = await admin.from("intentos_pago").insert({
    referencia,
    id_usuario: idUsuario,
    id_plan: idPlan,
    monto_centavos: monto,
    moneda: "COP",
    estado: "PENDIENTE",
  });
  if (error) throw new Error(`no se pudo crear el intento: ${error.message}`);

  return referencia;
}

async function contarSuscripciones(idUsuario: string) {
  const { data } = await admin
    .from("suscripciones")
    .select("id, estado, proveedor, monto_centavos")
    .eq("id_usuario", idUsuario)
    .eq("proveedor", "wompi");
  return data ?? [];
}

async function estadoIntento(referencia: string) {
  const { data } = await admin
    .from("intentos_pago")
    .select("estado")
    .eq("referencia", referencia)
    .maybeSingle();
  return data?.estado ?? null;
}

async function limpiar(idUsuario: string) {
  console.log("\nLimpiando lo que creó la prueba...");

  // Orden inverso a las dependencias: pagos -> suscripciones -> intentos.
  const suscripciones = await contarSuscripciones(idUsuario);
  for (const s of suscripciones) {
    await admin.from("pagos").delete().eq("id_suscripcion", s.id);
    await admin.from("suscripciones").delete().eq("id", s.id);
  }

  for (const referencia of referenciasCreadas) {
    await admin.from("intentos_pago").delete().eq("referencia", referencia);
  }

  // Los eventos que generó esta prueba: su id externo es el checksum, así que
  // se borran por el payload de las referencias creadas.
  const { data: eventos } = await admin
    .from("eventos_webhook")
    .select("id, payload")
    .eq("proveedor", "wompi");

  for (const evento of eventos ?? []) {
    const ref = (evento.payload as { data?: { transaction?: { reference?: string } } })?.data
      ?.transaction?.reference;
    if (ref && referenciasCreadas.includes(ref)) {
      await admin.from("eventos_webhook").delete().eq("id", evento.id);
    }
  }
}

async function main() {
  const wompiPOST = (await import("@/app/api/webhooks/wompi/route")).POST as unknown as Handler;

  // Un plan activo y un usuario SIN suscripción vigente: el índice parcial
  // `suscripcion_activa_unica_por_usuario` haría fallar el alta si el usuario
  // ya tuviera una.
  const { data: plan } = await admin
    .from("planes")
    .select("id, nombre, precio_centavos")
    .eq("activo", true)
    .order("orden")
    .limit(1)
    .maybeSingle();
  if (!plan) throw new Error("No hay ningún plan activo. Corre `npm run db:seed`.");

  const { data: candidatos } = await admin.from("perfiles").select("id, correo").limit(50);
  let idUsuario: string | null = null;
  for (const perfil of candidatos ?? []) {
    const { data: vigente } = await admin
      .from("suscripciones")
      .select("id")
      .eq("id_usuario", perfil.id)
      .in("estado", ["ACTIVA", "PAST_DUE"])
      .maybeSingle();
    if (!vigente) {
      idUsuario = perfil.id;
      console.log(`Usuario de prueba: ${perfil.correo}`);
      break;
    }
  }
  if (!idUsuario) throw new Error("Todos los perfiles tienen suscripción vigente.");

  const monto = Number(plan.precio_centavos);
  console.log(`Plan: ${plan.nombre} (${monto} centavos)\n`);

  try {
    // --- 1. APPROVED da acceso ------------------------------------------
    const ref1 = await crearIntento(idUsuario, plan.id, monto);
    const evento1 = construirEventoSimulado({
      referencia: ref1,
      idTransaccion: `sim-${randomUUID()}`,
      estado: "APPROVED",
      montoCentavos: monto,
      moneda: "COP",
      secretoEventos: SECRETO,
    });

    const r1 = await entregar(wompiPOST, evento1);
    registrar("APPROVED responde 200", r1.status === 200, `status ${r1.status}`);

    const tras1 = await contarSuscripciones(idUsuario);
    registrar(
      "APPROVED crea una suscripción ACTIVA",
      tras1.length === 1 && tras1[0]?.estado === "ACTIVA",
      `${tras1.length} suscripción(es), estado ${tras1[0]?.estado ?? "-"}`,
    );
    registrar(
      "la suscripción guarda el monto cobrado",
      Number(tras1[0]?.monto_centavos) === monto,
      `${tras1[0]?.monto_centavos} vs ${monto}`,
    );

    const { data: pagos1 } = await admin
      .from("pagos")
      .select("id, estado, proveedor")
      .eq("id_suscripcion", tras1[0]?.id ?? "");
    registrar(
      "APPROVED registra un pago EXITOSO",
      pagos1?.length === 1 && pagos1[0]?.estado === "EXITOSO",
      `${pagos1?.length ?? 0} pago(s)`,
    );
    registrar("el intento queda APROBADO", (await estadoIntento(ref1)) === "APROBADO");

    // --- 2. Idempotencia: el MISMO evento otra vez -----------------------
    const r2 = await entregar(wompiPOST, evento1);
    const cuerpo2 = (await r2.json()) as { duplicado?: boolean };
    registrar("reenviar el mismo evento responde 200", r2.status === 200, `status ${r2.status}`);
    registrar("el reenvío se detecta como duplicado", cuerpo2.duplicado === true);

    const tras2 = await contarSuscripciones(idUsuario);
    const { data: pagos2 } = await admin
      .from("pagos")
      .select("id")
      .eq("id_suscripcion", tras2[0]?.id ?? "");
    registrar(
      "el reenvío NO duplica la suscripción ni el pago",
      tras2.length === 1 && pagos2?.length === 1,
      `${tras2.length} suscripción(es), ${pagos2?.length ?? 0} pago(s)`,
    );

    // Limpieza parcial: los casos siguientes necesitan al usuario sin
    // suscripción vigente.
    for (const s of tras2) {
      await admin.from("pagos").delete().eq("id_suscripcion", s.id);
      await admin.from("suscripciones").delete().eq("id", s.id);
    }

    // --- 3. Monto alterado NO da acceso ---------------------------------
    const ref3 = await crearIntento(idUsuario, plan.id, monto);
    const evento3 = construirEventoSimulado({
      referencia: ref3,
      idTransaccion: `sim-${randomUUID()}`,
      estado: "APPROVED",
      // La mitad del precio: es el ataque que la conciliación debe frenar.
      montoCentavos: Math.floor(monto / 2),
      moneda: "COP",
      secretoEventos: SECRETO,
    });
    await entregar(wompiPOST, evento3);

    const tras3 = await contarSuscripciones(idUsuario);
    registrar(
      "un monto distinto al del intento NO da acceso",
      tras3.length === 0,
      `${tras3.length} suscripción(es)`,
    );
    registrar("el intento del monto alterado sigue PENDIENTE", (await estadoIntento(ref3)) === "PENDIENTE");

    // --- 4. DECLINED no da acceso ---------------------------------------
    const ref4 = await crearIntento(idUsuario, plan.id, monto);
    const evento4 = construirEventoSimulado({
      referencia: ref4,
      idTransaccion: `sim-${randomUUID()}`,
      estado: "DECLINED",
      montoCentavos: monto,
      moneda: "COP",
      secretoEventos: SECRETO,
    });
    const r4 = await entregar(wompiPOST, evento4);
    registrar("DECLINED responde 200", r4.status === 200, `status ${r4.status}`);

    const tras4 = await contarSuscripciones(idUsuario);
    registrar("DECLINED NO da acceso", tras4.length === 0, `${tras4.length} suscripción(es)`);
    registrar("DECLINED marca el intento RECHAZADO", (await estadoIntento(ref4)) === "RECHAZADO");

    // --- 5. Referencia desconocida --------------------------------------
    const evento5 = construirEventoSimulado({
      referencia: "uva_test_no_existe_en_la_base",
      idTransaccion: `sim-${randomUUID()}`,
      estado: "APPROVED",
      montoCentavos: monto,
      moneda: "COP",
      secretoEventos: SECRETO,
    });
    const r5 = await entregar(wompiPOST, evento5);
    referenciasCreadas.push("uva_test_no_existe_en_la_base");
    registrar("una referencia desconocida no revienta", r5.status === 200, `status ${r5.status}`);

    const tras5 = await contarSuscripciones(idUsuario);
    registrar("una referencia desconocida no crea nada", tras5.length === 0);
  } finally {
    await limpiar(idUsuario);
  }

  const fallidas = resultados.filter((r) => !r.ok);
  console.log(`\n${resultados.length - fallidas.length}/${resultados.length} pruebas OK.`);
  if (fallidas.length > 0) {
    console.log("\nFALLIDAS:");
    for (const f of fallidas) console.log(`  - ${f.nombre}${f.detalle ? ` (${f.detalle})` : ""}`);
    process.exitCode = 1;
  }
}

void main().catch((error) => {
  console.error("\nError inesperado:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
