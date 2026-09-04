import { describe, expect, it, vi } from "vitest";
import { logError } from "@/lib/log";

// Monitoreo/alertas — "registro estructurado sin datos personales ni
// tokens en los logs". Prueba la redacción por nombre de llave dentro de
// `context`, no el envío a Sentry (Sentry.captureException sin `init()` es
// un no-op seguro del propio SDK, no necesita mock).
describe("logError", () => {
  it("redacta llaves sensibles en el log de consola, incluso anidadas", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    logError("test", "algo falló", new Error("boom"), {
      area: "email",
      correo: "estudiante@ejemplo.com",
      token: "abc123",
      leccionId: "l-1",
      usuario: { email: "otro@ejemplo.com", nombre: "Ana" },
      lista: [{ password: "secreta" }],
    });

    const logueado = JSON.parse(spy.mock.calls[0][0] as string);

    expect(logueado.correo).toBe("[redactado]");
    expect(logueado.token).toBe("[redactado]");
    expect(logueado.usuario.email).toBe("[redactado]");
    expect(logueado.usuario.nombre).toBe("Ana");
    expect(logueado.lista[0].password).toBe("[redactado]");
    expect(logueado.leccionId).toBe("l-1");
    expect(logueado.area).toBe("email");

    spy.mockRestore();
  });

  it("no toca el mensaje de la excepción original", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    logError("test", "algo falló", new Error("correo@ejemplo.com no existe"));

    const logueado = JSON.parse(spy.mock.calls[0][0] as string);
    expect(logueado.error.mensaje).toBe("correo@ejemplo.com no existe");

    spy.mockRestore();
  });
});
