/**
 * Analítica: Google Analytics 4 y Microsoft Clarity (SEO fase 14,
 * docs/seo/07-webmasters.md §7, tarea de Notion «analítica y conversiones»).
 *
 * Apagada por defecto: sin `NEXT_PUBLIC_GA_ID` ni `NEXT_PUBLIC_CLARITY_ID` no
 * se carga ningún script, no aparece el aviso de cookies y la CSP no se abre a
 * nadie. Encendida, NADA se carga hasta que la persona acepta en el aviso
 * (`components/analitica/Analitica.tsx`, `lib/consentimiento.ts`).
 *
 * Antes de poner los id en Railway hay que cambiar el texto legal: el soporte
 * (4.11) dice hoy «solo cookies técnicas, sin rastreo»
 * (docs/legal/00-texto-vs-codigo.md, D6).
 *
 * Los id se validan porque terminan dentro de una URL de script: una variable
 * mal puesta no debe poder apuntar a otro sitio ni inyectar nada.
 *
 * Las vistas de página de GA4 no necesitan código: la «medición mejorada» las
 * registra también en la navegación del lado del cliente (cambios del
 * historial), que es como navega el App Router.
 */
const ga = process.env.NEXT_PUBLIC_GA_ID?.trim() ?? "";
const clarity = process.env.NEXT_PUBLIC_CLARITY_ID?.trim() ?? "";

export const GA_ID: string | null = validarGaId(ga);
export const CLARITY_ID: string | null = validarClarityId(clarity);

export function validarGaId(id: string): string | null {
  return /^G-[A-Z0-9]{4,20}$/.test(id) ? id : null;
}

/** El id de proyecto de Clarity: 10 caracteres en minúscula y dígitos hoy; se
 *  deja margen sin aceptar nada que no sea alfanumérico. */
export function validarClarityId(id: string): string | null {
  return /^[a-z0-9]{6,20}$/.test(id) ? id : null;
}

/**
 * Eventos propios. Los marcados como «clave» en GA4 los decide Aleck en el
 * panel (no en el código): `canje_invitacion`, `registro_completado`,
 * `curso_completado` y `certificado_emitido` según la propuesta de
 * docs/seo/07-webmasters.md §7.
 */
export type EventoAnalitica =
  | "canje_invitacion"
  | "registro_completado"
  | "clic_whatsapp"
  | "inicio_curso"
  | "curso_completado"
  | "certificado_emitido"
  | "verificacion_certificado";

/**
 * Envía un evento a GA4. Sin GA cargado (apagado, sin consentimiento o
 * bloqueado) no hace nada: `gtag` solo existe después de aceptar.
 *
 * Nunca mandar datos personales en `parametros` (nombre, correo, código de
 * invitación): GA4 lo prohíbe en sus condiciones y la política no lo dice.
 */
export function registrarEvento(nombre: EventoAnalitica, parametros?: Record<string, string>): void {
  if (typeof window === "undefined") return;
  (window as { gtag?: (...args: unknown[]) => void }).gtag?.("event", nombre, parametros);
}

/**
 * Rutas donde Clarity puede grabar: solo las públicas sin datos personales
 * (decisión del 17-nov-2026). Fuera quedan el panel del estudiante, el admin,
 * las clases y el examen (`/cursos/x/y`), la verificación de certificados
 * (muestra el nombre del estudiante) y las pantallas de cuenta.
 *
 * Los formularios de login, registro y canje sí entran: Clarity enmascara por
 * defecto el contenido de todos los campos, los números y los correos. Aleck
 * debe dejar además el proyecto en enmascarado «Estricto» desde su panel.
 */
export function clarityPermitida(ruta: string): boolean {
  const partes = ruta.split("?")[0].split("/").filter(Boolean);
  if (partes.length === 0) return true;
  const [primera] = partes;
  if (primera === "catalogo" || primera === "legal") return true;
  if (primera === "cursos") return partes.length === 2;
  return partes.length === 1 && RUTAS_PUBLICAS_SUELTAS.has(primera);
}

const RUTAS_PUBLICAS_SUELTAS = new Set(["planes", "soporte", "login", "registro", "canjear", "recuperar"]);

/** Hay alguna analítica encendida: monta el aviso de cookies y su enlace del pie. */
export const ANALITICA_ACTIVA = GA_ID !== null || CLARITY_ID !== null;

/**
 * Registro con Google: la cuenta se crea en `/auth/callback` (servidor), donde
 * no hay `gtag`. El callback deja esta cookie corta y `Analitica.tsx` la
 * convierte en `registro_completado` (o la borra si no hay consentimiento).
 * Solo existe con la analítica encendida; no lleva datos personales.
 */
export const COOKIE_REGISTRO_PENDIENTE = "uva-registro-pendiente";
export const DURACION_REGISTRO_PENDIENTE_S = 600;

type UsuarioAuth = {
  created_at?: string;
  last_sign_in_at?: string | null;
  app_metadata?: { provider?: string };
};

/**
 * La cuenta se creó en este mismo inicio de sesión con Google: Supabase pone
 * `created_at` y `last_sign_in_at` casi a la vez. Si ya existía, el último
 * inicio es de ahora y la creación es vieja.
 */
export function esRegistroNuevoConGoogle(usuario: UsuarioAuth | null | undefined): boolean {
  if (usuario?.app_metadata?.provider !== "google") return false;
  const creado = Date.parse(usuario.created_at ?? "");
  const ultimo = Date.parse(usuario.last_sign_in_at ?? "");
  if (Number.isNaN(creado) || Number.isNaN(ultimo)) return false;
  return Math.abs(ultimo - creado) < 60_000;
}
