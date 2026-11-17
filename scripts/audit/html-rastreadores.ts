/**
 * Qué contenido llega en el HTML sin JavaScript, por página pública y por
 * rastreador (SEO/GEO fase 14, tarea «contenido renderizado en el servidor»).
 *
 * Uso:
 *   npm run audit:html-rastreadores
 *   npm run audit:html-rastreadores -- --base-url=https://uvarq.com --env=.env.produccion.local
 *   npm run audit:html-rastreadores -- --curso=<slug> --escuela=<slug>
 *
 * Flags:
 *   --base-url=<url>   Default: http://localhost:3000 (un `next start`, no `next dev`)
 *   --env=<archivo>    De dónde sale el contenido esperado. Default: .env.local
 *                      (staging). Debe ser la misma base que sirve --base-url.
 *                      Solo usa la URL y la clave anónima: lo mismo que un visitante.
 *   --curso, --escuela Por defecto, la primera de cada una en el sitemap.
 *
 * Por qué existe
 * --------------
 * Google ejecuta JavaScript; la mayoría de los rastreadores de IA no. El
 * contenido esperado (descripción, temario, instructores, preguntas) se lee de
 * la base con la clave anónima y se busca en el HTML de cada respuesta, sin
 * cookies. Cada celda dice:
 *
 *   ✅  en el HTML inicial, visible.
 *   🟡  en el HTML, pero dentro de un bloque `<div hidden>` de streaming que
 *       JavaScript pone en su sitio: un rastreador sin JS puede ignorarlo.
 *   ❌  no está en el HTML.
 *
 * La tabla que imprime es la de la definición de terminado de la tarea en
 * Notion. Hay que volver a correrlo contra uvarq.com cuando se migre.
 */
import { createClient } from "@supabase/supabase-js";
import { PREGUNTAS_CENTRO_AYUDA } from "../../src/lib/soporte";

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => a.replace(/^--/, "").split("=") as [string, string]),
);
const BASE = (args["base-url"] ?? "http://localhost:3000").replace(/\/$/, "");
process.loadEnvFile(args.env ?? ".env.local");

// User-agents reales, tal como los documenta cada empresa.
const AGENTES: Record<string, string> = {
  Navegador: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
  Googlebot: "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
  Bingbot: "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)",
  GPTBot: "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.1; +https://openai.com/gptbot)",
  "OAI-SearchBot": "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; OAI-SearchBot/1.0; +https://openai.com/searchbot)",
  ClaudeBot: "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; ClaudeBot/1.0; +claudebot@anthropic.com)",
  "Claude-SearchBot": "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Claude-SearchBot/1.0; +searchbot@anthropic.com)",
  PerplexityBot: "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)",
};

type Esperado = { contenido: string; textos: string[] };

const texto = (html: string) =>
  html
    .replace(/<script[\s\S]*?<\/script>/g, " ")
    .replace(/<style[\s\S]*?<\/style>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ");
const normal = (s: string) => s.replace(/\s+/g, " ").trim().slice(0, 80);

/** El HTML de streaming llega después del primer `<div hidden id="S:n">`. */
function partes(html: string) {
  const corte = html.search(/<div hidden id="S:\d+"/);
  const inicial = corte === -1 ? html : html.slice(0, corte);
  return { head: html.slice(0, html.indexOf("</head>")), inicial: texto(inicial), todo: texto(html) };
}

function celda(p: ReturnType<typeof partes>, textos: string[]) {
  if (textos.length === 0) return "—";
  const buscados = textos.map(normal);
  if (buscados.every((t) => p.inicial.includes(t))) return "✅";
  if (buscados.every((t) => p.todo.includes(t))) return "🟡";
  const faltan = buscados.filter((t) => !p.todo.includes(t)).length;
  return `❌ ${faltan}/${buscados.length}`;
}

async function urlsDelSitemap() {
  const xml = await (await fetch(`${BASE}/sitemap.xml`)).text();
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname);
}

async function main() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const urls = await urlsDelSitemap();
  const cursoSlug = args.curso ?? urls.find((u) => u.startsWith("/cursos/") && !u.includes("rls-test"))?.split("/")[2];
  const escuelaSlug = args.escuela ?? urls.find((u) => u.startsWith("/catalogo/"))?.split("/")[2];
  if (!cursoSlug || !escuelaSlug) throw new Error("El sitemap no trae un curso o una escuela: pásalos con --curso y --escuela.");

  const { data: curso, error } = await supabase
    .from("cursos")
    .select("id, titulo, descripcion, modulos(titulo, lecciones(titulo))")
    .eq("slug", cursoSlug)
    .single();
  if (error) throw error;
  const { data: instructores } = await supabase.from("curso_instructores_publico").select("nombre").eq("id_curso", curso.id);
  const { data: cursos } = await supabase.from("cursos").select("titulo, slug").eq("mostrado", true);
  const { data: escuela } = await supabase.from("categorias").select("nombre, curso_categorias(curso:cursos(titulo, mostrado))").eq("slug", escuelaSlug).single();
  const titulosEscuela = (escuela?.curso_categorias ?? [])
    .map((cc) => (Array.isArray(cc.curso) ? cc.curso[0] : cc.curso) as { titulo: string; mostrado: boolean } | null)
    .filter((c) => c?.mostrado)
    .map((c) => c!.titulo);

  const paginas: { ruta: string; esperado: Esperado[] }[] = [
    { ruta: "/", esperado: [] },
    { ruta: "/catalogo", esperado: [{ contenido: "Cursos publicados (títulos)", textos: (cursos ?? []).map((c) => c.titulo) }] },
    { ruta: `/catalogo/${escuelaSlug}`, esperado: [{ contenido: "Cursos de la escuela (títulos)", textos: titulosEscuela }] },
    {
      ruta: `/cursos/${cursoSlug}`,
      esperado: [
        { contenido: "Título", textos: [curso.titulo] },
        { contenido: "Descripción completa", textos: curso.descripcion ? [curso.descripcion.slice(-80)] : [] },
        { contenido: "Temario: módulos", textos: curso.modulos.map((m) => m.titulo) },
        { contenido: "Temario: clases", textos: curso.modulos.flatMap((m) => m.lecciones.map((l) => l.titulo)) },
        { contenido: "Instructores", textos: (instructores ?? []).map((i) => i.nombre) },
      ],
    },
    {
      ruta: "/soporte",
      esperado: [
        { contenido: "Preguntas frecuentes", textos: PREGUNTAS_CENTRO_AYUDA.map((p) => p.pregunta) },
        {
          contenido: "Respuestas",
          textos: PREGUNTAS_CENTRO_AYUDA.flatMap((p) => (typeof p.respuesta === "string" ? [p.respuesta] : [])),
        },
      ],
    },
  ];

  const nombres = Object.keys(AGENTES);
  console.log(`\nHTML sin JavaScript — ${BASE} — ${new Date().toISOString().slice(0, 10)}\n`);
  console.log("✅ en el HTML inicial · 🟡 solo en un bloque oculto de streaming · ❌ ausente\n");

  for (const { ruta, esperado } of paginas) {
    const filas: Record<string, string[]> = { "Estado HTTP": [], "Tiempo (ms)": [], "Título y descripción en <head>": [], "JSON-LD": [], "Enlaces a cursos (iniciales/total)": [] };
    for (const e of esperado) filas[e.contenido] = [];

    for (const nombre of nombres) {
      const inicio = performance.now();
      const res = await fetch(`${BASE}${ruta}`, { headers: { "user-agent": AGENTES[nombre] }, redirect: "manual" });
      const html = await res.text();
      const ms = Math.round(performance.now() - inicio);
      const p = partes(html);
      const corte = html.search(/<div hidden id="S:\d+"/);
      const enlaces = (s: string) => new Set(s.match(/href="\/cursos\/[^"/?#]+"/g) ?? []).size;

      filas["Estado HTTP"].push(String(res.status));
      filas["Tiempo (ms)"].push(String(ms));
      filas["Título y descripción en <head>"].push(/<title>/.test(p.head) && /name="description"/.test(p.head) ? "✅" : "❌");
      // Solo las etiquetas: el texto también va repetido en los datos de React.
      filas["JSON-LD"].push(String((html.match(/<script type="application\/ld\+json"/g) ?? []).length));
      filas["Enlaces a cursos (iniciales/total)"].push(`${enlaces(corte === -1 ? html : html.slice(0, corte))}/${enlaces(html)}`);
      for (const e of esperado) filas[e.contenido].push(celda(p, e.textos));
    }

    console.log(`### ${ruta}\n`);
    console.log(`| Contenido | ${nombres.join(" | ")} |`);
    console.log(`| --- | ${nombres.map(() => "---").join(" | ")} |`);
    for (const [contenido, celdas] of Object.entries(filas)) console.log(`| ${contenido} | ${celdas.join(" | ")} |`);
    console.log();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
