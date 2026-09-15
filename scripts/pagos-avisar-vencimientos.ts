/**
 * Avisa por correo a quien tiene el acceso por vencer, y marca
 * `suscripciones.aviso_vencimiento_en` al enviarlo con éxito.
 *
 * Uso: npm run pagos:avisar-vencimientos
 *
 * Por qué existe
 * --------------
 * Es el correo que sostiene el modelo de cobro. Wompi no tiene cobro
 * recurrente sobre PSE ni Nequi, así que el acceso se compra por períodos y
 * NADIE lo renueva solo: sin este aviso, el estudiante no se entera de que
 * venció —un día simplemente deja de poder entrar— y eso se lee como que el
 * producto se rompió, no como que había que renovar.
 *
 * Por qué NO importa src/lib/resend.ts
 * ------------------------------------
 * Mismo motivo que `certificados-enviar-notificaciones.ts`: ese módulo y
 * `src/lib/resend/client.ts` leen RESEND_API_KEY en el ámbito del módulo, y
 * un import estático de ESM se resuelve ANTES que el `loadEnvFile()` de abajo
 * —llegaría con la key vacía. Por eso el cliente de Resend se arma aquí. La
 * plantilla sí se importa directo: es un componente puro, sin process.env.
 *
 * Idempotente y seguro de reintentar: una fila solo se marca cuando Resend
 * confirmó el envío. Si falla, queda pendiente para la próxima corrida.
 *
 * Pensado para un cron diario (Railway), junto a `certificados:notificar`.
 * Mientras no esté programado NO corre solo.
 */

// .env.local no existe en Railway (ni en CI): ahí las variables llegan ya
// puestas en process.env por la plataforma. Mismo patrón que
// certificados-enviar-notificaciones.ts / apply-rls.ts.
try {
  process.loadEnvFile(".env.local");
} catch {
  // Sin archivo: se usan las variables ya presentes en process.env.
}

import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";
import { VencimientoProximoEmail } from "@/emails/vencimiento-proximo";
import { calcularDiasVigencia } from "@/lib/estadoAcceso";
import { formatFecha } from "@/lib/admin/format";

/**
 * Lee una variable obligatoria y falla con un mensaje útil si falta.
 *
 * Es una función y no un `if (!X) process.exit()` suelto porque el análisis
 * de flujo de TypeScript no cruza límites de función: comprobado arriba, el
 * tipo dentro de `main()` seguiría siendo `string | undefined`. Así el valor
 * llega ya estrechado a donde se usa.
 */
function requerida(nombre: string, ayuda?: string): string {
  const valor = process.env[nombre]?.trim();
  if (!valor) {
    console.error(`
❌ Falta ${nombre}${ayuda ? `: ${ayuda}` : ""}.
`);
    process.exit(1);
  }
  return valor;
}

const SOLO_SIMULAR = !process.argv.includes("--enviar");

const URL_SUPABASE = requerida("NEXT_PUBLIC_SUPABASE_URL");
const SERVICE_KEY = requerida("SUPABASE_SERVICE_ROLE_KEY");

// Las credenciales de correo solo se exigen cuando se va a ENVIAR. La
// simulación (el modo por defecto) únicamente lee la base y cuenta a quién
// se le avisaría, así que pedirlas ahí impediría revisar la lista en un
// entorno donde Resend todavía no está configurado — que es justo el caso
// hoy en local.
const RESEND_API_KEY = SOLO_SIMULAR ? "" : requerida("RESEND_API_KEY");
const FROM = SOLO_SIMULAR ? "" : requerida("RESEND_FROM_EMAIL");
// A diferencia de un Server Action, este script no tiene ninguna petición
// entrante de la que derivar el origen: sin la variable no hay forma de armar
// el enlace de renovación del correo.
const SITE_URL = SOLO_SIMULAR
  ? (process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, "") ?? "http://localhost:3000")
  : requerida(
      "NEXT_PUBLIC_SITE_URL",
      "es el origen con el que se arma el enlace del correo",
    ).replace(/\/+$/, "");

/**
 * Con cuántos días de antelación se avisa. Es el mismo umbral con el que la
 * interfaz ya muestra "por vencer" (`UMBRAL_AVISO_DIAS` en
 * src/lib/estadoAcceso.ts): si el correo y la pantalla no coincidieran, el
 * estudiante recibiría un aviso sin ver nada en su cuenta, o al revés.
 */
const DIAS_ANTELACION = 7;

const admin = createClient(URL_SUPABASE, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const resend = new Resend(RESEND_API_KEY);

async function main() {
  // Candidatas: suscripciones de PAGO (las de invitación y las manuales las
  // otorga alguien, no se renuevan comprando) que siguen vigentes, tienen
  // fecha de fin y a las que no se les ha avisado todavía.
  const { data: suscripciones, error } = await admin
    .from("suscripciones")
    .select(
      "id, fecha_renovacion, id_usuario, plan:planes(nombre), perfil:perfiles!suscripciones_id_usuario_fkey(nombre, correo)",
    )
    .in("estado", ["ACTIVA", "PAST_DUE"])
    .in("proveedor", ["wompi", "stripe"])
    .is("aviso_vencimiento_en", null)
    .not("fecha_renovacion", "is", null);

  if (error) {
    console.error(`\n❌ No se pudieron leer las suscripciones: ${error.message}\n`);
    process.exit(1);
  }

  const candidatas = suscripciones ?? [];
  console.log(`\n${candidatas.length} suscripción(es) de pago sin aviso enviado.`);

  const ahora = new Date();
  let enviados = 0;
  let fallidos = 0;
  let omitidos = 0;

  for (const suscripcion of candidatas) {
    const dias = calcularDiasVigencia(suscripcion.fecha_renovacion, ahora);

    // `calcularDiasVigencia` devuelve negativo si ya pasó. No se avisa de un
    // vencimiento que ya ocurrió: ese estudiante no necesita un aviso, ya se
    // topó con el muro. Tampoco se avisa demasiado pronto.
    if (dias === null || dias < 0 || dias > DIAS_ANTELACION) {
      omitidos++;
      continue;
    }

    const perfil = Array.isArray(suscripcion.perfil) ? suscripcion.perfil[0] : suscripcion.perfil;
    const plan = Array.isArray(suscripcion.plan) ? suscripcion.plan[0] : suscripcion.plan;

    if (!perfil?.correo) {
      omitidos++;
      continue;
    }

    if (SOLO_SIMULAR) {
      console.log(`  [simulación] ${perfil.correo} — quedan ${dias} día(s)`);
      enviados++;
      continue;
    }

    const { error: errorEnvio } = await resend.emails.send({
      from: FROM,
      to: perfil.correo,
      subject:
        dias <= 0
          ? "Tu acceso a U.V.A termina hoy"
          : dias === 1
            ? "Tu acceso a U.V.A termina mañana"
            : `Tu acceso a U.V.A termina en ${dias} días`,
      react: VencimientoProximoEmail({
        nombre: perfil.nombre ?? "",
        planNombre: plan?.nombre ?? "Acceso U.V.A",
        diasRestantes: dias,
        fechaVencimiento: formatFecha(suscripcion.fecha_renovacion!),
        urlPlanes: `${SITE_URL}/dashboard/planes`,
      }),
    });

    if (errorEnvio) {
      console.error(`  FALLA ${perfil.correo} — ${errorEnvio.message}`);
      fallidos++;
      continue;
    }

    // Solo DESPUÉS de que Resend confirmó: si se marcara antes, un fallo de
    // envío dejaría al estudiante sin aviso y sin posibilidad de reintento.
    const { error: errorMarca } = await admin
      .from("suscripciones")
      .update({ aviso_vencimiento_en: new Date().toISOString() })
      .eq("id", suscripcion.id);

    if (errorMarca) {
      // El correo ya salió. Marcar es lo que falló, así que la próxima
      // corrida lo reenviará: molesto, pero mejor que no avisar.
      console.error(`  OJO  ${perfil.correo} — enviado pero no se pudo marcar: ${errorMarca.message}`);
    }

    console.log(`  OK   ${perfil.correo} — quedan ${dias} día(s)`);
    enviados++;
  }

  console.log(
    `\n${SOLO_SIMULAR ? "Simulación" : "Envío"}: ${enviados} aviso(s), ` +
      `${fallidos} fallido(s), ${omitidos} fuera de ventana.`,
  );
  if (SOLO_SIMULAR) {
    console.log("Para enviar de verdad:\n  npm run pagos:avisar-vencimientos -- --enviar\n");
  }
  if (fallidos > 0) process.exitCode = 1;
}

void main().catch((error) => {
  console.error("\n❌ Error inesperado:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
