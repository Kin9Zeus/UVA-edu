/**
 * Falla si una función de `public` queda expuesta por la API de Supabase
 * sin estar en la lista de abajo, con su porqué.
 *
 * Uso: npm run db:check-permisos-funciones
 *
 * Por qué existe (FASE 5 del plan de blindaje)
 * --------------------------------------------
 * La llave pública de Supabase va en el navegador: cualquiera puede llamar
 * por la API a toda función de `public` que su rol pueda ejecutar, sin pasar
 * por la app ni por Cloudflare. Y Postgres le da EXECUTE a PUBLIC (o sea,
 * también a `anon`) a CADA función nueva, salvo que el script lo revoque.
 * Así quedó `admin_listar_usuarios` abierta sin sesión cuando el 127 la
 * recreó (cerrada en 135).
 *
 * Lo que se vigila:
 *   · Toda función que `anon` (sin sesión) puede ejecutar.
 *   · Toda función SECURITY DEFINER (corre con permisos elevados, se salta
 *     RLS) que `authenticated` puede ejecutar: cada una tiene que
 *     comprobar por dentro quién la llama.
 * Las funciones normales (SECURITY INVOKER) con sesión no se listan: corren
 * con los permisos de quien llama y RLS las cubre.
 *
 * Una función nueva que aparezca aquí hace fallar el CI. Para pasar: o se le
 * quita el EXECUTE en su script (`revoke execute ... from public, anon`), o
 * se agrega a la lista con el porqué, después de revisar su comprobación.
 *
 * Contra el catálogo, no contra los archivos: corre en CI DESPUÉS de
 * `npm run db:rls`, igual que check-rls-initplan.ts.
 *
 * Staging es compartido: una función que creó el SQL de OTRA rama (aplicado
 * en staging y todavía sin mezclar) no debe tumbar el CI de este PR. Por eso
 * solo falla por funciones que define algún archivo de supabase/sql/ de esta
 * rama; las demás se avisan sin bloquear. Se revisan cuando esa otra rama
 * llegue con su script.
 */

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Client } from "pg";

try {
  process.loadEnvFile(process.env.ENV_FILE ?? ".env.local");
} catch {
  // Sin archivo: se usan las variables ya presentes en process.env.
}

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("\n❌ Falta DATABASE_URL (.env.local en local, secrets en CI).\n");
  process.exit(1);
}

/** Sin sesión. Solo lo que un visitante necesita, y que no escribe. */
const PERMITIDAS_ANON: Record<string, string> = {
  buscar_catalogo: "Buscador público del catálogo (034/062). INVOKER: RLS solo deja ver cursos publicados.",
  normalizar_busqueda: "Función pura de texto que usa buscar_catalogo. Al ser INVOKER, anon necesita ejecutarla.",
  comunidad_tiene_acceso:
    "La usan las policies de Comunidad, que también se evalúan para anon (sin EXECUTE la consulta fallaría en vez de volver vacía). Sin sesión devuelve false.",
  comunidad_bootstrap_activo: "Lee una bandera global de configuración (083). No recibe nada ni escribe.",
  comunidad_fin_bootstrap: "Lee la fecha de fin del arranque de Comunidad (083). No recibe nada ni escribe.",
};

/** Con sesión y SECURITY DEFINER. Cada una se protege por dentro. */
const PERMITIDAS_DEFINER_CON_SESION: Record<string, string> = {
  comunidad_tiene_acceso: "Solo responde por auth.uid().",
  comunidad_bootstrap_activo: "Bandera global de solo lectura.",
  comunidad_fin_bootstrap: "Fecha global de solo lectura.",
  admin_notas_por_leccion: "Exige private.es_administrador().",
  anonimizar_usuario: "Exige private.es_administrador() (075).",
  cerrar_suscripcion_caducada_admin: "Exige private.es_administrador().",
  conteo_preguntas_examen: "Exige private.es_administrador().",
  crear_lote_codigos_invitacion: "Exige private.es_administrador() (045).",
  reespaciar_orden_lecciones: "Exige administrador o service_role (132).",
  reespaciar_orden_modulos: "Exige administrador o service_role (132).",
  reespaciar_orden_preguntas: "Exige administrador o service_role (132).",
  registrar_generacion_examen: "Exige el cupo propio de un administrador o service_role (132).",
  verificar_limite_generar_examen: "Exige el cupo propio de un administrador o service_role (132).",
  curso_esta_completo: "Solo responde por el progreso de auth.uid().",
  lecciones_completas_curso: "Solo responde por el progreso de auth.uid().",
  registrar_archivo_certificado: "Solo sobre un certificado de auth.uid() (049).",
  solicitar_supresion_propia: "Solo suprime la cuenta de auth.uid(); rechaza administradores (109/110).",
  consumir_limite: "Solo gasta el cupo de auth.uid(); los topes los fija la base (134).",
};

/** Nombres de las funciones de `public` que define algún script de esta rama. */
function funcionesDelRepo(): Set<string> {
  const carpeta = join(process.cwd(), "supabase", "sql");
  const nombres = new Set<string>();
  for (const archivo of readdirSync(carpeta).filter((n) => n.endsWith(".sql"))) {
    const sql = readFileSync(join(carpeta, archivo), "utf8");
    for (const m of sql.matchAll(/function\s+public\.([a-z_0-9]+)\s*\(/gi)) nombres.add(m[1].toLowerCase());
  }
  return nombres;
}

async function main() {
  const delRepo = funcionesDelRepo();
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();

  try {
    const { rows } = await client.query<{ nombre: string; definer: boolean; anon: boolean; con_sesion: boolean }>(`
      select p.proname as nombre,
             p.prosecdef as definer,
             has_function_privilege('anon', p.oid, 'execute') as anon,
             has_function_privilege('authenticated', p.oid, 'execute') as con_sesion
      from pg_proc p
      where p.pronamespace = 'public'::regnamespace
        and p.prokind = 'f'
        and p.prorettype <> 'trigger'::regtype
      order by p.proname
    `);

    const sinJustificar: string[] = [];
    const deOtraRama: string[] = [];
    for (const fila of rows) {
      let motivo: string | null = null;
      if (fila.anon && !PERMITIDAS_ANON[fila.nombre]) {
        motivo = `${fila.nombre} — ejecutable SIN sesión${fila.definer ? " (SECURITY DEFINER)" : ""}`;
      } else if (fila.definer && fila.con_sesion && !PERMITIDAS_DEFINER_CON_SESION[fila.nombre]) {
        motivo = `${fila.nombre} — SECURITY DEFINER ejecutable con sesión`;
      }
      if (!motivo) continue;
      (delRepo.has(fila.nombre) ? sinJustificar : deOtraRama).push(motivo);
    }

    if (deOtraRama.length > 0) {
      console.warn(
        `\n⚠️  ${deOtraRama.length} función(es) expuesta(s) que no define ningún script de esta rama (¿SQL de otra rama aplicado en staging?). No bloquea:\n`,
      );
      for (const linea of deOtraRama) console.warn(`   ${linea}`);
    }

    if (sinJustificar.length > 0) {
      console.error(`\n❌ ${sinJustificar.length} función(es) expuesta(s) por la API sin justificar:\n`);
      for (const linea of sinJustificar) console.error(`   ${linea}`);
      console.error(
        "\n   Si la app la llama con la llave maestra: en su script,\n" +
          "     revoke execute on function public.<nombre>(<args>) from public, anon, authenticated;\n" +
          "   Si la llama la sesión: revoke from public, anon; grant to authenticated; y, si es\n" +
          "   SECURITY DEFINER, que compruebe por dentro quién llama. Luego agregarla a\n" +
          "   scripts/check-permisos-funciones.ts con el porqué.\n",
      );
      process.exitCode = 1;
      return;
    }

    const anon = rows.filter((f) => f.anon).length;
    const definer = rows.filter((f) => f.definer && f.con_sesion).length;
    console.log(
      `\n✅ ${anon} función(es) sin sesión y ${definer} SECURITY DEFINER con sesión, todas justificadas.\n`,
    );
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error("\n❌ Error inesperado:", error);
  process.exit(1);
});
