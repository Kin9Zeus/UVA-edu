import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

vi.mock("@/lib/log", () => ({ logError: vi.fn() }));

import { reclamarReproduccion, reproduccionVigente } from "./reproduccionUnica";

function cliente(respuesta: { data: unknown; error: unknown }) {
  return { rpc: vi.fn().mockResolvedValue(respuesta) } as unknown as SupabaseClient;
}

describe("reproducción única", () => {
  it("otro dispositivo reclamó: deja de estar vigente", async () => {
    expect(await reproduccionVigente(cliente({ data: false, error: null }), "a")).toBe(false);
  });

  it("falla abierto si la base no responde", async () => {
    expect(await reproduccionVigente(cliente({ data: null, error: { message: "x" } }), "a")).toBe(true);
    expect(await reclamarReproduccion(cliente({ data: null, error: { message: "x" } }))).toBeNull();
  });

  it("sin token (administrador) no consulta", async () => {
    const supabase = cliente({ data: false, error: null });
    expect(await reproduccionVigente(supabase, null)).toBe(true);
    expect(supabase.rpc).not.toHaveBeenCalled();
  });
});
