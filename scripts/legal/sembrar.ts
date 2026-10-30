/**
 * Copia los textos legales de `src/content/legal/` a la tabla
 * `textos_legales` como BORRADOR.
 *
 * Uso:
 *   npm run legal:sembrar
 *   ENV_FILE=.env.produccion.local npm run legal:sembrar   # otro entorno
 *
 * Es idempotente: se puede correr las veces que haga falta.
 *   · Si la versión no existe, la crea como BORRADOR.
 *   · Si existe como BORRADOR, refresca título y contenido (así se corrige un
 *     borrador antes de publicarlo).
 *   · Si existe como PUBLICADA y es idéntica, no hace nada.
 *   · Si existe como PUBLICADA y es DISTINTA, se niega y sale con código 1: una
 *     versión publicada no se cambia, se sube una versión nueva (el trigger de
 *     supabase/sql/130 lo impediría igual, esto lo dice antes y con claridad).
 *
 * Antes de escribir imprime contra qué proyecto de Supabase va, porque el
 * mismo script sirve para staging y producción según `ENV_FILE`.
 */

try {
  process.loadEnvFile(process.env.ENV_FILE ?? ".env.local");
} catch {
  // Sin archivo: se usan las variables ya presentes en process.env.
}

import { isDeepStrictEqual } from "node:util";
import { createClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function main() {
  if (!URL || !SERVICE_KEY) {
    throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY (en el ENV_FILE o en el entorno).");
  }
  // Import diferido por el mismo motivo que en scripts/rls-test.ts: un import
  // estático se eleva por encima del loadEnvFile de arriba.
  const { TEXTOS_LEGALES_FUENTE } = await import("../../src/content/legal");
  const { parsearBloques } = await import("../../src/lib/legal/bloques");

  console.log(`Destino: ${new globalThis.URL(URL).host}`);
  if (TEXTOS_LEGALES_FUENTE.length === 0) {
    console.log("No hay textos en src/content/legal/: nada que sembrar.");
    return;
  }

  const supabase = createClient(URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let fallos = 0;
  for (const fuente of TEXTOS_LEGALES_FUENTE) {
    const etiqueta = `${fuente.slug} v${fuente.version}`;
    try {
      // Se valida lo mismo que validará la página al leerlo.
      const bloques = parsearBloques(fuente.bloques);

      const { data: existente, error } = await supabase
        .from("textos_legales")
        .select("id, estado, titulo, contenido")
        .eq("slug", fuente.slug)
        .eq("version", fuente.version)
        .maybeSingle();
      if (error) throw new Error(`no pude leer ${etiqueta}: ${error.message}`);

      if (!existente) {
        const { error: errInsert } = await supabase.from("textos_legales").insert({
          slug: fuente.slug,
          version: fuente.version,
          titulo: fuente.titulo,
          contenido: bloques,
          estado: "BORRADOR",
        });
        if (errInsert) throw new Error(`no pude crear ${etiqueta}: ${errInsert.message}`);
        console.log(`✅ ${etiqueta}: creado como BORRADOR`);
        continue;
      }

      const igual = existente.titulo === fuente.titulo && isDeepStrictEqual(existente.contenido, bloques);

      if (existente.estado === "PUBLICADO") {
        if (igual) {
          console.log(`➖ ${etiqueta}: ya publicado y sin cambios`);
          continue;
        }
        throw new Error(
          `${etiqueta} ya está PUBLICADO y el texto de src/content/legal/ es distinto. Una versión publicada no se cambia: agrega una versión nueva.`,
        );
      }

      if (igual) {
        console.log(`➖ ${etiqueta}: borrador sin cambios`);
        continue;
      }
      const { error: errUpdate } = await supabase
        .from("textos_legales")
        .update({ titulo: fuente.titulo, contenido: bloques })
        .eq("id", existente.id)
        .eq("estado", "BORRADOR");
      if (errUpdate) throw new Error(`no pude actualizar ${etiqueta}: ${errUpdate.message}`);
      console.log(`✅ ${etiqueta}: borrador actualizado`);
    } catch (error) {
      fallos += 1;
      console.log(`❌ ${etiqueta}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (fallos > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error("\nError inesperado sembrando los textos legales:", error);
  process.exitCode = 1;
});
