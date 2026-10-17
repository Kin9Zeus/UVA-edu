import { beforeEach, describe, expect, it, vi } from "vitest";
import { servidorFalso } from "@/test/servidor-falso";

vi.mock("@/lib/supabase/admin", () => import("@/test/servidor-falso").then((m) => m.moduloSupabaseAdmin()));
vi.mock("next/headers", () => import("@/test/servidor-falso").then((m) => m.moduloNextHeaders()));
vi.mock("@/lib/log", () => import("@/test/servidor-falso").then((m) => m.moduloLog()));

import { verificarCertificado } from "@/lib/certificados/verificar";

const FALLO = { data: null, error: { message: "boom", code: "XX000" } };
const PERMITIDO = { data: { permitido: true, segundos_espera: 0 }, error: null };

const VALIDO = {
  valido: true,
  nombre_estudiante: "Daniela Ruiz",
  nombre_curso: "APU en Excel",
  fecha_emision: "2026-09-18T15:00:00Z",
  duracion_total_segundos: 7200,
  curso_slug: "apu-en-excel",
};

describe("verificarCertificado", () => {
  beforeEach(() => {
    servidorFalso.reiniciar();
    servidorFalso.responder("rpc:verificar_limite_certificado", PERMITIDO);
    servidorFalso.responder("rpc:registrar_intento_verificar_certificado", { data: null, error: null });
  });

  it("devuelve los datos del certificado, con la intensidad del PDF y el enlace al curso", async () => {
    servidorFalso.responder("rpc:verificar_certificado", { data: [VALIDO], error: null });

    expect(await verificarCertificado("K7M2Q-XP4TB")).toEqual({
      estado: "valido",
      nombreEstudiante: "Daniela Ruiz",
      nombreCurso: "APU en Excel",
      fechaEmision: "2026-09-18T15:00:00Z",
      duracionTexto: "2 horas de teoría y práctica",
      cursoSlug: "apu-en-excel",
    });
    expect(servidorFalso.argumentosDe("rpc:verificar_certificado")).toEqual({ p_codigo: "K7M2Q-XP4TB" });
  });

  it("sin videos listos no inventa una intensidad, y sin curso publicado no hay enlace", async () => {
    servidorFalso.responder("rpc:verificar_certificado", {
      data: [{ ...VALIDO, duracion_total_segundos: 0, curso_slug: null }],
      error: null,
    });

    expect(await verificarCertificado("K7M2Q-XP4TB")).toMatchObject({ duracionTexto: null, cursoSlug: null });
  });

  it("un código que no existe es 'no encontrado'", async () => {
    servidorFalso.responder("rpc:verificar_certificado", { data: [{ valido: false }], error: null });

    expect(await verificarCertificado("NOEXI-STE00")).toEqual({ estado: "no-encontrado" });
  });

  it("con el límite agotado no consulta el código", async () => {
    servidorFalso.responder("rpc:verificar_limite_certificado", {
      data: { permitido: false, segundos_espera: 300 },
      error: null,
    });

    expect(await verificarCertificado("K7M2Q-XP4TB")).toEqual({ estado: "bloqueado", segundosEspera: 300 });
    expect(servidorFalso.llamadasA("rpc:verificar_certificado")).toHaveLength(0);
  });

  it("si falla la consulta del límite, es un error y no 'no encontrado'", async () => {
    servidorFalso.responder("rpc:verificar_limite_certificado", FALLO);

    expect(await verificarCertificado("K7M2Q-XP4TB")).toEqual({ estado: "error" });
  });

  it("si no se puede registrar el intento, falla cerrado y no verifica", async () => {
    servidorFalso.responder("rpc:registrar_intento_verificar_certificado", FALLO);

    expect(await verificarCertificado("K7M2Q-XP4TB")).toEqual({ estado: "error" });
    expect(servidorFalso.llamadasA("rpc:verificar_certificado")).toHaveLength(0);
  });

  it("si falla la verificación, es un error y no 'no encontrado'", async () => {
    servidorFalso.responder("rpc:verificar_certificado", FALLO);

    expect(await verificarCertificado("K7M2Q-XP4TB")).toEqual({ estado: "error" });
  });
});
