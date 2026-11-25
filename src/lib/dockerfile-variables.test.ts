import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * P2-10 (AUDIT-2026-11-23): la imagen del plan B (infra/Dockerfile) se quedó
 * sin la llave de Turnstile y el login habría fallado. Next escribe cada
 * NEXT_PUBLIC_* en el JavaScript durante el build, así que la imagen solo la
 * tiene si el Dockerfile la declara como ARG y la pasa a ENV.
 */
function variablesPublicasUsadas(dir: string, encontradas = new Set<string>()): Set<string> {
  for (const entrada of readdirSync(dir, { withFileTypes: true })) {
    const ruta = join(dir, entrada.name);
    if (entrada.isDirectory()) {
      if (entrada.name !== "generated") variablesPublicasUsadas(ruta, encontradas);
    } else if (/\.tsx?$/.test(entrada.name) && !/\.test\.tsx?$/.test(entrada.name)) {
      for (const [, nombre] of readFileSync(ruta, "utf8").matchAll(/process\.env\.(NEXT_PUBLIC_[A-Z0-9_]+)/g)) {
        encontradas.add(nombre);
      }
    }
  }
  return encontradas;
}

describe("infra/Dockerfile", () => {
  const dockerfile = readFileSync("infra/Dockerfile", "utf8");
  const usadas = [...variablesPublicasUsadas("src")];

  it("encuentra variables públicas en el código (si no, el recorrido está roto)", () => {
    expect(usadas).toContain("NEXT_PUBLIC_SUPABASE_URL");
  });

  it.each(usadas)("declara %s como ARG y la pasa a ENV", (nombre) => {
    expect(dockerfile).toMatch(new RegExp(`^ARG ${nombre}\r?$`, "m"));
    expect(dockerfile).toContain(`${nombre}=\${${nombre}}`);
  });
});
