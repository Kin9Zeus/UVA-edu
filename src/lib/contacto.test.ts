import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { CORREO_SEGURIDAD, CORREO_SOPORTE } from "@/lib/contacto";
import { envioTransaccional } from "@/emails/marco/envio";

/**
 * Correos de contacto. Hasta el 2026-11 las plantillas citaban un buzón en
 * uva.edu (Universidad de Virginia): un estudiante con la cuenta robada le
 * habría escrito a otra institución. Estas pruebas evitan que vuelva.
 */

function archivos(carpeta: string): string[] {
  return readdirSync(carpeta).flatMap((nombre) => {
    const ruta = join(carpeta, nombre);
    return statSync(ruta).isDirectory() ? archivos(ruta) : [ruta];
  });
}

describe("correos de contacto", () => {
  it("son del dominio propio", () => {
    expect(CORREO_SOPORTE).toMatch(/@uvarq\.com$/);
    expect(CORREO_SEGURIDAD).toMatch(/@uvarq\.com$/);
  });

  it("ningún archivo de src/ cita un correo de uva.edu (Universidad de Virginia)", () => {
    const culpables = archivos(join(process.cwd(), "src"))
      .filter((ruta) => /\.(tsx?|md)$/.test(ruta))
      .filter((ruta) => /@uva\.edu\b/.test(readFileSync(ruta, "utf8")));
    expect(culpables).toEqual([]);
  });

  it("ningún envío llama a Resend sin pasar por envioTransaccional (que pone el «responder a»)", () => {
    const envios = archivos(join(process.cwd(), "src"))
      // Sin pruebas ni src/test/ (el servidor falso nombra la llamada en un comentario).
      .filter((ruta) => /\.(tsx?)$/.test(ruta) && !/\.test\./.test(ruta) && !/[\\/]src[\\/]test[\\/]/.test(ruta))
      .flatMap((ruta) => {
        const codigo = readFileSync(ruta, "utf8");
        return [...codigo.matchAll(/resend\.emails\.send\(([^)]{0,40})/g)].map((m) => `${ruta}: ${m[1]}`);
      });
    expect(envios.length).toBeGreaterThan(0);
    expect(envios.filter((e) => !e.includes("envioTransaccional"))).toEqual([]);
  });
});

describe("envioTransaccional", () => {
  const plantilla = createElement("p", null, "Hola");

  it("agrega el texto plano y responde a soporte", async () => {
    const envio = await envioTransaccional({ from: "UVA <hola@uvarq.com>", to: "ana@uva.co", subject: "x", react: plantilla });
    expect(envio.replyTo).toBe(CORREO_SOPORTE);
    expect(envio.text).toContain("Hola");
  });

  it("respeta un «responder a» explícito", async () => {
    const envio = await envioTransaccional({ react: plantilla, replyTo: "otra@uvarq.com" });
    expect(envio.replyTo).toBe("otra@uvarq.com");
  });
});

describe("/.well-known/security.txt (RFC 9116)", () => {
  const texto = readFileSync(join(process.cwd(), "public", ".well-known", "security.txt"), "utf8");
  const campo = (nombre: string) => texto.match(new RegExp(`^${nombre}: (.+)$`, "m"))?.[1];

  it("tiene el contacto de seguridad", () => {
    expect(campo("Contact")).toBe(`mailto:${CORREO_SEGURIDAD}`);
  });

  it("vence en el futuro y a menos de un año (la norma pide renovarlo)", () => {
    const vence = new Date(campo("Expires") ?? "");
    const enUnAnio = new Date();
    enUnAnio.setFullYear(enUnAnio.getFullYear() + 1);
    expect(Number.isNaN(vence.getTime())).toBe(false);
    expect(vence.getTime()).toBeGreaterThan(Date.now());
    expect(vence.getTime()).toBeLessThanOrEqual(enUnAnio.getTime() + 24 * 3600 * 1000);
  });
});
