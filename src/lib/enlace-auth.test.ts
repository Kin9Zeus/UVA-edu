import { describe, expect, it } from "vitest";
import { esEnlaceVencidoOAjeno, nivelFalloEnlace } from "@/lib/enlace-auth";

describe("esEnlaceVencidoOAjeno", () => {
  it.each([
    "pkce_code_verifier_not_found",
    "bad_code_verifier",
    "flow_state_not_found",
    "flow_state_expired",
    "otp_expired",
  ])("%s es un enlace vencido o abierto en otro navegador", (code) => {
    expect(esEnlaceVencidoOAjeno({ code, status: 400 })).toBe(true);
    expect(nivelFalloEnlace({ code })).toBe("warning");
  });

  it("un Error con `code` también cuenta (así llega AuthPKCECodeVerifierMissingError)", () => {
    const error = Object.assign(new Error("PKCE code verifier not found"), {
      code: "pkce_code_verifier_not_found",
    });
    expect(esEnlaceVencidoOAjeno(error)).toBe(true);
  });

  it.each([
    ["otro código de auth", { code: "unexpected_failure" }],
    ["error sin código", new Error("fetch failed")],
    ["null", null],
    ["código no string", { code: 500 }],
  ])("%s sigue siendo un error real", (_caso, error) => {
    expect(esEnlaceVencidoOAjeno(error)).toBe(false);
    expect(nivelFalloEnlace(error)).toBe("error");
  });
});
