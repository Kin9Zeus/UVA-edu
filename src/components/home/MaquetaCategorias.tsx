import Link from "next/link";
import type { CategoriaActiva } from "@/lib/categoria";

/**
 * Maqueta isométrica del hero: cuatro edificios sobre una base con retícula,
 * y cada uno rotula una categoría real con su número de cursos (las de más
 * cursos; el del centro, el más alto, es la primera; el bajo de adelante, la
 * cuarta). En celular se dibujan solo tres: a ese tamaño un cuarto rótulo
 * tapa los edificios. Con menos categorías, los edificios sobrantes quedan
 * sin rótulo ni línea guía.
 *
 * El dibujo es decorativo (`aria-hidden`) y los rótulos no reciben foco: la
 * lista "Explora por categoría", justo debajo, tiene los mismos enlaces para
 * teclado y lector de pantalla. Los rótulos son HTML sobre el SVG, no
 * `<text>`, para que un nombre largo parta en dos líneas en vez de salirse.
 *
 * Coordenadas del viewBox (0 -100 600 596): cada rótulo se apoya en el
 * extremo de su línea guía; de ahí sus porcentajes.
 */
const ROTULOS = [
  // El del centro puede ser más ancho: no tiene borde cerca y así un nombre
  // largo no sube en tres líneas hasta el título.
  { x: "50%", y: "17.1%", clase: "max-w-[44%] -translate-y-full" }, // centro, desde y=2
  { x: "16.67%", y: "42.95%", clase: "max-w-[33%] -translate-y-full" }, // izquierda, desde (120,154)
  { x: "83.33%", y: "42.95%", clase: "max-w-[33%] -translate-y-full" }, // derecha, desde (480,154)
  { x: "78%", y: "86.9%", clase: "max-w-[34%] -translate-y-1/2 hidden sm:flex" }, // adelante, a la derecha de la placa
] as const;

/** Línea guía y punto de cada rótulo, en el mismo orden de ROTULOS. */
const GUIAS = [
  { d: "M300 2V68", punto: [300, 74], hueco: false },
  { d: "M120 154L194 230", punto: [198, 236], hueco: true },
  { d: "M480 154L406 230", punto: [401, 236], hueco: false },
  { d: "M344 418H380", punto: [338, 418], hueco: false },
] as const;

export function MaquetaCategorias({ categorias }: { categorias: CategoriaActiva[] }) {
  const destacadas = [...categorias].sort((a, b) => b.totalCursos - a.totalCursos).slice(0, 4);

  return (
    <div className="relative w-full">
      <svg
        viewBox="0 -100 600 596"
        aria-hidden="true"
        focusable="false"
        fill="none"
        strokeLinejoin="round"
        className="block h-auto w-full"
      >
        <path d="M300 178L570.2 334L300 490L29.8 334Z" className="fill-uva-maqueta-base stroke-uva-maqueta-arista-suave" />
        <path
          d="M345 204L74.8 360M255 204L525.2 360M390.1 230L119.9 386M209.9 230L480.1 386M435.1 256L164.9 412M164.9 256L435.1 412M480.1 282L209.9 438M119.9 282L390.1 438M525.2 308L255 464M74.8 308L345 464"
          strokeOpacity={0.6}
          className="stroke-uva-maqueta-arista-suave"
        />

        {/* Centro: el edificio alto, tapa magenta */}
        <g className="uva-maqueta-edificio stroke-uva-maqueta-arista">
          <path d="M390.1 282L300 334L300 126L390.1 74Z" className="fill-uva-maqueta-der" />
          <path d="M209.9 282L300 334L300 126L209.9 74Z" className="fill-uva-maqueta-izq" />
          <path d="M209.9 178L300 230L390.1 178" className="stroke-uva-maqueta-arista-suave" />
          <path d="M300 22L390.1 74L300 126L209.9 74Z" className="fill-uva-accent" />
        </g>
        {/* Izquierda: tapa del color del texto */}
        <g className="uva-maqueta-edificio stroke-uva-maqueta-arista">
          <path d="M277.5 347L209.9 386L209.9 282L277.5 243Z" className="fill-uva-maqueta-der" />
          <path d="M119.9 334L209.9 386L209.9 282L119.9 230Z" className="fill-uva-maqueta-izq" />
          <path d="M187.4 191L277.5 243L209.9 282L119.9 230Z" className="fill-uva-text" />
        </g>
        {/* Derecha: tapa amarilla */}
        <g className="uva-maqueta-edificio stroke-uva-maqueta-arista">
          <path d="M480.1 334L390.1 386L390.1 282L480.1 230Z" className="fill-uva-maqueta-der" />
          <path d="M322.5 347L390.1 386L390.1 282L322.5 243Z" className="fill-uva-maqueta-izq" />
          <path d="M412.6 191L480.1 230L390.1 282L322.5 243Z" className="fill-uva-accent-2" />
        </g>
        {/* Adelante: una placa baja, tapa gris; no se dibuja en celular */}
        <g className="uva-maqueta-edificio hidden stroke-uva-maqueta-arista sm:inline">
          <path d="M300 446L367.5 407L367.5 367L300 406Z" className="fill-uva-maqueta-der" />
          <path d="M300 446L232.5 407L232.5 367L300 406Z" className="fill-uva-maqueta-izq" />
          <path d="M300 328L367.5 367L300 406L232.5 367Z" className="fill-uva-line-strong" />
        </g>

        {GUIAS.map((guia, i) =>
          destacadas[i] ? (
            <g key={guia.d} className={`uva-maqueta-rotulo stroke-uva-text ${i === 3 ? "hidden sm:inline" : ""}`} strokeWidth={1.5}>
              <path d={guia.d} strokeOpacity={0.6} />
              <circle
                cx={guia.punto[0]}
                cy={guia.punto[1]}
                r={4.5}
                className={guia.hueco ? "fill-uva-surface" : "fill-uva-text"}
              />
            </g>
          ) : null,
        )}
      </svg>

      {destacadas.map((categoria, i) => (
        <Link
          key={categoria.id}
          href={`/catalogo/${categoria.slug}`}
          tabIndex={-1}
          aria-hidden="true"
          style={{ left: ROTULOS[i].x, top: ROTULOS[i].y }}
          className={`uva-maqueta-rotulo absolute flex w-max -translate-x-1/2 ${ROTULOS[i].clase} flex-col items-center rounded-uva-md border border-uva-line-strong bg-uva-surface px-3 py-1.5 text-center leading-tight text-uva-text no-underline hover:border-uva-accent hover:no-underline sm:px-4 sm:py-2`}
        >
          <span className="text-uva-detalle font-bold text-balance sm:text-uva-cuerpo">{categoria.nombre}</span>
          <span className="text-uva-detalle text-uva-text-muted tabular-nums">
            {categoria.totalCursos} {categoria.totalCursos === 1 ? "curso" : "cursos"}
          </span>
        </Link>
      ))}
    </div>
  );
}
