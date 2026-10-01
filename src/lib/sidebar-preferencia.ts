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

export function guardarSidebarColapsado(colapsado: boolean): void {
  if (typeof document === "undefined") return;
  document.cookie = colapsado
    ? `${SIDEBAR_COOKIE}=1; path=/; max-age=${UN_ANIO_EN_SEGUNDOS}; SameSite=Lax`
    : `${SIDEBAR_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
}
