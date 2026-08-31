import { Award } from "lucide-react";
import { formatFecha } from "@/lib/admin/format";
import { DescargarCertificadoButton } from "@/components/dashboard/DescargarCertificadoButton";

export type CertificadoItem = {
  id: string;
  cursoTitulo: string;
  fechaEmision: string;
  codigoVerificacion: string;
};

export function CertificadosContent({ certificados }: { certificados: CertificadoItem[] }) {
  return (
    <div className="mx-auto flex max-w-[1080px] flex-col gap-6 px-[clamp(20px,3vw,44px)] py-8">
      <h1 className="text-2xl text-uva-text">Mis certificados</h1>

      {certificados.length === 0 ? (
        <div className="rounded-uva-md border border-uva-divider bg-uva-surface p-8 text-center">
          <Award className="mx-auto size-8 text-uva-text-faint" strokeWidth={1.6} />
          <p className="mt-3 text-sm text-uva-text-muted">
            Todavía no tienes certificados. Termina un curso completo para ganar el tuyo.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {certificados.map((certificado) => (
            <div
              key={certificado.id}
              className="flex flex-col overflow-hidden rounded-uva-md border border-uva-divider bg-uva-surface"
            >
              <div className="border-b border-uva-divider bg-[linear-gradient(150deg,color-mix(in_srgb,var(--uva-accent)_20%,transparent),transparent)] p-5">
                <div className="mb-4 flex items-center gap-2">
                  <div className="flex size-6 items-center justify-center rounded-full bg-uva-accent font-heading text-xs text-[#09090B]">
                    U
                  </div>
                  <span className="text-[11px] tracking-[.14em] text-uva-text-faint uppercase">
                    Certificado Uva
                  </span>
                </div>
                <p className="font-heading text-[17px] leading-[1.2] text-uva-text">
                  {certificado.cursoTitulo}
                </p>
                <p className="mt-1.5 text-xs text-uva-text-faint">
                  Emitido el {formatFecha(certificado.fechaEmision)}
                </p>
              </div>
              <div className="flex items-center gap-2 px-5 py-3.5">
                <span className="font-mono text-[11px] text-uva-text-faint">
                  {certificado.codigoVerificacion}
                </span>
                <DescargarCertificadoButton certificadoId={certificado.id} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
