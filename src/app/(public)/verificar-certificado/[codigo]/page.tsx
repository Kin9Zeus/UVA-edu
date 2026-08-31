import type { Metadata } from "next";
import { headers } from "next/headers";
import { ShieldCheck, ShieldX } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatFecha } from "@/lib/admin/format";

export const metadata: Metadata = { title: "U.V.A. — Verificar certificado" };

/**
 * Página pública de verificación (Certificado.md): sin sesión, solo
 * confirma nombre/curso/fecha — nunca correo ni id interno. El límite es
 * por IP (mismo motivo que check_email_provider, 023): quien enumera
 * códigos no repite el mismo, así que limitar por código no frena nada.
 *
 * `verificar_certificado` (endurecida en 050) ya no es invocable por
 * `anon`/`authenticated` — solo por `service_role`, así que esta página usa
 * el admin client DESPUÉS de pasar el límite, nunca antes.
 */
async function getClientIp(): Promise<string> {
  const headersList = await headers();
  const forwardedFor = headersList.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0].trim();
  return headersList.get("x-real-ip") ?? "unknown";
}

type ResultadoVerificacion =
  | { estado: "bloqueado"; segundosEspera: number }
  | { estado: "no-encontrado" }
  | { estado: "valido"; nombreEstudiante: string; nombreCurso: string; fechaEmision: string }
  | { estado: "error" };

async function verificar(codigo: string): Promise<ResultadoVerificacion> {
  const admin = createAdminClient();
  const ip = await getClientIp();

  const { data: limite, error: errorLimite } = await admin
    .rpc("verificar_limite_certificado", { p_ip: ip })
    .single();
  if (errorLimite) return { estado: "error" };

  const fila = limite as { permitido: boolean; segundos_espera: number };
  if (!fila.permitido) {
    return { estado: "bloqueado", segundosEspera: fila.segundos_espera };
  }

  await admin.rpc("registrar_intento_verificar_certificado", { p_ip: ip });

  const { data, error } = await admin.rpc("verificar_certificado", { p_codigo: codigo });
  if (error || !data || data.length === 0) return { estado: "error" };

  const [resultado] = data as {
    valido: boolean;
    nombre_estudiante: string | null;
    nombre_curso: string | null;
    fecha_emision: string | null;
  }[];

  if (!resultado.valido) return { estado: "no-encontrado" };

  return {
    estado: "valido",
    nombreEstudiante: resultado.nombre_estudiante!,
    nombreCurso: resultado.nombre_curso!,
    fechaEmision: resultado.fecha_emision!,
  };
}

export default async function VerificarCertificadoPage({
  params,
}: {
  params: Promise<{ codigo: string }>;
}) {
  const { codigo } = await params;
  const resultado = await verificar(codigo);

  return (
    <div className="grid min-h-screen place-items-center bg-uva-bg p-6">
      <div className="w-full max-w-[440px] rounded-uva-md border border-uva-divider bg-uva-surface p-8 text-center">
        <div className="mb-4 flex items-center justify-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-full bg-uva-accent font-heading text-xs text-[#09090B]">
            U
          </div>
          <span className="text-[11px] tracking-[.14em] text-uva-text-faint uppercase">
            Verificación de certificado UVA
          </span>
        </div>

        {resultado.estado === "valido" && (
          <>
            <ShieldCheck className="mx-auto mb-3 size-10 text-uva-accent-2-text" strokeWidth={1.6} />
            <h1 className="mb-1 text-xl text-uva-text">Certificado válido</h1>
            <p className="mb-5 text-sm text-uva-text-muted">Este código corresponde a un certificado real emitido por UVA.</p>
            <div className="flex flex-col gap-2 rounded-uva-md border border-uva-divider bg-uva-divider/40 p-4 text-left">
              <div>
                <p className="text-[11px] text-uva-text-faint uppercase">Estudiante</p>
                <p className="text-sm text-uva-text">{resultado.nombreEstudiante}</p>
              </div>
              <div>
                <p className="text-[11px] text-uva-text-faint uppercase">Curso</p>
                <p className="text-sm text-uva-text">{resultado.nombreCurso}</p>
              </div>
              <div>
                <p className="text-[11px] text-uva-text-faint uppercase">Fecha de emisión</p>
                <p className="text-sm text-uva-text">{formatFecha(resultado.fechaEmision)}</p>
              </div>
            </div>
          </>
        )}

        {resultado.estado === "no-encontrado" && (
          <>
            <ShieldX className="mx-auto mb-3 size-10 text-uva-text-faint" strokeWidth={1.6} />
            <h1 className="mb-1 text-xl text-uva-text">Certificado no encontrado</h1>
            <p className="text-sm text-uva-text-muted">
              No encontramos ningún certificado con este código. Revisa que lo hayas copiado completo.
            </p>
          </>
        )}

        {resultado.estado === "bloqueado" && (
          <>
            <ShieldX className="mx-auto mb-3 size-10 text-uva-text-faint" strokeWidth={1.6} />
            <h1 className="mb-1 text-xl text-uva-text">Demasiados intentos</h1>
            <p className="text-sm text-uva-text-muted">
              Espera un momento antes de volver a intentarlo ({Math.ceil(resultado.segundosEspera / 60)} min).
            </p>
          </>
        )}

        {resultado.estado === "error" && (
          <>
            <ShieldX className="mx-auto mb-3 size-10 text-uva-text-faint" strokeWidth={1.6} />
            <h1 className="mb-1 text-xl text-uva-text">No pudimos verificar el certificado</h1>
            <p className="text-sm text-uva-text-muted">Intenta de nuevo en unos minutos.</p>
          </>
        )}
      </div>
    </div>
  );
}
