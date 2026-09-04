import { describe, expect, it } from "vitest";
import {
  IP_DESCONOCIDA,
  SALTOS_CONFIABLES_POR_DEFECTO,
  construirDiagnostico,
  extraerIpConfiable,
  saltosConfiables,
} from "@/lib/clientIp";

// La regresión que este archivo existe para impedir (AUDIT-2026-09-04.md,
// P1-2): la implementación anterior devolvía el PRIMER valor de la cadena,
// que es el que escribe el cliente. Si alguna vez vuelve a hacerlo, el
// primer bloque de abajo falla.
describe("extraerIpConfiable — no devuelve lo que escribió el cliente", () => {
  it("con un salto de proxy toma la última entrada, no la primera", () => {
    expect(extraerIpConfiable("1.2.3.4, 10.0.0.1", 1)).toBe("10.0.0.1");
  });

  it("ignora una cadena entera falsificada por el atacante", () => {
    const falsificada = "6.6.6.6, 7.7.7.7, 8.8.8.8, 203.0.113.9";
    expect(extraerIpConfiable(falsificada, 1)).toBe("203.0.113.9");
  });

  it("da una clave distinta por cliente real aunque el atacante rote su valor", () => {
    const claves = new Set(
      ["1.1.1.1", "2.2.2.2", "3.3.3.3"].map((rotada) =>
        extraerIpConfiable(`${rotada}, 203.0.113.9`, 1),
      ),
    );

    // Rotar el valor propio ya no genera claves nuevas: las tres peticiones
    // caen en el mismo cubo y el límite las cuenta juntas.
    expect(claves.size).toBe(1);
    expect([...claves]).toEqual(["203.0.113.9"]);
  });
});

describe("extraerIpConfiable — cadenas normales", () => {
  it("devuelve la única entrada cuando el cliente no mandó nada", () => {
    expect(extraerIpConfiable("203.0.113.9", 1)).toBe("203.0.113.9");
  });

  it("retrocede un salto más cuando hay dos proxies de confianza", () => {
    expect(extraerIpConfiable("1.2.3.4, 203.0.113.9, 10.0.0.1", 2)).toBe("203.0.113.9");
  });

  it("tolera espacios y entradas vacías", () => {
    expect(extraerIpConfiable("  1.2.3.4 ,, 203.0.113.9  ", 1)).toBe("203.0.113.9");
  });

  it("acepta IPv6", () => {
    expect(extraerIpConfiable("::1, 2001:db8::a", 1)).toBe("2001:db8::a");
  });
});

describe("extraerIpConfiable — ausencia de cabecera", () => {
  it.each([null, undefined, "", "   ", ",,"])("devuelve %o como desconocida", (valor) => {
    expect(extraerIpConfiable(valor, 1)).toBe(IP_DESCONOCIDA);
  });

  it("no retrocede más allá del inicio si la cadena es más corta que los saltos", () => {
    // Todo lo que hay lo pusieron proxies de confianza: la primera entrada
    // ya es la IP real, y nunca `undefined`.
    expect(extraerIpConfiable("203.0.113.9", 3)).toBe("203.0.113.9");
  });
});

describe("saltosConfiables", () => {
  it("usa 1 cuando la variable no está definida", () => {
    expect(saltosConfiables(undefined)).toBe(SALTOS_CONFIABLES_POR_DEFECTO);
  });

  it("lee un entero válido", () => {
    expect(saltosConfiables("2")).toBe(2);
  });

  it.each(["0", "-1", "1.5", "muchos", ""])(
    "cae al defecto seguro con el valor inválido %o",
    (valor) => {
      expect(saltosConfiables(valor)).toBe(SALTOS_CONFIABLES_POR_DEFECTO);
    },
  );
});

describe("construirDiagnostico", () => {
  it("señala la posición de la que sale la IP", () => {
    const d = construirDiagnostico("1.2.3.4, 203.0.113.9", 1);

    expect(d.cadena).toEqual(["1.2.3.4", "203.0.113.9"]);
    expect(d.indiceUsado).toBe(1);
    expect(d.ipUsada).toBe("203.0.113.9");
    expect(d.crudo).toBe("1.2.3.4, 203.0.113.9");
  });

  it("no señala ninguna posición sin cabecera", () => {
    const d = construirDiagnostico(null, 1);

    expect(d.cadena).toEqual([]);
    expect(d.indiceUsado).toBeNull();
    expect(d.ipUsada).toBe(IP_DESCONOCIDA);
  });

  it("coincide siempre con lo que devolvería extraerIpConfiable", () => {
    for (const saltos of [1, 2, 3]) {
      const cadena = "1.2.3.4, 203.0.113.9, 10.0.0.1";
      expect(construirDiagnostico(cadena, saltos).ipUsada).toBe(
        extraerIpConfiable(cadena, saltos),
      );
    }
  });
});

describe("construirDiagnostico — origen del número de saltos", () => {
  it("informa el defecto cuando no se declara configurado", () => {
    expect(construirDiagnostico("203.0.113.9", 1).saltosConfigurados).toBe(false);
  });

  it("informa configurado cuando se le pasa así", () => {
    expect(construirDiagnostico("203.0.113.9", 2, true).saltosConfigurados).toBe(true);
  });
});
