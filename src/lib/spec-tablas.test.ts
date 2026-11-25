import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * P2-15 (AUDIT-2026-11-23): docs/technical-spec.md se quedó dos meses sin
 * 20 de las 47 tablas, y con SDD una spec desactualizada se obedece. Cada
 * tabla de schema.prisma tiene que aparecer, entre comillas invertidas, en
 * el índice §4.0 de la spec.
 */
describe("docs/technical-spec.md", () => {
  const tablas = [...readFileSync("prisma/schema.prisma", "utf8").matchAll(/@@map\("([^"]+)"\)/g)].map(([, t]) => t);
  const spec = readFileSync("docs/technical-spec.md", "utf8");

  it("encuentra las tablas del esquema (si no, la lectura está rota)", () => {
    expect(tablas).toContain("perfiles");
  });

  it("nombra todas las tablas de schema.prisma en el índice", () => {
    expect(tablas.filter((t) => !spec.includes(`\`${t}\``))).toEqual([]);
  });
});
