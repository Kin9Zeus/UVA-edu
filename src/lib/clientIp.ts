import { headers } from "next/headers";
import { CABECERA_ORIGEN, peticionDesdeCloudflare } from "@/lib/origen";

/**
 * IP del cliente para las claves de rate limiting, leída de forma que el
 * propio cliente no pueda elegirla.
 *
 * Por qué existe (AUDIT-2026-09-04.md, P1-2)
 * ------------------------------------------
 * La versión anterior de esto vivía duplicada literal en dos archivos
 * (src/actions/auth/check-email.ts y la página pública de verificación de
 * certificados) y hacía:
 *
 *     forwardedFor.split(",")[0].trim()   // el PRIMERO de la cadena
 *
 * `X-Forwarded-For` se construye por acumulación y **cada proxy añade a la
 * derecha**. El valor de más a la izquierda es exactamente el que envió el
 * cliente y no lo verifica nadie: mandar `X-Forwarded-For: 1.2.3.4` bastaba
 * para elegir la clave del límite, y rotarla en cada petición lo anulaba por
 * completo. Eso dejaba sin efecto los dos únicos controles anti-enumeración
 * del producto (`check_email_provider`, que dice si una cuenta existe y con
 * qué proveedor entra, y `verificar_certificado`, que devuelve nombre y
 * curso de un graduado).
 *
 * La única entrada que el cliente NO pudo escribir es la que añadió nuestro
 * propio proxy, y esa está al final. De ahí que se lea desde la derecha.
 *
 * Sobre TRUSTED_PROXY_HOPS
 * ------------------------
 * Es el número de proxies de confianza que hay DELANTE de la aplicación.
 * En Railway, sin CDN ni proxy propio adicional, es 1: el edge recibe la
 * conexión del navegador y añade su IP real al final de la cadena.
 *
 * Configurarlo MÁS BAJO de lo real degrada el límite (se toma la IP de un
 * proxy intermedio, así que varios clientes comparten clave y el límite
 * bloquea de más — molesto, pero cerrado). Configurarlo MÁS ALTO de lo real
 * **reintroduce la vulnerabilidad**: se retrocede más allá de lo que
 * escribieron nuestros proxies y se acaba leyendo justo el valor que puso el
 * atacante. Por eso el valor por defecto es 1 y conservador, y por eso
 * subirlo exige medir la cadena real primero, no suponerla:
 *
 *     # en un handler temporal, contra el dominio real:
 *     console.log((await headers()).get("x-forwarded-for"));
 *
 * Esto solo protege si hay de verdad un proxy delante que añada la IP real.
 * Sin él —`next dev` en local, o un despliegue sin proxy— la cadena entera
 * es lo que mandó el cliente y esta función devuelve justo eso. No es un
 * fallo que se pueda cerrar desde acá: no hay forma de distinguir una
 * entrada escrita por un proxy de una escrita por el cliente si nadie la
 * reescribió. La consecuencia práctica es que el límite NO se puede probar
 * en local mandando cabeceras falsas (cada valor entra como clave nueva,
 * igual que antes del arreglo): esa prueba solo significa algo contra el
 * dominio real, detrás de Railway.
 *
 * `X-Real-IP` NO se usa como respaldo, a diferencia de la versión anterior:
 * también lo escribe el cliente cuando el proxy no lo sobrescribe, así que
 * como plan B de un header no confiable no aporta confianza, solo otra vía
 * de entrada. Sin `X-Forwarded-For` la respuesta es "unknown", que agrupa a
 * todo el mundo bajo una clave compartida — más restrictivo, nunca más
 * permisivo. En desarrollo local no hay proxy y ese es el caso normal.
 *
 * Con Cloudflare delante (fase 2 del plan de blindaje)
 * ----------------------------------------------------
 * La cadena pasa a ser [cliente, ip-de-cloudflare]: con un salto, la app
 * leería la IP de Cloudflare y todos compartirían la misma clave de límite.
 * Cloudflare escribe la IP real en `CF-Connecting-IP` y siempre la
 * sobrescribe, pero esa cabecera solo es confiable si la petición pasó de
 * verdad por Cloudflare: quien llame directo a Railway puede mandarla con el
 * valor que quiera. Por eso se usa solo cuando la petición trae el secreto de
 * origen (src/lib/origen.ts). Sin él, todo sigue igual que antes.
 */

export const SALTOS_CONFIABLES_POR_DEFECTO = 1;

export const IP_DESCONOCIDA = "unknown";

/** Lee TRUSTED_PROXY_HOPS. Cualquier valor no válido cae al defecto seguro. */
export function saltosConfiables(valor = process.env.TRUSTED_PROXY_HOPS): number {
  const saltos = Number(valor);
  if (!Number.isInteger(saltos) || saltos < 1) return SALTOS_CONFIABLES_POR_DEFECTO;
  return saltos;
}

/**
 * Lógica pura, aparte de `clientIp()` para poder probarla sin un request:
 * dada la cadena cruda de `X-Forwarded-For`, devuelve la entrada que
 * escribió nuestro proxy.
 */
export function extraerIpConfiable(
  forwardedFor: string | null | undefined,
  saltos: number = SALTOS_CONFIABLES_POR_DEFECTO,
): string {
  if (!forwardedFor) return IP_DESCONOCIDA;

  const cadena = forwardedFor
    .split(",")
    .map((entrada) => entrada.trim())
    .filter(Boolean);

  if (cadena.length === 0) return IP_DESCONOCIDA;

  // Se cuenta desde la derecha: la última entrada la puso el proxy más
  // cercano a la aplicación. Si la cadena es más corta que los saltos
  // declarados, el cliente no mandó nada propio y toda ella es de proxies
  // de confianza, así que la primera entrada ya es la IP real.
  const indice = Math.max(0, cadena.length - saltos);
  return cadena[indice] ?? IP_DESCONOCIDA;
}

/** De dónde sale la IP. */
export type FuenteIp = "cf-connecting-ip" | "x-forwarded-for";

/**
 * Lógica pura de `clientIp()`. `desdeCloudflare` dice si la petición trajo el
 * secreto de origen; solo entonces se confía en `CF-Connecting-IP`.
 */
export function resolverIp(entrada: {
  cfConnectingIp: string | null | undefined;
  forwardedFor: string | null | undefined;
  desdeCloudflare: boolean;
  saltos?: number;
}): { ip: string; fuente: FuenteIp } {
  const cf = entrada.cfConnectingIp?.trim();
  if (entrada.desdeCloudflare && cf) return { ip: cf, fuente: "cf-connecting-ip" };
  return {
    ip: extraerIpConfiable(entrada.forwardedFor, entrada.saltos ?? SALTOS_CONFIABLES_POR_DEFECTO),
    fuente: "x-forwarded-for",
  };
}

/**
 * IP del cliente para la petición en curso. Único punto de lectura: si
 * mañana cambia la infraestructura, se corrige acá y no en cada llamador
 * (que fue justo lo que dejó este fallo duplicado en dos sitios).
 */
export async function clientIp(): Promise<string> {
  const headersList = await headers();
  return resolverIp({
    cfConnectingIp: headersList.get("cf-connecting-ip"),
    forwardedFor: headersList.get("x-forwarded-for"),
    desdeCloudflare: peticionDesdeCloudflare(headersList.get(CABECERA_ORIGEN)),
    saltos: saltosConfiables(),
  }).ip;
}
