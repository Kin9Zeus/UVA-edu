import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => import("@/test/servidor-falso").then((m) => m.moduloNextCache()));
vi.mock("@/lib/log", () => import("@/test/servidor-falso").then((m) => m.moduloLog()));

import { revalidatePath } from "next/cache";
import { logError } from "@/lib/log";
import { reiniciarUnaVezPorMinuto } from "@/lib/una-vez-por-minuto";
import { esRutaRefrescable, revalidarRutaDelCliente } from "@/lib/revalidar-ruta";

/** P3-2 (AUDIT-2026-11-23): la ruta a refrescar llega del navegador. */

beforeEach(() => {
  reiniciarUnaVezPorMinuto();
  vi.mocked(revalidatePath).mockClear();
  vi.mocked(logError).mockClear();
});

describe("esRutaRefrescable", () => {
  it.each([
    "/cursos/revit-desde-cero/muros-y-pisos",
    "/dashboard/comunidad",
    "/dashboard/comunidad/mi-primer-render-2",
    "/dashboard/comunidad?mias=1",
    "/dashboard/comunidad?categoria=EMPLEO",
  ])("acepta %s", (ruta) => {
    expect(esRutaRefrescable(ruta)).toBe(true);
  });

  it.each([
    "/",
    "/cursos",
    "/cursos/revit",
    "/admin",
    "/cursos/x/../admin",
    "/cursos/Revit/clase",
    "/cursos/a/b/c",
    "https://otro.sitio/cursos/a/b",
    "//otro.sitio/cursos/a/b",
    "/dashboard/comunidad?categoria=OTRA",
    "/dashboard/comunidad?mias=1&x=2",
    "/dashboard/comunidad/a/b",
    "",
  ])("rechaza %j", (ruta) => {
    expect(esRutaRefrescable(ruta)).toBe(false);
  });
});

describe("revalidarRutaDelCliente", () => {
  it("refresca una ruta permitida", () => {
    revalidarRutaDelCliente("/dashboard/comunidad");
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard/comunidad");
  });

  it("no refresca una ajena y deja un solo aviso por minuto", () => {
    for (let i = 0; i < 5; i++) revalidarRutaDelCliente("/");

    expect(revalidatePath).not.toHaveBeenCalled();
    expect(logError).toHaveBeenCalledTimes(1);
  });
});

/**
 * Guardia: ninguna Server Action vuelve a pasar a `revalidatePath` algo que
 * no sea un texto fijo o una constante en MAYÚSCULAS. Una variable puede venir
 * del navegador: para eso está `revalidarRutaDelCliente`.
 */
function archivosDeAcciones(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const ruta = join(dir, e.name);
    if (e.isDirectory()) return archivosDeAcciones(ruta);
    return /\.ts$/.test(e.name) && !/\.test\.ts$/.test(e.name) ? [ruta] : [];
  });
}

describe("Server Actions", () => {
  it("revalidatePath solo recibe rutas fijas", () => {
    const sospechosas = archivosDeAcciones("src/actions").flatMap((archivo) =>
      [...readFileSync(archivo, "utf8").matchAll(/revalidatePath\(\s*([^"`'\s][^,)]*)/g)]
        .map(([, argumento]) => argumento.trim())
        .filter((argumento) => !/^[A-Z][A-Z0-9_]*$/.test(argumento))
        .map((argumento) => `${archivo}: revalidatePath(${argumento})`),
    );
    expect(sospechosas).toEqual([]);
  });
});
