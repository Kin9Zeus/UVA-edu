import type { ReactNode } from "react";
import { PRECIOS_HABILITADOS } from "@/lib/features";

// Preguntas frecuentes de /soporte (pública y dentro del panel) y enlaces de
// soporte del pie del home.
//
// Archivo .tsx (no .ts): las respuestas son JSX, no texto plano — necesitan
// negritas. Las pinta `SoporteCentro` (components/soporte).

// Contenido redactado a partir de docs/legal/contenido-soporte.md (borrador
// revisado). A diferencia de Términos y Privacidad (src/content/legal.tsx),
// no depende de datos legales de la empresa ([RAZÓN SOCIAL], NIT, etc.) — por
// eso ya se puede publicar tal cual.
//
// Mientras los precios estén apagados (`PRECIOS_HABILITADOS`) se entra solo
// con código de invitación: las respuestas sobre suscripciones pagadas y
// cambio de plan quedan fuera, porque describirían algo que hoy no existe.
export const PREGUNTAS_CENTRO_AYUDA: { pregunta: string; respuesta: ReactNode }[] = [
  {
    pregunta: "¿Qué es U.V.A.?",
    respuesta:
      "U.V.A. es una plataforma de cursos en línea enfocada en arquitectura, diseño y construcción. Incluye clases en video, materiales descargables, exámenes finales por curso y certificado de finalización.",
  },
  {
    pregunta: "¿Cómo accedo a los cursos?",
    respuesta: PRECIOS_HABILITADOS
      ? "Con una suscripción activa (mensual o anual) tienes acceso a todo el catálogo mientras esté vigente. Algunos cursos también pueden otorgarse de forma individual, como cortesía del equipo de U.V.A."
      : "Por ahora el acceso es por invitación y sin costo: canjea tu código de invitación y tienes todo el catálogo por los días que traiga asignados. Algunos cursos también pueden otorgarse de forma individual, como cortesía del equipo de U.V.A.",
  },
  {
    pregunta: PRECIOS_HABILITADOS
      ? "¿Cuál es la diferencia entre una suscripción y un curso de cortesía?"
      : "¿Cuál es la diferencia entre un código de invitación y un curso de cortesía?",
    respuesta: (
      <>
        {PRECIOS_HABILITADOS
          ? "Una suscripción (pagada, o gratuita por código de invitación) te da"
          : "Un código de invitación te da"}{" "}
        acceso a{" "}
        <span className="font-medium text-uva-text">todo el catálogo</span>{" "}
        mientras esté vigente. Un curso de cortesía es distinto: el equipo de
        U.V.A. te da acceso a{" "}
        <span className="font-medium text-uva-text">un curso puntual</span>, sin
        que necesites suscripción ni código — aparece directo en tu catálogo.
        Puedes tener un curso de cortesía aunque no tengas (o nunca hayas
        tenido) una suscripción activa.
      </>
    ),
  },
  {
    pregunta: "¿Cómo canjeo un código de invitación?",
    respuesta: (
      <>
        Ingresa el código en la sección{" "}
        <span className="font-medium text-uva-text">
          ¿Tienes un código de invitación?
        </span>{" "}
        dentro de{" "}
        <span className="font-medium text-uva-text">Mi suscripción</span>. Un
        código válido te da acceso a todo el catálogo, sin ningún cobro, por los
        días que traiga asignados. Si ya tienes un acceso vigente, guarda el
        código para canjearlo cuando termine.
      </>
    ),
  },
  {
    pregunta: "¿Cómo obtengo mi certificado?",
    respuesta: (
      <>
        Se emite automáticamente, sin que tengas que solicitarlo. Si el curso
        tiene examen final, basta con aprobarlo con la nota mínima — no
        necesitas haber terminado todas las clases. Si no tiene examen, se
        emite al completar el 100&nbsp;% de las clases. Descárgalo en PDF desde{" "}
        <span className="font-medium text-uva-text">Certificados</span>, en tu
        panel; cualquier persona puede verificar su autenticidad con el código
        único o el código QR que trae impreso, sin necesidad de iniciar sesión.
      </>
    ),
  },
  {
    pregunta: "¿Qué pasa si no apruebo el examen final?",
    respuesta:
      "Tienes varios intentos por curso, con un tiempo de espera corto entre uno y otro. Si agotas los intentos de una tanda sin aprobar, se habilita automáticamente otra tanda después de un tiempo de espera más largo — no necesitas escribirle a soporte para seguir intentando.",
  },
  ...(PRECIOS_HABILITADOS
    ? [
        {
          pregunta: "¿Puedo cambiar o cancelar mi plan?",
          respuesta: (
            <>
              Sí, desde{" "}
              <span className="font-medium text-uva-text">Mi suscripción</span> puedes
              cambiar de plan o cancelar cuando quieras. La cancelación aplica al
              final del periodo ya pagado: conservas el acceso hasta esa fecha y no se
              generan más cobros después.
            </>
          ),
        },
      ]
    : []),
  {
    pregunta: "¿Cómo cambio mi contraseña o mis datos?",
    respuesta: (
      <>
        Desde <span className="font-medium text-uva-text">Mi perfil</span>{" "}
        puedes actualizar tu nombre y celular, y cambiar tu contraseña en la
        sección &ldquo;Contraseña&rdquo; (te pedirá la actual). Si perdiste el
        acceso a tu cuenta, usa la opción &ldquo;¿Olvidaste tu
        contraseña?&rdquo; en la pantalla de inicio de sesión.
      </>
    ),
  },
  {
    pregunta: "¿Cómo verifico si un certificado es válido?",
    respuesta:
      'Cada certificado trae un código único. Ingrésalo en el formulario "Verificar certificado" del pie de página para confirmar, sin iniciar sesión, a nombre de quién fue emitido, en qué curso y en qué fecha.',
  },
  {
    pregunta: "Encontré un error técnico en la plataforma, ¿qué hago?",
    respuesta:
      'Repórtalo con el mayor detalle posible — qué hacías, qué esperabas que pasara y qué pasó — con "Reportar un problema", en los accesos de arriba. Para cualquier otro tema, escríbenos por WhatsApp.',
  },
];

/**
 * Enlaces de soporte del pie del home. Cada documento tiene su dirección:
 * los temas ya no se abren con `?tema=` (ver `destinoTemaViejo`).
 */
export const ENLACES_SOPORTE = [
  { titulo: "Centro de ayuda", href: "/soporte" },
  { titulo: "Contacto", href: "/soporte#contacto" },
  { titulo: "Términos y condiciones", href: "/soporte/terminos" },
  { titulo: "Política de privacidad", href: "/soporte/privacidad" },
] as const;

/**
 * Soporte abría cada tema con `?tema=` (`/soporte?tema=terminos`), y esos
 * enlaces ya están compartidos: se redirigen a la dirección nueva. `base` es
 * el soporte desde el que se llegó (el público o el del panel). Términos y
 * Privacidad son siempre las páginas públicas.
 */
export function destinoTemaViejo(
  tema: string | string[] | undefined,
  base: "/soporte" | "/dashboard/soporte",
): string | null {
  switch (tema) {
    case "terminos":
    case "privacidad":
      return `/soporte/${tema}`;
    case "contacto":
      return `${base}#contacto`;
    case "centro-de-ayuda":
      return base;
    default:
      return null;
  }
}

// Formulario público de Notion (vista "Reportar bug/incidencias" de la base
// "Bugs / Incidencias") — cada envío cae ahí directo como fila nueva, sin
// backend propio. Fase 1 del plan de soporte: si más adelante se reemplaza
// por un formulario propio dentro de la app, solo hay que cambiar este link
// por la llamada al Server Action correspondiente.
export const URL_REPORTE_PROBLEMA =
  "https://loud-voice-8a9.notion.site/544401bd4fae4293ac2a81538ae09037?pvs=105";
