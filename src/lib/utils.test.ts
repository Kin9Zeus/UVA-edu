import { describe, expect, it } from "vitest";
import { cn } from "@/lib/utils";

describe("cn con la escala de letra", () => {
  it("un tamaño de la escala reemplaza al tamaño, no al color", () => {
    expect(cn("text-sm text-uva-on-accent", "text-uva-cuerpo")).toBe("text-uva-on-accent text-uva-cuerpo");
  });

  it("un color de marca sigue reemplazando a otro color", () => {
    expect(cn("text-uva-text", "text-uva-accent-ink")).toBe("text-uva-accent-ink");
  });
});
