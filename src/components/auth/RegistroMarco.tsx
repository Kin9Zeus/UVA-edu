import type { ReactNode } from "react";
import Link from "next/link";
import { LogoUva } from "@/components/home/LogoUva";

/**
 * Marco del paso de crear cuenta y de "¡Ya casi!" (Crear cuenta lab 6,
 * "Carné", tableros "Crear carnet" y "Crear carnet movil"). En celular el
 * carné compacto va arriba, con el logo adentro, y el formulario debajo:
 * ahí el scroll vertical es normal (cuatro campos). Desde 900 px la pantalla
 * se parte: el carné cuelga de su cinta a la izquierda y el formulario va en
 * un panel a la derecha, que se compacta con la altura de la pantalla
 * (variantes de globals.css) para no hacer scroll en un PC.
 */
export function RegistroMarco({
  carne,
  children,
}: {
  carne: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="relative flex min-h-dvh flex-col bg-uva-bg min-[900px]:flex-row">
      <Link
        href="/"
        aria-label="U.V.A., ir al inicio"
        className="absolute top-5 left-10 z-[2] hidden min-h-11 items-center text-uva-text hover:text-uva-text min-[900px]:inline-flex min-[1920px]:top-7 min-[1920px]:left-14"
      >
        <LogoUva className="h-[31px] w-24 min-[1920px]:h-[43px] min-[1920px]:w-[132px]" />
      </Link>

      <div className="px-5 pt-3.5 min-[900px]:flex min-[900px]:flex-[1.05] min-[900px]:justify-center min-[900px]:p-0">
        {carne}
      </div>

      <main className="flex-1 px-5 pt-4 pb-9 min-[900px]:grid min-[900px]:border-l min-[900px]:border-uva-divider min-[900px]:bg-uva-surface min-[900px]:px-10 min-[900px]:py-9 min-[900px]:[place-items:safe_center] min-[1280px]:px-[72px] medio:min-[900px]:py-6 bajo:min-[900px]:py-4">
        <div className="mx-auto w-full min-w-0 max-w-[410px] escritorio-bajo:max-w-[560px] [@media(min-width:1920px)_and_(min-height:1100px)]:max-w-[480px]">
          {children}
        </div>
      </main>
    </div>
  );
}
