import { beforeEach, describe, expect, it, vi } from "vitest";
import { servidorFalso } from "@/test/servidor-falso";

vi.mock("@/lib/supabase/server", () => import("@/test/servidor-falso").then((m) => m.moduloSupabaseServer()));
vi.mock("@/lib/supabase/admin", () => import("@/test/servidor-falso").then((m) => m.moduloSupabaseAdmin()));

import { obtenerUrlAdjuntoComunidad } from "@/actions/comunidad/adjunto";

/**
 * Descarga de adjuntos de Comunidad — AUDIT-2026-09-15.md, P2-9 Fase 1.
 *
 * El bucket no tiene policy de SELECT: la ÚNICA autorización es poder leer
 * la fila de `comunidad_adjuntos` con el cliente de sesión (RLS). La
 * Service Role solo firma lo que esa fila trajo. Si el orden se invierte, o
 * la ruta sale de otro lado, cualquiera con sesión descarga cualquier
 * archivo por id.
 */

const ESTUDIANTE = { id: "estudiante-1", email: "ana@uva.co" };
const BUCKET = "storage:comunidad-adjuntos";

beforeEach(() => {
  servidorFalso.reiniciar();
  servidorFalso.conUsuario(ESTUDIANTE);
  servidorFalso.responder("from:comunidad_adjuntos", {
    data: { ruta_storage: "autora-1/post-1/adj-1.pdf", nombre_original: "Planos.pdf" },
  });
  servidorFalso.responder(BUCKET, { data: { signedUrl: "https://firmada.example/adj-1" } });
});

it("sin sesión no lee ni firma nada", async () => {
  servidorFalso.conUsuario(null);

  expect(await obtenerUrlAdjuntoComunidad("adj-1")).toEqual({
    error: "Debes iniciar sesión para descargar este archivo.",
  });
  expect(servidorFalso.operaciones()).toEqual(["auth:getClaims"]);
  expect(servidorFalso.clientesCreados.admin).toBe(0);
});

it("si RLS no deja ver la fila, NO se crea el cliente de Service Role", async () => {
  servidorFalso.responder("from:comunidad_adjuntos", { data: null });

  expect(await obtenerUrlAdjuntoComunidad("adj-ajeno")).toEqual({ error: "No tienes acceso a este archivo." });
  expect(servidorFalso.clientesCreados.admin).toBe(0);
  expect(servidorFalso.llamadasA(BUCKET)).toHaveLength(0);
});

it("con acceso: lee con la sesión y firma con Service Role la ruta de ESA fila", async () => {
  expect(await obtenerUrlAdjuntoComunidad("adj-1")).toEqual({ url: "https://firmada.example/adj-1" });

  const [lectura] = servidorFalso.llamadasA("from:comunidad_adjuntos");
  expect(lectura.cliente).toBe("sesion");
  expect(servidorFalso.encadenado("from:comunidad_adjuntos", "eq")).toEqual([["id", "adj-1"]]);

  const [firma] = servidorFalso.llamadasA(BUCKET);
  expect(firma.cliente).toBe("admin");
  expect(servidorFalso.encadenado(BUCKET, "createSignedUrl")).toEqual([
    ["autora-1/post-1/adj-1.pdf", 300, { download: "Planos.pdf" }],
  ]);

  // Orden: la autorización va antes que la firma.
  expect(servidorFalso.operaciones()).toEqual(["auth:getClaims", "from:comunidad_adjuntos", BUCKET]);
});

describe("si la firma falla", () => {
  it.each([
    ["con error", { error: { message: "storage caído" } }],
    ["sin datos", { data: null }],
  ])("%s: mensaje, nunca una URL vacía", async (_caso, respuesta) => {
    servidorFalso.responder(BUCKET, respuesta);

    expect(await obtenerUrlAdjuntoComunidad("adj-1")).toEqual({ error: "No pudimos generar el enlace de descarga." });
  });
});
