/**
 * Preferencia de tema (claro / oscuro), compartida por el sitio público, el
 * panel del estudiante y el panel de administración.
 *
 * Vive en una cookie y no en `localStorage` por la misma razón que
 * `sidebar-preferencia.ts`: el servidor tiene que conocerla al pintar el
 * `<html>`. Con `localStorage` la página nacería oscura y cambiaría a clara
 * después de hidratar — un destello en cada carga. Todas las rutas ya son
 * dinámicas (CSP con nonce por petición), así que leer la cookie en el
 * layout raíz no le quita a ninguna página un render estático que tuviera.
 *
 * Sin cookie, o con un valor desconocido, el tema es OSCURO: es la identidad
 * de U.V.A y nadie que ya use la plataforma debe ver un cambio que no pidió.
 *
 * Este archivo es seguro para el cliente; la lectura en el servidor está en
 * `tema-servidor.ts`.
 */
export const TEMA_COOKIE = "uva-tema";

export type Tema = "claro" | "oscuro";

export const TEMA_POR_DEFECTO: Tema = "oscuro";

/** Color de la barra del navegador móvil y de la zona de overscroll: el
 *  mismo `--uva-bg` de cada tema en globals.css. */
export const COLOR_BARRA_NAVEGADOR: Record<Tema, string> = {
  claro: "#fafafa",
  oscuro: "#09090b",
};

const UN_ANIO_EN_SEGUNDOS = 60 * 60 * 24 * 365;

export function parsearTema(valor: string | undefined | null): Tema {
  return valor === "claro" ? "claro" : TEMA_POR_DEFECTO;
}

/**
 * Aplica el tema al documento ya pintado y lo deja guardado para la próxima
 * petición. No recarga ni pide nada al servidor: los colores salen de las
 * variables CSS de `:root` / `.dark`, así que basta con cambiar la clase.
 */
export function aplicarTema(tema: Tema): void {
  if (typeof document === "undefined") return;

  const raiz = document.documentElement;
  raiz.classList.toggle("dark", tema === "oscuro");
  raiz.style.colorScheme = tema === "oscuro" ? "dark" : "light";

  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", COLOR_BARRA_NAVEGADOR[tema]);
  document
    .querySelector('meta[name="color-scheme"]')
    ?.setAttribute("content", tema === "oscuro" ? "dark" : "light");

  document.cookie = `${TEMA_COOKIE}=${tema}; path=/; max-age=${UN_ANIO_EN_SEGUNDOS}; SameSite=Lax`;
}
