/**
 * Imprime un bloque de datos estructurados (JSON-LD) en el HTML.
 * Ver AUDIT-2026-09-15.md — P2-5.
 *
 * Genérico a propósito: recibe el objeto ya construido y no sabe nada de
 * cursos. `construirCursoJsonLd` (lib/seo/curso-jsonld.ts) lo alimenta hoy;
 * P2-6 le pasará `organizacionCompleta()` en la home y un `BreadcrumbList`
 * en el catálogo sin tocar este archivo.
 *
 * Sobre la CSP, que es la duda razonable al ver un <script> inline
 * ---------------------------------------------------------------
 * `src/lib/csp.ts` sirve una política con `'strict-dynamic'` y un nonce por
 * petición, así que un <script> inline sin nonce normalmente se bloquearía.
 * Este no: un `<script type="application/ld+json">` es un DATA BLOCK, no un
 * script. El algoritmo "prepare the script element" del HTML mira el `type`
 * y, al no ser un tipo ejecutable (classic/module/importmap), se detiene
 * antes de llegar a la comprobación de CSP. El navegador nunca lo ejecuta:
 * solo queda ahí como texto para quien lea el DOM.
 *
 * Se decidió NO pasarle el nonce igualmente, aunque se consideró: leerlo
 * exige `headers()`, y eso vuelve dinámica la página que lo renderice —
 * justo lo que P2-4 (cero caching/ISR) está en curso de arreglar. Añadir un
 * obstáculo al trabajo de otra persona por una precaución que no hace falta
 * sería un mal cambio.
 *
 * Si algún día un bloque de estos apareciera bloqueado en la consola del
 * navegador, el remedio es exactamente ese: aceptar un `nonce` por prop,
 * leerlo del header `x-nonce` que ya pone `src/proxy.ts:21`, y asumir el
 * coste de renderizado dinámico donde se use.
 *
 * Sobre `dangerouslySetInnerHTML`
 * -------------------------------
 * Es la forma correcta aquí, no un atajo. React escaparía el contenido de un
 * hijo de texto (`{"..."}`) como entidades HTML, y `&quot;` dentro de un
 * bloque JSON-LD lo vuelve ilegible para los rastreadores. Lo que entra es
 * siempre `JSON.stringify` de un objeto construido en el servidor, nunca
 * texto del usuario.
 *
 * `</script>` dentro de una cadena (una descripción de curso podría
 * contenerlo) cerraría la etiqueta antes de tiempo, así que se escapa la
 * barra. Es la mitigación estándar y la razón por la que esto no se deja al
 * `JSON.stringify` pelado.
 */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  const json = JSON.stringify(data).replace(/</g, "\\u003c");

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: json }}
    />
  );
}
