import type { ReactNode } from "react";
import Link from "next/link";
import { Check, Search, ShieldAlert, ShieldCheck, ShieldX } from "lucide-react";
import { LogoUva } from "@/components/home/LogoUva";
import { VerificarCertificadoForm } from "@/components/home/VerificarCertificadoForm";
import {
  CurvasCertificado,
  MiniaturaCertificado,
} from "@/components/dashboard/MiniaturaCertificado";
import { buttonVariants } from "@/components/ui/button";
import type { ResultadoVerificacion } from "@/lib/certificados/verificar";
import { cn } from "@/lib/utils";

export type EstadoPantalla = ResultadoVerificacion | { estado: "buscar" };

const FECHA_LARGA = new Intl.DateTimeFormat("es-CO", {
  dateStyle: "long",
  timeZone: "America/Bogota",
});

const ID_AYUDA = "ayuda-codigo-certificado";

const FOCO =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-uva-accent";

/**
 * Verificación pública de un certificado (tableros "verificados" y
 * "verificado movil" del canvas UVA Cursos). Una tarjeta con cinco estados:
 * buscar (sin código), válido, no encontrado, demasiados intentos y error.
 *
 * Cabecera propia y mínima, sin el header del sitio: quien llega suele venir
 * del QR del certificado, no de navegar U.V.A.
 */
export function VerificacionCertificado({
  resultado,
  codigo,
}: {
  resultado: EstadoPantalla;
  codigo?: string;
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-uva-bg text-uva-text">
      <header className="border-b border-uva-divider">
        <div className="mx-auto flex max-w-uva items-center gap-4 px-4 py-2.5 md:px-10 md:py-3.5">
          <Link
            href="/"
            aria-label="U.V.A., ir al inicio"
            className={cn(
              "inline-flex min-h-11 items-center rounded-uva-xs text-uva-text",
              FOCO,
            )}
          >
            <LogoUva className="h-7 w-[86px]" />
          </Link>
          <span aria-hidden="true" className="h-[26px] w-px bg-uva-divider" />
          <p className="m-0 text-uva-detalle font-semibold text-uva-text-muted">
            <span className="sm:hidden">Verificación</span>
            <span className="hidden sm:inline">
              Verificación de certificados
            </span>
          </p>
          <Link
            href="/"
            className={cn(
              buttonVariants({ variant: "uva-secondary", size: "uva" }),
              "ml-auto hidden w-auto px-4 text-uva-detalle sm:inline-flex",
            )}
          >
            Ir a U.V.A.
          </Link>
        </div>
      </header>

      <main className="relative isolate flex-1 px-3 pt-4 pb-10 sm:px-6 md:pt-11">
        <div
          aria-hidden="true"
          className="uva-reticula pointer-events-none absolute inset-0 -z-10"
        />

        <div className="mx-auto grid max-w-[1040px] gap-5.5 rounded-uva-lg border border-uva-divider bg-uva-surface px-5 pt-6 pb-6.5 sm:p-8 lg:px-10 lg:py-9">
          {/* Apilados en celular, no `flex-wrap`: con un código corto, rótulo y
              píldora cabían o no en una línea según si JetBrains Mono (preload:
              false) ya había cargado, y el salto movía toda la tarjeta (CLS 0,19). */}
          <div className="flex flex-col items-start gap-3 border-b border-dashed border-uva-line-strong pb-4.5 sm:flex-row sm:items-center sm:justify-between">
            <p className="m-0 text-uva-detalle font-bold text-uva-text-muted">
              Verificación de certificado U.V.A.
            </p>
            {codigo && (
              <p className="m-0 inline-flex min-h-8 max-w-full items-center rounded-uva-sm border border-uva-divider bg-uva-surface-2 px-3 font-codigo text-uva-detalle font-medium tracking-[0.04em] break-all">
                <span className="sr-only">Código consultado: </span>
                {codigo}
              </p>
            )}
          </div>

          <Contenido resultado={resultado} codigo={codigo} />
        </div>

        <p className="mt-5.5 mb-0 text-center text-uva-detalle text-uva-text-muted">
          ¿Dudas sobre un certificado?{" "}
          <Link
            href="/soporte?tema=contacto"
            className={cn(
              "rounded-uva-xs text-uva-accent-ink underline underline-offset-3",
              FOCO,
            )}
          >
            Escríbenos desde Soporte
          </Link>
          .
        </p>
      </main>
    </div>
  );
}

function Contenido({
  resultado,
  codigo,
}: {
  resultado: EstadoPantalla;
  codigo?: string;
}) {
  switch (resultado.estado) {
    case "valido":
      return <Valido resultado={resultado} codigo={codigo ?? ""} />;

    case "no-encontrado":
      return (
        <>
          <Estado
            sello="invalido"
            icono={<ShieldX />}
            titulo="Certificado no encontrado"
          >
            {/* Sin repetir el código: ya está en la píldora y en el campo. */}
            No encontramos ningún certificado con ese código. Revisa que lo
            hayas copiado completo e inténtalo de nuevo.
          </Estado>
          <VerificarCertificadoForm
            variante="pagina"
            valorInicial={codigo}
            invalido
            textoBoton="Verificar de nuevo"
            ayudaId={ID_AYUDA}
          />
          <AyudaCodigo />
        </>
      );

    case "buscar":
      return (
        <>
          <Estado
            sello="neutro"
            icono={<Search />}
            titulo="Verifica un certificado"
          >
            Escribe el código que aparece en el certificado para confirmar que
            lo emitió U.V.A.
          </Estado>
          <VerificarCertificadoForm
            variante="pagina"
            textoBoton="Verificar certificado"
            ayudaId={ID_AYUDA}
          />
          <AyudaCodigo />
        </>
      );

    case "bloqueado": {
      const minutos = Math.max(1, Math.ceil(resultado.segundosEspera / 60));
      return (
        <Estado
          sello="neutro"
          icono={<ShieldAlert />}
          titulo="Demasiados intentos"
        >
          Hiciste muchas verificaciones seguidas. Espera {minutos}{" "}
          {minutos === 1 ? "minuto" : "minutos"} y vuelve a intentarlo.
        </Estado>
      );
    }

    case "error":
      return (
        <>
          <Estado
            sello="neutro"
            icono={<ShieldAlert />}
            titulo="No pudimos verificar el certificado"
          >
            El problema es nuestro, no del código. Intenta de nuevo en unos
            minutos.
          </Estado>
          {codigo && (
            <div>
              <Link
                href={`/verificar-certificado/${encodeURIComponent(codigo)}`}
                className={cn(
                  buttonVariants({ variant: "uva-secondary", size: "uva" }),
                  "min-h-12.5 w-auto px-6 text-uva-cuerpo",
                )}
              >
                Intentar de nuevo
              </Link>
            </div>
          )}
        </>
      );
  }
}

const SELLO = {
  valido: "bg-uva-accent-2 text-uva-on-bright",
  invalido: "border-2 border-uva-accent text-uva-accent-ink",
  neutro: "border-[1.5px] border-uva-line-strong text-uva-text",
} as const;

function Estado({
  sello,
  icono,
  titulo,
  children,
}: {
  sello: keyof typeof SELLO;
  icono: ReactNode;
  titulo: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-start gap-4">
      <span
        aria-hidden="true"
        className={cn(
          "grid size-14 flex-none place-items-center rounded-uva-lg [&_svg]:size-7.5 [&_svg]:stroke-[1.8]",
          SELLO[sello],
        )}
      >
        {icono}
      </span>
      <div className="min-w-0">
        <h1 className="m-0 text-uva-titulo-3 text-uva-text">{titulo}</h1>
        <p className="mt-1.5 mb-0 text-uva-cuerpo text-uva-text-muted">
          {children}
        </p>
      </div>
    </div>
  );
}

function Valido({
  resultado,
  codigo,
}: {
  resultado: Extract<ResultadoVerificacion, { estado: "valido" }>;
  codigo: string;
}) {
  const datos: { termino: string; valor: string; codigo?: boolean }[] = [
    { termino: "Estudiante", valor: resultado.nombreEstudiante },
    { termino: "Curso", valor: resultado.nombreCurso },
    ...(resultado.duracionTexto
      ? [{ termino: "Intensidad", valor: resultado.duracionTexto }]
      : []),
    {
      termino: "Fecha de emisión",
      valor: FECHA_LARGA.format(new Date(resultado.fechaEmision)),
    },
    { termino: "Código", valor: codigo, codigo: true },
  ];

  return (
    <>
      <Estado
        sello="valido"
        icono={<ShieldCheck />}
        titulo="Certificado válido"
      >
        Este código corresponde a un certificado real emitido por U.V.A.
      </Estado>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,470px)_minmax(0,1fr)]">
        <CurvasCertificado />
        <div
          role="img"
          aria-label={`Vista del certificado de ${resultado.nombreEstudiante}`}
          className="relative overflow-hidden rounded-uva-sm border border-uva-divider"
        >
          <MiniaturaCertificado
            nombre={resultado.nombreEstudiante}
            curso={resultado.nombreCurso}
            fechaEmision={resultado.fechaEmision}
            duracionTexto={resultado.duracionTexto}
            codigo={codigo}
            className="block h-auto w-full"
          />
          <span className="absolute top-3.5 right-3.5 inline-flex items-center gap-1.5 rounded-full bg-uva-accent-2 px-2.5 py-1 text-uva-detalle font-extrabold text-uva-on-bright">
            <Check aria-hidden="true" className="size-3.5" strokeWidth={3} />
            Verificado
          </span>
        </div>

        <dl className="grid overflow-hidden rounded-uva-lg border border-uva-divider bg-uva-bg">
          {datos.map((dato) => (
            <div
              key={dato.termino}
              className="border-t border-uva-divider px-4.5 py-3 first:border-t-0"
            >
              <dt className="text-uva-detalle font-bold text-uva-text-muted">
                {dato.termino}
              </dt>
              <dd
                className={cn(
                  "mt-0.5 text-uva-cuerpo text-uva-text",
                  dato.codigo
                    ? "font-codigo font-medium tracking-[0.03em] break-all"
                    : "font-semibold",
                )}
              >
                {dato.valor}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="flex flex-wrap gap-2.5">
        {resultado.cursoSlug && (
          <Link
            href={`/cursos/${resultado.cursoSlug}`}
            className={cn(
              buttonVariants({ variant: "uva-primary", size: "uva" }),
              "min-h-12.5 flex-[1_1_12rem] text-uva-cuerpo",
            )}
          >
            Conocer el curso
          </Link>
        )}
        <Link
          href="/verificar-certificado"
          className={cn(
            buttonVariants({ variant: "uva-secondary", size: "uva" }),
            "min-h-12.5 flex-[1_1_12rem] text-uva-cuerpo",
          )}
        >
          Verificar otro código
        </Link>
      </div>
    </>
  );
}

function AyudaCodigo() {
  const pistas = [
    "Está en la esquina inferior derecha del certificado, junto al código QR.",
    "Escríbelo completo. Da igual si usas mayúsculas o minúsculas.",
    "Si tienes el certificado a mano, escanear el QR te trae directo a esta página.",
  ];

  return (
    <div
      id={ID_AYUDA}
      className="grid gap-2.5 rounded-uva-md border border-uva-divider bg-uva-surface-2 px-4.5 py-4"
    >
      <p className="m-0 text-uva-detalle font-bold text-uva-text">
        Dónde encontrar el código
      </p>
      <ul className="grid gap-2">
        {pistas.map((pista) => (
          <li
            key={pista}
            className="flex gap-2.5 text-uva-detalle text-uva-text-muted"
          >
            <span
              aria-hidden="true"
              className="mt-[7px] size-[7px] flex-none rotate-45 border-[1.5px] border-uva-text bg-uva-accent-2"
            />
            {pista}
          </li>
        ))}
      </ul>
    </div>
  );
}
