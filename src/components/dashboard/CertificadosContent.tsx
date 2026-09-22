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
    <div className="flex max-w-[1080px] flex-col gap-6 px-[clamp(20px,3vw,44px)] py-8">
      <h1 className="text-2xl text-uva-text">Mis certificados</h1>

      {certificados.length === 0 ? (
        <div className="rounded-uva-md border border-uva-divider bg-uva-surface p-8 text-center">
          <Award className="mx-auto size-8 text-uva-text-faint" strokeWidth={1.6} />
          <p className="mt-3 text-sm text-uva-text-muted">
            Todavía no tienes certificados. Termina un curso completo para ganar el tuyo.
          </p>
        </div>
      ) : (
        // Cada certificado es una lámina de diploma con proporción fija
        // (`aspect-[4/3]`). Si un título largo necesita más alto, la lámina
        // crece lo justo y las de su misma fila se igualan a ella.
        <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {certificados.map((certificado) => (
            <li
              key={certificado.id}
              className="relative flex aspect-[4/3] flex-col items-center rounded-uva-md border border-uva-divider bg-uva-surface px-5 pt-5 pb-3.5 text-center"
            >
              {/* Marco interior fino: el "sello" de diploma. */}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-1.5 rounded-[3px] border border-uva-divider"
              />

              <div className="flex size-8 items-center justify-center rounded-full bg-uva-accent font-heading text-sm text-[#09090B]">
                U
              </div>
              <span className="mt-2 text-[10px] tracking-[.18em] text-uva-accent-2-text uppercase">
                Certificado Uva
              </span>

              {/* El título se muestra completo (sin recorte). La fecha va
                  anclada abajo con `mt-auto`: queda en la misma posición en
                  todos los certificados de una misma fila. */}
              <p className="mt-3 font-heading text-[15px] leading-[1.25] text-uva-text">
                {certificado.cursoTitulo}
              </p>
              <p className="mt-auto mb-2.5 text-xs text-uva-text-faint">
                Emitido el {formatFecha(certificado.fechaEmision)}
              </p>

              <div className="relative flex w-full items-center gap-2 border-t border-uva-divider pt-2">
                <span className="font-mono text-[11px] text-uva-text-faint">
                  {certificado.codigoVerificacion}
                </span>
                <DescargarCertificadoButton certificadoId={certificado.id} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
