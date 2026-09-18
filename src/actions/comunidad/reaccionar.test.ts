import { beforeEach, describe, expect, it, vi } from "vitest";
import { servidorFalso } from "@/test/servidor-falso";

vi.mock("@/lib/supabase/server", () => import("@/test/servidor-falso").then((m) => m.moduloSupabaseServer()));
vi.mock("next/cache", () => import("@/test/servidor-falso").then((m) => m.moduloNextCache()));

import {
  quitarReaccionPostComunidad,
  quitarReaccionRespuestaComunidad,
  reaccionarPostComunidad,
  reaccionarRespuestaComunidad,
} from "@/actions/comunidad/reaccionar";

/**
 * Reacciones en Comunidad — AUDIT-2026-09-15.md, P2-9 Fase 1.
 *
 * Cada export fija la columna objetivo; un cruce (reaccionar a un post
 * guardando `id_respuesta`) no fallaría en la base, reaccionaría a otra
 * cosa. Y el choque de unicidad (23505) es "ya estaba", no un error.
 */

const ESTUDIANTE = { id: "estudiante-1", email: "ana@uva.co" };
const RUTA = "/dashboard/comunidad";

beforeEach(() => {
  servidorFalso.reiniciar();
  servidorFalso.conUsuario(ESTUDIANTE);
});

describe.each([
  ["post", reaccionarPostComunidad, quitarReaccionPostComunidad, "id_post"],
  ["respuesta", reaccionarRespuestaComunidad, quitarReaccionRespuestaComunidad, "id_respuesta"],
] as const)("%s", (_objetivo, reaccionar, quitar, columna) => {
  it("sin sesión no escribe", async () => {
    servidorFalso.conUsuario(null);

    expect(await reaccionar("obj-1", RUTA)).toEqual({ error: "Debes iniciar sesión." });
    expect(await quitar("obj-1", RUTA)).toEqual({ error: "Debes iniciar sesión." });
    expect(servidorFalso.operaciones()).toEqual(["auth:getUser", "auth:getUser"]);
  });

  it(`reaccionar inserta con el usuario de la sesión en \`${columna}\``, async () => {
    expect(await reaccionar("obj-1", RUTA)).toEqual({ success: true });
    expect(servidorFalso.encadenado("from:comunidad_reacciones", "insert")).toEqual([
      [{ id_usuario: ESTUDIANTE.id, [columna]: "obj-1" }],
    ]);
    expect(servidorFalso.revalidaciones).toEqual([RUTA]);
  });

  it("una reacción repetida (23505) cuenta como éxito", async () => {
    servidorFalso.responder("from:comunidad_reacciones", { error: { code: "23505" } });

    expect(await reaccionar("obj-1", RUTA)).toEqual({ success: true });
  });

  it("cualquier otro error no se disfraza de éxito", async () => {
    servidorFalso.responder("from:comunidad_reacciones", { error: { code: "42501" } });

    expect(await reaccionar("obj-1", RUTA)).toEqual({ error: "No pudimos guardar tu reacción." });
    expect(servidorFalso.revalidaciones).toEqual([]);
  });

  it("quitar borra solo la reacción propia sobre ese objetivo", async () => {
    expect(await quitar("obj-1", RUTA)).toEqual({ success: true });
    expect(servidorFalso.llamadasA("from:comunidad_reacciones")[0].cadena).toEqual([
      { metodo: "delete", argumentos: [] },
      { metodo: "eq", argumentos: ["id_usuario", ESTUDIANTE.id] },
      { metodo: "eq", argumentos: [columna, "obj-1"] },
    ]);
  });

  it("quitar con error no revalida", async () => {
    servidorFalso.responder("from:comunidad_reacciones", { error: { code: "42501" } });

    expect(await quitar("obj-1", RUTA)).toEqual({ error: "No pudimos quitar tu reacción." });
    expect(servidorFalso.revalidaciones).toEqual([]);
  });
});
