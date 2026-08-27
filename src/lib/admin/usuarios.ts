import { createClient } from "@/lib/supabase/server";
import { tipoAccesoGratuito, type TipoAccesoGratuito } from "@/lib/estadoAcceso";

export type UsuarioListado = {
  id: string;
  nombre: string;
  correo: string;
  rol: "ESTUDIANTE" | "ADMINISTRADOR";
  estado: "ACTIVO" | "SUSPENDIDO";
  fechaRegistro: string;
  cursosInscritos: number;
  suscripcionEstado: "ACTIVA" | "PAST_DUE" | "VENCIDA" | "CANCELADA" | null;
  /** null = sin suscripción o de pago. Misma clasificación que ve el estudiante, ver src/lib/estadoAcceso.ts. */
  tipoAccesoSuscripcion: TipoAccesoGratuito | null;
};

export async function getUsuarios(): Promise<UsuarioListado[]> {
  const supabase = await createClient();

  const [{ data: perfiles }, { data: suscripciones }, { data: inscripciones }] = await Promise.all([
    supabase.from("perfiles").select("id, nombre, correo, rol, estado, fecha_registro:creado_en").order("creado_en", { ascending: false }),
    supabase
      .from("suscripciones")
      .select("id_usuario, estado, fecha_inicio, acceso_manual, id_codigo_invitacion")
      .order("fecha_inicio", { ascending: false }),
    supabase.from("inscripciones").select("id_usuario"),
  ]);

  const suscripcionPorUsuario = new Map<string, UsuarioListado["suscripcionEstado"]>();
  const tipoAccesoPorUsuario = new Map<string, TipoAccesoGratuito | null>();
  for (const suscripcion of suscripciones ?? []) {
    if (!suscripcionPorUsuario.has(suscripcion.id_usuario)) {
      suscripcionPorUsuario.set(suscripcion.id_usuario, suscripcion.estado);
      tipoAccesoPorUsuario.set(
        suscripcion.id_usuario,
        tipoAccesoGratuito({
          accesoManual: suscripcion.acceso_manual,
          tieneCodigoInvitacion: suscripcion.id_codigo_invitacion !== null,
        }),
      );
    }
  }

  const inscritosPorUsuario = new Map<string, number>();
  for (const inscripcion of inscripciones ?? []) {
    inscritosPorUsuario.set(inscripcion.id_usuario, (inscritosPorUsuario.get(inscripcion.id_usuario) ?? 0) + 1);
  }

  return (perfiles ?? []).map((perfil) => ({
    id: perfil.id,
    nombre: perfil.nombre,
    correo: perfil.correo,
    rol: perfil.rol,
    estado: perfil.estado,
    fechaRegistro: perfil.fecha_registro,
    cursosInscritos: inscritosPorUsuario.get(perfil.id) ?? 0,
    suscripcionEstado: suscripcionPorUsuario.get(perfil.id) ?? null,
    tipoAccesoSuscripcion: tipoAccesoPorUsuario.get(perfil.id) ?? null,
  }));
}
