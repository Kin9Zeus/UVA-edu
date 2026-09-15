/**
 * Regenera y resube el PDF de cada certificado que ya tiene `archivo_pdf`
 * cacheado en Storage (`certificados.archivo_pdf IS NOT NULL`), usando la
 * versión actual de `construirCertificadoPdf` (src/lib/certificados/pdf.ts).
 *
 * Uso: npm run certificados:regenerar-pdf
 *
 * Por qué existe
 * ---------------
 * `descargarCertificadoPdf` (src/actions/certificados/descargar.ts) genera
 * el PDF una sola vez y lo cachea en Storage — a propósito, para "no
 * regenerar en cada descarga" (048_registrar_archivo_certificado.sql). Eso
 * significa que un cambio de diseño del certificado (como el rediseño
 * pixel-a-pixel del handoff de Canva, 2026-09-14) no le llega a un
 * estudiante que ya tenía su PDF cacheado hasta que ese caché se invalide:
 * la única vía normal es limpiar `archivo_pdf` y esperar la próxima
 * descarga. Este script en cambio regenera de una vez, ahora mismo, para
 * no depender de que cada estudiante vuelva a entrar a
 * /dashboard/certificados.
 *
 * Sube el PDF nuevo a la MISMA ruta (`upsert: true`) y dejar `archivo_pdf`
 * como estaba — no hace falta tocar esa columna, el archivo cacheado ya es
 * el correcto en cuanto termina de subir.
 *
 * Idempotente: correrlo de nuevo simplemente regenera los mismos archivos
 * con los mismos datos (no hay ningún campo que "consuma" o marque el
 * certificado como ya procesado), así que sirve tanto para este rediseño
 * puntual como para el próximo que haga falta.
 */

try {
  process.loadEnvFile(".env.local");
} catch {
  // Sin archivo (Railway/CI): se usan las variables ya presentes en process.env.
}

import { createClient } from "@supabase/supabase-js";
import { construirCertificadoPdf } from "../src/lib/certificados/pdf";

const URL_SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL;

if (!URL_SUPABASE || !SERVICE_KEY) {
  console.error("\n❌ Faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en .env.local.\n");
  process.exit(1);
}
if (!SITE_URL) {
  console.error("\n❌ Falta NEXT_PUBLIC_SITE_URL en .env.local (URL pública del sitio, sin barra final) — es la que arma el QR.\n");
  process.exit(1);
}

const supabase = createClient(URL_SUPABASE, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const BUCKET_CERTIFICADOS = "certificados";
const origin = SITE_URL.replace(/\/+$/, "");

async function main() {
  const { data: certificados, error } = await supabase
    .from("certificados")
    .select("id, id_usuario, id_curso, nombre_estudiante, nombre_curso, fecha_emision, codigo_verificacion, archivo_pdf")
    .not("archivo_pdf", "is", null);

  if (error) {
    console.error(`\n❌ No pude leer los certificados con PDF cacheado: ${error.message}\n`);
    process.exit(1);
  }

  if (!certificados || certificados.length === 0) {
    console.log("\n✅ Ningún certificado tiene un PDF cacheado todavía — nada que regenerar.\n");
    return;
  }

  console.log(`\nRegenerando ${certificados.length} certificado(s)...\n`);

  let ok = 0;
  let fallidos = 0;

  for (const cert of certificados) {
    try {
      const { data: lecciones, error: errorLecciones } = await supabase
        .from("lecciones")
        .select("duracion, modulo:modulos!inner(id_curso)")
        .eq("modulo.id_curso", cert.id_curso)
        .eq("estado_procesamiento", "LISTO");
      if (errorLecciones) throw new Error(`lecciones: ${errorLecciones.message}`);

      const totalSegundos = (lecciones ?? []).reduce((acc, fila) => acc + (fila.duracion ?? 0), 0);
      const horas = Math.round(totalSegundos / 3600);
      const duracionTexto = horas > 0 ? `${horas} ${horas === 1 ? "hora" : "horas"} de teoría y práctica` : null;

      const urlVerificacionQr = `${origin}/verificar-certificado/${cert.codigo_verificacion}`;
      const urlVerificacion = urlVerificacionQr.replace(/^https?:\/\//, "");

      const pdfBytes = await construirCertificadoPdf({
        nombreEstudiante: cert.nombre_estudiante,
        cursoTitulo: cert.nombre_curso,
        fechaEmision: new Date(cert.fecha_emision),
        duracionTexto,
        codigoVerificacion: cert.codigo_verificacion,
        urlVerificacion,
        urlVerificacionQr,
      });

      const rutaArchivo = cert.archivo_pdf as string;
      const { error: errorSubida } = await supabase.storage
        .from(BUCKET_CERTIFICADOS)
        .upload(rutaArchivo, pdfBytes, { contentType: "application/pdf", upsert: true });
      if (errorSubida) throw new Error(`storage: ${errorSubida.message}`);

      ok += 1;
      console.log(`✅ ${cert.id} — ${cert.nombre_estudiante} / ${cert.nombre_curso}`);
    } catch (err) {
      fallidos += 1;
      console.error(`❌ ${cert.id} — ${err instanceof Error ? err.message : err}`);
    }
  }

  console.log(`\n${ok} regenerado(s), ${fallidos} fallido(s) de ${certificados.length}.`);
  if (fallidos > 0) process.exitCode = 1;
  else console.log("");
}

main().catch((error) => {
  console.error("\n❌ Error inesperado:", error);
  process.exit(1);
});
