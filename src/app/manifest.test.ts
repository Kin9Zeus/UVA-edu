import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import manifest from "@/app/manifest";

describe("manifest", () => {
  it("cada ícono que declara existe en src/app (convención de íconos de Next)", () => {
    for (const icono of manifest().icons ?? []) {
      expect(existsSync(join(process.cwd(), "src", "app", icono.src.slice(1)))).toBe(true);
    }
  });

  it("el favicon ya no es el de create-next-app (25 931 bytes)", () => {
    const { size } = statSync(join(process.cwd(), "src", "app", "favicon.ico"));
    expect(size).not.toBe(25931);
  });
});
