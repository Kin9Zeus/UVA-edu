import { headers } from "next/headers";

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
 * `X-Real-IP` NO se usa como respaldo, a diferencia de la versión anterior:
 * también lo escribe el cliente cuando el proxy no lo sobrescribe, así que
 * como plan B de un header no confiable no aporta confianza, solo otra vía
 * de entrada. Sin `X-Forwarded-For` la respuesta es "unknown", que agrupa a
 * todo el mundo bajo una clave compartida — más restrictivo, nunca más
 * permisivo. En desarrollo local no hay proxy y ese es el caso normal.
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

/**
 * IP del cliente para la petición en curso. Único punto de lectura: si
 * mañana cambia la infraestructura, se corrige acá y no en cada llamador
 * (que fue justo lo que dejó este fallo duplicado en dos sitios).
 */
export type DiagnosticoIp = {
  /** La cabecera tal cual llegó, sin tocar. */
  crudo: string | null;
  /** Cada entrada de la cadena, en orden (izquierda = lo que mandó el cliente). */
  cadena: string[];
  /** El TRUSTED_PROXY_HOPS vigente. */
  saltos: number;
  /** false si se está usando el defecto — porque no está puesta o porque
   *  su valor no era válido, que es justo cuando conviene notarlo. */
  saltosConfigurados: boolean;
  /** Posición de la que sale la IP, o null si no hay cabecera. */
  indiceUsado: number | null;
  /** Lo que `clientIp()` devolvería ahora mismo. */
  ipUsada: string;
};

/**
 * Lógica pura del diagnóstico, para /admin/configuracion. Existe porque el
 * número correcto de TRUSTED_PROXY_HOPS no se puede deducir del código: hay
 * que ver la cadena real que arma la infraestructura (AUDIT-2026-09-04.md,
 * "Lo que no pude verificar" #3). Con esto se mide en vez de suponerse.
 */
export function construirDiagnostico(
  forwardedFor: string | null | undefined,
  saltos: number = SALTOS_CONFIABLES_POR_DEFECTO,
  saltosConfigurados = false,
): DiagnosticoIp {
  const cadena = (forwardedFor ?? "")
    .split(",")
    .map((entrada) => entrada.trim())
    .filter(Boolean);

  return {
    crudo: forwardedFor ?? null,
    cadena,
    saltos,
    saltosConfigurados,
    indiceUsado: cadena.length === 0 ? null : Math.max(0, cadena.length - saltos),
    ipUsada: extraerIpConfiable(forwardedFor, saltos),
  };
}

/** Diagnóstico de la petición en curso. Solo se usa desde el panel admin. */
export async function diagnosticoIp(): Promise<DiagnosticoIp> {
  const headersList = await headers();
  const crudo = process.env.TRUSTED_PROXY_HOPS;
  const saltos = saltosConfiables(crudo);
  // Un valor presente pero inválido ("dos", "0") cae al defecto: se informa
  // como NO configurado, que es lo que de verdad está pasando.
  const configurado = crudo !== undefined && saltos === Number(crudo);
  return construirDiagnostico(headersList.get("x-forwarded-for"), saltos, configurado);
}

export async function clientIp(): Promise<string> {
  const headersList = await headers();
  return extraerIpConfiable(headersList.get("x-forwarded-for"), saltosConfiables());
}
