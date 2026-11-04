import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sentry = vi.hoisted(() => ({ captureMessage: vi.fn() }));
vi.mock("@sentry/nextjs", () => sentry);
vi.mock("@/lib/clientIp", () => ({ clientIp: vi.fn(async () => "203.0.113.7") }));

import {
  AVISAR_A_SENTRY,
  EVENTOS_SEGURIDAD,
  lineaEventoSeguridad,
  registrarEventoDeLaPeticion,
  registrarEventoSeguridad,
} from "./eventos-seguridad";

const AHORA = new Date("2026-11-04T12:00:00.000Z");

describe("lineaEventoSeguridad", () => {
  it("arma una línea con tipo, evento y hora", () => {
    expect(lineaEventoSeguridad("login_fallido", { accion: "login", ip: "203.0.113.7" }, AHORA)).toEqual({
      tipo: "seguridad",
      evento: "login_fallido",
      timestamp: "2026-11-04T12:00:00.000Z",
      accion: "login",
      ip: "203.0.113.7",
    });
  });

  it("descarta cualquier campo fuera de la lista, aunque llegue por la fuerza", () => {
    const datos = { accion: "login", password: "Secreta2026!", email: "ana@uva.co", token: "abc" };
    const linea = lineaEventoSeguridad("login_fallido", datos as never, AHORA);
    expect(Object.keys(linea).sort()).toEqual(["accion", "evento", "timestamp", "tipo"]);
    expect(JSON.stringify(linea)).not.toMatch(/Secreta|ana@|abc/);
  });

  it("redacta un correo que se cuele dentro de un campo permitido", () => {
    const linea = lineaEventoSeguridad("admin_denegado", { motivo: "intento de ana@uva.co" }, AHORA);
    expect(linea.motivo).toBe("[redactado]");
  });

  it("de una ruta guarda solo el camino, sin la query que puede traer tokens", () => {
    const linea = lineaEventoSeguridad("origen_rechazado", { ruta: "/auth/confirm?token_hash=xyz#a" }, AHORA);
    expect(linea.ruta).toBe("/auth/confirm");
  });

  it("omite los vacíos y recorta los textos largos", () => {
    const linea = lineaEventoSeguridad("limite_de_uso", { accion: "x".repeat(500), motivo: "  ", ip: undefined }, AHORA);
    expect(linea.accion).toHaveLength(120);
    expect(linea).not.toHaveProperty("motivo");
    expect(linea).not.toHaveProperty("ip");
  });
});

describe("registrarEventoSeguridad", () => {
  let log: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    log = vi.spyOn(console, "log").mockImplementation(() => {});
    sentry.captureMessage.mockReset();
  });
  afterEach(() => log.mockRestore());

  it("escribe una sola línea JSON filtrable por tipo", () => {
    registrarEventoSeguridad("limite_de_uso", { accion: "comentar" });
    expect(log).toHaveBeenCalledTimes(1);
    const linea = JSON.parse(String(log.mock.calls[0][0]));
    expect(linea).toMatchObject({ tipo: "seguridad", evento: "limite_de_uso", accion: "comentar" });
  });

  it("avisa a Sentry solo los eventos de la lista, y sin la IP", () => {
    registrarEventoSeguridad("login_fallido", { ip: "203.0.113.7" });
    expect(sentry.captureMessage).not.toHaveBeenCalled();

    registrarEventoSeguridad("login_bloqueado", { ip: "203.0.113.7", accion: "login" });
    expect(sentry.captureMessage).toHaveBeenCalledTimes(1);
    const [, opciones] = sentry.captureMessage.mock.calls[0];
    expect(opciones).toMatchObject({ level: "warning", tags: { area: "seguridad", evento: "login_bloqueado" } });
    expect(opciones.extra).not.toHaveProperty("ip");
  });

  it("nunca lanza, aunque falle escribir", () => {
    log.mockImplementation(() => {
      throw new Error("stdout cerrado");
    });
    expect(() => registrarEventoSeguridad("admin_denegado")).not.toThrow();
  });

  it("los eventos avisables existen en la lista de eventos", () => {
    for (const evento of AVISAR_A_SENTRY) expect(EVENTOS_SEGURIDAD).toContain(evento);
  });
});

describe("registrarEventoDeLaPeticion", () => {
  it("agrega la IP de la petición en curso", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    await registrarEventoDeLaPeticion("login_fallido", { accion: "login" });
    expect(JSON.parse(String(log.mock.calls[0][0]))).toMatchObject({ ip: "203.0.113.7", accion: "login" });
    log.mockRestore();
  });
});
