import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { _reiniciarEnvioDeRegistros, enviarAlRegistroExterno, vaciarRegistrosPendientes } from "./envio-registros";

/**
 * Fase 10.1: la copia de los registros a Vector nunca debe frenar ni tumbar
 * una petición, y sin VECTOR_URL no hace nada.
 */
const fetchFalso = vi.fn();

beforeEach(() => {
  _reiniciarEnvioDeRegistros();
  fetchFalso.mockReset();
  fetchFalso.mockResolvedValue(new Response(null, { status: 200 }));
  vi.stubGlobal("fetch", fetchFalso);
  vi.stubEnv("VECTOR_URL", "http://vector.railway.internal:9000");
  vi.stubEnv("RAILWAY_SERVICE_NAME", "uva-edu");
  vi.stubEnv("RAILWAY_ENVIRONMENT_NAME", "production");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function lineasEnviadas(llamada = 0): Record<string, unknown>[] {
  const cuerpo = String(fetchFalso.mock.calls[llamada][1].body);
  return cuerpo.trim().split("\n").map((l) => JSON.parse(l));
}

describe("envío de registros a Vector", () => {
  it("sin VECTOR_URL no manda nada", async () => {
    vi.stubEnv("VECTOR_URL", "");
    enviarAlRegistroExterno({ tipo: "seguridad", evento: "login_fallido" });
    await vaciarRegistrosPendientes();
    expect(fetchFalso).not.toHaveBeenCalled();
  });

  it("junta las líneas y las manda juntas en un lote NDJSON, con el servicio y el entorno", async () => {
    enviarAlRegistroExterno({ tipo: "seguridad", evento: "login_fallido" });
    enviarAlRegistroExterno({ tipo: "seguridad", evento: "limite_de_uso" });
    expect(fetchFalso).not.toHaveBeenCalled(); // no espera a Vector en la petición

    await vaciarRegistrosPendientes();

    expect(fetchFalso).toHaveBeenCalledTimes(1);
    const [url, opciones] = fetchFalso.mock.calls[0];
    expect(url).toBe("http://vector.railway.internal:9000");
    expect(opciones.method).toBe("POST");
    expect(opciones.headers["content-type"]).toBe("application/x-ndjson");
    expect(lineasEnviadas()).toEqual([
      { tipo: "seguridad", evento: "login_fallido", servicio: "uva-edu", entorno: "production" },
      { tipo: "seguridad", evento: "limite_de_uso", servicio: "uva-edu", entorno: "production" },
    ]);
  });

  it("manda solo a los 2 segundos, sin que nadie lo pida", async () => {
    vi.useFakeTimers();
    enviarAlRegistroExterno({ evento: "a" });
    await vi.advanceTimersByTimeAsync(1_900);
    expect(fetchFalso).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(200);
    expect(fetchFalso).toHaveBeenCalledTimes(1);
  });

  it("con 100 líneas manda enseguida, sin esperar el temporizador", async () => {
    for (let i = 0; i < 100; i++) enviarAlRegistroExterno({ i });
    await Promise.resolve();
    expect(fetchFalso).toHaveBeenCalledTimes(1);
    expect(lineasEnviadas()).toHaveLength(100);
  });

  it("si Vector está caído, no lanza, avisa una sola vez y descarta el lote", async () => {
    const aviso = vi.spyOn(console, "warn").mockImplementation(() => {});
    fetchFalso.mockRejectedValue(new Error("ECONNREFUSED"));

    enviarAlRegistroExterno({ evento: "a" });
    await expect(vaciarRegistrosPendientes()).resolves.toBeUndefined();
    enviarAlRegistroExterno({ evento: "b" });
    await vaciarRegistrosPendientes();

    expect(aviso).toHaveBeenCalledTimes(1); // no llena la salida con un aviso por lote
    expect(String(aviso.mock.calls[0][0])).toContain("ECONNREFUSED");
    aviso.mockRestore();
  });

  it("una respuesta de error de Vector también cuenta como fallo", async () => {
    const aviso = vi.spyOn(console, "warn").mockImplementation(() => {});
    fetchFalso.mockResolvedValue(new Response(null, { status: 503 }));
    enviarAlRegistroExterno({ evento: "a" });
    await vaciarRegistrosPendientes();
    expect(String(aviso.mock.calls[0][0])).toContain("HTTP 503");
    aviso.mockRestore();
  });
});
