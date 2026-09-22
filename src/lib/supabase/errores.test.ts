import { describe, expect, it } from "vitest";
import { lanzarSiFalla } from "@/lib/supabase/errores";

/**
 * P0-1, seguimiento (AUDIT-2026-09-08). Estas pruebas cubren el envoltorio,
 * no el `throw`: lo que se rompe en silencio es que un PostgrestError —un
 * objeto plano, no un Error— se relance tal cual, dejando a Next sin
 * `digest` y a Sentry sin agrupar. Ver lanzarSiFalla() en lib/supabase/errores.ts.
 */
describe("lanzarSiFalla", () => {
  it("no hace nada cuando la consulta salió bien", () => {
    expect(() => lanzarSiFalla(null, "getIntentoEnCurso")).not.toThrow();
  });

  it("lanza un Error de verdad, no el objeto plano de PostgREST", () => {
    // Forma real de un PostgrestError: sin prototipo de Error.
    const postgrest = { message: "permission denied for column preguntas_congeladas", code: "42501" };

    try {
      lanzarSiFalla(postgrest, "getIntentoEnCurso");
      expect.unreachable("debió lanzar");
    } catch (e) {
      expect(e).toBeInstanceOf(Error);
    }
  });

  it("conserva el código de Postgres y el nombre de la consulta en el mensaje", () => {
    expect(() =>
      lanzarSiFalla({ message: "permission denied", code: "42501" }, "getResultadoIntento"),
    ).toThrow(/getResultadoIntento.*permission denied.*42501/);
  });

  it("lanza igual aunque el error venga sin message ni code", () => {
    // Un error sin forma sigue siendo un fallo: tragárselo es justo lo que
    // convertía el 42501 en un bucle de redirección.
    expect(() => lanzarSiFalla({}, "getIntentoEnCurso")).toThrow(/sin código/);
  });
});
