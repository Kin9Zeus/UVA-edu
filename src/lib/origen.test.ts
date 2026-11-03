import { describe, expect, it } from "vitest";
import {
  RUTA_SIN_SESION,
  cabeceraDeOrigenValida,
  decidirOrigen,
  peticionDesdeCloudflare,
  secretoDeOrigen,
} from "@/lib/origen";

// Fase 2 del plan de blindaje: quien llama directo a Railway, sin pasar por
// Cloudflare, no trae el secreto y recibe 403. Con la variable sin poner,
// nada cambia: así el código se despliega antes de tener el dominio.
const SECRETO = "s3creto-largo-de-cloudflare-0123456789";

describe("secretoDeOrigen", () => {
  it("sin variable, vacía o con solo espacios: el cierre está apagado", () => {
    expect(secretoDeOrigen(undefined)).toBeNull();
    expect(secretoDeOrigen("")).toBeNull();
    expect(secretoDeOrigen("   ")).toBeNull();
  });

  it("quita espacios de los bordes (un salto de línea pegado en Railway)", () => {
    expect(secretoDeOrigen(` ${SECRETO}\n`)).toBe(SECRETO);
  });
});

describe("cabeceraDeOrigenValida", () => {
  it("solo el secreto exacto vale", () => {
    expect(cabeceraDeOrigenValida(SECRETO, SECRETO)).toBe(true);
    expect(cabeceraDeOrigenValida(SECRETO.slice(0, -1), SECRETO)).toBe(false);
    expect(cabeceraDeOrigenValida(`${SECRETO}x`, SECRETO)).toBe(false);
    expect(cabeceraDeOrigenValida(SECRETO.toUpperCase(), SECRETO)).toBe(false);
  });

  it("sin cabecera no vale", () => {
    expect(cabeceraDeOrigenValida(null, SECRETO)).toBe(false);
    expect(cabeceraDeOrigenValida(undefined, SECRETO)).toBe(false);
    expect(cabeceraDeOrigenValida("", SECRETO)).toBe(false);
  });
});

describe("decidirOrigen", () => {
  it("con el cierre apagado deja pasar todo, traiga o no la cabecera", () => {
    expect(decidirOrigen("/", null, undefined)).toBe("seguir");
    expect(decidirOrigen("/login", "cualquier-cosa", "")).toBe("seguir");
  });

  it("con el cierre encendido: sin cabecera o con una falsa, rechaza", () => {
    expect(decidirOrigen("/", null, SECRETO)).toBe("rechazar");
    expect(decidirOrigen("/login", "adivinando", SECRETO)).toBe("rechazar");
    expect(decidirOrigen("/api/webhooks/mux", null, SECRETO)).toBe("rechazar");
  });

  it("cubre el optimizador de imágenes y los estáticos, no solo las páginas", () => {
    expect(decidirOrigen("/_next/image", null, SECRETO)).toBe("rechazar");
    expect(decidirOrigen("/_next/static/chunks/app.js", null, SECRETO)).toBe("rechazar");
  });

  it("con la cabecera correcta deja pasar", () => {
    expect(decidirOrigen("/", SECRETO, SECRETO)).toBe("seguir");
    expect(decidirOrigen("/_next/image", SECRETO, SECRETO)).toBe("seguir");
  });

  it("/api/health queda abierta para el chequeo de Railway y el monitor", () => {
    expect(decidirOrigen("/api/health", null, SECRETO)).toBe("seguir");
    // Solo esa ruta exacta: no abre nada que empiece igual.
    expect(decidirOrigen("/api/health-falso", null, SECRETO)).toBe("rechazar");
    expect(decidirOrigen("/api/healthz", null, SECRETO)).toBe("rechazar");
  });
});

describe("peticionDesdeCloudflare", () => {
  it("con el cierre apagado nunca afirma que pasó por Cloudflare", () => {
    expect(peticionDesdeCloudflare(SECRETO, undefined)).toBe(false);
  });

  it("con el cierre encendido, solo si la cabecera coincide", () => {
    expect(peticionDesdeCloudflare(SECRETO, SECRETO)).toBe(true);
    expect(peticionDesdeCloudflare("otra", SECRETO)).toBe(false);
    expect(peticionDesdeCloudflare(null, SECRETO)).toBe(false);
  });
});

describe("RUTA_SIN_SESION", () => {
  it("estáticos, optimizador e imágenes no consultan la sesión", () => {
    for (const ruta of ["/_next/static/chunks/a.js", "/_next/image", "/favicon.ico", "/logo.svg", "/img/hero.webp"]) {
      expect(RUTA_SIN_SESION.test(ruta), ruta).toBe(true);
    }
  });

  it("las páginas, las acciones y la API sí", () => {
    for (const ruta of ["/", "/login", "/admin", "/api/health", "/api/webhooks/mux", "/_next/staticos", "/favicon.ico/x"]) {
      expect(RUTA_SIN_SESION.test(ruta), ruta).toBe(false);
    }
  });
});
