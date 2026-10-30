import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { servidorFalso } from "@/test/servidor-falso";

vi.mock("@/lib/supabase/server", () => import("@/test/servidor-falso").then((m) => m.moduloSupabaseServer()));

const {
  HORAS_MAXIMAS_SEGUNDO_FACTOR,
  getNivelAalActual,
  nivelAalDeClaims,
  pantallaDeSegundoFactor,
  rutaSegundoFactor,
  sesionEsAal2,
} = await import("@/lib/auth/aal");

const AHORA_MS = Date.UTC(2026, 9, 30, 15, 0, 0);
const AHORA_S = AHORA_MS / 1000;
const HORA = 3600;

/**
 * Nivel de seguridad de la sesión — FASE 8.1 del plan de blindaje. Lo usan el
 * layout de /admin y `requireAdmin` para decidir si un administrador entra, así
 * que el error caro es dar por aal2 una sesión que no lo es: todo lo que no sea
 * exactamente "aal2" tiene que contar como aal1.
 */

describe("nivelAalDeClaims", () => {
  it("solo el valor exacto 'aal2', con un código reciente, es aal2", () => {
    expect(nivelAalDeClaims({ aal: "aal2", amr: [{ method: "totp", timestamp: AHORA_S }] }, AHORA_MS)).toBe("aal2");
  });

  it("aal1 es aal1", () => {
    expect(nivelAalDeClaims({ aal: "aal1" })).toBe("aal1");
  });

  it("sin claim `aal` es aal1 (así lo documenta Supabase)", () => {
    expect(nivelAalDeClaims({})).toBe("aal1");
  });

  it.each([
    ["claims nulos", null],
    ["claims indefinidos", undefined],
    ["un nivel que no existe", { aal: "aal3" }],
    ["mayúsculas", { aal: "AAL2" }],
    ["un número", { aal: 2 }],
    ["un booleano", { aal: true }],
    ["null", { aal: null }],
    ["una cadena vacía", { aal: "" }],
  ])("falla cerrado: %s es aal1", (_caso, claims) => {
    expect(nivelAalDeClaims(claims as { aal?: unknown } | null | undefined)).toBe("aal1");
  });
});

describe("getNivelAalActual / sesionEsAal2", () => {
  beforeEach(() => {
    servidorFalso.reiniciar();
  });

  it("sin sesión: null, y no es aal2", async () => {
    servidorFalso.conUsuario(null);

    expect(await getNivelAalActual()).toBeNull();
    expect(await sesionEsAal2()).toBe(false);
  });

  it("sesión aal1 (solo contraseña): aal1, y no es aal2", async () => {
    servidorFalso.conUsuario({ id: "u1", email: "admin@uva.co", aal: "aal1" });

    expect(await getNivelAalActual()).toBe("aal1");
    expect(await sesionEsAal2()).toBe(false);
  });

  it("sesión aal2 (contraseña y código): aal2", async () => {
    servidorFalso.conUsuario({ id: "u1", email: "admin@uva.co", aal: "aal2" });

    expect(await getNivelAalActual()).toBe("aal2");
    expect(await sesionEsAal2()).toBe(true);
  });

  it("lee el token en local: no pide el usuario a la red (getUser)", async () => {
    servidorFalso.conUsuario({ id: "u1", email: "admin@uva.co", aal: "aal2" });

    await getNivelAalActual();

    expect(servidorFalso.llamadasA("auth:getClaims").length).toBeGreaterThan(0);
    expect(servidorFalso.llamadasA("auth:getUser")).toHaveLength(0);
  });
});

describe("pantallaDeSegundoFactor", () => {
  beforeEach(() => {
    servidorFalso.reiniciar();
    servidorFalso.conUsuario({ id: "u1", email: "admin@uva.co", aal: "aal1" });
  });

  const factor = (estado: "verified" | "unverified") => ({ id: "f1", factor_type: "totp", status: estado });

  it("con un factor confirmado: verificar (solo le falta escribir el código)", async () => {
    servidorFalso.responder("auth.mfa:listFactors", {
      data: { all: [factor("verified")], totp: [factor("verified")], phone: [] },
      error: null,
    });

    expect(await pantallaDeSegundoFactor()).toBe("verificar");
  });

  it("sin factores: activar", async () => {
    servidorFalso.responder("auth.mfa:listFactors", { data: { all: [], totp: [], phone: [] }, error: null });

    expect(await pantallaDeSegundoFactor()).toBe("activar");
  });

  it("un factor a medio registrar (sin confirmar) NO cuenta: sigue en activar", async () => {
    servidorFalso.responder("auth.mfa:listFactors", {
      data: { all: [factor("unverified")], totp: [], phone: [] },
      error: null,
    });

    expect(await pantallaDeSegundoFactor()).toBe("activar");
  });

  it("si Supabase falla lanza: no adivina, porque adivinar mal le haría registrar un segundo factor a quien ya tiene uno", async () => {
    servidorFalso.responder("auth.mfa:listFactors", { data: null, error: { message: "boom", code: "500" } });

    await expect(pantallaDeSegundoFactor()).rejects.toThrow(/mfa:factores falló/);
  });
});

describe("rutaSegundoFactor", () => {
  it("lleva el destino codificado para volver tras el código", () => {
    expect(rutaSegundoFactor("verificar", "/admin")).toBe("/seguridad/verificar?redirect=%2Fadmin");
    expect(rutaSegundoFactor("activar", "/admin/usuarios?q=a b")).toBe(
      "/seguridad/activar?redirect=%2Fadmin%2Fusuarios%3Fq%3Da%20b",
    );
  });
});

describe("tiempo máximo del código (fase 8.3, tarea 4)", () => {
  const sesion = (totpHaceSegundos: number, extra: object[] = []) => ({
    aal: "aal2",
    amr: [{ method: "totp", timestamp: AHORA_S - totpHaceSegundos }, { method: "password", timestamp: AHORA_S - totpHaceSegundos - 60 }, ...extra],
  });

  it("dentro de las horas permitidas sigue siendo aal2", () => {
    expect(nivelAalDeClaims(sesion(HORAS_MAXIMAS_SEGUNDO_FACTOR * HORA - 1), AHORA_MS)).toBe("aal2");
  });

  it("pasado el límite cuenta como aal1, aunque el token diga aal2: hay que volver a escribir el código", () => {
    expect(nivelAalDeClaims(sesion(HORAS_MAXIMAS_SEGUNDO_FACTOR * HORA + 1), AHORA_MS)).toBe("aal1");
  });

  it("si se escribió el código más de una vez, cuenta la vez más reciente", () => {
    const claims = sesion(HORAS_MAXIMAS_SEGUNDO_FACTOR * HORA + 100, [{ method: "totp", timestamp: AHORA_S - 60 }]);

    expect(nivelAalDeClaims(claims, AHORA_MS)).toBe("aal2");
  });

  it("aal2 sin rastro del código en amr (ni vacío ni con otra forma) es aal1: falla cerrado", () => {
    expect(nivelAalDeClaims({ aal: "aal2" }, AHORA_MS)).toBe("aal1");
    expect(nivelAalDeClaims({ aal: "aal2", amr: [] }, AHORA_MS)).toBe("aal1");
    expect(nivelAalDeClaims({ aal: "aal2", amr: [{ method: "password", timestamp: AHORA_S }] }, AHORA_MS)).toBe("aal1");
    expect(nivelAalDeClaims({ aal: "aal2", amr: [{ method: "totp", timestamp: "ayer" }] }, AHORA_MS)).toBe("aal1");
    expect(nivelAalDeClaims({ aal: "aal2", amr: "totp" }, AHORA_MS)).toBe("aal1");
  });

  it("con amr en formato RFC 8176 (solo nombres, sin hora) vale el nivel: si no, los admins quedarían en bucle", () => {
    expect(nivelAalDeClaims({ aal: "aal2", amr: ["pwd", "otp"] }, AHORA_MS)).toBe("aal2");
  });

  it("aal1 nunca sube a aal2 por traer un código reciente en amr", () => {
    expect(nivelAalDeClaims({ aal: "aal1", amr: [{ method: "totp", timestamp: AHORA_S }] }, AHORA_MS)).toBe("aal1");
  });

  it("la sesión actual pasa a aal1 cuando el código es viejo (lo que leen layout, requireAdmin y los demás)", async () => {
    servidorFalso.reiniciar();
    servidorFalso.conUsuario({
      id: "u1",
      email: "admin@uva.co",
      aal: "aal2",
      totpHaceSegundos: HORAS_MAXIMAS_SEGUNDO_FACTOR * HORA + 60,
    });

    expect(await getNivelAalActual()).toBe("aal1");
    expect(await sesionEsAal2()).toBe(false);
  });

  it("la base usa el MISMO límite: el SQL 131 lo tiene en segundos", () => {
    const sql = readFileSync(join(process.cwd(), "supabase/sql/131_admin_exige_aal2.sql"), "utf8");

    expect(sql).toContain(`- ${HORAS_MAXIMAS_SEGUNDO_FACTOR * 3600}`);
  });
});
