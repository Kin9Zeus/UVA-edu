import { CURVAS } from "@/lib/certificados/curvas";

/**
 * Miniatura del certificado con el mismo diseño del PDF (lib/certificados/
 * pdf.ts, «curvas de nivel»), para que lo que se ve en "Mis certificados" sea
 * lo que se descarga.
 *
 * Los colores van fijos, como en el PDF: es la imagen de un papel impreso,
 * blanco en los dos temas, no una superficie de la interfaz.
 *
 * Las curvas (20 KB de trazos) se declaran UNA vez con <CurvasCertificado />
 * y cada miniatura las reutiliza con <use>.
 */
const ID_CURVAS = "uva-curvas-certificado";

export function CurvasCertificado() {
  return (
    <svg aria-hidden="true" className="absolute size-0 overflow-hidden">
      <defs>
        <g id={ID_CURVAS} fill="none">
          {CURVAS.map((curva, i) => (
            <path key={i} d={curva.d} stroke={curva.fuerte ? "#C8C8CE" : "#E4E4E7"} strokeWidth={curva.fuerte ? 1.4 : 1} />
          ))}
          <circle cx="870" cy="300" r="6" fill="#18181B" />
        </g>
      </defs>
    </svg>
  );
}

const LOGO =
  "M2.4 5.6H12.6M41.6 5.6H31.8M3.8 4V26A18.6 17.4 0 0 0 41 26V4M2.2 23.6H42.6M50.2 4V43.4M50.2 42.4L88.6 4.6M64.2 42.6L89.6 17.2M86.6 42L122.8 5.2M124.2 4V43.6M85.6 42.4H125.8M86.6 30.4H125.8";

/** Corta el título del curso en líneas de unos `ancho` caracteres (aproximado: es una miniatura). */
function lineas(texto: string, ancho: number, maximo: number) {
  const salida: string[] = [];
  let actual = "";
  for (const palabra of texto.split(/\s+/)) {
    if (actual && (actual + " " + palabra).length > ancho) {
      salida.push(actual);
      actual = palabra;
    } else actual = actual ? `${actual} ${palabra}` : palabra;
  }
  if (actual) salida.push(actual);
  if (salida.length > maximo) {
    salida.length = maximo;
    salida[maximo - 1] = `${salida[maximo - 1].replace(/\s+\S*$/, "")}…`;
  }
  return salida;
}

export function MiniaturaCertificado({
  nombre,
  curso,
  className,
}: {
  nombre: string;
  curso: string;
  className?: string;
}) {
  // Mismo tope que el PDF: 84 y más chico si el nombre es largo.
  const tamanoNombre = Math.min(84, Math.max(40, 960 / Math.max(nombre.length, 1)));
  const cursoLineas = lineas(curso, 40, 2);

  return (
    <svg viewBox="0 0 1123 794" aria-hidden="true" className={className}>
      <rect width="1123" height="794" fill="#FFFFFF" />
      <use href={`#${ID_CURVAS}`} />
      <path d={LOGO} transform="translate(72 60) scale(0.527)" fill="none" stroke="#18181B" strokeWidth="3.2" />
      {/* Misma composición del PDF: bloque de texto abajo a la izquierda,
          sobre un velo blanco, y el pie con firmas y QR. */}
      <rect x="72" y="330" width="600" height="280" fill="#FFFFFF" fillOpacity="0.88" />
      <text x="72" y="372" fontSize="17" fill="#C2005B" fontFamily="var(--font-jetbrains-mono), monospace">
        Certificado de aprobación
      </text>
      <g fontFamily="var(--font-plus-jakarta-sans), sans-serif" fontWeight="700" fill="#18181B">
        <text x="72" y="470" fontSize={tamanoNombre} letterSpacing="-2">
          {nombre}
        </text>
        {cursoLineas.map((linea, i) => (
          <text key={i} x="72" y={540 + i * 34} fontSize="28">
            {linea}
          </text>
        ))}
      </g>
      <path d="M72 700h200M304 700h200" stroke="#18181B" strokeWidth="2" />
      <rect x="977" y="668" width="64" height="64" fill="#18181B" opacity="0.85" />
    </svg>
  );
}
