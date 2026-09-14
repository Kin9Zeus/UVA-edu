import { describe, expect, it } from "vitest";
import { calcularDesglose, validarCupon } from "@/lib/pagos/descuento";

/** Precio realista: el plan anual de la plataforma, en centavos de peso. */
const ANUAL = 8_990_000;

describe("calcularDesglose", () => {
  it("sin cupón: el total es el precio de lista", () => {
    expect(calcularDesglose(ANUAL, null)).toEqual({
      subtotalCentavos: ANUAL,
      descuentoCentavos: 0,
      totalCentavos: ANUAL,
    });
  });

  it("porcentaje: descuenta sobre el subtotal", () => {
    expect(calcularDesglose(ANUAL, { tipo_descuento: "PORCENTAJE", valor: 30 })).toEqual({
      subtotalCentavos: ANUAL,
      descuentoCentavos: 2_697_000,
      totalCentavos: 6_293_000,
    });
  });

  it("monto fijo: el valor ya viene en centavos", () => {
    expect(calcularDesglose(ANUAL, { tipo_descuento: "MONTO_FIJO", valor: 1_000_000 })).toEqual({
      subtotalCentavos: ANUAL,
      descuentoCentavos: 1_000_000,
      totalCentavos: 7_990_000,
    });
  });

  /**
   * El caso que protege la caja: un cupón de monto fijo mayor que el precio
   * dejaría el total negativo. `intentos_pago` tiene un CHECK
   * `monto_centavos > 0` que lo frenaría (supabase/sql/100), pero para
   * entonces el estudiante ya habría visto "-$10.000" en pantalla.
   */
  it("monto fijo mayor que el precio: el total queda en 0, nunca negativo", () => {
    expect(calcularDesglose(50_000, { tipo_descuento: "MONTO_FIJO", valor: 10_000_000 })).toEqual({
      subtotalCentavos: 50_000,
      descuentoCentavos: 50_000,
      totalCentavos: 0,
    });
  });

  it("un valor negativo no SUBE el precio", () => {
    expect(calcularDesglose(ANUAL, { tipo_descuento: "MONTO_FIJO", valor: -500_000 })).toEqual({
      subtotalCentavos: ANUAL,
      descuentoCentavos: 0,
      totalCentavos: ANUAL,
    });
  });

  it("100% deja el total en 0", () => {
    expect(calcularDesglose(ANUAL, { tipo_descuento: "PORCENTAJE", valor: 100 }).totalCentavos).toBe(0);
  });

  it("un porcentaje fuera de rango se acota en vez de lanzar", () => {
    expect(calcularDesglose(ANUAL, { tipo_descuento: "PORCENTAJE", valor: 150 }).totalCentavos).toBe(0);
    expect(calcularDesglose(ANUAL, { tipo_descuento: "PORCENTAJE", valor: -10 }).totalCentavos).toBe(ANUAL);
  });

  it("un porcentaje no finito se trata como 0", () => {
    expect(calcularDesglose(ANUAL, { tipo_descuento: "PORCENTAJE", valor: Number.NaN }).totalCentavos)
      .toBe(ANUAL);
  });

  it("el desglose siempre cuadra: subtotal - descuento = total", () => {
    const casos = [
      calcularDesglose(ANUAL, { tipo_descuento: "PORCENTAJE", valor: 33 }),
      calcularDesglose(89_900, { tipo_descuento: "PORCENTAJE", valor: 17 }),
      calcularDesglose(1, { tipo_descuento: "MONTO_FIJO", valor: 1 }),
    ];
    for (const d of casos) {
      expect(d.subtotalCentavos - d.descuentoCentavos).toBe(d.totalCentavos);
      expect(Number.isInteger(d.totalCentavos)).toBe(true);
    }
  });

  /**
   * El total entra en el hash de integridad como string. Un decimal ahí
   * produciría "6293000.5" y Wompi rechazaría la transacción — o peor, la
   * aceptaría con un monto distinto al que se firmó.
   */
  it("el total siempre es entero, incluso con porcentajes que no dividen exacto", () => {
    expect(Number.isInteger(calcularDesglose(89_901, { tipo_descuento: "PORCENTAJE", valor: 33 }).totalCentavos))
      .toBe(true);
  });
});

describe("validarCupon", () => {
  const ahora = new Date("2026-09-14T12:00:00Z");

  it("vigente y con usos disponibles: válido", () => {
    expect(
      validarCupon({ fecha_vencimiento: "2026-12-31T00:00:00Z", limite_usos: 10, veces_usado: 3 }, ahora),
    ).toBeNull();
  });

  it("vencido", () => {
    expect(
      validarCupon({ fecha_vencimiento: "2026-09-01T00:00:00Z", limite_usos: 10, veces_usado: 0 }, ahora),
    ).toBe("vencido");
  });

  it("agotado", () => {
    expect(
      validarCupon({ fecha_vencimiento: "2026-12-31T00:00:00Z", limite_usos: 5, veces_usado: 5 }, ahora),
    ).toBe("agotado");
  });

  it("limite_usos null significa sin tope", () => {
    expect(
      validarCupon({ fecha_vencimiento: "2026-12-31T00:00:00Z", limite_usos: null, veces_usado: 9999 }, ahora),
    ).toBeNull();
  });

  /**
   * El vencimiento se comprueba ANTES que el límite: si el cupón está vencido
   * Y agotado, el motivo que se le muestra al estudiante es el vencimiento.
   * Mismo criterio de orden que `canjear_codigo_invitacion` (035), que valida
   * "ya canjeado" antes que "agotado" para no decir "se acabó" a quien en
   * realidad ya lo usó.
   */
  it("vencido gana a agotado cuando se dan los dos", () => {
    expect(
      validarCupon({ fecha_vencimiento: "2026-01-01T00:00:00Z", limite_usos: 1, veces_usado: 1 }, ahora),
    ).toBe("vencido");
  });

  it("acepta un Date igual que un string ISO", () => {
    expect(
      validarCupon({ fecha_vencimiento: new Date("2026-09-01T00:00:00Z"), limite_usos: null, veces_usado: 0 }, ahora),
    ).toBe("vencido");
  });
});
