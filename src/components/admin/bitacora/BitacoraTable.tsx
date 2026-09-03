"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AdminCard } from "@/components/admin/AdminCard";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { Paginacion } from "@/components/Paginacion";
import { formatFechaHora } from "@/lib/admin/format";
import type { ResultadoBitacora } from "@/lib/admin/bitacora";

/** Etiqueta legible + a qué ruta del panel enlaza cada tipo de entidad, cuando tiene una pantalla propia. */
const ENTIDAD_INFO: Record<string, { etiqueta: string; ruta?: (id: string) => string }> = {
  perfiles: { etiqueta: "Usuario", ruta: (id) => `/admin/usuarios/${id}` },
  suscripciones: { etiqueta: "Membresía", ruta: (id) => `/admin/usuarios/${id}` },
  inscripciones: { etiqueta: "Cortesía", ruta: (id) => `/admin/usuarios/${id}` },
  cursos: { etiqueta: "Curso", ruta: (id) => `/admin/cursos/${id}` },
  categorias: { etiqueta: "Categoría" },
  // Se conserva solo para las filas HISTÓRICAS: la bitácora es append-only y
  // sigue teniendo entradas de cuando `instructores` era una tabla propia con
  // su CRUD. Ninguna acción nueva escribe esta entidad — un instructor es
  // ahora una cuenta con rol PROFESOR, y sus cambios se registran como
  // `perfiles`. Quitarla dejaría esas filas viejas sin etiqueta.
  instructores: { etiqueta: "Instructor" },
  codigos_invitacion: { etiqueta: "Código de invitación", ruta: () => "/admin/codigos" },
  lecciones: { etiqueta: "Lección" },
};

/** Tono según si la acción suena reversible/informativa (neutral), o de corte de acceso (error/warning). */
function tonoAccion(accion: string): "neutral" | "warning" | "error" {
  if (/revocó|canceló|suspendió|quitó/i.test(accion)) return "error";
  if (/otorgó|activó/i.test(accion)) return "warning";
  return "neutral";
}

export function BitacoraTable({ resultado }: { resultado: ResultadoBitacora }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function irAPagina(pagina: number) {
    const params = new URLSearchParams(searchParams);
    params.set("page", String(pagina));
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <div className="flex flex-col gap-4">
      <AdminCard flush className="gap-0">
        {resultado.entradas.length === 0 && (
          <p className="px-5 py-6 text-center text-sm text-uva-text-faint">
            Todavía no hay acciones registradas.
          </p>
        )}

        {/* Mismo criterio que el resto del panel: 5 columnas no caben sin
            scroll horizontal en un touch, y acá "Detalle" puede ser texto
            largo — el que peor se desborda de todas las tablas. */}
        {resultado.entradas.length > 0 && (
          <div className="flex flex-col pointer-fine:md:hidden">
            {resultado.entradas.map((entrada) => {
              const info = ENTIDAD_INFO[entrada.entidadAfectada];
              const nombreSujeto = entrada.usuarioAfectadoNombre ?? info?.etiqueta ?? entrada.entidadAfectada;
              const ruta = entrada.usuarioAfectadoId
                ? info?.ruta?.(entrada.usuarioAfectadoId)
                : undefined;

              return (
                <div
                  key={entrada.id}
                  className="flex flex-col gap-2 border-b border-uva-divider px-5 py-3.5 last:border-b-0"
                >
                  {/* `flex-wrap`: el badge lleva texto libre ("Eliminó una
                      categoría y reasignó sus cursos") y no se puede truncar
                      sin perder el detalle de la acción. Junto a la fecha en
                      una sola fila sin envolver, un teléfono angosto se
                      desbordaba — acá la fecha simplemente baja a su propia
                      línea cuando no caben las dos. */}
                  <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                    <StatusBadge tone={tonoAccion(entrada.accion)}>{entrada.accion}</StatusBadge>
                    <span className="shrink-0 font-mono text-[11.5px] text-uva-muted-2 tabular-nums">
                      {formatFechaHora(entrada.creadoEn)}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm text-uva-text">{entrada.adminNombre}</span>
                    {entrada.adminCorreo && (
                      <span className="text-[11px] text-uva-muted-2">{entrada.adminCorreo}</span>
                    )}
                  </div>
                  <p className="text-[13px]">
                    {ruta ? (
                      <Link href={ruta} className="text-uva-text hover:text-uva-accent-text">
                        {nombreSujeto}
                      </Link>
                    ) : (
                      <span className="text-uva-muted">{nombreSujeto}</span>
                    )}
                  </p>
                  {entrada.detalles && (
                    <p className="text-[12.5px] text-uva-muted-2">{entrada.detalles}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {resultado.entradas.length > 0 && (
        <Table className="hidden pointer-fine:md:table">
          <TableHeader>
            <TableRow>
              <TableHead>Cuándo</TableHead>
              <TableHead>Administrador</TableHead>
              <TableHead>Acción</TableHead>
              <TableHead>Sobre</TableHead>
              <TableHead>Detalle</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {resultado.entradas.map((entrada) => {
              const info = ENTIDAD_INFO[entrada.entidadAfectada];
              const nombreSujeto = entrada.usuarioAfectadoNombre ?? info?.etiqueta ?? entrada.entidadAfectada;
              const ruta = entrada.usuarioAfectadoId
                ? info?.ruta?.(entrada.usuarioAfectadoId)
                : undefined;

              return (
                <TableRow key={entrada.id}>
                  <TableCell className="font-mono text-[12px] text-uva-muted-2 tabular-nums whitespace-nowrap">
                    {formatFechaHora(entrada.creadoEn)}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="text-uva-text">{entrada.adminNombre}</span>
                      {entrada.adminCorreo && (
                        <span className="text-[11px] text-uva-muted-2">{entrada.adminCorreo}</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <StatusBadge tone={tonoAccion(entrada.accion)}>{entrada.accion}</StatusBadge>
                  </TableCell>
                  <TableCell className="text-[13px]">
                    {ruta ? (
                      <Link href={ruta} className="text-uva-text hover:text-uva-accent-text">
                        {nombreSujeto}
                      </Link>
                    ) : (
                      <span className="text-uva-muted">{nombreSujeto}</span>
                    )}
                  </TableCell>
                  <TableCell className="max-w-[320px] text-[12.5px] text-uva-muted-2">
                    {entrada.detalles ?? "—"}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        )}
      </AdminCard>

      <Paginacion pagina={resultado.pagina} totalPaginas={resultado.totalPaginas} onCambiarPagina={irAPagina} />
    </div>
  );
}
