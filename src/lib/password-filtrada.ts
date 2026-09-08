import { logError } from "@/lib/log";

/**
 * Rechaza contraseñas que aparecen en filtraciones conocidas, consultando
 * la API de Pwned Passwords (Have I Been Pwned).
 *
 * Por qué existe
 * --------------
 * `src/lib/password.ts` exige 10 caracteres, mayúscula, número y símbolo.
 * Eso mide la FORMA de la contraseña, no si alguien más ya la usa: reglas
 * de composición como esas empujan a la gente hacia un puñado de patrones
 * muy predecibles —`Password123!`, `Colombia2026!`, `Constructor1!`— que
 * las cumplen todas y aparecen millones de veces en las filtraciones.
 *
 * Ese es justo el insumo del *password spraying*: probar una contraseña
 * común contra miles de correos distintos. El límite de intentos de login
 * (022) no lo frena porque cuenta 5 fallos POR CORREO y el ataque nunca
 * llega a 2 en ninguno. La defensa que sí ataca la raíz es que la
 * contraseña de la víctima no esté en la lista del atacante.
 *
 * Supabase Auth trae esta misma comprobación como un toggle, pero solo en
 * los planes de pago; acá se hace en el código para no depender del plan.
 *
 * La contraseña NO sale de este servidor
 * --------------------------------------
 * Es el protocolo de k-anonimato de HIBP: se calcula el SHA-1 y se mandan
 * ÚNICAMENTE los primeros 5 caracteres hexadecimales del hash. El servicio
 * responde con todos los sufijos que empiezan por ese prefijo (unos
 * cientos), y la comparación contra el sufijo real ocurre acá. Quien mire
 * el tráfico ve 5 caracteres compartidos por ~800 contraseñas distintas —
 * ni la contraseña, ni su hash completo, ni el correo del usuario.
 *
 * `Add-Padding: true` completa la respuesta con entradas falsas para que su
 * TAMAÑO no delate cuántos resultados reales tenía el prefijo. Esas
 * entradas vienen con `count = 0` y hay que descartarlas: contarlas como
 * coincidencia rechazaría contraseñas perfectamente buenas.
 *
 * Falla abierto, a propósito
 * --------------------------
 * Si HIBP no responde, tarda demasiado o devuelve algo raro, la función
 * dice "no filtrada" y el registro continúa. Es la decisión correcta: esto
 * es una capa extra sobre reglas que ya se aplican, y la alternativa
 * —tumbar el registro de usuarios nuevos porque un tercero está caído— es
 * peor que el riesgo que evita. Queda en Sentry para poder notarlo si pasa
 * de ser algo puntual.
 */

const API = "https://api.pwnedpasswords.com/range";

/** Un registro que se demora más que esto no vale la pena; se sigue sin él. */
const TIMEOUT_MS = 2500;

async function sha1Hex(texto: string): Promise<string> {
  // Web Crypto (global desde Node 18) en vez de `node:crypto`: el mismo
  // código sirve si algún día esto corre en el runtime edge.
  const digest = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(texto));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}

export async function esPasswordFiltrada(password: string): Promise<boolean> {
  try {
    const hash = await sha1Hex(password);
    const prefijo = hash.slice(0, 5);
    const sufijo = hash.slice(5);

    const respuesta = await fetch(`${API}/${prefijo}`, {
      headers: { "Add-Padding": "true" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      // Sin esto Next puede cachear la respuesta en el Data Cache. No es un
      // dato que deba cachearse por request de registro.
      cache: "no-store",
    });

    if (!respuesta.ok) {
      logError("esPasswordFiltrada", `HIBP respondió ${respuesta.status}`, null, {
        area: "auth",
        estado: respuesta.status,
      });
      return false;
    }

    const cuerpo = await respuesta.text();

    for (const linea of cuerpo.split("\n")) {
      const [suf, veces] = linea.trim().split(":");
      // `count = 0` son las entradas de relleno de Add-Padding, no
      // coincidencias reales.
      if (suf === sufijo && Number(veces) > 0) return true;
    }

    return false;
  } catch (error) {
    // Incluye el timeout del AbortSignal y cualquier fallo de red.
    logError("esPasswordFiltrada", "no se pudo consultar HIBP; se deja pasar", error, {
      area: "auth",
    });
    return false;
  }
}

/** Mensaje único para los dos puntos que la usan, para que no diverjan. */
export const MENSAJE_PASSWORD_FILTRADA =
  "Esa contraseña aparece en filtraciones de datos conocidas. Elige otra distinta.";
