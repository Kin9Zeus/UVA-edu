// Fuente única de los temas de soporte: la consume tanto la página /soporte
// (pública y dentro del dashboard) como la columna "Soporte" del footer del
// home. El `id` viaja en la URL (`/soporte?tema=terminos`) para abrir ese
// acordeón de entrada, así que es parte del contrato público: cambiarlo
// rompe enlaces ya compartidos.

// Placeholder: todavía no hay contenido real para estos 4 puntos (pendiente
// de que el equipo lo redacte). Se deja la estructura de acordeón lista para
// que solo haya que reemplazar `contenido` acá cuando llegue el texto final.
export const TEMAS_SOPORTE = [
  {
    id: "centro-de-ayuda",
    titulo: "Centro de ayuda",
    contenido: "Contenido en preparación. Pronto encontrarás aquí guías y preguntas frecuentes.",
  },
  {
    id: "contacto",
    titulo: "Contacto",
    contenido: "Contenido en preparación. Pronto encontrarás aquí las formas de comunicarte con nosotros.",
  },
  {
    id: "terminos",
    titulo: "Términos",
    contenido: "Contenido en preparación. Pronto encontrarás aquí los Términos y condiciones de U.V.A.",
  },
  {
    id: "privacidad",
    titulo: "Privacidad",
    contenido: "Contenido en preparación. Pronto encontrarás aquí la Política de privacidad de U.V.A.",
  },
] as const;

export type TemaSoporte = (typeof TEMAS_SOPORTE)[number]["id"];

/** `?tema=` viene del cliente: solo se acepta si coincide con un tema real. */
export function esTemaSoporte(valor: string | undefined): valor is TemaSoporte {
  return TEMAS_SOPORTE.some((tema) => tema.id === valor);
}

// Formulario público de Notion (vista "Reportar bug/incidencias" de la base
// "Bugs / Incidencias") — cada envío cae ahí directo como fila nueva, sin
// backend propio. Fase 1 del plan de soporte: si más adelante se reemplaza
// por un formulario propio dentro de la app, solo hay que cambiar este link
// por la llamada al Server Action correspondiente.
export const URL_REPORTE_PROBLEMA =
  "https://loud-voice-8a9.notion.site/544401bd4fae4293ac2a81538ae09037?pvs=105";
