import Link from "next/link";
import { Button } from "@/components/ui/button";
import { urlWhatsapp } from "@/lib/contacto";

/**
 * Reemplaza la sección de precios mientras el MVP sea gratuito y por
 * invitación (ver src/lib/features.ts). Explica cómo se entra y ofrece las dos
 * salidas: canjear un código que ya se tiene, o pedir una invitación.
 *
 * `hrefCodigo` lo decide la página según haya sesión o no: con sesión va
 * directo al formulario de canje; sin sesión, a entrar o crear cuenta y de ahí
 * al canje.
 */
export function AccesoInvitacion({ hrefCodigo }: { hrefCodigo: string }) {
  return (
    <section
      id="acceso"
      aria-labelledby="acceso-titulo"
      className="mx-auto max-w-[900px] px-[clamp(20px,4vw,56px)] py-[clamp(72px,10vw,112px)]"
    >
      <div className="rounded-uva-md border border-uva-divider bg-uva-surface px-[clamp(20px,5vw,56px)] py-[clamp(32px,6vw,56px)] text-center">
        <h2
          id="acceso-titulo"
          className="mb-3 text-[clamp(28px,4vw,40px)] font-bold tracking-[-0.02em] text-uva-text"
        >
          Acceso por invitación
        </h2>
        <p className="mx-auto mb-8 max-w-[560px] text-base text-uva-text-muted">
          U.V.A. es gratuita y se entra con un código de invitación. Los cupos
          son limitados: si ya tienes tu código, canjéalo con tu cuenta; si no,
          pídenos una invitación.
        </p>
        <div className="flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
          <Button
            render={<Link href={hrefCodigo} />}
            nativeButton={false}
            variant="uva-primary"
            size="uva"
            className="sm:w-auto sm:min-w-[200px]"
          >
            Tengo un código
          </Button>
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
            className="sm:w-auto sm:min-w-[200px]"
          >
            Quiero una invitación
          </Button>
        </div>
      </div>
    </section>
  );
}
