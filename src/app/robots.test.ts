import { describe, expect, it } from "vitest";
import robots, { RUTAS_PRIVADAS } from "./robots";

const grupos = () => [robots().rules].flat();

describe("robots.txt", () => {
  // Un rastreador con grupo propio ignora el grupo `*`: si un grupo de IA
  // olvida las rutas privadas, ese rastreador entra a /admin.
  it("cada grupo bloquea todas las rutas privadas", () => {
    for (const grupo of grupos()) expect(grupo.disallow).toEqual(RUTAS_PRIVADAS);
  });

  // Bloqueadas, Google no podría leer su `noindex` y una URL enlazada desde
  // fuera quedaría indexada sin contenido.
  it("no bloquea las páginas públicas que llevan noindex", () => {
    const conNoindex = [
      "/login",
      "/recuperar",
      "/actualizar-password",
      "/verificar-correo",
      "/verificar-certificado",
      "/acceso-denegado",
      "/canjear",
      "/cuenta-eliminada",
    ];
    for (const ruta of conNoindex) {
      expect(RUTAS_PRIVADAS.some((p) => ruta.startsWith(p))).toBe(false);
    }
  });

  it("declara el sitemap", () => {
    expect(robots().sitemap).toBe("http://localhost:3000/sitemap.xml");
  });
});
