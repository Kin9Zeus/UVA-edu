import { describe, expect, it } from "vitest";
import { construirCsp, endpointInformesCsp, generarNonce } from "@/lib/csp";

const DSN = "https://abc123def456@o4511972325588992.ingest.us.sentry.io/4511972327096320";
const SUPABASE = "https://eoewtxnheblzsspnubvt.supabase.co";

function csp(extra: Partial<Parameters<typeof construirCsp>[0]> = {}) {
  return construirCsp({
    nonce: "n0nc3DePrueba==",
    desarrollo: false,
    supabaseUrl: SUPABASE,
    sentryDsn: DSN,
    ...extra,
  });
}

/** Aísla una directiva para no dar por buena una coincidencia en otra. */
function directiva(politica: string, nombre: string): string {
  const encontrada = politica
    .split(";")
    .map((d) => d.trim())
    .find((d) => d === nombre || d.startsWith(`${nombre} `));
  return encontrada ?? "";
}

describe("construirCsp — script-src es donde está el riesgo real", () => {
  it("nunca permite 'unsafe-inline' en script-src, ni en desarrollo", () => {
    // La razón de ser de todo el nonce. Si esto se rompe, la política deja de
    // servir para lo único que de verdad importa: que un XSS no ejecute.
    expect(directiva(csp(), "script-src")).not.toContain("'unsafe-inline'");
    expect(directiva(csp({ desarrollo: true }), "script-src")).not.toContain("'unsafe-inline'");
  });

  it("lleva el nonce de esta petición y 'strict-dynamic'", () => {
    const scriptSrc = directiva(csp(), "script-src");
    expect(scriptSrc).toContain("'nonce-n0nc3DePrueba=='");
    expect(scriptSrc).toContain("'strict-dynamic'");
  });

  it("'unsafe-eval' solo en desarrollo (React lo usa para los stacks de error)", () => {
    expect(directiva(csp({ desarrollo: true }), "script-src")).toContain("'unsafe-eval'");
    expect(directiva(csp(), "script-src")).not.toContain("'unsafe-eval'");
  });
});

describe("construirCsp — orígenes medidos, no supuestos", () => {
  it("connect-src abre Supabase por https y por wss (Realtime)", () => {
    const connect = directiva(csp(), "connect-src");
    expect(connect).toContain("https://eoewtxnheblzsspnubvt.supabase.co");
    expect(connect).toContain("wss://eoewtxnheblzsspnubvt.supabase.co");
  });

  it("el video de Mux puede cargar: manifiestos, telemetría y worker", () => {
    const politica = csp();
    expect(directiva(politica, "media-src")).toContain("https://*.mux.com");
    expect(directiva(politica, "connect-src")).toContain("https://*.mux.com");
    expect(directiva(politica, "connect-src")).toContain("https://*.litix.io");
    // El reproductor descompone HLS en un worker creado desde un blob.
    expect(directiva(politica, "worker-src")).toContain("blob:");
  });

  /**
   * Regresión de las violaciones que recogió la fase de observación
   * (UVA-EDU-1J/1K/1M/1Q/1R/1T en Sentry). La política anterior enumeraba
   * `stream.mux.com` y `stats.mux.com`, y el navegador nunca pide esos hosts:
   * pide el PoP regional al que redirigen. Forzarla así habría dejado sin
   * video a todo el mundo y sin subidas al administrador.
   *
   * Se comprueba contra los hosts REALES observados, no contra el comodín,
   * para que la prueba siga valiendo si alguien lo cambia por otra cosa.
   */
  it("los PoP regionales de Mux que aparecieron en producción están cubiertos", () => {
    const connect = directiva(csp(), "connect-src");
    const comodinCasa = (host: string) =>
      connect
        .split(" ")
        .some((fuente) =>
          fuente.startsWith("https://*.")
            ? host.endsWith(fuente.slice("https://*".length))
            : fuente === `https://${host}`,
        );

    for (const host of [
      "manifest-oci-us-phoenix-1-vop1.fastly.mux.com",
      "chunk-oci-us-phoenix-1-vop1.fastly.mux.com",
      "manifest-oci-us-ashburn-1-vop1.fastly.mux.com",
      "chunk-oci-us-ashburn-1-vop1.fastly.mux.com",
      "direct-uploads-oci-us-phoenix-1-vop1.mux.com",
      "inferred.litix.io",
      // Los de siempre tienen que seguir pasando.
      "stream.mux.com",
      "stats.mux.com",
    ]) {
      expect(comodinCasa(host), `${host} debería estar permitido`).toBe(true);
    }
  });

  /**
   * El comodín cubre subdominios de Mux, no cualquier dominio que TERMINE en
   * algo parecido: `evilmux.com` o `mux.com.atacante.net` deben quedar fuera.
   */
  it("el comodín de Mux no abre dominios ajenos parecidos", () => {
    const connect = directiva(csp(), "connect-src");
    expect(connect).not.toContain("https://*mux.com");
    expect(connect).toContain("https://*.mux.com");
    // ".mux.com" como sufijo exige el punto: "evilmux.com" no lo tiene.
    expect("evilmux.com".endsWith(".mux.com")).toBe(false);
  });

  it("las miniaturas de Mux y las portadas de Supabase pasan por img-src", () => {
    const img = directiva(csp(), "img-src");
    expect(img).toContain("https://image.mux.com");
    expect(img).toContain("https://eoewtxnheblzsspnubvt.supabase.co");
  });

  it("font-src se queda en 'self': next/font sirve las tipografías desde /_next", () => {
    expect(directiva(csp(), "font-src")).toBe("font-src 'self'");
  });

  it("picsum solo en desarrollo (lo usa el seed, no producción)", () => {
    expect(directiva(csp({ desarrollo: true }), "img-src")).toContain("https://picsum.photos");
    expect(directiva(csp(), "img-src")).not.toContain("picsum");
  });
});

describe("construirCsp — las directivas que cierran vectores clásicos", () => {
  it.each([
    ["object-src", "'none'"],
    ["frame-src", "'none'"],
    ["frame-ancestors", "'none'"],
    ["base-uri", "'self'"],
    ["form-action", "'self'"],
    ["default-src", "'self'"],
  ])("%s = %s", (nombre, valor) => {
    expect(directiva(csp(), nombre)).toBe(`${nombre} ${valor}`);
  });

  it("upgrade-insecure-requests solo en producción", () => {
    // En desarrollo forzaría a https el http://localhost:3000 de `next dev`
    // y de Playwright.
    expect(csp()).toContain("upgrade-insecure-requests");
    expect(csp({ desarrollo: true })).not.toContain("upgrade-insecure-requests");
  });
});

describe("construirCsp — no puede tumbar el sitio por configuración", () => {
  it("una URL de Supabase inválida degrada la política en vez de lanzar", () => {
    // Una variable mal puesta debe quitar un origen, nunca reventar cada
    // petición: este código corre en el proxy, antes que cualquier página.
    expect(() => csp({ supabaseUrl: "esto-no-es-una-url" })).not.toThrow();
    expect(directiva(csp({ supabaseUrl: "esto-no-es-una-url" }), "connect-src")).toBe(
      "connect-src 'self' https://*.mux.com https://*.litix.io https://o4511972325588992.ingest.us.sentry.io",
    );
  });

  it("sin variables de entorno sigue produciendo una política válida", () => {
    const politica = csp({ supabaseUrl: undefined, sentryDsn: undefined });
    expect(politica).toContain("default-src 'self'");
    expect(politica).not.toContain("undefined");
    expect(politica).not.toContain("report-uri");
  });
});

describe("endpointInformesCsp", () => {
  it("deriva el endpoint de seguridad del DSN de Sentry", () => {
    // Sin esto, Report-Only solo escribe en la consola del navegador de cada
    // visitante — o sea, en ningún sitio que alguien vaya a mirar.
    expect(endpointInformesCsp(DSN)).toBe(
      "https://o4511972325588992.ingest.us.sentry.io/api/4511972327096320/security/?sentry_key=abc123def456",
    );
  });

  it("y aparece como report-uri en la política", () => {
    expect(csp()).toContain("report-uri https://o4511972325588992.ingest.us.sentry.io/api/");
  });

  it.each([undefined, "", "no-es-un-dsn", "https://sin-clave.sentry.io/123", "https://clave@host/"])(
    "devuelve null con un DSN inservible (%s)",
    (dsn) => {
      expect(endpointInformesCsp(dsn)).toBeNull();
    },
  );
});

describe("generarNonce", () => {
  it("da 128 bits en base64", () => {
    expect(Buffer.from(generarNonce(), "base64")).toHaveLength(16);
  });

  it("es distinto en cada llamada", () => {
    // Un nonce predecible no protege de nada: el atacante lo pondría en su
    // propio script.
    const muestras = new Set(Array.from({ length: 200 }, generarNonce));
    expect(muestras.size).toBe(200);
  });
});
