/**
 * Busca páginas huérfanas: URLs del sitemap a las que no llega ningún enlace
 * desde el resto del sitio (SEO fase 14, «páginas de escuela como landings»:
 * «ninguna página pública sin enlaces que lleguen a ella»). Es la misma
 * comprobación que hace Screaming Frog cruzando el rastreo con el sitemap.
 *
 * Uso:
 *   npm run audit:huerfanas
 *   npm run audit:huerfanas -- --base-url=http://localhost:3000
 *
 * Flags:
 *   --base-url=<url>   Default: https://uva-edu-production.up.railway.app
 *   --maximo=<n>       Páginas a rastrear como mucho. Default: 500
 *
 * Qué hace: lee /sitemap.xml, rastrea como un visitante sin sesión desde la
 * portada siguiendo los <a href> del mismo dominio (sin pasar por /dashboard,
 * /admin ni /api), y cuenta qué páginas enlazan a cada URL. Un enlace de una
 * página a sí misma no cuenta. Las URLs del sitemap se rastrean también,
 * aunque nadie las enlace, para ver a dónde enlazan ellas.
 *
 * Termina con código 1 si hay huérfanas o enlaces internos rotos (4xx/5xx).
 */

const args = new Map(
  process.argv.slice(2).flatMap((a) => {
    const m = a.match(/^--([^=]+)=(.*)$/);
    return m ? [[m[1], m[2]] as const] : [];
  }),
);
const BASE = new URL(args.get("base-url") ?? "https://uva-edu-production.up.railway.app").origin;
const MAXIMO = Number(args.get("maximo") ?? 500);
/** Algunos filtros del borde rechazan peticiones sin agente: se presenta como un rastreador genérico. */
const CABECERAS = { "User-Agent": "Mozilla/5.0 (compatible; uva-auditoria-huerfanas/1.0)" };
const PRIVADAS = /^\/(dashboard|admin|api|auth|seguridad|vista-previa|dev)(\/|$)/;

/** Ruta normalizada: sin fragmento, sin consulta (los filtros canonizan a la limpia) y sin barra final. */
function normalizar(href: string, desde: string): string | null {
  let url: URL;
  try {
    url = new URL(href, desde);
  } catch {
    return null;
  }
  if (url.origin !== BASE) return null;
  const ruta = url.pathname.replace(/\/+$/, "") || "/";
  return PRIVADAS.test(ruta) ? null : ruta;
}

function enlacesDe(html: string, desde: string): Set<string> {
  const rutas = new Set<string>();
  for (const m of html.matchAll(/<a\b[^>]*\bhref\s*=\s*["']([^"']+)["']/gi)) {
    const ruta = normalizar(m[1].replace(/&amp;/g, "&"), desde);
    if (ruta) rutas.add(ruta);
  }
  return rutas;
}

async function rutasDelSitemap(): Promise<string[]> {
  const respuesta = await fetch(`${BASE}/sitemap.xml`, { headers: CABECERAS });
  if (!respuesta.ok) throw new Error(`/sitemap.xml respondió ${respuesta.status}`);
  const xml = await respuesta.text();
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)]
    .map((m) => {
      const url = new URL(m[1].trim());
      // El sitemap usa el dominio de NEXT_PUBLIC_SITE_URL; se rastrea en BASE.
      return url.pathname.replace(/\/+$/, "") || "/";
    })
    .filter((ruta) => !PRIVADAS.test(ruta));
}

async function main() {
  const sitemap = await rutasDelSitemap();
  const entrantes = new Map<string, Set<string>>();
  const rotos: { ruta: string; estado: number; desde: string[] }[] = [];
  const pendientes = ["/", ...sitemap];
  const vistas = new Set<string>();

  while (pendientes.length > 0 && vistas.size < MAXIMO) {
    const ruta = pendientes.shift()!;
    if (vistas.has(ruta)) continue;
    vistas.add(ruta);

    const respuesta = await fetch(`${BASE}${ruta}`, { redirect: "follow", headers: CABECERAS });
    if (!respuesta.ok) {
      rotos.push({ ruta, estado: respuesta.status, desde: [...(entrantes.get(ruta) ?? [])] });
      continue;
    }
    if (!respuesta.headers.get("content-type")?.includes("text/html")) continue;

    // Si redirigió (slug viejo, UUID), los enlaces cuelgan de la ruta final.
    const final = normalizar(respuesta.url, BASE) ?? ruta;
    for (const destino of enlacesDe(await respuesta.text(), `${BASE}${final}`)) {
      if (destino === final) continue;
      if (!entrantes.has(destino)) entrantes.set(destino, new Set());
      entrantes.get(destino)!.add(final);
      if (!vistas.has(destino)) pendientes.push(destino);
    }
  }

  const huerfanas = sitemap.filter((ruta) => ruta !== "/" && (entrantes.get(ruta)?.size ?? 0) === 0);

  console.log(`Rastreadas: ${vistas.size} páginas de ${BASE} (sitemap: ${sitemap.length} URLs)`);
  if (vistas.size >= MAXIMO) console.log(`⚠️  Se llegó al máximo de ${MAXIMO}: sube --maximo para rastrear todo.`);

  if (huerfanas.length === 0) console.log("✅ Ninguna página del sitemap está huérfana.");
  else {
    console.log(`❌ ${huerfanas.length} huérfana(s): están en el sitemap pero ningún enlace llega a ellas.`);
    for (const ruta of huerfanas) console.log(`   ${ruta}`);
  }

  if (rotos.length === 0) console.log("✅ Ningún enlace interno roto.");
  else {
    console.log(`❌ ${rotos.length} enlace(s) interno(s) roto(s):`);
    for (const r of rotos) console.log(`   ${r.estado} ${r.ruta}${r.desde.length ? ` (desde ${r.desde.slice(0, 3).join(", ")})` : ""}`);
  }

  const pocas = sitemap
    .map((ruta) => [ruta, entrantes.get(ruta)?.size ?? 0] as const)
    .filter(([ruta, n]) => ruta !== "/" && n === 1);
  if (pocas.length > 0) {
    console.log(`ℹ️  Con un solo enlace entrante (frágiles): ${pocas.map(([r]) => r).join(", ")}`);
  }

  process.exitCode = huerfanas.length > 0 || rotos.length > 0 ? 1 : 0;
}

main().catch((error) => {
  console.error("❌ No se pudo completar el rastreo:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
