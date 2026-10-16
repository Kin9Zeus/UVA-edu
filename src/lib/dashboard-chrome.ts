import { createClient } from "@/lib/supabase/server";
import { getSuscripcionActual } from "@/lib/suscripcion";
import { calcularDiasGracia } from "@/lib/gracia";
import { logError } from "@/lib/log";
import { getNotificaciones, contarNotificacionesNoLeidas } from "@/lib/notificaciones";
import type { getPerfilActual } from "@/lib/perfil";

type PerfilActual = Awaited<ReturnType<typeof getPerfilActual>>;

/**
 * Datos que necesita el chrome de navegación del dashboard (Sidebar, Header,
 * BottomTabBar): certificadosCount para el badge, diasGracia para el aviso
 * de período de gracia. Compartido entre (student)/dashboard/layout.tsx y
 * /cursos/[id]/page.tsx (que muestra el mismo chrome para estudiantes
 * logueados, ver ese archivo).
 */
export async function getDashboardChromeData({
  user,
  perfil,
}: {
  user: NonNullable<PerfilActual["user"]>;
  perfil: PerfilActual["perfil"];
}) {
  const supabase = await createClient();
  const [{ count: certificadosCount, error: errorCertificados }, suscripcion, notificaciones, notificacionesNoLeidas] = await Promise.all([
    supabase
      .from("certificados")
      .select("id", { count: "exact", head: true })
      .eq("id_usuario", user.id),
    // El chrome envuelve a todas las pantallas: si lanzara aquí, un fallo de
    // `suscripciones` tumbaría el dashboard entero. Sin suscripción solo
    // pierde el aviso de gracia; las páginas que dependen de ella (perfil,
    // suscripción) sí lanzan por su cuenta.
    getSuscripcionActual(user.id).catch((error: unknown) => {
      logError("dashboard-chrome:suscripcion", "no se pudo leer la suscripción para el aviso de gracia", error, {
        area: "dashboard",
      });
      return null;
    }),
    // `null` = no se pudieron leer (distinto de [] = "no tiene"): la campana
    // avisa con Reintentar en vez de decir "No tienes notificaciones todavía".
    // Se degrada aquí y no se lanza: el chrome envuelve todas las pantallas.
    getNotificaciones(user.id).catch((error: unknown) => {
      logError("dashboard-chrome:notificaciones", "no se pudieron leer las notificaciones", error, {
        area: "dashboard",
      });
      return null;
    }),
    contarNotificacionesNoLeidas(user.id),
  ]);

  // El badge es decorativo: ante un fallo se oculta (0) y se registra, en vez
  // de tumbar la pantalla.
  if (errorCertificados) {
    logError("dashboard-chrome:certificados", "no se pudo contar los certificados", errorCertificados, {
      area: "dashboard",
    });
  }

  const nombre = perfil?.nombre ?? user.email?.split("@")[0] ?? "Estudiante";
  const fotoUrl = perfil?.foto_url ?? null;
  const esAdmin = perfil?.rol === "ADMINISTRADOR";

  // Un ADMINISTRADOR no depende de esta fila para su acceso (ver
  // obtenerAccesoAlCurso, src/lib/accesoCurso.ts): si tiene una suscripción
  // real en PAST_DUE (p. ej. de antes de que lo hicieran admin), no tiene
  // sentido anunciarle en la barra lateral que se le acaba la gracia.
  const diasGracia =
    !esAdmin && suscripcion?.estado === "PAST_DUE" && suscripcion.fechaRenovacion
      ? calcularDiasGracia(suscripcion.fechaRenovacion)
      : null;

  // Tarjeta "Tu acceso" del menú lateral: días que le quedan a un acceso
  // vigente con fecha de fin. Sin fecha (acceso sin vencimiento) o fuera de
  // ACTIVA no hay nada que contar y la tarjeta no aparece; PAST_DUE ya tiene
  // su propio aviso (diasGracia).
  const acceso = !esAdmin ? calcularAcceso(suscripcion) : null;

  return {
    nombre,
    fotoUrl,
    esAdmin,
    certificadosCount: certificadosCount ?? 0,
    diasGracia,
    acceso,
    notificaciones,
    notificacionesNoLeidas,
  };
}

export type AccesoVigente = {
  diasRestantes: number;
  /** Fin del acceso, ISO. */
  hasta: string;
  /** Parte del período que todavía queda, de 0 a 1 (para la barra). */
  restante: number;
  /** Vino de un código de invitación (la tarjeta dice "Invitación hasta…"). */
  esInvitacion: boolean;
};

const DIA_MS = 24 * 60 * 60 * 1000;

export function calcularAcceso(
  suscripcion: { estado: string; fechaInicio: string; fechaRenovacion: string | null; tieneCodigoInvitacion: boolean } | null,
  ahora: Date = new Date(),
): AccesoVigente | null {
  if (!suscripcion || suscripcion.estado !== "ACTIVA" || !suscripcion.fechaRenovacion) return null;
  const inicio = new Date(suscripcion.fechaInicio).getTime();
  const fin = new Date(suscripcion.fechaRenovacion).getTime();
  if (!(fin > ahora.getTime())) return null;
  const total = Math.max(fin - inicio, 1);
  return {
    diasRestantes: Math.ceil((fin - ahora.getTime()) / DIA_MS),
    hasta: suscripcion.fechaRenovacion,
    restante: Math.min(1, Math.max(0, (fin - ahora.getTime()) / total)),
    esInvitacion: suscripcion.tieneCodigoInvitacion,
  };
}
