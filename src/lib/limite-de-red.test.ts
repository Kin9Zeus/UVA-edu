import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchConLimite, LIMITE_RED_MS } from "@/lib/limite-de-red";

/** P2-14 (AUDIT-2026-11-23): ninguna llamada del servidor espera sin fin. */
describe("fetchConLimite", () => {
  afterEach(() => vi.unstubAllGlobals());

  function capturarFetch() {
    const llamadas: [unknown, RequestInit | undefined][] = [];
    vi.stubGlobal("fetch", async (entrada: unknown, opciones?: RequestInit) => {
      llamadas.push([entrada, opciones]);
      return new Response("{}");
    });
    return llamadas;
  }

  it("sin señal propia, le pone el límite y conserva el resto de opciones", async () => {
    const llamadas = capturarFetch();
    const timeout = vi.spyOn(AbortSignal, "timeout");

    await fetchConLimite()("https://x.supabase.co/rest/v1/cursos", { method: "POST", headers: { a: "1" } });

    expect(timeout).toHaveBeenCalledWith(LIMITE_RED_MS);
    const [, opciones] = llamadas[0];
    expect(opciones).toMatchObject({ method: "POST", headers: { a: "1" } });
    expect(opciones?.signal).toBeInstanceOf(AbortSignal);
  });

  it("si la llamada trae su propia señal (una operación larga), esa gana", async () => {
    const llamadas = capturarFetch();
    const propia = new AbortController().signal;

    await fetchConLimite()("https://x.supabase.co/rest/v1/rpc/anonimizar_usuario", { signal: propia });

    expect(llamadas[0][1]?.signal).toBe(propia);
  });

  it("el límite de verdad corta una petición colgada", async () => {
    vi.stubGlobal("fetch", (_entrada: unknown, opciones?: RequestInit) =>
      new Promise((_resolver, rechazar) => opciones?.signal?.addEventListener("abort", () => rechazar(opciones.signal!.reason))),
    );

    await expect(fetchConLimite(20)("https://colgada.test")).rejects.toThrow(/timeout|abort/i);
  });
});
