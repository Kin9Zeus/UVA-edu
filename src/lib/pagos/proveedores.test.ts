import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  normalizarMoneda,
  PROVEEDORES_PAGO,
  PROVEEDORES_SUSCRIPCION,
  PROVEEDORES_WEBHOOK,
} from "@/lib/pagos/proveedores";

/**
 * Los CHECK de `proveedor` viven en la base y las listas equivalentes en
 * TypeScript. Postgres no puede importar una constante de TS, así que los
 * valores están escritos dos veces — y si se separan, el síntoma es un
 * INSERT que revienta con 23514 en producción y nada antes.
 *
 * Este test lee el SQL real y compara conjunto contra conjunto, en vez de
 * confiar en que alguien recuerde editar los dos sitios. Mismo criterio que
 * `gracia.test.ts` con la ventana de gracia.
 */
const SQL_RESTRICCIONES = join(
  process.cwd(),
  "supabase/sql/042_restricciones_dinero_y_proveedor.sql",
);

/** Extrae los literales de `check (<columna> in ('a', 'b'))` de una restricción por nombre. */
function proveedoresDelCheck(sql: string, nombreRestriccion: string): string[] {
  const patron = new RegExp(
    `add constraint ${nombreRestriccion}\\s+check \\(proveedor in \\(([^)]+)\\)\\)`,
    "i",
  );
  const encontrado = sql.match(patron);
  if (!encontrado) {
    throw new Error(
      `no se encontró la restricción ${nombreRestriccion} en 042; ¿se renombró?`,
    );
  }
  return [...encontrado[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
}

describe("las listas de proveedores no se separan entre TypeScript y SQL", () => {
  const sql = readFileSync(SQL_RESTRICCIONES, "utf8");

  it("suscripciones admite los mismos proveedores en ambos lados", () => {
    expect(proveedoresDelCheck(sql, "suscripciones_proveedor_valido").sort()).toEqual(
      [...PROVEEDORES_SUSCRIPCION].sort(),
    );
  });

  it("pagos admite los mismos proveedores en ambos lados", () => {
    expect(proveedoresDelCheck(sql, "pagos_proveedor_valido").sort()).toEqual(
      [...PROVEEDORES_PAGO].sort(),
    );
  });

  it("planes_precios usa la misma lista que pagos", () => {
    expect(proveedoresDelCheck(sql, "planes_precios_proveedor_valido").sort()).toEqual(
      [...PROVEEDORES_PAGO].sort(),
    );
  });

  it("eventos_webhook admite los mismos proveedores en ambos lados", () => {
    expect(proveedoresDelCheck(sql, "eventos_webhook_proveedor_valido").sort()).toEqual(
      [...PROVEEDORES_WEBHOOK].sort(),
    );
  });

  it("eventos_webhook admite mux y pagos no: son conjuntos distintos a propósito", () => {
    // Es el motivo por el que esto no es un enum compartido de Postgres. Si
    // algún día las dos listas coincidieran, la decisión habría que revisarla.
    expect(PROVEEDORES_WEBHOOK).toContain("mux");
    expect(PROVEEDORES_PAGO as readonly string[]).not.toContain("mux");
  });
});

describe("normalizarMoneda", () => {
  it("pasa a mayúsculas lo que Stripe envía en minúsculas", () => {
    expect(normalizarMoneda("usd")).toBe("USD");
  });

  it("tolera espacios sobrantes", () => {
    expect(normalizarMoneda("  cop  ")).toBe("COP");
  });

  it("deja intacto un código que ya viene bien", () => {
    expect(normalizarMoneda("COP")).toBe("COP");
  });

  it("rechaza lo que el CHECK de la base rechazaría", () => {
    expect(normalizarMoneda("pesos")).toBeNull();
    expect(normalizarMoneda("CO")).toBeNull();
    expect(normalizarMoneda("")).toBeNull();
  });

  it("no valida que la moneda exista, solo su forma", () => {
    // 'ZZZ' pasa el CHECK de la base igual que pasa aquí: la restricción es
    // de formato, no un padrón de ISO-4217.
    expect(normalizarMoneda("zzz")).toBe("ZZZ");
  });
});
