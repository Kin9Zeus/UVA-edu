import { createAdminClient } from "@/lib/supabase/admin";
import { clientIp } from "@/lib/clientIp";
import { logError } from "@/lib/log";
import { duracionCertificadoTexto } from "@/lib/certificados/duracion";

export type ResultadoVerificacion =
  | { estado: "bloqueado"; segundosEspera: number }
  | { estado: "no-encontrado" }
  | {
      estado: "valido";
      nombreEstudiante: string;
      nombreCurso: string;
      fechaEmision: string;
      /** "12 horas de teoría y práctica", igual que el PDF; null si el curso no tiene videos listos. */
      duracionTexto: string | null;
      /** Solo si el curso sigue publicado; si no, no hay ficha a la que enlazar. */
      cursoSlug: string | null;
    }
  | { estado: "error" };

type FilaVerificacion = {
  valido: boolean;
  nombre_estudiante: string | null;
  nombre_curso: string | null;
  fecha_emision: string | null;
  duracion_total_segundos: number | string | null;
  curso_slug: string | null;
};

function fallo(paso: string, error: unknown): ResultadoVerificacion {
  logError("verificarCertificado", `Falló ${paso}`, error, { area: "certificados" });
  return { estado: "error" };
}

/**
 * Verificación pública de un certificado (Certificado.md): sin sesión, solo
 * confirma nombre, curso, intensidad y fecha. Nunca correo ni ids internos.
 *
 * El límite es por IP (mismo motivo que check_email_provider, 023): quien
 * enumera códigos no repite el mismo, así que limitar por código no frena
 * nada. La IP sale de `clientIp()`, que lee `x-forwarded-for` desde la
 * derecha (AUDIT-2026-09-04.md, P1-2).
 *
 * `verificar_certificado` (050, 123) solo la puede llamar `service_role`, así
 * que se usa el admin client DESPUÉS de pasar el límite, nunca antes.
 *
 * Falla cerrado: si no se puede comprobar o registrar el intento, no se
 * verifica. Seguir sin registrarlo dejaría enumerar códigos sin límite
 * mientras dure el fallo.
 */
export async function verificarCertificado(codigo: string): Promise<ResultadoVerificacion> {
  const admin = createAdminClient();
  const ip = await clientIp();

  const { data: limite, error: errorLimite } = await admin
    .rpc("verificar_limite_certificado", { p_ip: ip })
    .single();
  if (errorLimite || !limite) return fallo("la consulta del límite de intentos", errorLimite);

  const fila = limite as { permitido: boolean; segundos_espera: number };
  if (!fila.permitido) {
    return { estado: "bloqueado", segundosEspera: fila.segundos_espera };
  }

  const { error: errorRegistro } = await admin.rpc("registrar_intento_verificar_certificado", { p_ip: ip });
  if (errorRegistro) return fallo("el registro del intento", errorRegistro);

  const { data, error } = await admin.rpc("verificar_certificado", { p_codigo: codigo });
  if (error || !data || data.length === 0) return fallo("la verificación del código", error);

  const [resultado] = data as FilaVerificacion[];
  if (!resultado.valido) return { estado: "no-encontrado" };

  return {
    estado: "valido",
    nombreEstudiante: resultado.nombre_estudiante!,
    nombreCurso: resultado.nombre_curso!,
    fechaEmision: resultado.fecha_emision!,
    duracionTexto: duracionCertificadoTexto(Number(resultado.duracion_total_segundos ?? 0)),
    cursoSlug: resultado.curso_slug,
  };
}
