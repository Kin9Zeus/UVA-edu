import { describe, expect, it } from "vitest";
import {
  estadoCodigo,
  generarCodigoInvitacion,
  normalizarCodigo,
  validarDuracionDias,
  validarFechaVencimiento,
  MAX_DURACION_DIAS,
} from "@/lib/codigoInvitacion";

describe("generarCodigoInvitacion", () => {
  it("tiene el formato UVA-XXXX-XXXX", () => {
    expect(generarCodigoInvitacion()).toMatch(/^UVA-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
  });

  it("nunca usa caracteres que se confunden al dictarlo", () => {
    // 0/O y 1/I/L son la causa clásica de un canje fallido cuando el código
    // se lee en voz alta o de una diapositiva.
    const muestra = Array.from({ length: 300 }, () => generarCodigoInvitacion()).join("");
    const cuerpos = muestra.replace(/UVA|-/g, "");

    expect(cuerpos).not.toMatch(/[01OIL]/);
  });

  it("no repite códigos en un lote grande", () => {
    const codigos = new Set(Array.from({ length: 2000 }, () => generarCodigoInvitacion()));
    expect(codigos.size).toBe(2000);
  });

  it("acepta un prefijo propio", () => {
    expect(generarCodigoInvitacion("BECA")).toMatch(/^BECA-/);
  });
});

describe("normalizarCodigo", () => {
  it("pasa a mayúsculas y quita espacios", () => {
    expect(normalizarCodigo("  uva-k7m2-qp4x  ")).toBe("UVA-K7M2-QP4X");
  });

  it("quita espacios interiores de un pegado torpe", () => {
    expect(normalizarCodigo("UVA - K7M2 - QP4X")).toBe("UVA-K7M2-QP4X");
  });

  it("no toca un código ya limpio", () => {
    expect(normalizarCodigo("UVA-K7M2-QP4X")).toBe("UVA-K7M2-QP4X");
  });
});

describe("estadoCodigo", () => {
  const MANANA = new Date(Date.now() + 86_400_000).toISOString();
  const AYER = new Date(Date.now() - 86_400_000).toISOString();
  const vigente = {
    activo: true,
    fechaVencimiento: MANANA,
    limiteUsos: 10,
    vecesUsado: 3,
  };

  it("un código vigente y con usos disponibles está ACTIVO", () => {
    expect(estadoCodigo(vigente)).toBe("ACTIVO");
  });

  it("un código de uso único sin canjear sigue ACTIVO", () => {
    expect(estadoCodigo({ ...vigente, limiteUsos: 1, vecesUsado: 0 })).toBe("ACTIVO");
  });

  it("desactivado a mano -> INACTIVO", () => {
    expect(estadoCodigo({ ...vigente, activo: false })).toBe("INACTIVO");
  });

  it("pasada la fecha de vencimiento -> VENCIDO", () => {
    expect(estadoCodigo({ ...vigente, fechaVencimiento: AYER })).toBe("VENCIDO");
  });

  it("alcanzado el límite de usos -> AGOTADO", () => {
    expect(estadoCodigo({ ...vigente, limiteUsos: 5, vecesUsado: 5 })).toBe("AGOTADO");
  });

  it("desactivado gana sobre vencido y agotado", () => {
    // Mismo orden que canjear_codigo_invitacion() (035), para que el panel
    // muestre el motivo que de verdad vería quien intenta canjearlo.
    expect(
      estadoCodigo({ activo: false, fechaVencimiento: AYER, limiteUsos: 1, vecesUsado: 1 }),
    ).toBe("INACTIVO");
  });

  it("vencido gana sobre agotado", () => {
    expect(
      estadoCodigo({ activo: true, fechaVencimiento: AYER, limiteUsos: 1, vecesUsado: 1 }),
    ).toBe("VENCIDO");
  });
});

// Compartidos por los dos modos de generación (código único y lote): la
// regla de negocio de duración y vencimiento es la misma sin importar cuál
// gane la decisión pendiente de rev.md.
describe("validarDuracionDias", () => {
  it("acepta un entero positivo dentro del tope", () => {
    expect(validarDuracionDias(30)).toBeNull();
    expect(validarDuracionDias(MAX_DURACION_DIAS)).toBeNull();
  });

  it("rechaza cero, negativos y no enteros", () => {
    expect(validarDuracionDias(0)).not.toBeNull();
    expect(validarDuracionDias(-5)).not.toBeNull();
    expect(validarDuracionDias(1.5)).not.toBeNull();
  });

  it("rechaza superar el tope", () => {
    expect(validarDuracionDias(MAX_DURACION_DIAS + 1)).not.toBeNull();
  });
});

describe("validarFechaVencimiento", () => {
  it("acepta una fecha futura", () => {
    const manana = new Date(Date.now() + 86_400_000).toISOString();
    expect(validarFechaVencimiento(manana)).toBeNull();
  });

  it("rechaza una fecha pasada", () => {
    const ayer = new Date(Date.now() - 86_400_000).toISOString();
    expect(validarFechaVencimiento(ayer)).not.toBeNull();
  });

  it("rechaza una fecha inválida", () => {
    expect(validarFechaVencimiento("no-es-una-fecha")).not.toBeNull();
  });
});
