import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Vigencias que se pueden elegir al generar un enlace, en minutos.
 *
 * El caso normal —y el que pide Revcurso— es que el administrador repase su
 * propio trabajo antes de publicar: eso dura minutos, no días, y siempre
 * puede generar otro enlace con un clic. Por eso el valor por defecto es el
 * más corto: cada minuto extra es ventana de exposición de contenido sin
 * publicar a cambio de nada.
 *
 * Las opciones largas existen para el otro caso, que es compartirlo con un
 * cliente o un instructor sin cuenta. Ahí la espera no la controla el
 * administrador, así que tiene sentido — pero es una decisión explícita, no
 * lo que sale por defecto.
 */
export const VIGENCIAS_VISTA_PREVIA = [
  { minutos: 15, etiqueta: "15 minutos" },
  { minutos: 60 * 24, etiqueta: "24 horas" },
  { minutos: 60 * 24 * 7, etiqueta: "7 días" },
] as const;

export const MINUTOS_VIGENCIA_VISTA_PREVIA = VIGENCIAS_VISTA_PREVIA[0].minutos;

/** Minutos aceptados por el Server Action; el valor llega del cliente. */
export const MINUTOS_VIGENCIA_VALIDOS: readonly number[] = VIGENCIAS_VISTA_PREVIA.map(
  (opcion) => opcion.minutos,
);

/**
 * Genera un token de vista previa y su hash.
 *
 * 32 bytes de `randomBytes` (CSPRNG) en base64url: ~256 bits de entropía,
 * imposible de adivinar por fuerza bruta. Se devuelve el token en claro
 * UNA sola vez, para mostrárselo al administrador; lo que se guarda es el
 * hash (ver hashToken).
 */
export function generarTokenVistaPrevia(): { token: string; hash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashToken(token) };
}

/**
 * SHA-256 hexadecimal del token.
 *
 * SHA-256 sin sal ni estiramiento es lo correcto AQUÍ, a diferencia de una
 * contraseña: el token tiene 256 bits aleatorios, así que no hay diccionario
 * ni tabla arcoíris que atacar y el coste de bcrypt/argon solo añadiría
 * latencia a cada visita. Lo que importa es que la tabla no guarde el valor
 * en claro.
 */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Compara dos hashes en tiempo constante.
 *
 * La búsqueda en la base ya se hace por igualdad de hash, así que esto es
 * defensa en profundidad para el punto donde sí comparamos en memoria.
 */
export function hashesIguales(a: string, b: string): boolean {
  const bufferA = Buffer.from(a, "hex");
  const bufferB = Buffer.from(b, "hex");
  if (bufferA.length !== bufferB.length) return false;
  return timingSafeEqual(bufferA, bufferB);
}

export type EstadoTokenVistaPrevia =
  | { valido: true; idCurso: string; expiraEn: Date }
  | { valido: false; motivo: "INEXISTENTE" | "REVOCADO" | "EXPIRADO" };

/** Fila de `tokens_vista_previa` reducida a lo que decide la validez. */
export type FilaToken = {
  idCurso: string;
  expiraEn: Date;
  revocadoEn: Date | null;
};

/**
 * Decide si un token sirve, dada su fila y el momento actual.
 *
 * Está separada de la consulta para poder probarla sin base de datos: el
 * orden de las comprobaciones (revocado antes que expirado) y los límites
 * exactos son justo lo que conviene tener cubierto.
 */
export function evaluarToken(
  fila: FilaToken | null,
  ahora: Date,
): EstadoTokenVistaPrevia {
  if (!fila) return { valido: false, motivo: "INEXISTENTE" };
  if (fila.revocadoEn !== null) return { valido: false, motivo: "REVOCADO" };
  // `<=`: en el instante exacto de la caducidad el enlace ya no sirve.
  if (fila.expiraEn.getTime() <= ahora.getTime()) {
    return { valido: false, motivo: "EXPIRADO" };
  }
  return { valido: true, idCurso: fila.idCurso, expiraEn: fila.expiraEn };
}

/** Fecha de caducidad a partir de ahora, en minutos. */
export function calcularExpiracion(minutos: number, ahora = new Date()): Date {
  return new Date(ahora.getTime() + minutos * 60 * 1000);
}
