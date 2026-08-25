import { describe, expect, it } from "vitest";
import { planificarReasignacion } from "@/lib/admin/reasignarCategoria";

// Escenario base: se elimina la categoría A y sus cursos se reasignan a B.
describe("planificarReasignacion", () => {
  it("mueve un curso que solo estaba en la categoría eliminada", () => {
    const plan = planificarReasignacion([{ id: "fila-1", idCurso: "curso-1" }], []);

    expect(plan).toEqual({ soltar: [], mover: ["fila-1"] });
  });

  it("NO duplica: un curso que ya estaba en el destino solo pierde la vieja", () => {
    // curso-1 está en {A, B} y el destino es B. Su fila de A se suelta en
    // vez de moverse, así que termina en {B} y no en {B, B}.
    const plan = planificarReasignacion([{ id: "fila-1", idCurso: "curso-1" }], ["curso-1"]);

    expect(plan).toEqual({ soltar: ["fila-1"], mover: [] });
  });

  it("separa correctamente cuando hay cursos de los dos tipos", () => {
    const plan = planificarReasignacion(
      [
        { id: "fila-1", idCurso: "curso-1" }, // solo en A -> se mueve
        { id: "fila-2", idCurso: "curso-2" }, // en A y en B -> se suelta
        { id: "fila-3", idCurso: "curso-3" }, // solo en A -> se mueve
      ],
      ["curso-2", "curso-9"], // curso-9 está en B pero no en A: no influye
    );

    expect(plan.mover).toEqual(["fila-1", "fila-3"]);
    expect(plan.soltar).toEqual(["fila-2"]);
  });

  it("todos los cursos ya estaban en el destino: no queda nada que mover", () => {
    const plan = planificarReasignacion(
      [
        { id: "fila-1", idCurso: "curso-1" },
        { id: "fila-2", idCurso: "curso-2" },
      ],
      ["curso-1", "curso-2"],
    );

    expect(plan).toEqual({ soltar: ["fila-1", "fila-2"], mover: [] });
  });

  it("una categoría sin cursos no genera ninguna operación", () => {
    expect(planificarReasignacion([], ["curso-1"])).toEqual({ soltar: [], mover: [] });
  });

  it("cada fila cae en exactamente una lista, nunca en las dos", () => {
    const filas = [
      { id: "fila-1", idCurso: "curso-1" },
      { id: "fila-2", idCurso: "curso-2" },
      { id: "fila-3", idCurso: "curso-3" },
    ];
    const plan = planificarReasignacion(filas, ["curso-2"]);

    // Ninguna fila se pierde ni se procesa dos veces: si una quedara fuera,
    // la categoría no se podría borrar (la FK es RESTRICT); si quedara en
    // ambas, se borraría y se intentaría mover a la vez.
    expect([...plan.soltar, ...plan.mover].sort()).toEqual(["fila-1", "fila-2", "fila-3"]);
  });
});
