import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { idOrganizacion, organizacionCompleta } from "@/lib/seo/organizacion";

describe("organizacionCompleta", () => {
  it("mantiene el @id que usan las fichas de curso", () => {
    expect(organizacionCompleta()["@id"]).toBe(idOrganizacion());
  });

  it("declara un logo que existe en public/", () => {
    const { logo } = organizacionCompleta();
    const archivo = new URL(logo).pathname.slice(1);
    expect(existsSync(join(process.cwd(), "public", archivo))).toBe(true);
  });

  it("solo enlaza perfiles oficiales confirmados (sin Spotify por ahora)", () => {
    const { sameAs } = organizacionCompleta();
    expect(sameAs).toHaveLength(3);
    expect(sameAs.some((url) => url.includes("spotify"))).toBe(false);
  });
});
