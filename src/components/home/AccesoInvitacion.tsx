import Link from "next/link";
import { Button } from "@/components/ui/button";
import { urlWhatsapp } from "@/lib/contacto";

const ESQUINAS = ["-top-1.5 -left-1.5", "-top-1.5 -right-1.5", "-bottom-1.5 -left-1.5", "-right-1.5 -bottom-1.5"];

/**
 * Reemplaza la sección de precios mientras el MVP sea gratuito y por
 * invitación (ver src/lib/features.ts). Explica cómo se entra y ofrece las dos
 * salidas: canjear un código que ya se tiene, o pedir una invitación.
 *
 * Un marco de lámina con un cuadrito amarillo en cada esquina; las dos salidas
 * se separan con una línea punteada (abajo en celular, al lado en escritorio).
 *
 * `hrefCodigo` es el destino de "Tengo un código". Sin sesión, el proxy lo
 * manda a entrar o crear cuenta y de ahí vuelve al canje.
 */
export function AccesoInvitacion({ hrefCodigo }: { hrefCodigo: string }) {
  return (
    <section
      id="acceso"
      aria-labelledby="acceso-titulo"
      className="mx-auto w-full max-w-uva px-uva-margen py-uva-seccion"
    >
      <div className="relative border border-uva-line-strong px-6 py-8 lg:p-16">
        {ESQUINAS.map((posicion) => (
          <span key={posicion} aria-hidden="true" className={`absolute size-[11px] bg-uva-accent-2 ${posicion}`} />
        ))}
        <h2
          id="acceso-titulo"
          className="mb-3 text-uva-titulo-1 text-uva-text"
        >
          Entra con una invitación
        </h2>
        <p className="mb-9 max-w-[30em] text-uva-lead text-uva-text-muted lg:mb-14">
          Abrimos cupos limitados, sin costo. Solo necesitas un código.
        </p>

        <div className="grid md:grid-cols-2">
          <div className="flex flex-col items-start pb-8 md:pr-12 md:pb-0">
            <h3 className="mb-2 text-uva-titulo-4 text-uva-text">¿Ya tienes un código?</h3>
            <p className="mb-5 max-w-[26em] text-uva-cuerpo text-uva-text-muted lg:mb-6">
              Crea tu cuenta o inicia sesión y canjéalo para ver todos los cursos.
            </p>
            <Button
              render={<Link href={hrefCodigo} />}
              nativeButton={false}
              variant="uva-primary"
              size="uva"
              className="mt-auto min-h-13 px-[26px] text-uva-cuerpo sm:w-auto"
            >
              Tengo un código
            </Button>
          </div>

          <div className="flex flex-col items-start border-t border-dashed border-uva-line-strong pt-8 md:border-t-0 md:border-l md:pt-0 md:pl-12">
            <h3 className="mb-2 text-uva-titulo-4 text-uva-text">¿Aún no tienes uno?</h3>
            <p className="mb-5 max-w-[26em] text-uva-cuerpo text-uva-text-muted lg:mb-6">
              Escríbenos y te decimos cómo conseguir tu invitación.
            </p>
            <Button
              render={
                <a
                  href={urlWhatsapp("Hola, quiero una invitación para entrar a U.V.A.")}
                  target="_blank"
                  rel="noopener noreferrer"
                />
              }
              nativeButton={false}
              variant="uva-secondary"
              size="uva"
              className="mt-auto min-h-13 px-[26px] text-uva-cuerpo sm:w-auto"
            >
              Quiero una invitación
              <span className="sr-only"> (abre WhatsApp en otra pestaña)</span>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
