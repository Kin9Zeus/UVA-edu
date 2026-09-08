"use server";

import { createClient } from "@/lib/supabase/server";
import { getPerfilActual } from "@/lib/perfil";
import { construirCertificadoPdf } from "@/lib/certificados/pdf";
import { siteUrl } from "@/lib/site-url";
import { logError } from "@/lib/log";

const BUCKET_CERTIFICADOS = "certificados";
const DURACION_URL_SEGUNDOS = 300;

export type DescargarCertificadoResult = { url?: string; error?: string };

/**
 * Devuelve una URL firmada al PDF del certificado, generándolo (y
 * cacheándolo en Storage) la primera vez que se pide — Certificado.md:
 * "generar bajo demanda y cachear... no regenerar en cada descarga". Todas
 * las operaciones usan la sesión propia del estudiante (RLS), nunca la
 * Service Role Key: `certificados_select_propio` (001) ya impide traer un
 * certificado ajeno, y las policies de storage.objects de 049 acotan el
 * bucket al mismo `auth.uid()`.
 */
export async function descargarCertificadoPdf(certificadoId: string): Promise<DescargarCertificadoResult> {
  const { user, perfil } = await getPerfilActual();
  if (!user || !perfil) return { error: "Debes iniciar sesión para descargar tu certificado." };

  const supabase = await createClient();

  const { data: certificado, error: errorCertificado } = await supabase
    .from("certificados")
    .select("id, id_curso, fecha_emision, codigo_verificacion, archivo_pdf, nombre_estudiante, nombre_curso")
    .eq("id", certificadoId)
    .maybeSingle();

  if (errorCertificado || !certificado) {
    return { error: "No encontramos ese certificado." };
  }

  const rutaArchivo = `${user.id}/${certificado.id}.pdf`;

  if (!certificado.archivo_pdf) {
    // El origen sale de la configuración del despliegue, nunca del header
    // `Host` (P1-1, AUDIT-2026-09-04.md). Aquí importa más que en los correos:
    // el PDF se cachea en Storage y se descarga durante años, así que un
    // origen envenenado no caduca — quien escanea el QR meses después (un
    // empleador verificando el título) acabaría en el dominio del atacante.
    const origin = siteUrl();
    // El diseño (Uva - Certificado.dc.html) muestra la URL sin protocolo
    // ("uva.co/verificar/@daniela" en el mockup) — esa es la que se
    // imprime como texto. El QR necesita la URL completa y real para que
    // escanearla funcione.
    const urlVerificacionQr = `${origin}/verificar-certificado/${certificado.codigo_verificacion}`;
    const urlVerificacion = urlVerificacionQr.replace(/^https?:\/\//, "");

    const { data: lecciones } = await supabase
      .from("lecciones")
      .select("duracion, modulo:modulos!inner(id_curso)")
      .eq("modulo.id_curso", certificado.id_curso)
      .eq("estado_procesamiento", "LISTO");
    const totalSegundos = (lecciones ?? []).reduce((acc, fila) => acc + (fila.duracion ?? 0), 0);
    const horas = Math.round(totalSegundos / 3600);
    const duracionTexto = horas > 0 ? `${horas} ${horas === 1 ? "hora" : "horas"} de teoría y práctica` : null;

    let pdfBytes: Uint8Array;
    try {
      pdfBytes = await construirCertificadoPdf({
        nombreEstudiante: certificado.nombre_estudiante,
        cursoTitulo: certificado.nombre_curso,
        fechaEmision: new Date(certificado.fecha_emision),
        duracionTexto,
        codigoVerificacion: certificado.codigo_verificacion,
        urlVerificacion,
        urlVerificacionQr,
      });
    } catch (error) {
      logError("descargarCertificadoPdf", "No se pudo construir el PDF", error, { area: "certificados" });
      return { error: "No pudimos generar tu certificado. Intenta de nuevo." };
    }

    const { error: errorSubida } = await supabase.storage
      .from(BUCKET_CERTIFICADOS)
      .upload(rutaArchivo, pdfBytes, { contentType: "application/pdf", upsert: true });

    if (errorSubida) {
      logError("descargarCertificadoPdf", "No se pudo subir el PDF a Storage", errorSubida, { area: "certificados" });
      return { error: "No pudimos guardar tu certificado. Intenta de nuevo." };
    }

    const { error: errorRegistro } = await supabase.rpc("registrar_archivo_certificado", {
      p_certificado_id: certificado.id,
      p_archivo_pdf: rutaArchivo,
    });
    if (errorRegistro) {
      // El PDF ya quedó subido y es descargable — no perder la descarga
      // por esto. La próxima vez `archivo_pdf` seguirá null y se
      // regenerará (mismo resultado, solo repite el trabajo de armar el
      // PDF una vez más).
      logError("descargarCertificadoPdf", "No se pudo registrar archivo_pdf", errorRegistro, { area: "certificados" });
    }
  }

  const { data: firmada, error: errorFirma } = await supabase.storage
    .from(BUCKET_CERTIFICADOS)
    .createSignedUrl(rutaArchivo, DURACION_URL_SEGUNDOS, { download: `certificado-uva-${certificado.codigo_verificacion}.pdf` });

  if (errorFirma || !firmada) {
    logError("descargarCertificadoPdf", "No se pudo firmar la URL de descarga", errorFirma, { area: "certificados" });
    return { error: "No pudimos generar el enlace de descarga." };
  }

  return { url: firmada.signedUrl };
}
