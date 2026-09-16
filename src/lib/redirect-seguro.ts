/**
 * Destino de redirección que viene del usuario (`?redirect=`, `?next=`, un
 * campo oculto de formulario), reducido a una ruta INTERNA del sitio.
 *
 * Por qué existe
 * --------------
 * Login, registro, `/auth/callback` y la página de `/login` validaban el
 * destino con `target.startsWith("/")`. Eso deja pasar `//sitio.com`: empieza
 * con `/`, pero un navegador lo lee como URL relativa al PROTOCOLO, o sea
 * otro dominio. Next no lo frena: el reducer de Server Actions resuelve el
 * destino con `new URL(destino, location.href)`, ve que el origen cambió y
 * hace navegación dura fuera del sitio
 * (next/dist/client/components/router-reducer/reducers/server-action-reducer.js).
 *
 * Así, `https://<uva>/login?redirect=//phishing.com` era un enlace legítimo
 * del dominio de U.V.A. que, tras un login REAL, dejaba al usuario en una
 * página ajena lista para pedirle la contraseña "otra vez". `/auth/callback`
 * ni siquiera tenía el `startsWith`: redirigía a `next` tal cual llegara.
 *
 * Por qué se parsea y no se comparan strings
 * ------------------------------------------
 * El arreglo obvio —además rechazar lo que empiece por `//`— sigue roto:
 * · `"/\t/sitio.com"`: el parser de URL descarta tabs y saltos de línea, así
 *   que el navegador lo lee como `//sitio.com`.
 * · `"/\\sitio.com"`: en URLs http(s) la barra invertida vale como `/`.
 * · `"/.//sitio.com"`: pasa el filtro de `//`, pero al normalizar el `.`
 *   queda `//sitio.com`.
 * Cada variante necesitaría su propia regla y siempre faltaría una. Se usa
 * el mismo parser WHATWG que usa el navegador y se compara el ORIGEN, que es
 * lo que realmente importa; después se vuelve a revisar la ruta ya
 * normalizada por el último caso.
 */

/** Base ficticia: solo sirve para detectar si el destino cambia de origen. */
const ORIGEN_PROPIO = "http://destino.invalid";

export const DESTINO_POR_DEFECTO = "/dashboard";

export function destinoInternoSeguro(
  valor: unknown,
  porDefecto: string = DESTINO_POR_DEFECTO,
): string {
  // `FormDataEntryValue` también puede ser un `File`.
  if (typeof valor !== "string" || !valor.startsWith("/")) return porDefecto;

  let url: URL;
  try {
    url = new URL(valor, ORIGEN_PROPIO);
  } catch {
    return porDefecto;
  }

  if (url.origin !== ORIGEN_PROPIO) return porDefecto;

  const destino = `${url.pathname}${url.search}${url.hash}`;

  // `"/.//sitio.com"` conserva el origen propio al parsearlo aquí, pero su
  // ruta normalizada es `//sitio.com`, que el navegador volvería a leer como
  // otro dominio al recibirla en el redirect.
  if (destino.startsWith("//")) return porDefecto;

  return destino;
}
