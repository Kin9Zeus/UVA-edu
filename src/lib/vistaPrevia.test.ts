import { describe, expect, it } from "vitest";
import {
  MINUTOS_VIGENCIA_VALIDOS,
  MINUTOS_VIGENCIA_VISTA_PREVIA,
  calcularExpiracion,
  evaluarToken,
  generarTokenVistaPrevia,
  hashToken,
  hashesIguales,
} from "@/lib/vistaPrevia";

const AHORA = new Date("2026-08-25T12:00:00Z");
const MANANA = new Date("2026-08-26T12:00:00Z");
const AYER = new Date("2026-08-24T12:00:00Z");

describe("generarTokenVistaPrevia", () => {
  it("devuelve un token largo y su hash correspondiente", () => {
    const { token, hash } = generarTokenVistaPrevia();

    // 32 bytes en base64url = 43 caracteres.
    expect(token).toHaveLength(43);
    expect(hash).toBe(hashToken(token));
    // Hexadecimal de SHA-256.
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("nunca genera dos veces el mismo token", () => {
    const tokens = new Set(
      Array.from({ length: 200 }, () => generarTokenVistaPrevia().token),
    );
    expect(tokens.size).toBe(200);
  });

  it("el token en claro NO aparece dentro de su hash", () => {
    // Si esto fallara, guardar el hash no protegería nada.
    const { token, hash } = generarTokenVistaPrevia();
    expect(hash).not.toContain(token);
  });
});

describe("hashesIguales", () => {
  it("reconoce dos hashes idénticos", () => {
    const hash = hashToken("abc");
    expect(hashesIguales(hash, hash)).toBe(true);
  });

  it("distingue hashes distintos", () => {
    expect(hashesIguales(hashToken("abc"), hashToken("abd"))).toBe(false);
  });

  it("no revienta con longitudes distintas", () => {
    expect(hashesIguales(hashToken("abc"), "aabb")).toBe(false);
  });
});

describe("evaluarToken", () => {
  const vigente = { idCurso: "curso-1", expiraEn: MANANA, revocadoEn: null };

  it("acepta un token vigente y devuelve el curso", () => {
    expect(evaluarToken(vigente, AHORA)).toEqual({
      valido: true,
      idCurso: "curso-1",
      expiraEn: MANANA,
    });
  });

  it("rechaza un token que no existe", () => {
    expect(evaluarToken(null, AHORA)).toEqual({ valido: false, motivo: "INEXISTENTE" });
  });

  it("rechaza un token ya caducado", () => {
    expect(evaluarToken({ ...vigente, expiraEn: AYER }, AHORA)).toEqual({
      valido: false,
      motivo: "EXPIRADO",
    });
  });

  it("en el instante exacto de la caducidad ya no sirve", () => {
    expect(evaluarToken({ ...vigente, expiraEn: AHORA }, AHORA)).toEqual({
      valido: false,
      motivo: "EXPIRADO",
    });
  });

  it("rechaza un token revocado aunque todavía no haya caducado", () => {
    // El caso de "lo compartí por error": la revocación tiene que ganarle
    // a una caducidad que aún está lejos.
    expect(evaluarToken({ ...vigente, revocadoEn: AYER }, AHORA)).toEqual({
      valido: false,
      motivo: "REVOCADO",
    });
  });

  it("un token revocado Y caducado se reporta como revocado", () => {
    expect(
      evaluarToken({ idCurso: "curso-1", expiraEn: AYER, revocadoEn: AYER }, AHORA),
    ).toEqual({ valido: false, motivo: "REVOCADO" });
  });
});

describe("calcularExpiracion", () => {
  it("suma los minutos pedidos", () => {
    expect(calcularExpiracion(30, AHORA).toISOString()).toBe("2026-08-25T12:30:00.000Z");
  });

  it("1440 minutos son exactamente 24 horas", () => {
    expect(calcularExpiracion(60 * 24, AHORA)).toEqual(MANANA);
  });

  it("la vigencia por defecto es la más corta de la lista", () => {
    // Es la decisión de diseño: el caso normal (el admin repasa su propio
    // trabajo) no necesita más, y cada minuto extra es exposición gratis.
    expect(MINUTOS_VIGENCIA_VISTA_PREVIA).toBe(15);
    expect(Math.min(...MINUTOS_VIGENCIA_VALIDOS)).toBe(MINUTOS_VIGENCIA_VISTA_PREVIA);
  });

  it("un enlace con la vigencia por defecto sirve antes del corte y no después", () => {
    const expira = calcularExpiracion(MINUTOS_VIGENCIA_VISTA_PREVIA, AHORA);
    const fila = { idCurso: "curso-1", expiraEn: expira, revocadoEn: null };
    const minutosDespues = (n: number) => new Date(AHORA.getTime() + n * 60 * 1000);

    expect(evaluarToken(fila, minutosDespues(MINUTOS_VIGENCIA_VISTA_PREVIA - 1)).valido).toBe(true);
    expect(evaluarToken(fila, minutosDespues(MINUTOS_VIGENCIA_VISTA_PREVIA + 1))).toEqual({
      valido: false,
      motivo: "EXPIRADO",
    });
  });
});
