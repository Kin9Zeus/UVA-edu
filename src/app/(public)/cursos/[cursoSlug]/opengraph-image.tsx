import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { getCursoPublico } from "@/lib/curso";
import { formatHoras } from "@/lib/admin/format";
import { NIVEL_LEGIBLE } from "@/lib/seo/curso-jsonld";
import { TRAZO_LOGO, VIEWBOX_LOGO } from "@/components/home/LogoUva";
import { logError } from "@/lib/log";

/**
 * Imagen al compartir un curso (SEO fase 14, tarea de metadatos en Notion):
 * título, escuela, nivel y duración sobre la identidad de UVA. Reemplaza a la
 * portada como imagen social: se lee igual en todos los cursos y no depende
 * de cómo sea cada foto. Nunca usa miniaturas de Mux (su token vence).
 *
 * Los datos salen de `getCursoPublico(slug, null)`, la versión anónima y
 * cacheada: lo mismo que ve un visitante sin sesión, sin cookies.
 *
 * Si el curso no existe o la consulta falla, devuelve la tarjeta de marca
 * (solo el logo) en vez de un error: una vista previa sin imagen es peor que
 * una genérica, y el fallo queda registrado.
 */
export const alt = "Curso en línea de UVA";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Colores del tema oscuro (globals.css): uva-bg, uva-text y uva-text-muted
// (FAFAFA al 60 % sobre el fondo); el borde es un gris que se ve sobre el fondo.
const FONDO = "#09090B";
const TEXTO = "#FAFAFA";
const TEXTO_SUAVE = "#A1A1AA";
const BORDE = "#3F3F46";

// La misma Plus Jakarta Sans del certificado: ya está en el repositorio y
// `outputFileTracingIncludes` (next.config.ts) la lleva al despliegue.
const fuente = readFile(join(process.cwd(), "src", "lib", "certificados", "fonts", "PlusJakartaSans-Bold.ttf"));

function Logo({ ancho }: { ancho: number }) {
  return (
    <svg
      width={ancho}
      height={(ancho * 487) / 1501}
      viewBox={VIEWBOX_LOGO}
      fill="none"
      stroke={TEXTO}
      strokeWidth={40}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={TRAZO_LOGO} />
    </svg>
  );
}

function Dato({ texto }: { texto: string }) {
  return (
    <div
      style={{
        display: "flex",
        padding: "10px 22px",
        border: `2px solid ${BORDE}`,
        borderRadius: 10,
        fontSize: 28,
        fontWeight: 700,
        color: TEXTO_SUAVE,
      }}
    >
      {texto}
    </div>
  );
}

export default async function Image({ params }: { params: Promise<{ cursoSlug: string }> }) {
  const { cursoSlug } = await params;
  const opciones = {
    ...size,
    fonts: [{ name: "Jakarta", data: await fuente, weight: 700 as const, style: "normal" as const }],
  };

  let curso = null;
  try {
    curso = await getCursoPublico(cursoSlug, null);
  } catch (error) {
    logError("opengraph-image:curso", "no se pudo leer el curso para su imagen social", error, {
      cursoSlug,
      nivel: "warning",
    });
  }

  if (!curso) {
    return new ImageResponse(
      (
        <div style={{ display: "flex", width: "100%", height: "100%", background: FONDO, alignItems: "center", justifyContent: "center" }}>
          <Logo ancho={700} />
        </div>
      ),
      opciones,
    );
  }

  const escuela = curso.categorias[0]?.nombre;
  const datos = [
    NIVEL_LEGIBLE[curso.nivel],
    curso.duracionTotalSegundos > 0 ? formatHoras(curso.duracionTotalSegundos) : null,
  ].filter((dato): dato is string => Boolean(dato));
  // Títulos muy largos bajan de tamaño en vez de cortarse.
  const tamanoTitulo = curso.titulo.length > 70 ? 56 : curso.titulo.length > 40 ? 68 : 80;

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          width: "100%",
          height: "100%",
          padding: 72,
          background: FONDO,
          color: TEXTO,
          fontFamily: "Jakarta",
        }}
      >
        <Logo ancho={190} />
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {escuela && (
            <div style={{ display: "flex", fontSize: 30, fontWeight: 700, color: TEXTO_SUAVE }}>{escuela}</div>
          )}
          <div
            style={{
              display: "flex",
              fontSize: tamanoTitulo,
              fontWeight: 700,
              lineHeight: 1.08,
              letterSpacing: -1.5,
              maxHeight: tamanoTitulo * 1.08 * 3,
              overflow: "hidden",
              // Cada palabra es una caja: el generador corta en los guiones
              // («V-» / «Ray») si el título va como un solo texto.
              flexWrap: "wrap",
              columnGap: tamanoTitulo * 0.26,
            }}
          >
            {curso.titulo.split(/\s+/).map((palabra, indice) => (
              <span key={indice}>{palabra}</span>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", gap: 14 }}>
            {datos.map((dato) => (
              <Dato key={dato} texto={dato} />
            ))}
          </div>
          <div style={{ display: "flex", fontSize: 28, fontWeight: 700, color: TEXTO_SUAVE }}>Curso en línea</div>
        </div>
      </div>
    ),
    opciones,
  );
}
