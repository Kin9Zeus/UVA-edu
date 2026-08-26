import { describe, expect, it } from "vitest";
import {
  extensionArchivo,
  formatDuracion,
  formatFecha,
  formatMoneda,
  formatTamanoArchivo,
  tiempoRelativo,
} from "@/lib/admin/format";

/**
 * Offsets elegidos con margen de sobra respecto a los umbrales de
 * `UNIDADES` y a los límites de redondeo de `Math.round`, para que unos
 * pocos ms de overhead entre construir la fecha y que la función llame a
 * `Date.now()` no puedan cambiar el resultado.
 */
const SEGUNDO = 1000;
const MINUTO = 60 * SEGUNDO;
const HORA = 60 * MINUTO;
const DIA = 24 * HORA;

function hace(ms: number): string {
  return new Date(Date.now() - ms).toISOString();
}

function enFuturo(ms: number): string {
  return new Date(Date.now() + ms).toISOString();
}

describe("tiempoRelativo", () => {
  it("segundos (por debajo del umbral de minuto)", () => {
    expect(tiempoRelativo(hace(30 * SEGUNDO))).toBe("hace 30 segundos");
  });

  it("minutos", () => {
    expect(tiempoRelativo(hace(5 * MINUTO))).toBe("hace 5 minutos");
  });

  it("horas", () => {
    expect(tiempoRelativo(hace(2 * HORA))).toBe("hace 2 horas");
  });

  it("días, en el pasado", () => {
    expect(tiempoRelativo(hace(3 * DIA))).toBe("hace 3 días");
  });

  it("días, en el futuro", () => {
    expect(tiempoRelativo(enFuturo(2 * DIA))).toBe("pasado mañana");
  });

  it("semanas", () => {
    expect(tiempoRelativo(hace(10 * DIA))).toBe("la semana pasada");
  });

  it("meses", () => {
    expect(tiempoRelativo(hace(60 * DIA))).toBe("hace 2 meses");
  });

  it("años", () => {
    expect(tiempoRelativo(hace(400 * DIA))).toBe("el año pasado");
  });
});

describe("formatFecha", () => {
  it("formatea en es-CO: día, mes abreviado, año", () => {
    expect(formatFecha("2026-03-05T12:00:00Z")).toBe("5 de mar de 2026");
  });
});

describe("formatMoneda", () => {
  // Intl.NumberFormat separa el símbolo del monto con U+00A0 (espacio de
  // no separación), no un espacio normal — por eso el   explícito
  // abajo en vez de un " " que se ve idéntico pero no compara igual.
  it("convierte centavos a la unidad de la moneda (COP)", () => {
    expect(formatMoneda(15_000_000, "COP")).toBe("$ 150.000");
  });

  it("convierte centavos a la unidad de la moneda (USD)", () => {
    expect(formatMoneda(99_900, "USD")).toBe("US$ 999");
  });
});

describe("formatDuracion", () => {
  it("null: sin duración conocida", () => {
    expect(formatDuracion(null)).toBe("—");
  });

  it("0 o negativo: se trata igual que 'sin duración'", () => {
    expect(formatDuracion(0)).toBe("—");
    expect(formatDuracion(-5)).toBe("—");
  });

  it("formatea mm:ss con padding", () => {
    expect(formatDuracion(492)).toBe("08:12");
  });

  it("padea también los segundos sueltos", () => {
    expect(formatDuracion(65)).toBe("01:05");
  });
});

describe("formatTamanoArchivo", () => {
  it("null: sin tamaño conocido", () => {
    expect(formatTamanoArchivo(null)).toBe("");
  });

  it("bytes por debajo de 1 KB", () => {
    expect(formatTamanoArchivo(512)).toBe("512 B");
  });

  it("kilobytes", () => {
    expect(formatTamanoArchivo(1536)).toBe("1.5 KB");
  });

  it("megabytes", () => {
    expect(formatTamanoArchivo(1_468_006)).toBe("1.4 MB");
  });

  it("el límite exacto de 1024 ya cuenta como KB, no B", () => {
    expect(formatTamanoArchivo(1024)).toBe("1.0 KB");
  });
});

describe("extensionArchivo", () => {
  it("extensión simple", () => {
    expect(extensionArchivo("Guía de iluminación V-Ray.pdf")).toBe("PDF");
  });

  it("nombre con varios puntos: usa el último", () => {
    expect(extensionArchivo("plantilla.final.rte")).toBe("RTE");
  });

  it("sin extensión: cae al genérico", () => {
    expect(extensionArchivo("archivo-sin-extension")).toBe("ARCHIVO");
  });

  it("archivo oculto sin extensión real (punto inicial): cae al genérico", () => {
    expect(extensionArchivo(".gitignore")).toBe("ARCHIVO");
  });

  it("termina en punto sin nada después: cae al genérico", () => {
    expect(extensionArchivo("nombre.")).toBe("ARCHIVO");
  });
});
