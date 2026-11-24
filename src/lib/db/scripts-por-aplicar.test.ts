import { describe, expect, it } from "vitest";
import { scriptsPorAplicar } from "@/lib/db/scripts-por-aplicar";

const SCRIPTS = [
  { nombre: "000_a.sql", sha256: "a" },
  { nombre: "013_b.sql", sha256: "b" },
  { nombre: "139_c.sql", sha256: "c" },
];
const AL_DIA = new Map(SCRIPTS.map((s) => [s.nombre, s.sha256]));
const AYER = new Date("2026-11-23T12:00:00Z");
const HOY = new Date("2026-11-24T12:00:00Z");

const nombres = (r: { scripts: { nombre: string }[] }) => r.scripts.map((s) => s.nombre);
const base = { scripts: SCRIPTS, registrados: AL_DIA, ultimaMigracion: AYER, ultimoRls: HOY, todo: false };

describe("scriptsPorAplicar", () => {
  it("nada cambió: no aplica nada (no hay bloqueos)", () => {
    expect(nombres(scriptsPorAplicar(base))).toEqual([]);
  });

  it("un script nuevo al final: solo ese", () => {
    const nuevo = { nombre: "140_d.sql", sha256: "d" };
    expect(nombres(scriptsPorAplicar({ ...base, scripts: [...SCRIPTS, nuevo] }))).toEqual(["140_d.sql"]);
  });

  it("un script del medio cambió: desde ese hasta el final, para no pisar lo que redefinen los siguientes", () => {
    const editado = SCRIPTS.map((s) => (s.nombre === "013_b.sql" ? { ...s, sha256: "b2" } : s));
    expect(nombres(scriptsPorAplicar({ ...base, scripts: editado }))).toEqual(["013_b.sql", "139_c.sql"]);
  });

  it("hubo una migración de Prisma después de la última corrida: todos", () => {
    const r = scriptsPorAplicar({ ...base, ultimaMigracion: new Date("2026-11-24T13:00:00Z") });
    expect(nombres(r)).toEqual(SCRIPTS.map((s) => s.nombre));
  });

  it("--todo o una base sin registro: todos", () => {
    expect(nombres(scriptsPorAplicar({ ...base, todo: true }))).toHaveLength(3);
    expect(nombres(scriptsPorAplicar({ ...base, registrados: new Map(), ultimoRls: null }))).toHaveLength(3);
  });
});
