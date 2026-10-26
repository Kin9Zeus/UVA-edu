import { describe, expect, it } from "vitest";
import { destinoTemaViejo } from "@/lib/soporte";

describe("destinoTemaViejo (enlaces viejos /soporte?tema=…)", () => {
  it("lleva Términos y Privacidad a sus páginas públicas, también desde el panel", () => {
    expect(destinoTemaViejo("terminos", "/soporte")).toBe("/soporte/terminos");
    expect(destinoTemaViejo("privacidad", "/dashboard/soporte")).toBe("/soporte/privacidad");
  });

  it("deja Contacto y el Centro de ayuda en el soporte del que se llegó", () => {
    expect(destinoTemaViejo("contacto", "/dashboard/soporte")).toBe("/dashboard/soporte#contacto");
    expect(destinoTemaViejo("centro-de-ayuda", "/soporte")).toBe("/soporte");
  });

  it("no redirige sin tema o con uno que no existe", () => {
    expect(destinoTemaViejo(undefined, "/soporte")).toBeNull();
    expect(destinoTemaViejo("otro", "/soporte")).toBeNull();
    expect(destinoTemaViejo(["terminos", "privacidad"], "/soporte")).toBeNull();
  });
});
