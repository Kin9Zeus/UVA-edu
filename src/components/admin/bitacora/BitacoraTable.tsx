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
  // Ni la lección ni el examen tienen pantalla propia en el panel — ambos
  // se editan dentro de las pestañas del curso — así que `idEntidadAfectada`
  // para estas dos entidades es el CURSO (ver src/actions/admin/mux.ts y
  // src/actions/admin/examenes.ts), y el enlace lleva ahí. El nombre
  // específico de la lección/examen queda en la columna "Detalle".
  lecciones: { etiqueta: "Lección", ruta: (id) => `/admin/cursos/${id}` },
  examenes: { etiqueta: "Examen", ruta: (id) => `/admin/cursos/${id}` },
  intentos_examen: { etiqueta: "Intento de examen", ruta: (id) => `/admin/usuarios/${id}` },
  // El admin ya tiene acceso a Comunidad por rol (084_comunidad_gate_sin_requisito_temporal.sql),
  // así que enlazar directo a la vista del estudiante funciona igual acá.
  comunidad_posts: { etiqueta: "Comunidad", ruta: (id) => `/dashboard/comunidad/${id}` },
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

  function actualizarUrl(cambios: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams);
    for (const [clave, valor] of Object.entries(cambios)) {
      if (valor === null || valor === "") params.delete(clave);
      else params.set(clave, valor);
    }
    // Cambiar el rango vuelve a la página 1: si estabas en la 3 y el rango
    // deja dos páginas, la 3 quedaría vacía.
    params.delete("page");
    const cadena = params.toString();
    router.push(cadena ? `${pathname}?${cadena}` : pathname, { scroll: false });
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Rango sobre `creado_en` (mismo criterio que el filtro de registro
          en UsuariosTable): vive en la URL para que la página, y no solo la
          tabla, se recargue con el rango aplicado. */}
      <div className="flex items-center gap-2">
        <label className="shrink-0 text-[12.5px] text-uva-muted" htmlFor="bitacora-filtro-desde">
          Fecha
        </label>
        <input
          id="bitacora-filtro-desde"
          type="date"
          value={searchParams.get("desde") ?? ""}
          onChange={(evento) => actualizarUrl({ desde: evento.target.value || null })}
          className="min-w-0 flex-1 rounded-uva-md border border-uva-divider bg-uva-surface px-2.5 py-1.5 text-[13px] text-uva-text md:flex-none"
          aria-label="Desde"
        />
        <span className="shrink-0 text-[12.5px] text-uva-muted-2">a</span>
        <input
          type="date"
          value={searchParams.get("hasta") ?? ""}
          onChange={(evento) => actualizarUrl({ hasta: evento.target.value || null })}
          className="min-w-0 flex-1 rounded-uva-md border border-uva-divider bg-uva-surface px-2.5 py-1.5 text-[13px] text-uva-text md:flex-none"
          aria-label="Hasta"
        />
        {(searchParams.get("desde") || searchParams.get("hasta")) && (
          <button
            type="button"
            onClick={() => actualizarUrl({ desde: null, hasta: null })}
            className="shrink-0 text-[12.5px] text-uva-muted-2 hover:text-uva-text"
          >
            Limpiar
          </button>
        )}
      </div>

      <AdminCard flush className="gap-0">
        {resultado.entradas.length === 0 && (
          <p className="px-5 py-6 text-center text-sm text-uva-text-faint">
            {searchParams.get("desde") || searchParams.get("hasta")
              ? "No hay acciones registradas en ese rango de fechas."
              : "Todavía no hay acciones registradas."}
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
              const ruta = entrada.idEntidadAfectada ? info?.ruta?.(entrada.idEntidadAfectada) : undefined;

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
                  <div className="flex flex-wrap items-start justify-between gap-x-2 gap-y-1">
                    {/* `whitespace-normal` pisa el `whitespace-nowrap` fijo
                        de StatusBadge: acá el texto es libre y largo
                        ("Publicó el examen final de un curso (pasa a ser
                        obligatorio...)"), y sin esto el badge se salía del
                        ancho de la tarjeta en vez de envolver. */}
                    <StatusBadge tone={tonoAccion(entrada.accion)} className="whitespace-normal">
                      {entrada.accion}
                    </StatusBadge>
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
          {/* Encabezado con más presencia: `bg-uva-hover` (el mismo tono
              que ya usa el resto del panel para "esto está resaltado", ej.
              el hover de la Sidebar) separa visualmente la fila de
              títulos del cuerpo de la tabla en vez de flotar sobre el
              mismo fondo, y `text-uva-muted` reemplaza el `text-uva-muted-2`
              por defecto de `TableHead` (src/components/ui/table.tsx),
              demasiado apagado en una tabla con tanto texto suelto. Ambos
              son overrides locales a esta tabla, no un cambio del
              componente compartido — las demás tablas del panel no
              pidieron este ajuste. */}
          <TableHeader className="bg-uva-hover">
            <TableRow>
              <TableHead className="text-uva-muted">Cuándo</TableHead>
              <TableHead className="text-uva-muted">Administrador</TableHead>
              <TableHead className="text-uva-muted">Acción</TableHead>
              <TableHead className="text-uva-muted">Sobre</TableHead>
              <TableHead className="text-uva-muted">Detalle</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {resultado.entradas.map((entrada) => {
              const info = ENTIDAD_INFO[entrada.entidadAfectada];
              const nombreSujeto = entrada.usuarioAfectadoNombre ?? info?.etiqueta ?? entrada.entidadAfectada;
              const ruta = entrada.idEntidadAfectada ? info?.ruta?.(entrada.idEntidadAfectada) : undefined;

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
                  {/* Mismo criterio que la celda de Detalle: `accion` es
                      texto libre y a veces largo, así que la columna tiene
                      un ancho tope y el badge envuelve (`whitespace-normal`
                      pisa el `whitespace-nowrap` fijo de StatusBadge) en
                      vez de forzar una sola línea. */}
                  <TableCell className="max-w-[220px] align-top">
                    <StatusBadge tone={tonoAccion(entrada.accion)} className="whitespace-normal">
                      {entrada.accion}
                    </StatusBadge>
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
                  {/* `whitespace-normal` pisa el `whitespace-nowrap` por
                      defecto de `TableCell`: acá el texto puede ser largo
                      ("2 curso(s) movidos a...", nombre + curso de un
                      intento de examen, etc.) y antes se cortaba en una
                      sola línea en vez de crecer la fila. `align-top`
                      porque el resto de columnas de la fila siguen en una
                      línea — sin esto, una celda de 2-3 líneas quedaba
                      centrada verticalmente contra celdas de una sola. */}
                  <TableCell className="max-w-[320px] align-top text-[12.5px] whitespace-normal text-uva-muted-2">
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
