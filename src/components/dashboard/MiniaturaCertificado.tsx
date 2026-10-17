import QRCode from "qrcode";
import { COTAS, CURVAS } from "@/lib/certificados/curvas";
import {
  FIRMAS_CERTIFICADO,
  LOGO_CERTIFICADO,
  TEXTOS_CERTIFICADO,
  lineaDatosCertificado,
  urlsVerificacion,
} from "@/lib/certificados/diseno";
import { siteUrl } from "@/lib/site-url";

/**
 * Miniatura del certificado con el mismo diseño y los mismos textos del PDF
 * (lib/certificados/pdf.ts, «curvas de nivel»): logo e institución, "U.V.A.
 * certifica que", nombre, curso, fecha e intensidad, firmas, código, la
 * dirección de verificación y un QR real. Lo que se ve en "Mis certificados"
 * y en la verificación es lo que se descarga.
 *
 * Las posiciones son las del PDF (unidades de diseño 1123 × 794). Los cortes
 * de línea del nombre y del curso se calculan con un ancho de letra promedio:
 * en el PDF se miden con la fuente real, así que en nombres o cursos muy
 * largos el corte puede caer una palabra antes o después.
 *
 * Los colores van fijos, como en el PDF: es la imagen de un papel impreso,
 * blanco en los dos temas, no una superficie de la interfaz.
 *
 * Las curvas (20 KB de trazos) se declaran UNA vez con <CurvasCertificado />
 * y cada miniatura las reutiliza con <use>.
 */
const ID_CURVAS = "uva-curvas-certificado";

const ANCHO = 1123;
const ALTO = 794;
const IZQ = 72;
const DER = ANCHO - 72;
const ABAJO = ALTO - 52;
const TEXTO = "#18181B";
const TENUE = "#52525B";
const MAGENTA = "#C2005B";
const COTA = "#A1A1AA";
const JAKARTA = "var(--font-plus-jakarta-sans), sans-serif";
const MONO = "var(--font-jetbrains-mono), monospace";

export function CurvasCertificado() {
  return (
    <svg aria-hidden="true" className="absolute size-0 overflow-hidden">
      <defs>
        <g id={ID_CURVAS} fill="none">
          {CURVAS.map((curva, i) => (
            <path key={i} d={curva.d} stroke={curva.fuerte ? "#C8C8CE" : "#E4E4E7"} strokeWidth={curva.fuerte ? 1.4 : 1} />
          ))}
          {COTAS.map(({ x, y, texto }) => (
            <g key={texto}>
              {/* Halo blanco detrás de la cota, como en el PDF. */}
              <rect x={x - 2} y={y - 10} width={texto.length * 6.6 + 4} height={13} fill="#FFFFFF" />
              <text x={x} y={y} fontSize="11" fill={COTA} fontFamily={MONO}>
                {texto}
              </text>
            </g>
          ))}
          <circle cx="870" cy="300" r="6" fill={TEXTO} />
        </g>
      </defs>
    </svg>
  );
}

/**
 * Parte un texto en líneas que quepan en `ancho` con un ancho de letra
 * promedio de `factor` × tamaño (aproximado: es una miniatura).
 */
function partir(texto: string, tamano: number, ancho: number, factor = 0.56): string[] {
  // `+ 1e-6`: cuando el texto cabe justo (ancho / letra = 15,0), el
  // redondeo de coma flotante daba 14,999… y partía de más.
  const maximo = Math.max(1, Math.floor(ancho / (tamano * factor) + 1e-6));
  const salida: string[] = [];
  let actual = "";
  for (const palabra of texto.split(/\s+/).filter(Boolean)) {
    if (actual && (actual + " " + palabra).length > maximo) {
      salida.push(actual);
      actual = palabra;
    } else actual = actual ? `${actual} ${palabra}` : palabra;
  }
  if (actual) salida.push(actual);
  return salida;
}

/** Línea base de un texto dentro de una "caja de línea" de CSS (`top` y `alto`), como `linea()` del PDF. */
const base = (top: number, alto: number, tamano: number) => top + alto / 2 + tamano * 0.36;

/** Trazo del QR (un cuadro de 1 × 1 por módulo oscuro) en un lado de `lado`. */
function trazoQr(texto: string): { d: string; modulos: number } {
  const { modules } = QRCode.create(texto, { errorCorrectionLevel: "M" });
  let d = "";
  for (let fila = 0; fila < modules.size; fila++) {
    for (let col = 0; col < modules.size; col++) {
      if (modules.get(fila, col)) d += `M${col} ${fila}h1v1h-1z`;
    }
  }
  return { d, modulos: modules.size };
}

export function MiniaturaCertificado({
  nombre,
  curso,
  fechaEmision,
  duracionTexto,
  codigo,
  className,
}: {
  nombre: string;
  curso: string;
  /** ISO de la emisión. */
  fechaEmision: string;
  /** "12 horas de teoría y práctica"; null si el curso no tiene videos listos. */
  duracionTexto: string | null;
  codigo: string;
  className?: string;
}) {
  const anchoTexto = 600 - 24;

  // Nombre: 84 y más chico si no cabe (hasta 56); si aun así no cabe, parte.
  let tamanoNombre = 84;
  const anchoNombre = nombre.length * tamanoNombre * 0.56;
  if (anchoNombre > anchoTexto) tamanoNombre = Math.max(56, (tamanoNombre * anchoTexto) / anchoNombre);
  const lineasNombre = partir(nombre, tamanoNombre, anchoTexto);

  // Curso: 26 en las líneas que haga falta; con más de 3 se achica.
  let tamanoCurso = 26;
  let lineasCurso = partir(curso, tamanoCurso, anchoTexto);
  while (lineasCurso.length > 3 && tamanoCurso > 18) {
    tamanoCurso -= 2;
    lineasCurso = partir(curso, tamanoCurso, anchoTexto);
  }
  const lhNombre = tamanoNombre * 0.98;
  const lhCurso = tamanoCurso * 1.2;
  const datos = lineaDatosCertificado(new Date(fechaEmision), duracionTexto);

  // Pie: firmas a la izquierda; código, dirección y QR a la derecha.
  const altoFirma = 44 + 1 + 8 + 18.2 + 16.8;
  const topFirma = ABAJO - altoFirma;
  const ladoQr = 64;
  const xQr = DER - 10 - ladoQr;
  const topQr = ABAJO - 10 - ladoQr;
  const centroQr = topQr + ladoQr / 2;
  const xTextoQr = xQr - 12;
  const { impresa, qr } = urlsVerificacion(siteUrl(), codigo);
  const anchoUrl = impresa.length * 11 * 0.6;
  const { d: dQr, modulos } = trazoQr(qr);

  // Bloque principal, armado de abajo hacia arriba como en el PDF.
  const bloques = [
    { alto: 16.8, antes: 0 },
    { alto: 24, antes: 18 },
    { alto: lhNombre * lineasNombre.length, antes: 8 },
    { alto: 24, antes: 24 },
    { alto: lhCurso * lineasCurso.length, antes: 6 },
    { alto: 22.5, antes: 14 },
  ];
  const altoContenido = bloques.reduce((total, bloque) => total + bloque.antes + bloque.alto, 0);
  const finCaja = topFirma - 8 - 32;
  const inicioCaja = finCaja - 20 - altoContenido - 20;
  const tops: number[] = [];
  let top = inicioCaja + 20;
  for (const bloque of bloques) {
    top += bloque.antes;
    tops.push(top);
    top += bloque.alto;
  }

  return (
    <svg viewBox={`0 0 ${ANCHO} ${ALTO}`} aria-hidden="true" className={className}>
      <rect width={ANCHO} height={ALTO} fill="#FFFFFF" />
      <use href={`#${ID_CURVAS}`} />

      {/* Encabezado: logo de trazo y nombre de la institución. */}
      <path d={LOGO_CERTIFICADO} transform={`translate(${IZQ} 60) scale(${25.3 / 48})`} fill="none" stroke={TEXTO} strokeWidth="3.2" />
      <text x={IZQ + (128 * 25.3) / 48 + 12} y={base(63, 19.5, 13)} fontSize="13" fill={TENUE} fontFamily={JAKARTA}>
        {TEXTOS_CERTIFICADO.institucion}
      </text>

      {/* Bloque de texto sobre un velo blanco. */}
      <rect x={IZQ} y={inicioCaja} width="600" height={finCaja - inicioCaja} fill="#FFFFFF" fillOpacity="0.88" />
      <text x={IZQ} y={base(tops[0], 16.8, 12)} fontSize="12" fill={MAGENTA} fontFamily={MONO}>
        {TEXTOS_CERTIFICADO.tipo}
      </text>
      <text x={IZQ} y={base(tops[1], 24, 16)} fontSize="16" fill={TENUE} fontFamily={JAKARTA}>
        {TEXTOS_CERTIFICADO.antesDelNombre}
      </text>
      <g fontFamily={JAKARTA} fontWeight="700" fill={TEXTO}>
        {lineasNombre.map((linea, i) => (
          <text key={i} x={IZQ} y={base(tops[2] + i * lhNombre, lhNombre, tamanoNombre)} fontSize={tamanoNombre} letterSpacing="-1.5">
            {linea}
          </text>
        ))}
      </g>
      <text x={IZQ} y={base(tops[3], 24, 16)} fontSize="16" fill={TENUE} fontFamily={JAKARTA}>
        {TEXTOS_CERTIFICADO.antesDelCurso}
      </text>
      <g fontFamily={JAKARTA} fontWeight="700" fill={TEXTO}>
        {lineasCurso.map((linea, i) => (
          <text key={i} x={IZQ} y={base(tops[4] + i * lhCurso, lhCurso, tamanoCurso)} fontSize={tamanoCurso}>
            {linea}
          </text>
        ))}
      </g>
      <text x={IZQ} y={base(tops[5], 22.5, 15)} fontSize="15" fill={TEXTO} fontFamily={JAKARTA}>
        {datos}
      </text>

      {/* Firmas. */}
      {FIRMAS_CERTIFICADO.map((firma, i) => {
        const x = IZQ + i * (200 + 32);
        return (
          <g key={firma.nombre}>
            <path d={firma.trazo} transform={`translate(${x} ${topFirma})`} fill="none" stroke={TEXTO} strokeWidth="2" strokeLinecap="round" />
            <rect x={x} y={topFirma + 44} width="200" height="1" fill={TEXTO} />
            <text x={x} y={base(topFirma + 53, 18.2, 14)} fontSize="14" fontWeight="600" fill={TEXTO} fontFamily={JAKARTA}>
              {firma.nombre}
            </text>
            <text x={x} y={base(topFirma + 71.2, 16.8, 12)} fontSize="12" fill={TENUE} fontFamily={JAKARTA}>
              {firma.cargo}
            </text>
          </g>
        );
      })}

      {/* Código, dirección de verificación y QR. */}
      <rect x={xTextoQr - anchoUrl - 8} y={centroQr - 22} width={anchoUrl + 8} height="44" fill="#FFFFFF" />
      <text x={xTextoQr} y={base(centroQr - 16.8, 18.2, 13)} fontSize="13" fontWeight="500" fill={TEXTO} fontFamily={MONO} textAnchor="end">
        {codigo}
      </text>
      <text x={xTextoQr} y={base(centroQr + 1.4, 15.4, 11)} fontSize="11" fill={TENUE} fontFamily={MONO} textAnchor="end">
        {impresa}
      </text>
      <rect x={xQr - 10} y={topQr - 10} width={ladoQr + 20} height={ladoQr + 20} fill="#FFFFFF" />
      <path d={dQr} transform={`translate(${xQr} ${topQr}) scale(${ladoQr / modulos})`} fill={TEXTO} shapeRendering="crispEdges" />
    </svg>
  );
}
