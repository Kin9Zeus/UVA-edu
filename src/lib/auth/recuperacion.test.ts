import { describe, expect, it } from "vitest";
import { decidirRecuperacion } from "@/lib/auth/recuperacion";

/**
 * El enlace de «recuperar contraseña» inicia sesión (así funciona Supabase).
 * Esa sesión solo debe servir para cambiar la contraseña: si la persona se
 * va a otra parte del sitio (p. ej. el logo), se cierra.
 */
describe("decidirRecuperacion", () => {
  const base = { tieneSesion: true, enRecuperacion: true, esPrecarga: false };

  it.each(["/actualizar-password", "/seguridad/verificar", "/auth/confirm", "/api/health"])(
    "%s sigue: es parte del cambio de contraseña (o técnica)",
    (pathname) => {
      expect(decidirRecuperacion({ ...base, pathname })).toBe("seguir");
    },
  );

  it.each(["/", "/dashboard", "/admin", "/login", "/cursos/revit", "/actualizar-password-falsa"])(
    "%s cierra la sesión de recuperación",
    (pathname) => {
      expect(decidirRecuperacion({ ...base, pathname })).toBe("cerrar");
    },
  );

  it("una precarga de Next (el logo visible) no cierra nada: solo se rechaza", () => {
    expect(decidirRecuperacion({ ...base, pathname: "/", esPrecarga: true })).toBe("rechazar-precarga");
  });

  it("sin la marca de recuperación, o sin sesión, no interviene", () => {
    expect(decidirRecuperacion({ ...base, pathname: "/", enRecuperacion: false })).toBe("seguir");
    expect(decidirRecuperacion({ ...base, pathname: "/", tieneSesion: false })).toBe("seguir");
  });
});
