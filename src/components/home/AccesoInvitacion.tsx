import Link from "next/link";
import { Button } from "@/components/ui/button";
import { urlWhatsapp } from "@/lib/contacto";

/**
 * Reemplaza la sección de precios mientras el MVP sea gratuito y por
 * invitación (ver src/lib/features.ts). Explica cómo se entra y ofrece las dos
 * salidas: canjear un código que ya se tiene, o pedir una invitación.
 *
 * Sin tarjeta, fondo ni líneas: texto centrado sobre el fondo de la página.
 * Cada salida es una pregunta corta, una frase y su botón.
 *
 * `hrefCodigo` es el destino de "Tengo un código". Sin sesión, el proxy lo
 * manda a entrar o crear cuenta y de ahí vuelve al canje.
 */
export function AccesoInvitacion({ hrefCodigo }: { hrefCodigo: string }) {
  return (
    <section
      id="acceso"
      aria-labelledby="acceso-titulo"
      className="mx-auto max-w-[1180px] px-[clamp(20px,4vw,56px)] py-[clamp(72px,10vw,112px)] text-center"
    >
      <h2
        id="acceso-titulo"
        className="mx-auto mb-4 max-w-[720px] text-[clamp(32px,5vw,56px)] leading-[1.08] font-bold tracking-[-0.03em] text-uva-text"
      >
        Entra con una invitación
      </h2>
      <p className="mx-auto mb-[clamp(40px,6vw,72px)] max-w-[560px] text-lg text-uva-text-muted">
        Abrimos cupos limitados, sin costo. Solo necesitas un código.
      </p>

      <div className="mx-auto grid max-w-[900px] gap-12 md:grid-cols-2 md:gap-[clamp(40px,6vw,96px)]">
        <div className="flex flex-col items-center gap-5 md:justify-between">
          <div>
            <p className="mb-2 font-heading text-xl font-bold text-uva-text">
              ¿Ya tienes un código?
            </p>
            <p className="mx-auto max-w-[360px] text-base text-uva-text-muted">
              Crea tu cuenta o inicia sesión y canjéalo para ver todos los
              cursos.
            </p>
          </div>
          <Button
            render={<Link href={hrefCodigo} />}
            nativeButton={false}
            variant="uva-primary"
            size="uva"
            className="w-full sm:w-auto sm:min-w-48"
          >
            Tengo un código
          </Button>
        </div>

        <div className="flex flex-col items-center gap-5 md:justify-between">
          <div>
            <p className="mb-2 font-heading text-xl font-bold text-uva-text">
              ¿Aún no tienes uno?
            </p>
            <p className="mx-auto max-w-[360px] text-base text-uva-text-muted">
              Escríbenos y te decimos cómo conseguir tu invitación.
            </p>
          </div>
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
            className="w-full border-uva-text-faint sm:w-auto sm:min-w-48"
          >
            Quiero una invitación
            <span className="sr-only"> (abre WhatsApp en otra pestaña)</span>
          </Button>
        </div>
      </div>
    </section>
  );
}
