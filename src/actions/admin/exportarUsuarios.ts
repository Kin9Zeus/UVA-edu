"use server";

import { requireAdmin } from "@/lib/admin/requireAdmin";
import { registrarBitacora } from "@/lib/admin/bitacora";
import { getUsuarios, type FiltrosUsuarios } from "@/lib/admin/usuarios";
import { construirCsv } from "@/lib/csv";

/**
 * Tope de filas por exportación. La acción es un endpoint POST alcanzable por
 * sí mismo, así que necesita un límite propio: sin él, una sola llamada pide
 * el padrón entero y lo serializa en memoria.
 */
const MAX_FILAS_EXPORT = 5_000;

const CABECERAS = [
  "Nombre",
  "Correo",
  "Rol",
  "Cuenta",
  "Fecha de registro",
  "Cursos empezados",
  "Acceso",
  "Origen del acceso",
  "Plan",
  "Fin del acceso",
  "Última vez que estudió",
] as const;

function formatearFecha(iso: string | null): string {
  if (!iso) return "";
  // Formato ISO corto: es lo que ordena bien en una hoja de cálculo, a
  // diferencia de "27 ago 2026".
  return new Date(iso).toISOString().slice(0, 10);
}

const ACCESO_LABEL: Record<string, string> = {
  ACTIVA: "Con acceso",
  PAST_DUE: "Pago pendiente",
  VENCIDA: "Vencido",
  CANCELADA: "Revocado o cancelado",
};

const ORIGEN_LABEL: Record<string, string> = {
  INVITACION: "Por invitación",
  MANUAL: "Dado por U.V.A.",
  PAGO: "Pagado",
};

const ROL_LABEL: Record<string, string> = {
  ESTUDIANTE: "Estudiante",
  PROFESOR: "Profesor",
  ADMINISTRADOR: "Administrador",
};

/** Misma forma que `AdminActionResult`: el error es opcional y se comprueba con `if (resultado.error)`. */
export type ExportResult = { csv?: string; nombreArchivo?: string; error?: string };

/**
 * Devuelve el CSV de la tabla de usuarios como texto, con los mismos filtros
 * que la pantalla pero sin paginar.
 *
 * Va como Server Action y no como Route Handler porque CLAUDE.md §3.1 reserva
 * `/api/` exclusivamente para webhooks externos. El cliente convierte este
 * string en un Blob y dispara la descarga.
 *
 * `requireAdmin()` no es una formalidad heredada del resto del panel: los
 * Server Actions son endpoints POST alcanzables directamente, y la protección
 * de la página NO se extiende a ellos (ver la guía de seguridad de Next en
 * node_modules/next/dist/docs/01-app/02-guides/data-security.md). Esta acción
 * devuelve nombre y correo de todos los usuarios, así que esa comprobación es
 * lo único que la separa de una fuga del padrón.
 *
 * No se exporta `celular`: la lista no expone datos personales que no
 * necesita, misma regla que el RPC.
 */
export async function exportarUsuariosCsv(filtros: FiltrosUsuarios = {}): Promise<ExportResult> {
  const admin = await requireAdmin();
  if ("error" in admin) return { error: admin.error };

  const primera = await getUsuarios({ ...filtros, pagina: 1 });

  if (primera.total === 0) {
    return { error: "No hay usuarios que coincidan con los filtros." };
  }
  if (primera.total > MAX_FILAS_EXPORT) {
    return {
      error: `La exportación supera las ${MAX_FILAS_EXPORT.toLocaleString("es-CO")} filas. Acota el rango de fechas o la búsqueda.`,
    };
  }

  const usuarios = [...primera.usuarios];
  for (let pagina = 2; pagina <= primera.totalPaginas; pagina += 1) {
    const siguiente = await getUsuarios({ ...filtros, pagina });
    usuarios.push(...siguiente.usuarios);
  }

  const csv = construirCsv(
    CABECERAS,
    usuarios.map((usuario) => [
      usuario.nombre,
      usuario.correo,
      ROL_LABEL[usuario.rol],
      usuario.estado === "ACTIVO" ? "Activa" : "Suspendida",
      formatearFecha(usuario.fechaRegistro),
      usuario.cursosInscritos,
      usuario.rol === "ADMINISTRADOR" ? "Permanente" : usuario.acceso ? ACCESO_LABEL[usuario.acceso.estado] : "Nunca tuvo",
      usuario.acceso ? ORIGEN_LABEL[usuario.acceso.origen] : "",
      usuario.acceso?.plan ?? "",
      formatearFecha(usuario.acceso?.fin ?? null),
      formatearFecha(usuario.ultimaActividad),
    ]),
  );

  // Exportar los datos personales de todos los usuarios es exactamente el
  // tipo de acción que la bitácora existe para registrar; el panel ya deja
  // rastro de cosas bastante menores, como editar un código.
  await registrarBitacora(admin.supabase, {
    idAdmin: admin.adminId,
    accion: "Exportó la lista de usuarios a CSV",
    entidadAfectada: "perfiles",
    detalles: `${usuarios.length} usuario(s)`,
  });

  const hoy = new Date().toISOString().slice(0, 10);
  return { csv, nombreArchivo: `usuarios-uva-${hoy}.csv` };
}
