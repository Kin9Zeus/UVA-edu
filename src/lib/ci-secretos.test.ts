import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * P3-5 (AUDIT-2026-11-23): un secreto en el `env` de un JOB lo ve también
 * `npm ci`, que corre los scripts de instalación de paquetes de terceros. Los
 * secretos van en el `env` de cada paso, después de instalar.
 */
function envDeJobs(workflow: string): string[] {
  // El `env:` de un job está a 4 espacios; el de un paso, a 8 o más.
  return [...workflow.matchAll(/^ {4}env:\n((?: {6,}.*\n|\s*\n)*)/gm)].map(([, bloque]) => bloque);
}

function leer(archivo: string): string {
  return readFileSync(`.github/workflows/${archivo}`, "utf8").replace(/\r\n/g, "\n");
}

/** Solo los que instalan paquetes de npm: ahí está el riesgo. */
const conNpm = readdirSync(".github/workflows").filter(
  (archivo) => /\.ya?ml$/.test(archivo) && /\bnpm (?:ci|install)\b/.test(leer(archivo)),
);

describe(".github/workflows", () => {
  it("encuentra los workflows que instalan con npm y sus env de job", () => {
    expect(conNpm).toContain("ci.yml");
    expect(envDeJobs(leer("ci.yml")).length).toBeGreaterThan(0);
  });

  it.each(conNpm)("%s no pone secretos en el env de un job", (archivo) => {
    expect(envDeJobs(leer(archivo)).filter((bloque) => /secrets\./.test(bloque))).toEqual([]);
  });
});
