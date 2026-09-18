import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { crearCliente, servidorFalso } from "@/test/servidor-falso";

vi.mock("@/lib/supabase/server", () => import("@/test/servidor-falso").then((m) => m.moduloSupabaseServer()));
vi.mock("@/lib/supabase/admin", () => import("@/test/servidor-falso").then((m) => m.moduloSupabaseAdmin()));
vi.mock("next/cache", () => import("@/test/servidor-falso").then((m) => m.moduloNextCache()));
vi.mock("next/navigation", () => import("@/test/servidor-falso").then((m) => m.moduloNextNavigation()));
vi.mock("next/headers", () => import("@/test/servidor-falso").then((m) => m.moduloNextHeaders()));
vi.mock("@/lib/resend/client", () => import("@/test/servidor-falso").then((m) => m.moduloResendCliente()));
vi.mock("@/lib/mux/client", () => import("@/test/servidor-falso").then((m) => m.moduloMuxCliente()));
vi.mock("@/lib/log", () => import("@/test/servidor-falso").then((m) => m.moduloLog()));
vi.mock("@/lib/admin/bitacora", async (original) => ({
  ...(await original<typeof import("@/lib/admin/bitacora")>()),
  registrarBitacora: vi.fn(),
}));
vi.mock("@/lib/admin/requireAdmin", () => ({ requireAdmin: vi.fn() }));

import { requireAdmin } from "@/lib/admin/requireAdmin";
import { registrarBitacora } from "@/lib/admin/bitacora";

/**
 * Gate de autorización de todas las Server Actions de administrador.
 * AUDIT-2026-09-15.md — P2-8, Fase 2.
 *
 * Por qué hace falta
 * ------------------
 * `requireAdmin()` no lanza: DEVUELVE `{ error }`, y cada acción tiene que
 * acordarse de escribir `if ("error" in admin) return …`. Hoy las 65 lo
 * hacen. El día que una no lo haga, cualquier usuario con sesión la puede
 * invocar —una Server Action es un endpoint POST público, esté o no en un
 * botón de la UI—. En `cursos.ts`, `examenes.ts` y `usuarios.ts` ni siquiera
 * RLS lo frenaría: usan Service Role, que se la salta.
 *
 * Qué afirma
 * ----------
 * Para CADA función exportada, descubierta leyendo la carpeta —así una
 * acción o un archivo nuevo entra solo, sin que nadie se acuerde de
 * agregarlo aquí—, con `requireAdmin` negando el acceso:
 *   · devuelve el error del guard, sin lanzar;
 *   · llamó a `requireAdmin` exactamente una vez;
 *   · NO tocó nada: ningún cliente de Supabase creado, ninguna consulta,
 *     ningún `revalidatePath`, nada en bitácora, nada a Mux ni a Resend.
 *
 * Esto es más fuerte que buscar `requireAdmin(` en el texto: el texto puede
 * contener la llamada e ignorar su resultado, o llamarla DESPUÉS de mutar.
 *
 * Las funciones se invocan con argumentos comodín (ver abajo). Funciona
 * porque en todas el guard es la primera instrucción; si alguna validara
 * sus argumentos antes, el comodín no lo rompe, y la prueba igual exige que
 * haya llamado al guard y no haya tocado nada.
 */

const CARPETAS_ADMIN = ["admin"] as const;
/**
 * Acciones de administrador que viven FUERA de `src/actions/admin/` por
 * pertenecer a su módulo. Si un archivo nuevo llama `requireAdmin`, la
 * prueba de abajo exige que esté aquí o en `admin/`.
 */
const ARCHIVOS_ADMIN_SUELTOS = ["comunidad/fijar.ts"] as const;

const RAIZ_ACCIONES = join(process.cwd(), "src/actions");
const MENSAJE_DENEGADO = "No tienes permisos de administrador.";

function archivosDeAcciones(): string[] {
  const deCarpetas = CARPETAS_ADMIN.flatMap((carpeta) =>
    readdirSync(join(RAIZ_ACCIONES, carpeta))
      .filter((nombre) => nombre.endsWith(".ts") && !nombre.endsWith(".test.ts"))
      .map((nombre) => `${carpeta}/${nombre}`),
  );
  return [...deCarpetas, ...ARCHIVOS_ADMIN_SUELTOS];
}

/**
 * Argumento que aguanta cualquier uso sin lanzar: se puede desestructurar,
 * leer propiedades, invocar (`formData.get(...)`) o convertir a string. Así
 * una acción mal ordenada no revienta con TypeError antes de llegar al punto
 * que se quiere observar.
 */
function comodin(): unknown {
  const proxy: unknown = new Proxy(function () {}, {
    get(_objetivo, propiedad) {
      if (propiedad === "then") return undefined;
      if (propiedad === Symbol.toPrimitive) return () => "";
      if (propiedad === Symbol.iterator) return function* () {};
      return proxy;
    },
    apply: () => proxy,
  });
  return proxy;
}

type Accion = { archivo: string; nombre: string; fn: (...args: unknown[]) => Promise<unknown> };

async function descubrirAcciones(): Promise<Accion[]> {
  const acciones: Accion[] = [];
  for (const archivo of archivosDeAcciones()) {
    const modulo: Record<string, unknown> = await import(/* @vite-ignore */ `../${archivo.replace(/\.ts$/, "")}`);
    for (const [nombre, valor] of Object.entries(modulo)) {
      if (typeof valor === "function") {
        acciones.push({ archivo, nombre, fn: valor as Accion["fn"] });
      }
    }
  }
  return acciones;
}

const acciones = await descubrirAcciones();

beforeEach(() => {
  servidorFalso.reiniciar();
  vi.mocked(requireAdmin).mockReset();
  vi.mocked(registrarBitacora).mockReset();
});

describe("descubrimiento", () => {
  it("encuentra todas las funciones exportadas, contadas también en el texto fuente", () => {
    // Sin esto, un fallo al importar (o un cambio de carpeta) dejaría la
    // prueba de abajo recorriendo una lista vacía y pasando en verde.
    const enElTexto = archivosDeAcciones().reduce((total, archivo) => {
      const fuente = readFileSync(join(RAIZ_ACCIONES, archivo), "utf8");
      return total + (fuente.match(/^export async function /gm)?.length ?? 0);
    }, 0);
    expect(enElTexto).toBeGreaterThan(60);
    expect(acciones).toHaveLength(enElTexto);
  });

  it("toda acción que llama requireAdmin está cubierta por esta prueba", () => {
    const cubiertos = new Set(archivosDeAcciones());
    const sinCubrir = readdirSync(RAIZ_ACCIONES, { recursive: true, encoding: "utf8" })
      .map((ruta) => ruta.replaceAll("\\", "/"))
      .filter((ruta) => ruta.endsWith(".ts") && !ruta.endsWith(".test.ts"))
      .filter((ruta) => readFileSync(join(RAIZ_ACCIONES, ruta), "utf8").includes("requireAdmin("))
      .filter((ruta) => !cubiertos.has(ruta));
    expect(sinCubrir, "agrégalo a ARCHIVOS_ADMIN_SUELTOS").toEqual([]);
  });
});

describe("sin rol de administrador, ninguna acción toca nada", () => {
  it.each(acciones.map((a) => [`${a.archivo} › ${a.nombre}`, a] as const))("%s", async (_titulo, accion) => {
    vi.mocked(requireAdmin).mockResolvedValue({ error: MENSAJE_DENEGADO });

    const resultado = await accion.fn(comodin(), comodin(), comodin(), comodin());

    expect(resultado).toEqual({ error: MENSAJE_DENEGADO });
    expect(requireAdmin).toHaveBeenCalledTimes(1);
    expect(servidorFalso.clientesCreados).toEqual({ sesion: 0, admin: 0 });
    expect(servidorFalso.operaciones()).toEqual([]);
    expect(servidorFalso.revalidaciones).toEqual([]);
    expect(servidorFalso.efectosExternos).toEqual([]);
    expect(registrarBitacora).not.toHaveBeenCalled();
  });
});

describe("control positivo", () => {
  it("con rol de administrador, la misma acción SÍ llega a la base y a la bitácora", async () => {
    // Si el servidor falso dejara de registrar, todas las pruebas de arriba
    // pasarían en verde sin haber observado nada. Esta falla en ese caso.
    const supabase = crearCliente("sesion");
    vi.mocked(requireAdmin).mockResolvedValue({
      supabase: supabase as never,
      adminId: "admin-1",
    });

    const { descartarReporteComunidad } = await import("@/actions/admin/comunidadReportes");
    const resultado = await descartarReporteComunidad("reporte-1", "spam");

    expect(resultado).toEqual({ success: true });
    expect(servidorFalso.operaciones()).toEqual(["from:comunidad_reportes"]);
    expect(servidorFalso.llamadas[0].cadena.map((c) => c.metodo)).toEqual(["update", "eq"]);
    expect(registrarBitacora).toHaveBeenCalledTimes(1);
    expect(servidorFalso.revalidaciones).toEqual(["/admin/comunidad"]);
  });
});
