/**
 * Envía el correo de "certificado listo" para cada fila de `certificados`
 * con `notificado_en IS NULL`, y marca `notificado_en = now()` al enviarlo
 * con éxito.
 *
 * Uso: npm run certificados:notificar
 *
 * Por qué existe (Deteccion.md, Fase 5 — requisitos de calidad senior)
 * -------------------------------------------------------------------
 * "La emisión no puede bloquear la interfaz: procesar de forma asíncrona y
 * notificar cuando esté listo." La emisión en sí ya es asíncrona respecto a
 * la navegación del estudiante (trigger de BD sobre `progreso`, SQL 047),
 * pero ese trigger corre SECURITY DEFINER en la sesión del propio
 * estudiante — Postgres no puede hacer una llamada HTTP saliente a Resend
 * sin sumar una extensión adicional (pg_net) y guardar una API key fuera
 * del entorno de la aplicación, más superficie por un correo que no es
 * parte del camino caliente de nada.
 *
 * En vez de eso, `certificados.notificado_en` (NULL = pendiente) actúa
 * como outbox: este script barre los certificados pendientes y envía el
 * correo desde el mismo entorno Next.js/Resend que ya maneja el resto de
 * correos transaccionales (RESEND_API_KEY vive solo ahí, nunca en la base
 * de datos). Mismo patrón que `mux_assets_pendientes_eliminacion` /
 * mux-limpiar-assets.ts: una cola en la tabla, drenada por un script
 * idempotente pensado para correr a mano o programado (cron de Railway,
 * GitHub Actions con schedule) — no necesita que el trigger, el estudiante
 * y el dominio de la app coincidan en el tiempo.
 *
 * No usa src/lib/resend.ts (el wrapper compartido) a propósito: ese módulo
 * y src/lib/resend/client.ts leen RESEND_API_KEY de process.env en su
 * ámbito de módulo, y un import estático se resuelve ANTES que
 * loadEnvFile() de abajo (hoisting de ESM) — llegaría con la key vacía.
 * Mismo motivo por el que mux-limpiar-assets.ts arma su propio cliente de
 * Mux en vez de importar src/lib/mux/client.ts. El template de correo
 * (src/emails/certificado-emitido.tsx) sí se importa directo: es un
 * componente puro, sin ninguna lectura de process.env.
 *
 * Requiere NEXT_PUBLIC_SITE_URL para armar el link del correo — a
 * diferencia de descargarCertificadoPdf (que deriva el origin de los
 * headers de la request entrante), este script no tiene ninguna request
 * de la que partir.
 *
 * Idempotente y seguro de reintentar: una fila solo se marca
 * `notificado_en` después de un envío exitoso de Resend; si el envío
 * falla, la fila queda pendiente para la próxima corrida. La única ventana
 * de duplicado es la inversa (el correo se envía pero el UPDATE que marca
 * `notificado_en` falla) — se loguea como advertencia, igual que
 * mux-limpiar-assets.ts acepta el mismo riesgo simétrico al borrar en Mux
 * y no poder marcar la fila.
 *
 * Sale con código 1 si algún envío falló, para poder usarse como chequeo
 * de monitoreo (¿la cola se está vaciando o se está acumulando?).
 */

process.loadEnvFile(".env.local");

import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { CertificadoEmitidoEmail } from "../src/emails/certificado-emitido";

const URL_SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL;

if (!URL_SUPABASE || !SERVICE_KEY) {
  console.error("\n❌ Faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en .env.local.\n");
  process.exit(1);
}
if (!RESEND_API_KEY) {
  console.error("\n❌ Falta RESEND_API_KEY en .env.local.\n");
  process.exit(1);
}
if (!SITE_URL) {
  console.error("\n❌ Falta NEXT_PUBLIC_SITE_URL en .env.local (URL pública del sitio, sin barra final).\n");
  process.exit(1);
}

const supabase = createClient(URL_SUPABASE, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const resend = new Resend(RESEND_API_KEY);

const LOTE = 50;
const URL_CERTIFICADOS = `${SITE_URL.replace(/\/$/, "")}/dashboard/certificados`;

async function main() {
  const { data: pendientes, error } = await supabase
    .from("certificados")
    .select("id, id_usuario, nombre_estudiante, nombre_curso, codigo_verificacion")
    .is("notificado_en", null)
    .limit(LOTE);

  if (error) {
    console.error(`\n❌ No pude leer certificados pendientes de notificar: ${error.message}\n`);
    process.exit(1);
  }

  if (!pendientes || pendientes.length === 0) {
    console.log("\n✅ No hay certificados pendientes de notificar.\n");
    return;
  }

  console.log(`\nNotificando ${pendientes.length} certificado(s)...\n`);

  let enviados = 0;
  let fallidos = 0;

  for (const fila of pendientes) {
    const { data: perfil, error: errorPerfil } = await supabase
      .from("perfiles")
      .select("correo")
      .eq("id", fila.id_usuario)
      .maybeSingle();

    if (errorPerfil || !perfil) {
      fallidos += 1;
      console.error(
        `❌ ${fila.id} — no pude leer el correo del estudiante: ${errorPerfil?.message ?? "perfil no encontrado"}`,
      );
      continue;
    }

    const { error: errorEnvio } = await resend.emails.send({
      // Mismo remitente que src/lib/resend.ts: uvarq.com está verificado
      // en Resend (SPF/DKIM/DMARC OK).
      from: "U.V.A <noreply@uvarq.com>",
      to: perfil.correo,
      subject: `Tu certificado de ${fila.nombre_curso} ya está listo`,
      react: CertificadoEmitidoEmail({
        nombre: fila.nombre_estudiante,
        cursoTitulo: fila.nombre_curso,
        codigoVerificacion: fila.codigo_verificacion,
        urlCertificados: URL_CERTIFICADOS,
      }),
    });

    if (errorEnvio) {
      fallidos += 1;
      console.error(`❌ ${fila.id} — ${errorEnvio.message}`);
      continue;
    }

    const { error: errorUpdate } = await supabase
      .from("certificados")
      .update({ notificado_en: new Date().toISOString() })
      .eq("id", fila.id);

    if (errorUpdate) {
      fallidos += 1;
      console.error(`⚠️  ${fila.id} — el correo se envió pero no pude marcar notificado_en: ${errorUpdate.message}`);
    } else {
      enviados += 1;
      console.log(`✅ ${fila.id} (${perfil.correo})`);
    }
  }

  console.log(`\n${enviados} enviado(s), ${fallidos} fallido(s) de ${pendientes.length}.`);
  if (fallidos > 0) {
    console.log("   Las filas fallidas se quedan pendientes para la próxima corrida.\n");
    process.exitCode = 1;
  } else {
    console.log("");
  }
}

main().catch((error) => {
  console.error("\n❌ Error inesperado:", error);
  process.exit(1);
});
