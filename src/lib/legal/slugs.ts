/**
 * Los cinco textos legales públicos y cómo se llaman. Sin dependencias del
 * servidor a propósito: los usan las páginas, el pie, el mapa del sitio y los
 * scripts de siembra y publicación (scripts/legal/), y la lista también está
 * en un CHECK de la base (supabase/sql/130): si cambia una, cambia la otra.
 */
export const SLUGS_LEGALES = [
  "terminos",
  "datos-personales",
  "privacidad",
  "cookies",
  "comunidad",
] as const;

export type SlugLegal = (typeof SLUGS_LEGALES)[number];

export function esSlugLegal(valor: string | undefined): valor is SlugLegal {
  return SLUGS_LEGALES.some((slug) => slug === valor);
}

/** Nombre corto: el del enlace del pie y el de la pestaña. */
export const NOMBRE_LEGAL: Record<SlugLegal, string> = {
  terminos: "Términos y condiciones",
  "datos-personales": "Tratamiento de datos personales",
  privacidad: "Aviso de privacidad",
  cookies: "Política de cookies",
  comunidad: "Normas de la comunidad",
};

/** Para el `<meta description>`: una frase que diga qué es, sin prometer nada. */
export const DESCRIPCION_LEGAL: Record<SlugLegal, string> = {
  terminos: "Las condiciones de uso de la plataforma de cursos de U.V.A.: cuenta, acceso, certificados y propiedad intelectual.",
  "datos-personales": "Cómo U.V.A. trata tus datos personales: qué datos, para qué, con quién y cómo ejercer tus derechos.",
  privacidad: "Resumen del tratamiento de tus datos personales en U.V.A. y la autorización que nos otorgas al registrarte.",
  cookies: "Qué cookies usa U.V.A., para qué sirven y cómo elegir cuáles aceptar.",
  comunidad: "Las normas de convivencia y de uso aceptable de la comunidad y la plataforma de U.V.A.",
};

export function rutaLegal(slug: SlugLegal): string {
  return `/legal/${slug}`;
}
