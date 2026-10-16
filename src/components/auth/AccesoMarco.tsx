import type { ReactNode } from "react";
import Link from "next/link";
import { LogoUva } from "@/components/LogoUva";

/**
 * Marco de los pasos de acceso (correo, contraseña, Google, verificación
 * pendiente): Login lab 7, "Nivel plano técnico" del lienzo "UVA Cursos".
 * Una sola tarjeta centrada; en celular el logo va en el flujo, encima de
 * la tarjeta, y desde 900 px queda fijo arriba a la izquierda.
 *
 * `min-h-dvh` con centrado seguro: si algo no cabe (letra del sistema
 * agrandada) la página hace scroll en vez de cortar la tarjeta. La tarjeta
 * mide 460 px de ancho hasta 1920 px de pantalla, donde pasa a 520; el
 * tablero del diseño (566 px en 1440) se veía demasiado grande en un
 * portátil. En pantallas bajas (variantes `bajo`, `muy-bajo` y `apaisado` de
 * globals.css) se recorta el aire, y con el celular girado la tarjeta pasa a
 * dos columnas, para que quepa entera sin scroll vertical.
 */
export function AccesoMarco({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-dvh flex-col bg-uva-bg apaisado:flex-row">
      <header className="px-3 pt-3 bajo:pt-1 apaisado:shrink-0 apaisado:pt-1.5 apaisado:pr-0 min-[900px]:absolute min-[900px]:top-5 min-[900px]:left-10 min-[900px]:z-[2] min-[900px]:p-0 min-[1920px]:top-7 min-[1920px]:left-14">
        <Link
          href="/"
          aria-label="U.V.A., ir al inicio"
          className="inline-flex min-h-11 items-center text-uva-text hover:text-uva-text"
        >
          <LogoUva className="h-[31px] w-24 muy-bajo:h-[26px] muy-bajo:w-20 min-[1920px]:h-[43px] min-[1920px]:w-[132px]" />
        </Link>
      </header>

      <main className="grid flex-1 px-3 pt-3 pb-8 [place-items:safe_center] min-[900px]:px-6 min-[900px]:py-10 bajo:py-3 muy-bajo:pt-2 muy-bajo:pb-1">
        <div className="w-full min-w-0 max-w-[460px] rounded-uva-lg border border-uva-divider bg-uva-surface px-4 py-5 sm:px-8 sm:py-8 min-[1920px]:max-w-[520px] min-[1920px]:px-11 min-[1920px]:py-10 bajo:py-5 muy-bajo:py-3 apaisado:max-w-[680px] apaisado:px-6 apaisado:py-3">
          {children}
        </div>
      </main>
    </div>
  );
}
