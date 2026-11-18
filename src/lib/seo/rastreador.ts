import { headers } from "next/headers";

/**
 * Buscadores, rastreadores de IA y vistas previas de redes. El `isBot` de
 * `next/server` no reconoce ClaudeBot, PerplexityBot ni OAI-SearchBot; «bot»
 * cubre a casi todos, y los que leen a pedido de una persona
 * (`ChatGPT-User`, `Claude-User`, `Perplexity-User`) van por nombre.
 */
const RASTREADOR = /bot|crawler|spider|slurp|facebookexternalhit|-User\b|WhatsApp|Google-InspectionTool/i;

export function esUserAgentDeRastreador(userAgent: string | null): boolean {
  return userAgent !== null && RASTREADOR.test(userAgent);
}

/**
 * La mayoría de los rastreadores de IA no ejecutan JavaScript, y lo que va
 * dentro de un `<Suspense>` con esqueleto llega en un bloque `<div hidden>`
 * que JavaScript pone en su sitio. A ellos se les manda la página completa,
 * sin esqueleto (SEO/GEO fase 14, tarea «contenido renderizado en el
 * servidor», paso 2). Las personas siguen viendo el esqueleto.
 */
export async function esRastreador(): Promise<boolean> {
  return esUserAgentDeRastreador((await headers()).get("user-agent"));
}
