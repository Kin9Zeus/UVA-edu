/**
 * Logo de trazo de U.V.A. (lienzo de diseño "UVA Cursos", Login lab 7). Toma
 * el color del texto (`currentColor`), así sirve igual en claro y en oscuro.
 * Es decorativo: el nombre accesible lo pone el enlace que lo envuelve.
 */
export function LogoUva({ className }: { className?: string }) {
  return (
    <svg
      viewBox="136 223 1501 487"
      fill="none"
      stroke="currentColor"
      strokeWidth="44"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M266 243H156V468A232 220 0 0 0 620 468V243H514M156 468H620M729 243L727 686L1182 243M866 686L1182 385M1617 243V688H1146L1617 243M1161 543H1617" />
    </svg>
  );
}
