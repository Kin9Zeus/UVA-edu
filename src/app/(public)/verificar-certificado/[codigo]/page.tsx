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
 * en un directorio de quién se graduó de qué. `robots.ts` ya la tiene en su
 * `disallow`, y esto lo dice también en la propia página.
 *
 * Las dos capas no sobran, hacen cosas distintas: `Disallow` impide que
 * Google la RASTREE, pero una URL enlazada desde fuera puede acabar indexada
 * igual, sin contenido. El `noindex` es lo que lo impide de verdad — y sí,
 * Google solo lo ve si puede rastrear la página, así que hoy manda el
 * robots.txt; esto es lo que protege el día que alguien lo afloje sin
 * acordarse de por qué estaba.
 *
 * Sin `canonical`: una canónica por código no tiene sentido en una página
 * que no se indexa.
 */
export const metadata: Metadata = {
  title: "U.V.A. — Verificar certificado",
  description:
    "Comprueba la autenticidad de un certificado emitido por U.V.A. a partir de su código.",
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
