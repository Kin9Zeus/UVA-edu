import { describe, expect, it } from "vitest";
import { moverA } from "./reordenar";

const lista = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }];
const ids = (resultado: ReturnType<typeof moverA>) => resultado?.lista.map((e) => e.id).join("");

describe("moverA", () => {
  it("subir un paso deja los vecinos nuevos", () => {
    const r = moverA(lista, "c", 1);
    expect(ids(r)).toBe("acbd");
    expect(r).toMatchObject({ idAnterior: "a", idSiguiente: "b" });
  });

  it("bajar al final no tiene vecino siguiente", () => {
    const r = moverA(lista, "b", 3);
    expect(ids(r)).toBe("acdb");
    expect(r).toMatchObject({ idAnterior: "d", idSiguiente: null });
  });

  it("subir al principio no tiene vecino anterior", () => {
    expect(moverA(lista, "b", 0)).toMatchObject({ idAnterior: null, idSiguiente: "a" });
  });

  it("no mueve fuera de la lista, al mismo sitio ni un id que no existe", () => {
    expect(moverA(lista, "a", -1)).toBeNull();
    expect(moverA(lista, "d", 4)).toBeNull();
    expect(moverA(lista, "b", 1)).toBeNull();
    expect(moverA(lista, "z", 0)).toBeNull();
  });

  it("no cambia la lista original", () => {
    moverA(lista, "a", 2);
    expect(lista.map((e) => e.id).join("")).toBe("abcd");
  });
});
