/**
 * Bandera de la sección de precios. El MVP es gratuito y por invitación, así
 * que la sección de planes de la portada, el enlace "Precios" del menú y la
 * página pública /planes quedan ocultos. El código de los planes se conserva:
 * se reactiva con NEXT_PUBLIC_PRICING_ENABLED=true cuando entre el cobro.
 *
 * Es NEXT_PUBLIC_: Next la inlinea en el build, así que un cambio de valor
 * requiere un nuevo deploy (también para los componentes de cliente).
 */
export const PRECIOS_HABILITADOS =
  process.env.NEXT_PUBLIC_PRICING_ENABLED === "true";

/**
 * Bandera de los textos legales (/legal/*): términos, datos personales,
 * privacidad, cookies y normas de la comunidad. Mientras esté apagada el sitio
 * queda como antes: sin columna "Legal" en el pie, sin las rutas en el mapa
 * del sitio y con los temas de soporte tal como están. Se enciende con
 * NEXT_PUBLIC_LEGAL_ENABLED=true una vez que los textos tengan la aprobación
 * escrita del abogado y del CEO y estén publicados (docs: artefacto "UVA:
 * marco legal de la plataforma y textos oficiales").
 *
 * Las rutas /legal/[slug] responden igual con la bandera apagada: sin una
 * versión publicada dan 404, y un administrador puede abrir un borrador con
 * `?version=` para revisarlo antes de publicar. Lo que la bandera controla es
 * solo lo que el visitante ve ENLAZADO.
 *
 * Es NEXT_PUBLIC_: se inlinea en el build, un cambio de valor pide un deploy.
 */
export const LEGAL_HABILITADO =
  process.env.NEXT_PUBLIC_LEGAL_ENABLED === "true";
