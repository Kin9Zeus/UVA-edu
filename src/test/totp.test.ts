import { describe, expect, it } from "vitest";
import { generarCodigoTotp } from "@/test/totp";

/**
 * Vectores oficiales del RFC 6238, apéndice B (SHA1). El secreto es el texto
 * ASCII "12345678901234567890", que en Base32 es el de abajo. El RFC da
 * códigos de 8 dígitos; las apps usan 6, que son los 6 últimos.
 */
const SECRETO_RFC = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";

describe("generarCodigoTotp (RFC 6238)", () => {
  it.each([
    [59, "94287082"],
    [1111111109, "07081804"],
    [1111111111, "14050471"],
    [1234567890, "89005924"],
    [2000000000, "69279037"],
    [20000000000, "65353130"],
  ])("en el segundo %i da %s con 8 dígitos", (segundos, esperado) => {
    expect(generarCodigoTotp(SECRETO_RFC, segundos * 1000, { digitos: 8 })).toBe(esperado);
  });

  it("con 6 dígitos (lo que usan Supabase y las apps) son los 6 últimos del vector", () => {
    expect(generarCodigoTotp(SECRETO_RFC, 59 * 1000)).toBe("287082");
  });

  it("el código cambia cada 30 segundos y no dentro del mismo periodo", () => {
    const base = 1111111080 * 1000; // inicio exacto de un periodo
    expect(generarCodigoTotp(SECRETO_RFC, base)).toBe(generarCodigoTotp(SECRETO_RFC, base + 29_999));
    expect(generarCodigoTotp(SECRETO_RFC, base)).not.toBe(generarCodigoTotp(SECRETO_RFC, base + 30_000));
  });

  it("tolera minúsculas, espacios y relleno en el secreto", () => {
    expect(generarCodigoTotp("gezd gnbv gy3t qojq gezd gnbv gy3t qojq==", 59 * 1000)).toBe("287082");
  });

  it("un secreto con caracteres que no son Base32 se rechaza en vez de dar un código falso", () => {
    expect(() => generarCodigoTotp("NO-ES-BASE32!", 0)).toThrow(/Base32/);
  });
});
