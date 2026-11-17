import { describe, expect, it } from "vitest";
import {
  EXCEPCIONES_AUDITORIA,
  evaluarAuditoria,
  type ExcepcionAuditoria,
} from "@/lib/seguridad/auditoria-dependencias";

/** Forma real de `npm audit --json`: el aviso cuelga del paquete; los demás lo citan por nombre. */
function informe(avisos: { paquete: string; ghsa: string; severidad: string }[]) {
  const vulnerabilities: Record<string, { via: unknown[] }> = {
    "@sentry/nextjs": { via: ["@rollup/plugin-commonjs"] },
  };
  for (const a of avisos) {
    vulnerabilities[a.paquete] = {
      via: [{ source: 1, name: a.paquete, title: "aviso", url: `https://github.com/advisories/${a.ghsa}`, severity: a.severidad }],
    };
  }
  return { vulnerabilities };
}

const PICOMATCH = { paquete: "picomatch", ghsa: "GHSA-fc5q-39xc-vjpf", severidad: "high" };
const EXCEPCION: ExcepcionAuditoria = {
  ghsa: "GHSA-fc5q-39xc-vjpf",
  paquete: "picomatch",
  motivo: "prueba",
  revisarAntes: "2026-12-17",
};

describe("evaluarAuditoria", () => {
  it("aprueba un aviso con excepción vigente", () => {
    const r = evaluarAuditoria(informe([PICOMATCH]), "2026-11-17", [EXCEPCION]);

    expect(r.aprobada).toBe(true);
    expect(r.aceptados.map((a) => a.ghsa)).toEqual(["GHSA-fc5q-39xc-vjpf"]);
  });

  it("evalúa la causa, no cada paquete que depende de ella", () => {
    // @sentry/nextjs aparece en el informe solo porque depende de picomatch:
    // no es un aviso propio y no necesita excepción.
    const r = evaluarAuditoria(informe([PICOMATCH]), "2026-11-17", [EXCEPCION]);
    expect(r.bloqueantes).toEqual([]);
  });

  it("bloquea cualquier aviso alto o crítico nuevo, aunque haya otra excepción", () => {
    const r = evaluarAuditoria(
      informe([PICOMATCH, { paquete: "next", ghsa: "GHSA-aaaa-bbbb-cccc", severidad: "critical" }]),
      "2026-11-17",
      [EXCEPCION],
    );

    expect(r.aprobada).toBe(false);
    expect(r.bloqueantes.map((a) => a.paquete)).toEqual(["next"]);
  });

  it("una excepción no vale para otro paquete con el mismo aviso", () => {
    const r = evaluarAuditoria(
      informe([{ paquete: "otro", ghsa: "GHSA-fc5q-39xc-vjpf", severidad: "high" }]),
      "2026-11-17",
      [EXCEPCION],
    );
    expect(r.aprobada).toBe(false);
  });

  it("bloquea cuando la excepción venció: obliga a revisar si ya hay parche", () => {
    const r = evaluarAuditoria(informe([PICOMATCH]), "2026-12-17", [EXCEPCION]);

    expect(r.aprobada).toBe(false);
    expect(r.vencidas).toEqual([EXCEPCION]);
    expect(r.bloqueantes.map((a) => a.paquete)).toEqual(["picomatch"]);
  });

  it("no bloquea por avisos medios o bajos (mismo umbral que --audit-level=high)", () => {
    const r = evaluarAuditoria(
      informe([{ paquete: "x", ghsa: "GHSA-1111-2222-3333", severidad: "moderate" }]),
      "2026-11-17",
      [],
    );
    expect(r.aprobada).toBe(true);
  });

  it("marca como sin uso una excepción cuyo aviso ya no aparece", () => {
    const r = evaluarAuditoria(informe([]), "2026-11-17", [EXCEPCION]);

    expect(r.aprobada).toBe(true);
    expect(r.sinUso).toEqual([EXCEPCION]);
  });

  it("falla cerrado si npm no devolvió un informe válido", () => {
    expect(evaluarAuditoria({ error: { code: "ENOTFOUND" } }, "2026-11-17").aprobada).toBe(false);
    expect(evaluarAuditoria(null, "2026-11-17").aprobada).toBe(false);
  });

  it("toda excepción real trae motivo y una fecha de revisión AAAA-MM-DD", () => {
    for (const e of EXCEPCIONES_AUDITORIA) {
      expect(e.motivo.length).toBeGreaterThan(20);
      expect(e.revisarAntes).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(e.ghsa).toMatch(/^GHSA-/);
    }
  });
});
