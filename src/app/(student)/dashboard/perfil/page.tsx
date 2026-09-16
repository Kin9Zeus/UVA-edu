import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getPerfilActual } from "@/lib/perfil";
import { getSuscripcionActual } from "@/lib/suscripcion";
import { calcularEstadoAcceso } from "@/lib/estadoAcceso";
import { PerfilForm } from "@/components/dashboard/PerfilForm";

export const metadata: Metadata = {
  title: "U.V.A. — Mi perfil",
};

export default async function PerfilPage() {
  const { user, perfil } = await getPerfilActual();
  const supabase = await createClient();

  const [{ data: certificadosRows }, suscripcion, { data: usuarioAuth }] = await Promise.all([
    supabase
      .from("certificados")
      .select("id, fecha_emision, nombre_curso")
      .eq("id_usuario", user!.id)
      .order("fecha_emision", { ascending: false })
      .limit(2),
    getSuscripcionActual(user!.id),
    // `getPerfilActual` solo trae los claims del JWT (id/email) a propósito
    // (ver el comentario en src/lib/perfil.ts): las identidades vinculadas
    // (`identities`) no viajan ahí, así que para saber si esta cuenta tiene
    // contraseña —y por lo tanto puede reautenticarse con ella antes de
    // eliminarse— hace falta el `User` completo, con su propio roundtrip.
    supabase.auth.getUser(),
  ]);

  // Una cuenta que entró solo con "Continuar con Google" nunca creó
  // contraseña: EliminarCuentaCard no debe pedir un campo que no puede
  // llenar.
  const tienePassword = (usuarioAuth.user?.identities ?? []).some(
    (identidad) => identidad.provider === "email",
  );

  // `nombre_curso` es el título congelado al momento de la emisión
  // (Deteccion.md), no el título vigente de `cursos`.
  const certificados = (certificadosRows ?? []).map((fila) => ({
    id: fila.id as string,
    titulo: fila.nombre_curso as string,
    fecha: new Date(fila.fecha_emision as string).toLocaleDateString("es-CO", {
      year: "numeric",
      month: "short",
      day: "2-digit",
      timeZone: "America/Bogota",
    }),
  }));

  // Tipo de acceso, fecha de vigencia y aviso, resueltos de una sola vez:
  // devuelve null para las suscripciones de pago, que tienen su propia
  // pantalla con historial en /dashboard/suscripcion.
  //
  // `null` también para un ADMINISTRADOR aunque tenga una fila de
  // `suscripciones` real (p. ej. de antes de que lo hicieran admin): esa fila
  // no decide su acceso (ver obtenerAccesoAlCurso, src/lib/accesoCurso.ts), así
  // que la tarjeta "Tu acceso" no puede seguir anunciando "Invitación
  // gratuita · Vigente hasta…" de un cupo que ya no es lo que le da entrada.
  const estadoAcceso = perfil?.rol === "ADMINISTRADOR" ? null : calcularEstadoAcceso(suscripcion);

  const suscripcionVigente =
    suscripcion && (suscripcion.estado === "ACTIVA" || suscripcion.estado === "PAST_DUE");

  // El acceso gratuito manda sobre el nombre del plan en la insignia de la
  // cabecera: a quien recibió una invitación no se le anuncia "Anual" —
  // nunca compró un plan, aunque `otorgarMembresia` guarde uno para calcular
  // la duración.
  // Un ADMINISTRADOR tiene acceso incondicional a todo el catálogo (ver
  // obtenerAccesoAlCurso, src/lib/accesoCurso.ts) sin depender de una
  // suscripción propia — la insignia tiene que decir eso en vez de "sin
  // suscripción" o el estado de una fila que, si existe, es irrelevante.
  const insignia =
    perfil?.rol === "ADMINISTRADOR"
      ? { texto: "Acceso permanente", atenuada: false }
      : estadoAcceso
        ? {
            texto: estadoAcceso.vigencia === "VENCIDO" ? "Acceso finalizado" : "Acceso gratuito",
            atenuada: estadoAcceso.vigencia === "VENCIDO",
          }
        : suscripcionVigente
          ? { texto: suscripcion.planNombre, atenuada: false }
          : null;

  return (
    <div className="px-[clamp(20px,3vw,44px)] py-8">
      <PerfilForm
        nombre={perfil?.nombre ?? "Estudiante"}
        correo={perfil?.correo ?? user!.email ?? ""}
        celular={perfil?.celular ?? null}
        fotoUrl={perfil?.foto_url ?? null}
        insignia={insignia}
        tienePassword={tienePassword}
        certificados={certificados}
        estadoAcceso={estadoAcceso}
      />
    </div>
  );
}
