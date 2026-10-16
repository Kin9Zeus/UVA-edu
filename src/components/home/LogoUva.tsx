/**
 * Logo U.V.A. de trazo (dirección visual «Maqueta»). Toma el color del texto
 * (`currentColor`), así sirve igual en claro y en oscuro. Decorativo por
 * defecto: el enlace o el contexto que lo envuelve pone el nombre accesible.
 */
export function LogoUva({ className, etiqueta }: { className?: string; etiqueta?: string }) {
  return (
    <svg
      viewBox="136 223 1501 487"
      fill="none"
      stroke="currentColor"
      strokeWidth={40}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...(etiqueta ? { role: "img", "aria-label": etiqueta } : { "aria-hidden": true })}
    >
      <path d="M266 243H156V468A232 220 0 0 0 620 468V243H514M156 468H620M729 243L727 686L1182 243M866 686L1182 385M1617 243V688H1146L1617 243M1161 543H1617" />
    </svg>
  );
}
