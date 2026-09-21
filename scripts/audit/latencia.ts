/**
 * Mide cuánto tarda cada ruta en responder, para comparar rutas entre sí y
 * una misma ruta antes y después de un cambio.
 *
 * Uso:
 *   npm run audit:latencia
 *   npm run audit:latencia -- --base-url=http://localhost:3000
 *   npm run audit:latencia -- --repeticiones=5 --anonimo
 *
 * Flags:
 *   --base-url=<url>        Default: https://uva-edu-production.up.railway.app
 *   --repeticiones=<n>      Medidas por ruta. Default: 3 (se reporta la mediana)
 *   --anonimo               No inicia sesión: solo mide las rutas públicas
 *   --email=<correo>        Cuenta con la que medir. Default: la del seed
 *
 * Por qué existe
 * --------------
 * Railway corre en US-West y Supabase en US-East, así que cada consulta desde
 * el servidor cuesta ~190 ms de ida y vuelta. Con ese peaje, lo que importa
 * no es el número absoluto de una ruta —que incluye la latencia de quien mide
 * y varía según desde dónde se corra— sino cuántos de esos viajes encadena
 * cada ruta.
 *
 * El número que imprime es tiempo de pared completo: desde que sale la
 * petición hasta que llega la respuesta entera. NO aísla el tiempo de
 * servidor. Lo que sí hace es quitarle el ruido comparable: una petición de
 * calentamiento por ruta deja la conexión TLS establecida, de modo que las
 * medidas reales no pagan el handshake, y la fila `/login` absorbe la
 * latencia de red constante para que el resto se lea CONTRA ella.
 *
 * Si necesitas el tiempo de servidor aislado de verdad, `curl` sí expone las
 * marcas de conexión:
 *
 *   curl -s -o /dev/null -w "%{time_starttransfer} %{time_appconnect}" <url>
 *
 * y la resta de esos dos valores es trabajo del servidor.
 *
 * Cómo leerlo
 * -----------
 * La fila `/login` es el PISO: no consulta la base, así que marca el coste de
 * renderizar más la red hasta tu máquina, y nada más. La diferencia entre
 * cualquier otra ruta y ese piso, dividida por ~190 ms, es aproximadamente el
 * número de consultas encadenadas que hace. Una ruta que baja de 1400 a 300 ms no es "más rápida" en abstracto
 * — es que dejó de cruzar el continente nueve veces.
 *
 * Local, bajo demanda — igual que audit:lighthouse, no es un gate de CI:
 * medir contra producción desde el runner de GitHub daría números de otra red.
 */

import { readFileSync } from "node:fs";

const BASE_URL_DEFECTO = "https://uva-edu-production.up.railway.app";
const EMAIL_DEFECTO = "estudiante-activo@uva.test";
/** La misma de prisma/seed.ts (PASSWORD_PRUEBA). Solo sirve contra datos de
 *  prueba; si el entorno no tiene el seed cargado, el script avisa y sigue en
 *  modo anónimo en vez de fallar. */
const PASSWORD_SEED = "UvaSeed2026!";

const RUTAS_PUBLICAS = ["/login", "/", "/catalogo", "/planes", "/api/health"];
const RUTAS_PRIVADAS = [
  "/dashboard",
  "/dashboard/catalogo",
  "/dashboard/progreso",
  "/dashboard/certificados",
  "/dashboard/comunidad",
  "/dashboard/perfil",
  "/dashboard/suscripcion",
];

function flag(nombre: string): string | undefined {
  const encontrado = process.argv.find((arg) => arg.startsWith(`--${nombre}=`));
  return encontrado?.split("=").slice(1).join("=");
}

function leerEnvLocal(clave: string): string | undefined {
  try {
    const texto = readFileSync(".env.local", "utf8");
    const linea = texto.match(new RegExp(`^${clave}=(.*)$`, "m"));
    return linea?.[1]?.trim().replace(/^["']|["']$/g, "");
  } catch {
    return undefined;
  }
}

/**
 * Cookie de sesión en el formato que lee @supabase/ssr 0.12: el prefijo
 * `base64-` seguido del JSON de la sesión en base64url, troceado en cookies
 * `.0`, `.1`… cada 3180 caracteres (MAX_CHUNK_SIZE en
 * node_modules/@supabase/ssr/dist/main/utils/chunker.js).
 */
async function iniciarSesion(email: string): Promise<string | null> {
  const supabaseUrl = leerEnvLocal("NEXT_PUBLIC_SUPABASE_URL");
  const anonKey = leerEnvLocal("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  if (!supabaseUrl || !anonKey) {
    console.warn("⚠  Sin credenciales de Supabase en .env.local — solo rutas públicas.");
    return null;
  }

  const respuesta = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: anonKey, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: PASSWORD_SEED }),
  });
  const sesion = await respuesta.json();
  if (!sesion.access_token) {
    console.warn(`⚠  No se pudo iniciar sesión como ${email} — solo rutas públicas.`);
    return null;
  }

  const ref = new URL(supabaseUrl).hostname.split(".")[0];
  const payload = `base64-${Buffer.from(JSON.stringify(sesion)).toString("base64url")}`;
  const trozos: string[] = [];
  for (let i = 0; i < payload.length; i += 3180) trozos.push(payload.slice(i, i + 3180));

  return trozos.length === 1
    ? `sb-${ref}-auth-token=${trozos[0]}`
    : trozos.map((trozo, i) => `sb-${ref}-auth-token.${i}=${trozo}`).join("; ");
}

/** Una medida: tiempo de pared de la petición completa, cuerpo incluido. */
async function medirUnaVez(url: string, cookie: string | null): Promise<number> {
  const inicio = performance.now();
  const respuesta = await fetch(url, {
    headers: cookie ? { Cookie: cookie } : {},
    redirect: "manual",
  });
  await respuesta.arrayBuffer();
  return performance.now() - inicio;
}

function mediana(valores: number[]): number {
  const ordenados = [...valores].sort((a, b) => a - b);
  const medio = Math.floor(ordenados.length / 2);
  return ordenados.length % 2 ? ordenados[medio] : (ordenados[medio - 1] + ordenados[medio]) / 2;
}

async function main() {
  const baseUrl = flag("base-url") ?? BASE_URL_DEFECTO;
  const repeticiones = Number(flag("repeticiones") ?? 3);
  const anonimo = process.argv.includes("--anonimo");
  const email = flag("email") ?? EMAIL_DEFECTO;

  const cookie = anonimo ? null : await iniciarSesion(email);
  const rutas = cookie ? [...RUTAS_PUBLICAS, ...RUTAS_PRIVADAS] : RUTAS_PUBLICAS;

  console.log(`\nMidiendo ${baseUrl} — mediana de ${repeticiones} medidas por ruta`);
  console.log(cookie ? `Sesión: ${email}\n` : "Sin sesión (solo rutas públicas)\n");
  console.log("RUTA".padEnd(30) + "MEDIANA".padStart(10) + "   MEDIDAS");
  console.log("-".repeat(64));

  let piso: number | null = null;
  for (const ruta of rutas) {
    const url = `${baseUrl}${ruta}`;
    // Una petición de calentamiento que no se cuenta: establece la conexión
    // TLS para que las medidas reales no la incluyan.
    await medirUnaVez(url, cookie);

    const medidas: number[] = [];
    for (let i = 0; i < repeticiones; i += 1) medidas.push(await medirUnaVez(url, cookie));

    const centro = mediana(medidas);
    if (ruta === "/login") piso = centro;

    const sobrePiso = piso !== null && ruta !== "/login" ? `  (+${Math.round(centro - piso)} ms sobre el piso)` : "";
    console.log(
      ruta.padEnd(30) +
        `${Math.round(centro)} ms`.padStart(10) +
        "   " +
        medidas.map((m) => Math.round(m)).join(" / ") +
        sobrePiso,
    );
  }

  console.log(
    "\nEl piso (/login) no consulta la base. Cada ~190 ms por encima de él es, " +
      "aproximadamente,\nuna consulta más encadenada contra Supabase en US-East.\n",
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
