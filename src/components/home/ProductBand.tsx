import { FUNCIONES_PLATAFORMA } from "@/content/marketing";

/** Ícono de cada función, en el mismo orden de FUNCIONES_PLATAFORMA: video,
 *  marcador de avance, medalla del certificado y descarga de plantillas. */
const ICONOS = [
  <g key="video">
    <rect x="4" y="7" width="24" height="18" rx="2" />
    <path d="M13 12v8l7-4z" />
  </g>,
  <path key="avance" d="M9 4h14v24l-7-6-7 6z" />,
  <g key="certificado">
    <circle cx="16" cy="13" r="8" />
    <path d="M12 20l-2 9 6-3 6 3-2-9" />
  </g>,
  <path key="descarga" d="M16 5v16M9 14l7 7 7-7M6 27h20" />,
];

export function ProductBand() {
  return (
    <section id="producto" aria-labelledby="producto-titulo" className="bg-uva-surface-2">
      <div className="mx-auto w-full max-w-uva px-uva-margen py-uva-seccion">
        <h2
          id="producto-titulo"
          className="mb-9 text-uva-titulo-2 text-uva-text lg:mb-14"
        >
          Lo que encuentras al entrar
        </h2>
        <ul className="grid gap-7 lg:grid-cols-4 lg:gap-10">
          {FUNCIONES_PLATAFORMA.map((funcion, i) => (
            <li key={funcion.titulo} className="flex items-start gap-4 lg:flex-col lg:gap-4">
              <span className="grid size-12 shrink-0 place-items-center rounded-full bg-uva-accent-2 text-uva-on-bright">
                <svg
                  viewBox="0 0 32 32"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2.6}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                  className="size-6"
                >
                  {ICONOS[i]}
                </svg>
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="mb-1.5 text-uva-titulo-4 text-uva-text">
                  {funcion.titulo}
                </h3>
                <p className="text-uva-cuerpo text-uva-text-muted">{funcion.descripcion}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
