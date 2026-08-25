import { describe, expect, it } from "vitest";
import { isPasswordValid, passwordRules } from "@/lib/password";

describe("isPasswordValid", () => {
  it("acepta una contraseña que cumple las 4 reglas", () => {
    expect(isPasswordValid("Abcdefgh1!")).toBe(true);
  });

  it("rechaza una contraseña vacía", () => {
    expect(isPasswordValid("")).toBe(false);
  });

  it("rechaza si falta longitud mínima (10)", () => {
    expect(isPasswordValid("Abc1!defg")).toBe(false); // 9 caracteres
  });

  it("acepta el límite exacto de 10 caracteres", () => {
    expect("Abcdefg1!x").toHaveLength(10);
    expect(isPasswordValid("Abcdefg1!x")).toBe(true);
  });

  it("rechaza el límite justo por debajo, 9 caracteres", () => {
    expect("Abcdefg1!").toHaveLength(9);
    expect(isPasswordValid("Abcdefg1!")).toBe(false);
  });

  it("rechaza si falta mayúscula", () => {
    expect(isPasswordValid("abcdefgh1!")).toBe(false);
  });

  it("rechaza si falta número", () => {
    expect(isPasswordValid("Abcdefghi!")).toBe(false);
  });

  it("rechaza si falta carácter especial", () => {
    expect(isPasswordValid("Abcdefgh12")).toBe(false);
  });
});

describe("passwordRules", () => {
  it("cada regla evalúa de forma independiente (no se pisan entre sí)", () => {
    const soloLongitudFalla = "Ab1!Ab1!"; // 8 caracteres, resto OK
    const fallidas = passwordRules.filter((r) => !r.test(soloLongitudFalla));
    expect(fallidas.map((r) => r.id)).toEqual(["length"]);
  });
});
