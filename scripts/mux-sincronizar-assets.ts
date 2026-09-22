/**
 * Detecta lecciones que apuntan a un video que ya no existe en Mux y, con
 * `--aplicar`, las deja "sin video".
 *
 * Uso:
 *   npm run mux:sincronizar             → solo lista (no escribe nada)
 *   npm run mux:sincronizar -- --aplicar → corrige las que listó
 *
 * Por qué existe (P2-7, AUDIT-2026-09-22.md)
 * -------------------------------------------
 * Para liberar cupo del plan gratuito de Mux (10 videos) se borraron assets
 * desde el panel de Mux, y 7 lecciones quedaron en LISTO apuntando a videos
 * inexistentes: reproductor que no carga, miniatura rota. El webhook ahora
 * maneja `video.asset.deleted` para los borrados futuros, pero los que ya
 * ocurrieron no van a volver a mandar ese evento. Este script los encuentra
 * preguntándole a la API de Mux (solo lectura) por cada asset referenciado.
 *
 * Sirve también como chequeo periódico: sale con código 1 si encuentra
 * lecciones desincronizadas y no se pidió `--aplicar`.
 *
 * Qué hace `--aplicar`, por lección (lo mismo que "Quitar video" en el panel,
 * src/actions/admin/mux.ts, salvo borrar en Mux — el asset ya no existe):
 *   · deja la lección como recién creada (sin video, SUBIENDO), filtrando por
 *     el asset que se comprobó, para no pisar un video subido entre medio;
 *   · reinicia el segundo de reanudación de los estudiantes (conserva
 *     "completada");
 *   · borra la transcripción, que describe un video que ya no existe.
 *
 * Mismo motivo que scripts/mux-limpiar-assets.ts para armar sus propios
 * clientes después de loadEnvFile() en vez de importar los compartidos.
 */

process.loadEnvFile(".env.local");

import { createClient } from "@supabase/supabase-js";
import Mux, { NotFoundError } from "@mux/mux-node";

const URL_SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const MUX_TOKEN_ID = process.env.MUX_TOKEN_ID;
const MUX_TOKEN_SECRET = process.env.MUX_TOKEN_SECRET;

if (!URL_SUPABASE || !SERVICE_KEY) {
  console.error("\n❌ Faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en .env.local.\n");
  process.exit(1);
}
if (!MUX_TOKEN_ID || !MUX_TOKEN_SECRET) {
  console.error("\n❌ Faltan MUX_TOKEN_ID / MUX_TOKEN_SECRET en .env.local.\n");
  process.exit(1);
}

const supabase = createClient(URL_SUPABASE, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const mux = new Mux({ tokenId: MUX_TOKEN_ID, tokenSecret: MUX_TOKEN_SECRET });

const aplicar = process.argv.includes("--aplicar");

/** Mismos valores que LECCION_SIN_VIDEO en src/actions/admin/mux.ts. */
const LECCION_SIN_VIDEO = {
  id_video_mux: null,
  id_mux_asset_id: null,
  id_mux_upload_id: null,
  duracion: null,
  estado_procesamiento: "SUBIENDO",
  error_procesamiento: null,
};

type Leccion = {
  id: string;
  titulo: string;
  id_mux_asset_id: string;
  modulo: { curso: { titulo: string } | null } | null;
};

async function existeEnMux(assetId: string): Promise<boolean> {
  try {
    await mux.video.assets.retrieve(assetId);
    return true;
  } catch (error) {
    if (error instanceof NotFoundError) return false;
    throw error;
  }
}

async function main() {
  const { data, error } = await supabase
    .from("lecciones")
    .select("id, titulo, id_mux_asset_id, modulo:modulos!inner(curso:cursos(titulo))")
    .not("id_mux_asset_id", "is", null);

  if (error) {
    console.error(`\n❌ No pude leer las lecciones: ${error.message}\n`);
    process.exit(1);
  }

  const lecciones = (data ?? []) as unknown as Leccion[];
  console.log(`\nComprobando ${lecciones.length} lección(es) con video contra la API de Mux...\n`);

  const faltantes: Leccion[] = [];
  for (const leccion of lecciones) {
    if (!(await existeEnMux(leccion.id_mux_asset_id))) faltantes.push(leccion);
  }

  if (faltantes.length === 0) {
    console.log("✅ Todas las lecciones apuntan a videos que existen en Mux.\n");
    return;
  }

  console.log(`${faltantes.length} lección(es) apuntan a un video que ya no existe en Mux:\n`);
  for (const leccion of faltantes) {
    console.log(`  · ${leccion.modulo?.curso?.titulo ?? "¿curso?"} — ${leccion.titulo} (asset ${leccion.id_mux_asset_id})`);
  }

  if (!aplicar) {
    console.log("\nNo se cambió nada. Para dejarlas sin video: npm run mux:sincronizar -- --aplicar\n");
    process.exitCode = 1;
    return;
  }

  console.log("");
  let corregidas = 0;
  for (const leccion of faltantes) {
    const { error: errorLeccion, count } = await supabase
      .from("lecciones")
      .update(LECCION_SIN_VIDEO, { count: "exact" })
      .eq("id", leccion.id)
      .eq("id_mux_asset_id", leccion.id_mux_asset_id);

    if (errorLeccion || !count) {
      console.error(`❌ ${leccion.titulo} — ${errorLeccion?.message ?? "cambió mientras corría el script, se omite"}`);
      continue;
    }

    await supabase.from("progreso").update({ segundo_actual: 0 }).eq("id_leccion", leccion.id);
    await supabase.from("transcripciones_video").delete().eq("id_leccion", leccion.id);
    corregidas += 1;
    console.log(`✅ ${leccion.titulo}`);
  }

  console.log(`\n${corregidas} de ${faltantes.length} lección(es) quedaron sin video.\n`);
  if (corregidas < faltantes.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error("\n❌ Error inesperado:", error);
  process.exit(1);
});
