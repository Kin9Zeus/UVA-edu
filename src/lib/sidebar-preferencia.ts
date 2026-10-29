/**
 * Preferencia de "menú lateral colapsado", compartida por el panel del
 * estudiante, la ficha de curso y el panel de administración.
 *
 * Vive en una cookie y no en `localStorage` porque el servidor tiene que
 * conocerla al pintar: con `localStorage` el menú nacería abierto y se cerraría
 * después de hidratar (un parpadeo en cada navegación). El valor no es un dato
 * sensible ni de sesión: solo "1" cuando el usuario lo colapsó.
 *
 * Este archivo es seguro para el cliente; la lectura en el servidor está en
 * `sidebar-preferencia-servidor.ts`.
 */
export const SIDEBAR_COOKIE = "uva-sidebar-colapsado";

const UN_ANIO_EN_SEGUNDOS = 60 * 60 * 24 * 365;

/**
 * "1" colapsado, "0" expandido. Sin cookie, el panel del estudiante y el de
 * administración deciden por el ancho (ver PreferenciaSidebar).
 */
export function guardarSidebarColapsado(colapsado: boolean): void {
  if (typeof document === "undefined") return;
  document.cookie = `${SIDEBAR_COOKIE}=${colapsado ? "1" : "0"}; path=/; max-age=${UN_ANIO_EN_SEGUNDOS}; SameSite=Lax`;
}

/**
 * Lo que eligió la persona, o `null` si nunca tocó el botón: entonces el
 * menú del panel va solo con íconos por debajo de 1280 px (tabletas, iPad
 * horizontal) y completo desde ahí.
 */
export type PreferenciaSidebar = "colapsado" | "expandido" | null;
