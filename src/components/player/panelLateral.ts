/** Cookie con la columna lateral de la clase oculta: la página la lee en el
 * servidor para dibujarla ya oculta, sin parpadeo. Vive fuera de
 * LeccionMaqueta porque un valor exportado desde un archivo "use client" no
 * llega como valor a un componente de servidor. */
export const COOKIE_PANEL_OCULTO = "uva-panel-clase";
