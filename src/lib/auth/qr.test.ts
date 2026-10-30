import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import Image from "next/image";
import QRCode from "qrcode";
import { qrDeActivacion, uriSegundoFactor } from "@/lib/auth/qr";

const SECRETO = "JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP"; // 32 caracteres, como el de Supabase
const CORREO = "juanlarrotasilva@hotmail.com";

/** Lo que de verdad falló en la pantalla de activar: pintarlo con next/image. */
const pintar = (src: string, lado: number) =>
  renderToString(createElement(Image, { src, alt: "qr", width: lado, height: lado, unoptimized: true }));

const modulosDe = (uri: string) => QRCode.create(uri, { errorCorrectionLevel: "L" }).modules.size;

describe("uriSegundoFactor", () => {
  it("lleva emisor, cuenta (el correo, codificado) y secreto", () => {
    expect(uriSegundoFactor({ secreto: SECRETO, correo: CORREO })).toBe(
      `otpauth://totp/U.V.A.:juanlarrotasilva%40hotmail.com?secret=${SECRETO}&issuer=U.V.A.`,
    );
  });

  it("no menciona a Supabase: la app de autenticación debe decir U.V.A.", () => {
    expect(uriSegundoFactor({ secreto: SECRETO, correo: CORREO }).toLowerCase()).not.toContain("supabase");
  });

  it("un correo con caracteres especiales se codifica y no rompe la dirección", () => {
    const uri = uriSegundoFactor({ secreto: SECRETO, correo: "ana+uva@correo.co" });

    expect(uri).toContain("U.V.A.:ana%2Buva%40correo.co?");
    expect(new URL(uri).searchParams.get("secret")).toBe(SECRETO);
  });

  it("sin correo la cuenta es solo el emisor", () => {
    expect(uriSegundoFactor({ secreto: SECRETO, correo: undefined })).toBe(
      `otpauth://totp/U.V.A.?secret=${SECRETO}&issuer=U.V.A.`,
    );
  });

  it("es bastante más corta que la de Supabase (144 caracteres): es lo que achica el QR", () => {
    expect(uriSegundoFactor({ secreto: SECRETO, correo: CORREO }).length).toBeLessThan(115);
  });
});

describe("qrDeActivacion: que se lea con la cámara", () => {
  it("un correo normal da un QR de 37×37 módulos, no los 49×49 del de Supabase", () => {
    expect(modulosDe(uriSegundoFactor({ secreto: SECRETO, correo: CORREO }))).toBe(37);
  });

  it("cada módulo mide al menos 8 px en el caso normal", async () => {
    const { lado } = await qrDeActivacion({ secreto: SECRETO, correo: CORREO });
    const total = 37 + 8; // módulos + margen de 4 a cada lado

    expect(lado).toBe(360);
    expect(lado / total).toBeGreaterThanOrEqual(8);
  });

  it("el lado es SIEMPRE múltiplo entero del total de módulos, incluso con correos largos", async () => {
    for (const correo of [undefined, "a@b.co", CORREO, "administrador.academico@universidad.edu.co", "x".repeat(80) + "@uva.co"]) {
      const { lado } = await qrDeActivacion({ secreto: SECRETO, correo });
      const total = modulosDe(uriSegundoFactor({ secreto: SECRETO, correo })) + 8;

      expect(lado % total).toBe(0);
      expect(lado / total).toBeGreaterThanOrEqual(5);
    }
  });

  it("trae su margen blanco y su fondo: no depende del tema de la pantalla", async () => {
    const { src } = await qrDeActivacion({ secreto: SECRETO, correo: CORREO });
    const svg = decodeURIComponent(src.slice(src.indexOf(",") + 1));

    // 37 módulos + 4 de margen a cada lado.
    expect(svg).toContain('viewBox="0 0 45 45"');
    expect(svg).toContain("#ffffff");
  });
});

describe("qrDeActivacion: que se pinte", () => {
  it("el resultado lo pinta next/image sin lanzar (el 500 de «Empezar»)", async () => {
    const { src, lado } = await qrDeActivacion({ secreto: SECRETO, correo: CORREO });

    expect(pintar(src, lado)).toContain("<img");
  });

  it("el data: no trae espacios, saltos ni comillas sin codificar en los bordes ni en el cuerpo", async () => {
    const { src } = await qrDeActivacion({ secreto: SECRETO, correo: CORREO });

    expect(src.startsWith("data:image/svg+xml;charset=utf-8,")).toBe(true);
    expect(src.slice(src.indexOf(",") + 1)).not.toMatch(/[<>"\s]/);
  });
});
