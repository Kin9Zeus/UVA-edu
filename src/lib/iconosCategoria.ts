/**
 * Trazo del ícono de una categoría (viewBox 0 0 96 96), elegido por el tema
 * que se lee en su slug o en su nombre. Lo usan la lista "Explora por
 * categoría" de la portada y el catálogo (botones de categoría y tarjetas).
 *
 * Se compara contra el texto normalizado (minúsculas, sin tildes), así que
 * sirve igual con `modelado-bim` que con "Modelado BIM": las tarjetas del
 * catálogo solo reciben el nombre de la categoría.
 *
 * Una escuela sin ícono propio recibe la regla de dibujo. Cuando haya otra
 * con ícono, se agrega aquí y aparece en todas las pantallas a la vez.
 */
const ICONOS: { patron: RegExp; trazo: string }[] = [
  { patron: /estructura|construcci/, trazo: "M10 12h76v12H56v48h30v12H10V72h30V24H10z" },
  { patron: /bim|modelad/, trazo: "M48 6l40 22v40L48 90 8 68V28z M8 28l40 22 40-22 M48 50v40" },
  { patron: /visualiz|render/, trazo: "M6 84L48 12l42 72z M6 84h84 M48 12v72 M27 48h42" },
  {
    patron: /presupuest|\bapu\b|costo/,
    trazo:
      "M18 8h60v80H18z M28 18h40v16H28z M31 50h6 M45 50h6 M59 50h6 M31 64h6 M45 64h6 M59 64h6 M31 78h6 M45 78h6 M59 78h6",
  },
  { patron: /normativ|licencia/, trazo: "M20 6h40l18 18v66H20z M60 6v18h18 M32 44h32 M32 58h32 M32 72h18" },
  { patron: /interior/, trazo: "M22 44V22h52v22 M14 44h68v22H14z M22 66v16 M74 66v16" },
];

const TRAZO_GENERICO = "M8 72L72 8l16 16-64 64z M24 56l8 8 M36 44l8 8 M48 32l8 8";

export function trazoIconoCategoria(slugONombre: string): string {
  const texto = slugONombre
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
  return ICONOS.find(({ patron }) => patron.test(texto))?.trazo ?? TRAZO_GENERICO;
}
