import { cn } from "@/lib/utils";

/** Trazo del ícono según el tema de la categoría; el resto, una regla de
 *  dibujo. Cuando haya más escuelas con ícono propio, se agregan aquí. */
function trazoIcono(clave: string): string {
  // Sirve igual con el slug ("modelado-bim") o el nombre ("Modelado BIM"):
  // en minúscula y sin tildes.
  const slug = clave.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
  if (/estructura|construcci/.test(slug)) return "M10 12h76v12H56v48h30v12H10V72h30V24H10z";
  if (/bim|modelad/.test(slug)) return "M48 6l40 22v40L48 90 8 68V28z M8 28l40 22 40-22 M48 50v40";
  if (/visualiz|render/.test(slug)) return "M6 84L48 12l42 72z M6 84h84 M48 12v72 M27 48h42";
  if (/presupuest|apu|costo/.test(slug)) return "M18 8h60v80H18z M28 18h40v16H28z M31 50h6 M45 50h6 M59 50h6 M31 64h6 M45 64h6 M59 64h6 M31 78h6 M45 78h6 M59 78h6";
  if (/normativ|licenci|gestion|legal/.test(slug)) return "M20 6h40l18 18v66H20z M60 6v18h18 M32 44h32 M32 58h32 M32 72h18";
  if (/interior/.test(slug)) return "M22 44V22h52v22 M14 44h68v22H14z M22 66v16 M74 66v16";
  return "M8 72L72 8l16 16-64 64z M24 56l8 8 M36 44l8 8 M48 32l8 8";
}

/** Ícono de trazo de una categoría, decorativo: el nombre siempre va al lado.
 *  `clave` es su slug o su nombre. `grosor`: ancho del trazo en el viewBox de
 *  96 (la portada grande de una tarjeta sin imagen usa uno más fino). */
export function IconoCategoria({
  clave,
  grosor = 6,
  className,
}: {
  clave: string;
  grosor?: number;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 96 96"
      fill="none"
      strokeWidth={grosor}
      strokeLinejoin="round"
      strokeLinecap="round"
      aria-hidden="true"
      className={cn("shrink-0 stroke-uva-accent-2-text", className)}
    >
      <path d={trazoIcono(clave)} />
    </svg>
  );
}
