import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AccionesCertificado } from "@/components/dashboard/AccionesCertificado";
import { CurvasCertificado, MiniaturaCertificado } from "@/components/dashboard/MiniaturaCertificado";

export type CertificadoItem = {
  id: string;
  cursoTitulo: string;
  nombreEstudiante: string;
  fechaEmision: string;
  codigoVerificacion: string;
  /** "12 horas de teoría y práctica", o null si el curso no tiene duración registrada (o no se pudo leer). */
  duracionTexto: string | null;
  /** Horas del curso para el total de arriba (0 si no hay dato). */
  horas: number;
  urlVerificacion: string;
};

const ZONA = "America/Bogota";
const FECHA_LARGA = new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "long", year: "numeric", timeZone: ZONA });
const FECHA_CORTA = new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", year: "numeric", timeZone: ZONA });

/** "18 sep 2026", sin los "de" ni el punto de es-CO. */
function fechaCorta(iso: string) {
  const partes = FECHA_CORTA.formatToParts(new Date(iso));
  const parte = (tipo: string) => partes.find((p) => p.type === tipo)?.value.replace(".", "") ?? "";
  return `${parte("day")} ${parte("month")} ${parte("year")}`;
}

function Cifra({ valor, etiqueta }: { valor: string; etiqueta: string }) {
  return (
    <div className="flex flex-col-reverse pt-4 pr-3 not-first:border-l not-first:border-uva-divider not-first:pl-3 lg:pt-5 lg:pr-[22px] lg:not-first:pl-[22px]">
      <dt className="mt-0.5 text-uva-detalle text-uva-text-muted">{etiqueta}</dt>
      <dd className="font-mono text-uva-titulo-4 font-extrabold text-uva-text lg:text-uva-titulo-3">{valor}</dd>
    </div>
  );
}

export function CertificadosContent({ certificados }: { certificados: CertificadoItem[] }) {
  const totalHoras = certificados.reduce((total, certificado) => total + certificado.horas, 0);

  return (
    <div className="mx-auto flex w-full max-w-uva flex-col gap-6 px-uva-margen py-7 lg:gap-8 lg:py-9">
      <div>
        <h1 className="text-uva-titulo-3 text-uva-text">Mis certificados</h1>
        <p className="mt-2 max-w-[44em] text-uva-lead text-uva-text-muted">
          Los cursos que aprobaste. Descarga el PDF o comparte el enlace para que cualquiera compruebe que es tuyo.
        </p>
      </div>

      {certificados.length === 0 ? (
        <div className="flex flex-col items-start gap-3 rounded-uva-lg border border-uva-divider bg-uva-surface p-6">
          <p className="text-uva-cuerpo text-uva-text-muted">
            Todavía no tienes certificados. Termina un curso completo para ganar el tuyo.
          </p>
          <Button
            render={<Link href="/dashboard/progreso" />}
            nativeButton={false}
            variant="uva-primary"
            size="uva"
            className="min-h-11 text-uva-cuerpo sm:w-auto"
          >
            Ver tu progreso
          </Button>
        </div>
      ) : (
        <>
          <dl className="grid grid-cols-3 border-t border-uva-divider">
            <Cifra valor={String(certificados.length)} etiqueta={certificados.length === 1 ? "certificado" : "certificados"} />
            <Cifra valor={`${totalHoras} h`} etiqueta="de teoría y práctica" />
            <Cifra valor={fechaCorta(certificados[0].fechaEmision)} etiqueta="el más reciente" />
          </dl>

          <CurvasCertificado />
          <ul className="border-b border-uva-divider">
            {certificados.map((certificado) => (
              <li
                key={certificado.id}
                className="grid gap-3.5 border-t border-uva-divider py-5 lg:grid-cols-[200px_minmax(0,1fr)_auto] lg:items-center lg:gap-[22px]"
              >
                <div
                  role="img"
                  aria-label={`Vista previa del certificado de ${certificado.cursoTitulo}`}
                  className="overflow-hidden rounded-uva-sm border border-uva-divider"
                >
                  <MiniaturaCertificado
                    nombre={certificado.nombreEstudiante}
                    curso={certificado.cursoTitulo}
                    fechaEmision={certificado.fechaEmision}
                    duracionTexto={certificado.duracionTexto}
                    codigo={certificado.codigoVerificacion}
                    className="block h-auto w-full"
                  />
                </div>
                <div className="grid min-w-0 content-center gap-1">
                  <h2 className="text-uva-cuerpo leading-snug font-extrabold text-uva-text">{certificado.cursoTitulo}</h2>
                  <p className="text-uva-cuerpo text-uva-text-muted">
                    Emitido el {FECHA_LARGA.format(new Date(certificado.fechaEmision))}
                  </p>
                  {certificado.duracionTexto && (
                    <p className="text-uva-cuerpo text-uva-text-muted">{certificado.duracionTexto}</p>
                  )}
                  <p className="text-uva-cuerpo text-uva-text-muted">
                    Código{" "}
                    <span className="font-codigo font-bold tracking-[0.06em] text-uva-text">
                      {certificado.codigoVerificacion}
                    </span>
                  </p>
                </div>
                <AccionesCertificado certificadoId={certificado.id} urlVerificacion={certificado.urlVerificacion} />
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
