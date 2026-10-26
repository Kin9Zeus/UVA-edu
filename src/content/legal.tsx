import type { ReactNode } from "react";

export type DocumentoLegal = "terminos" | "privacidad";

export type SeccionLegal = {
  /** Ancla de la cláusula (`/soporte/terminos#certificados`): no cambiarla una vez publicada. */
  id: string;
  titulo: string;
  contenido: ReactNode;
};

/**
 * Términos y Privacidad, cada uno en /soporte/<documento>.
 *
 * El borrador está en docs/legal/contenido-soporte.md, pero todavía no se
 * puede publicar: le faltan los datos de la empresa ([RAZÓN SOCIAL], NIT,
 * domicilio, correo y fecha), describe pagos que el MVP por invitación no
 * tiene y pide revisión de un abogado. Publicarlo así afirmaría cosas falsas
 * (CLAUDE.md 3.4, contenido veraz). Cuando esté aprobado se copia aquí, una
 * entrada de `secciones` por cláusula, y se pone la fecha en `actualizado`.
 * Mientras `secciones` esté vacío, la página dice que está en preparación.
 */
export const DOCUMENTOS_LEGALES: Record<
  DocumentoLegal,
  { titulo: string; descripcion: string; actualizado: string | null; secciones: SeccionLegal[] }
> = {
  terminos: {
    titulo: "Términos y condiciones",
    descripcion: "Las condiciones de uso de la plataforma U.V.A.",
    actualizado: null,
    secciones: [],
  },
  privacidad: {
    titulo: "Política de privacidad",
    descripcion: "Cómo U.V.A. trata tus datos personales y cómo ejercer tus derechos.",
    actualizado: null,
    secciones: [],
  },
};

export function esDocumentoLegal(valor: string): valor is DocumentoLegal {
  return Object.hasOwn(DOCUMENTOS_LEGALES, valor);
}
