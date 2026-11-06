import * as Sentry from "@sentry/nextjs";
import { clientIp } from "@/lib/clientIp";
import { enviarAlRegistroExterno } from "@/lib/envio-registros";

/**
 * Eventos de seguridad estructurados (fase 10.2 del plan de blindaje).
 *
 * Cada evento es UNA línea JSON en la salida estándar con `tipo:
 * "seguridad"`, para que el servicio de registros externo (fase 10.1) la
 * pueda filtrar y alertar sin parsear texto libre:
 *
 *   {"tipo":"seguridad","evento":"login_fallido","timestamp":"…","ip":"…"}
 *
 * Qué NUNCA va aquí: contraseñas, tokens, códigos de 2FA, cuerpos de
 * formularios ni correos. Por eso los campos son una lista cerrada
 * (`DatosEvento`) y no un objeto libre: quien registra un evento no puede
 * pasar el formulario entero "para tener contexto". Y por si un texto trae
 * un correo dentro (un motivo armado a mano), cualquier valor con "@" se
 * redacta.
 *
 * Qué sí va: el id del usuario (un UUID, no identifica a nadie sin la base),
 * la IP (para ver si los intentos fallidos vienen de un mismo lugar; queda
 * en el inventario de datos con su retención) y qué se intentó.
 *
 * Además de la línea, los eventos de `AVISAR_A_SENTRY` llegan a Sentry
 * como aviso (no como error), agrupados por evento: ahí ya existen reglas y
 * canal de alertas. Sin IP: Sentry no la necesita para avisar.
 */

export const EVENTOS_SEGURIDAD = [
  /** Contraseña incorrecta (login, cambiar contraseña o eliminar la cuenta). */
  "login_fallido",
  /** Se alcanzó el tope de intentos de contraseña (022): ni se intentó. */
  "login_bloqueado",
  /** Código de verificación en dos pasos rechazado. */
  "segundo_factor_fallido",
  /** Petición directa al origen sin el secreto de Cloudflare (403). */
  "origen_rechazado",
  /** Tope de uso de la base (134) alcanzado (429). */
  "limite_de_uso",
  /** Una sesión sin rol de administrador intentó entrar al panel o a una acción de administrador. */
  "admin_denegado",
  /** Acción de un administrador (la misma que queda en la bitácora). */
  "accion_admin",
] as const;

export type EventoSeguridad = (typeof EVENTOS_SEGURIDAD)[number];

/** Solo estos llegan también a Sentry: son raros y vale la pena enterarse. */
export const AVISAR_A_SENTRY: ReadonlySet<EventoSeguridad> = new Set<EventoSeguridad>([
  "login_bloqueado",
  "segundo_factor_fallido",
  "admin_denegado",
]);

/** Lista cerrada de campos. Agregar uno nuevo es una decisión de privacidad. */
export type DatosEvento = {
  usuarioId?: string;
  ip?: string;
  /** Ruta de la app (sin la query: puede traer tokens o correos). */
  ruta?: string;
  /** Qué se intentó: la acción limitada, la acción del administrador… */
  accion?: string;
  /** Por qué: "rol", "suspendida", "sin_sesion"… Siempre un texto fijo. */
  motivo?: string;
  /** Sobre qué: el tipo de entidad y su id (bitácora). */
  entidad?: string;
  entidadId?: string;
};

const CAMPOS: ReadonlyArray<keyof DatosEvento> = [
  "usuarioId",
  "ip",
  "ruta",
  "accion",
  "motivo",
  "entidad",
  "entidadId",
];

const LARGO_MAXIMO = 120;

function limpiarValor(campo: keyof DatosEvento, valor: unknown): string | undefined {
  if (valor === undefined || valor === null) return undefined;
  let texto = String(valor).trim();
  if (!texto) return undefined;
  if (texto.includes("@")) return "[redactado]";
  // La query de una URL puede traer un token (?code=, ?token_hash=) o un
  // correo: de una ruta solo se guarda el camino.
  if (campo === "ruta") texto = texto.split(/[?#]/)[0];
  return texto.slice(0, LARGO_MAXIMO);
}

/** Lógica pura: arma la línea a partir del evento y sus datos. */
export function lineaEventoSeguridad(
  evento: EventoSeguridad,
  datos: DatosEvento = {},
  ahora: Date = new Date(),
): Record<string, string> {
  const linea: Record<string, string> = {
    tipo: "seguridad",
    evento,
    timestamp: ahora.toISOString(),
  };
  for (const campo of CAMPOS) {
    const valor = limpiarValor(campo, (datos as Record<string, unknown>)[campo]);
    if (valor !== undefined) linea[campo] = valor;
  }
  return linea;
}

/**
 * Registra un evento. Nunca lanza: un fallo al registrar no debe tumbar el
 * inicio de sesión ni la acción que lo provocó.
 */
export function registrarEventoSeguridad(evento: EventoSeguridad, datos: DatosEvento = {}): void {
  try {
    const linea = lineaEventoSeguridad(evento, datos);
    console.log(JSON.stringify(linea));
    // Fase 10.1: copia a Vector (Better Stack + archivo de 90 días en R2).
    enviarAlRegistroExterno(linea);

    if (AVISAR_A_SENTRY.has(evento)) {
      const sinIp = { ...linea };
      delete sinIp.ip;
      Sentry.captureMessage(`Evento de seguridad: ${evento}`, {
        level: "warning",
        tags: { area: "seguridad", evento },
        fingerprint: ["seguridad", evento],
        extra: sinIp,
      });
    }
  } catch {
    // Registrar es lo menos importante de la petición: se sigue sin él.
  }
}

/**
 * Igual que `registrarEventoSeguridad`, con la IP de la petición en curso
 * (la misma que usan los límites de la app, src/lib/clientIp.ts). Para
 * Server Actions y páginas; el proxy no puede usarla (ahí no hay
 * `headers()`) y pasa la IP él mismo.
 */
export async function registrarEventoDeLaPeticion(
  evento: EventoSeguridad,
  datos: DatosEvento = {},
): Promise<void> {
  let ip = datos.ip;
  if (ip === undefined) {
    try {
      ip = await clientIp();
    } catch {
      // Fuera de una petición (pruebas, scripts) no hay cabeceras.
    }
  }
  registrarEventoSeguridad(evento, { ...datos, ip });
}
