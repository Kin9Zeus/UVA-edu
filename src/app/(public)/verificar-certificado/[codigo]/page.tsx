import type { Metadata } from "next";
import { VerificacionCertificado } from "@/components/certificados/VerificacionCertificado";
import { normalizarCodigoCertificado } from "@/lib/certificados/codigo";
import { verificarCertificado } from "@/lib/certificados/verificar";

/**
 * P2-6 (AUDIT-2026-09-15.md) la lista entre las páginas que comparten la
 * descripción genérica del layout, pero el arreglo aquí NO es el mismo que en
 * catálogo o planes: esta página no debe estar en Google.
 *
 * Cada URL contiene el código de un certificado concreto, es decir el
 * resultado de una persona identificable. Indexarla convertiría el buscador
 * en un directorio de quién se graduó de qué. Lo impide el `noindex`.
 *
 * A propósito NO está en el `disallow` de robots.ts (SEO fase 14): una URL
 * bloqueada que alguien enlace desde LinkedIn puede quedar indexada sin
 * contenido, porque Google no puede leer el `noindex`. Rastreable + `noindex`
 * es lo que la saca del índice de verdad.
 *
 * Sin `canonical`: una canónica por código no tiene sentido en una página
 * que no se indexa.
 */
export const metadata: Metadata = {
  title: "Verificar certificado",
  description:
    "Comprueba la autenticidad de un certificado emitido por UVA a partir de su código.",
  robots: { index: false, follow: false },
};

/** "K7M2Q%20XP4TB" → "K7M2Q XP4TB". Un "%" suelto no es un 500: se deja como vino. */
function decodificar(texto: string) {
  try {
    return decodeURIComponent(texto);
  } catch {
    return texto;
  }
}

/**
 * Resultado de verificar un código (QR del certificado o el formulario).
 * La lógica, el límite por IP y el manejo de fallos viven en
 * `lib/certificados/verificar.ts`. Un código inexistente responde 200: "no
 * encontrado" es un resultado, no una ruta rota.
 */
export default async function VerificarCertificadoPage({
  params,
}: {
  params: Promise<{ codigo: string }>;
}) {
  const { codigo: crudo } = await params;
  const codigo = normalizarCodigoCertificado(decodificar(crudo));
  const resultado = await verificarCertificado(codigo);

  return <VerificacionCertificado resultado={resultado} codigo={codigo} />;
}
