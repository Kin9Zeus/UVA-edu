/**
 * Publica una versión de un texto legal que ya está sembrada como BORRADOR.
 *
 * Uso:
 *   npm run legal:publicar -- <slug> <version> <fecha AAAA-MM-DD> --admin <correo>
 *   npm run legal:publicar -- terminos 1.0 2026-11-15 --admin alguien@uva.com            # solo simula
 *   npm run legal:publicar -- terminos 1.0 2026-11-15 --admin alguien@uva.com --confirmar # publica
 *   ENV_FILE=.env.produccion.local npm run legal:publicar -- ...                          # otro entorno
 *
 * Por qué es un script y no un botón: publicar un texto legal es raro (una o
 * dos veces al año), necesita la aprobación escrita del abogado y del CEO, y
 * no se puede deshacer. Ver el artefacto "UVA: marco legal de la plataforma y
 * textos oficiales", sección "Próximos pasos".
 *
 * Por defecto SOLO SIMULA: comprueba todo, imprime qué haría y contra qué
 * proyecto, y sale. Publica solo con `--confirmar`. Así el mismo comando que se
 * ensaya en staging se repite en producción añadiendo una palabra.
 *
 * Qué comprueba antes de publicar:
 *   · que el slug sea uno de los cinco textos y la versión exista como BORRADOR;
 *   · que el contenido sea válido (el mismo esquema con el que lo lee la página);
 *   · que NO quede ningún dato entre corchetes ("[NIT]", "[30]"): lo que va entre
 *     corchetes es un dato que solo UVA puede completar y "debe reemplazarse";
 *   · que la fecha de vigencia no esté en el pasado: un texto no puede regir
 *     hacia atrás, y la fecha es la que se usa para demostrar qué versión
 *     aceptó cada persona;
 *   · que `--admin` sea el correo de un administrador real: la publicación queda
 *     firmada en `bitacora_administrativa`.
 *
 * Al publicar, el trigger de supabase/sql/130 sella `publicado_en` y la fila
 * queda inmutable. La página tarda hasta 5 minutos en mostrarla (caché).
 */

try {
  process.loadEnvFile(process.env.ENV_FILE ?? ".env.local");
} catch {
  // Sin archivo: se usan las variables ya presentes en process.env.
}

import { createClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function fallar(mensaje: string): never {
  console.error(`❌ ${mensaje}`);
  process.exit(1);
}

function leerArgumentos(argv: string[]) {
  const posicionales: string[] = [];
  let admin: string | undefined;
  let confirmar = false;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--confirmar") confirmar = true;
    else if (arg === "--admin") admin = argv[(i += 1)];
    else if (arg.startsWith("--")) fallar(`Opción desconocida: ${arg}`);
    else posicionales.push(arg);
  }
  const [slug, version, fecha] = posicionales;
  if (!slug || !version || !fecha || !admin || posicionales.length > 3) {
    fallar("Uso: npm run legal:publicar -- <slug> <version> <AAAA-MM-DD> --admin <correo> [--confirmar]");
  }
  return { slug, version, fecha, admin, confirmar };
}

/** Hoy en Colombia (AAAA-MM-DD): la fecha de vigencia se cuenta en hora local, no en UTC. */
function hoyEnColombia(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date());
}

async function main() {
  const { slug, version, fecha, admin: correoAdmin, confirmar } = leerArgumentos(process.argv.slice(2));

  if (!URL || !SERVICE_KEY) {
    fallar("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY (en el ENV_FILE o en el entorno).");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || Number.isNaN(Date.parse(fecha))) {
    fallar(`La fecha "${fecha}" no es válida: usa AAAA-MM-DD.`);
  }
  if (fecha < hoyEnColombia()) {
    fallar(`La fecha de vigencia ${fecha} ya pasó (hoy es ${hoyEnColombia()} en Colombia). Un texto no rige hacia atrás.`);
  }

  // Import diferido por el mismo motivo que en scripts/rls-test.ts.
  const { esSlugLegal } = await import("../../src/lib/legal/slugs");
  const { parsearBloques, corchetesSinResolver } = await import("../../src/lib/legal/bloques");

  if (!esSlugLegal(slug)) fallar(`"${slug}" no es un texto legal conocido.`);

  const supabase = createClient(URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log(`Destino: ${new globalThis.URL(URL).host}`);

  const { data: texto, error: errTexto } = await supabase
    .from("textos_legales")
    .select("id, estado, titulo, contenido")
    .eq("slug", slug)
    .eq("version", version)
    .maybeSingle();
  if (errTexto) fallar(`No pude leer el texto: ${errTexto.message}`);
  if (!texto) fallar(`No existe ${slug} v${version}. Siémbralo primero con npm run legal:sembrar.`);
  if (texto.estado !== "BORRADOR") fallar(`${slug} v${version} ya está ${texto.estado}: una versión publicada no se vuelve a publicar.`);

  let bloques;
  try {
    bloques = parsearBloques(texto.contenido);
  } catch (error) {
    fallar(error instanceof Error ? error.message : String(error));
  }

  const pendientes = corchetesSinResolver(bloques, texto.titulo);
  if (pendientes.length > 0) {
    fallar(
      `${slug} v${version} todavía tiene ${pendientes.length} dato(s) entre corchetes sin completar: ${pendientes.join(", ")}.\n` +
        "   Complétalos en src/content/legal/, vuelve a sembrar y repite.",
    );
  }

  const { data: perfil, error: errPerfil } = await supabase
    .from("perfiles")
    .select("id, rol, estado")
    .eq("correo", correoAdmin.trim().toLowerCase())
    .maybeSingle();
  if (errPerfil) fallar(`No pude buscar al administrador: ${errPerfil.message}`);
  if (!perfil || perfil.rol !== "ADMINISTRADOR" || perfil.estado !== "ACTIVO") {
    fallar(`"${correoAdmin}" no es un administrador activo de este proyecto.`);
  }

  // Si ya hay otra versión publicada de este texto, se avisa cuál dejará de ser la vigente.
  const { data: vigentes } = await supabase
    .from("textos_legales")
    .select("version, vigente_desde")
    .eq("slug", slug)
    .eq("estado", "PUBLICADO")
    .order("vigente_desde", { ascending: false })
    .limit(1);
  const anterior = vigentes?.[0];

  // Medianoche en Colombia (UTC-5, sin horario de verano) del día indicado.
  const vigenteDesde = `${fecha}T00:00:00-05:00`;

  console.log("");
  console.log(`  Texto:        ${slug} (${texto.titulo})`);
  console.log(`  Versión:      ${version}`);
  console.log(`  Vigente desde: ${fecha} 00:00 (hora de Colombia)`);
  console.log(`  Publica:      ${correoAdmin}`);
  if (anterior) {
    console.log(`  Reemplaza a:  v${anterior.version} (vigente desde ${anterior.vigente_desde}) a partir de la fecha de vigencia`);
  }
  console.log("");

  if (!confirmar) {
    console.log("Simulación: todo en orden. No se cambió nada. Agrega --confirmar para publicar.");
    return;
  }

  // `.eq("estado", "BORRADOR")` y `.select()`: si alguien publicó la misma
  // versión entre la lectura y este update, no se pisa y se avisa.
  const { data: publicado, error: errPublicar } = await supabase
    .from("textos_legales")
    .update({ estado: "PUBLICADO", vigente_desde: vigenteDesde })
    .eq("id", texto.id)
    .eq("estado", "BORRADOR")
    .select("id");
  if (errPublicar) fallar(`No pude publicar: ${errPublicar.message}`);
  if (!publicado || publicado.length !== 1) fallar("Nadie publicó nada: el texto ya no estaba en BORRADOR.");

  const { error: errBitacora } = await supabase.from("bitacora_administrativa").insert({
    id_admin: perfil.id,
    accion: "PUBLICAR_TEXTO_LEGAL",
    entidad_afectada: "textos_legales",
    id_entidad_afectada: texto.id,
    detalles: `${slug} v${version}, vigente desde ${fecha}`,
  });
  if (errBitacora) {
    // La publicación ya ocurrió y no se puede deshacer; lo que falló es la
    // firma. Se dice en voz alta para registrarla a mano, no se calla.
    console.error(
      `⚠️  Publicado, pero NO pude firmarlo en bitacora_administrativa: ${errBitacora.message}. Regístralo a mano.`,
    );
    process.exitCode = 1;
  }

  console.log(`✅ ${slug} v${version} publicado, vigente desde ${fecha}. La página puede tardar hasta 5 minutos en mostrarlo.`);
}

main().catch((error) => {
  console.error("\nError inesperado publicando el texto legal:", error);
  process.exitCode = 1;
});
