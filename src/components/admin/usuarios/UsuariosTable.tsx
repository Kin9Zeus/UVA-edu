"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Download } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SwitchEstado } from "@/components/admin/SwitchEstado";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AdminCard } from "@/components/admin/AdminCard";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { Paginacion } from "@/components/Paginacion";
import { useAdminToast } from "@/components/admin/Toast";
import { suspenderActivarUsuario } from "@/actions/admin/usuarios";
import { exportarUsuariosCsv } from "@/actions/admin/exportarUsuarios";
import { formatFecha } from "@/lib/admin/format";
import type { ResultadoUsuarios, UsuarioListado } from "@/lib/admin/usuarios";
import {
  ETIQUETA_TIPO_ACCESO,
  ETIQUETA_ESTADO_SUSCRIPCION,
  TONO_ESTADO_SUSCRIPCION,
  suscripcionEstaVigentePorEstado,
} from "@/lib/estadoAcceso";

const ROL_LABEL: Record<UsuarioListado["rol"], string> = {
  ESTUDIANTE: "Estudiante",
  ADMINISTRADOR: "Administrador",
};

const SUSCRIPCION_LABEL = ETIQUETA_ESTADO_SUSCRIPCION;
const SUSCRIPCION_TONO = TONO_ESTADO_SUSCRIPCION;

const ROL_ITEMS = { todos: "Todos los roles", ...ROL_LABEL };
const ESTADO_CUENTA_ITEMS = { todos: "Todos los estados", ACTIVO: "Activo", SUSPENDIDO: "Suspendido" };
const SUSCRIPCION_ITEMS = {
  todos: "Toda suscripción",
  ...SUSCRIPCION_LABEL,
  SIN_SUSCRIPCION: "Sin suscripción",
};

function iniciales(nombre: string) {
  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  return partes.slice(0, 2).map((parte) => parte[0]?.toUpperCase() ?? "").join("") || "U";
}

export function UsuariosTable({ resultado }: { resultado: ResultadoUsuarios }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const showToast = useAdminToast();
  const [pendiente, startTransition] = useTransition();
  const [exportando, setExportando] = useState(false);

  // Mismo degradado que CursosTable: avisa que hay más filtros a la derecha
  // en la franja con scroll horizontal de mobile, y solo cuando de verdad
  // sobra contenido.
  const filtrosRef = useRef<HTMLDivElement>(null);
  const [hayMasFiltros, setHayMasFiltros] = useState(false);

  useEffect(() => {
    const el = filtrosRef.current;
    if (!el) return;
    function actualizar() {
      if (!el) return;
      setHayMasFiltros(el.scrollWidth - el.scrollLeft - el.clientWidth > 4);
    }
    actualizar();
    el.addEventListener("scroll", actualizar);
    window.addEventListener("resize", actualizar);
    return () => {
      el.removeEventListener("scroll", actualizar);
      window.removeEventListener("resize", actualizar);
    };
  }, []);

  /**
   * Los filtros viven en la URL, no en `useState`, porque el filtrado ocurre
   * en Postgres (RPC admin_listar_usuarios). Filtrar en cliente sobre la
   * página cargada daría resultados falsos: "suspendidos" mostraría los
   * suspendidos de estas 25 filas, no de todos los usuarios.
   */
  const valorFiltro = (clave: string) => searchParams.get(clave) ?? "todos";

  function actualizarUrl(cambios: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams);
    for (const [clave, valor] of Object.entries(cambios)) {
      if (valor === null || valor === "" || valor === "todos") params.delete(clave);
      else params.set(clave, valor);
    }
    // Cualquier cambio de filtro vuelve a la página 1: si estabas en la 3 y
    // el filtro deja dos resultados, la 3 queda vacía.
    if (!("page" in cambios)) params.delete("page");

    const cadena = params.toString();
    startTransition(() => {
      router.replace(cadena ? `${pathname}?${cadena}` : pathname, { scroll: false });
    });
  }

  async function handleToggleEstado(usuario: UsuarioListado) {
    const nuevoEstado = usuario.estado === "ACTIVO" ? "SUSPENDIDO" : "ACTIVO";
    const respuesta = await suspenderActivarUsuario(usuario.id, nuevoEstado);
    if (respuesta.error) {
      showToast(respuesta.error, "error");
      return;
    }
    // Sin estado local: la acción ya hace revalidatePath("/admin/usuarios") y
    // el servidor devuelve la página con los filtros aplicados. Mutar una
    // copia en memoria dejaría visible una fila que el filtro actual ya
    // excluye (p. ej. suspender con el filtro "Activo" puesto).
    showToast(nuevoEstado === "SUSPENDIDO" ? "Usuario suspendido." : "Usuario activado.");
  }

  async function handleExportar() {
    setExportando(true);
    try {
      const respuesta = await exportarUsuariosCsv({
        query: searchParams.get("q") ?? undefined,
        desde: searchParams.get("desde") ?? undefined,
        hasta: searchParams.get("hasta") ?? undefined,
        rol: searchParams.get("rol") ?? undefined,
        estado: searchParams.get("estado") ?? undefined,
        suscripcion: searchParams.get("suscripcion") ?? undefined,
      });

      if (respuesta.error || !respuesta.csv || !respuesta.nombreArchivo) {
        showToast(respuesta.error ?? "No pudimos generar la exportación.", "error");
        return;
      }

      // El Server Action devuelve el CSV como texto y la descarga se dispara
      // aquí: CLAUDE.md §3.1 reserva /api/ para webhooks externos, así que no
      // hay Route Handler que sirva el archivo.
      const blob = new Blob([respuesta.csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const enlace = document.createElement("a");
      enlace.href = url;
      enlace.download = respuesta.nombreArchivo;
      enlace.click();
      URL.revokeObjectURL(url);
      showToast("Exportación descargada.");
    } finally {
      setExportando(false);
    }
  }

  const { usuarios, total, pagina, totalPaginas } = resultado;

  return (
    <div className="flex flex-col gap-[18px]">
      <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center">
        {/* Mismo criterio que CursosTable: los 3 selects no caben en una fila
            en mobile sin envolver feo, así que deslizan en horizontal en vez
            de partirse en varias líneas. */}
        <div className="relative">
          <div
            ref={filtrosRef}
            className="flex gap-3 overflow-x-auto pb-1 md:flex-wrap md:overflow-visible md:pb-0"
          >
            <Select
              items={ROL_ITEMS}
              value={valorFiltro("rol")}
              onValueChange={(value) => actualizarUrl({ rol: value ?? "todos" })}
            >
              <SelectTrigger className="shrink-0"><SelectValue placeholder="Rol" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los roles</SelectItem>
                <SelectItem value="ESTUDIANTE">Estudiante</SelectItem>
                <SelectItem value="ADMINISTRADOR">Administrador</SelectItem>
              </SelectContent>
            </Select>
            <Select
              items={ESTADO_CUENTA_ITEMS}
              value={valorFiltro("estado")}
              onValueChange={(value) => actualizarUrl({ estado: value ?? "todos" })}
            >
              <SelectTrigger className="shrink-0"><SelectValue placeholder="Estado de cuenta" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los estados</SelectItem>
                <SelectItem value="ACTIVO">Activo</SelectItem>
                <SelectItem value="SUSPENDIDO">Suspendido</SelectItem>
              </SelectContent>
            </Select>
            <Select
              items={SUSCRIPCION_ITEMS}
              value={valorFiltro("suscripcion")}
              onValueChange={(value) => actualizarUrl({ suscripcion: value ?? "todos" })}
            >
              <SelectTrigger className="shrink-0"><SelectValue placeholder="Suscripción" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Toda suscripción</SelectItem>
                <SelectItem value="ACTIVA">Activa</SelectItem>
                <SelectItem value="PAST_DUE">Pago pendiente</SelectItem>
                <SelectItem value="VENCIDA">Vencida</SelectItem>
                <SelectItem value="CANCELADA">Cancelada</SelectItem>
                <SelectItem value="SIN_SUSCRIPCION">Sin suscripción</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {hayMasFiltros && (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-uva-bg to-transparent md:hidden"
            />
          )}
        </div>

        {/* Rango sobre la fecha de registro. Solo filtra la tabla: los KPIs
            de arriba siempre muestran el acumulado, porque "cupos
            disponibles" es un saldo y acotarlo a un periodo no significa
            nada. */}
        <div className="flex items-center gap-2">
          <label className="shrink-0 text-[12.5px] text-uva-muted" htmlFor="filtro-desde">
            Registro
          </label>
          <input
            id="filtro-desde"
            type="date"
            value={searchParams.get("desde") ?? ""}
            onChange={(evento) => actualizarUrl({ desde: evento.target.value || null })}
            className="min-w-0 flex-1 rounded-uva-md border border-uva-divider bg-uva-surface px-2.5 py-1.5 text-[13px] text-uva-text md:flex-none"
            aria-label="Registrados desde"
          />
          <span className="shrink-0 text-[12.5px] text-uva-muted-2">a</span>
          <input
            type="date"
            value={searchParams.get("hasta") ?? ""}
            onChange={(evento) => actualizarUrl({ hasta: evento.target.value || null })}
            className="min-w-0 flex-1 rounded-uva-md border border-uva-divider bg-uva-surface px-2.5 py-1.5 text-[13px] text-uva-text md:flex-none"
            aria-label="Registrados hasta"
          />
        </div>

        <button
          type="button"
          onClick={handleExportar}
          disabled={exportando || total === 0}
          className="flex w-full items-center justify-center gap-2 rounded-uva-md border border-uva-divider px-3.5 py-2 text-[13px] text-uva-text hover:border-uva-accent hover:text-uva-accent-text disabled:opacity-40 md:ml-auto md:w-auto"
        >
          <Download className="size-4" strokeWidth={1.9} />
          {exportando ? "Preparando..." : "Exportar CSV"}
        </button>
      </div>

      <AdminCard flush>
        {usuarios.length === 0 && (
          <p className="px-5 py-6 text-center text-sm text-uva-muted-2">
            No hay usuarios que coincidan con los filtros.
          </p>
        )}

        {/* Mismo criterio que CursosTable/EstudiantesTab: 9 columnas (una un
            switch funcional) no caben sin scroll horizontal en un touch, así
            que por debajo de `pointer-fine:md` se ve una lista de tarjetas
            en vez de la tabla. */}
        {usuarios.length > 0 && (
          <div className={`flex flex-col pointer-fine:md:hidden ${pendiente ? "opacity-60" : ""}`}>
            {usuarios.map((usuario) => (
              <div
                key={usuario.id}
                className="flex flex-col gap-2 border-b border-uva-divider px-5 py-3.5 last:border-b-0"
              >
                <div className="flex items-center justify-between gap-3">
                  <Link
                    href={`/admin/usuarios/${usuario.id}`}
                    className="flex min-w-0 items-center gap-2.5"
                  >
                    <Avatar className="size-[30px] shrink-0 bg-uva-divider after:hidden">
                      <AvatarFallback className="bg-uva-divider font-heading text-[11px] font-bold text-uva-muted">
                        {iniciales(usuario.nombre)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="truncate text-sm font-semibold text-uva-text">{usuario.nombre}</span>
                  </Link>
                  <SwitchEstado
                    checked={usuario.estado === "ACTIVO"}
                    onCheckedChange={() => handleToggleEstado(usuario)}
                    etiquetas={["Activo", "Suspendido"]}
                    acciones={["Activar usuario", "Suspender usuario"]}
                  />
                </div>
                <p className="truncate text-xs text-uva-muted">{usuario.correo}</p>
                <p className="font-mono text-[12px] text-uva-muted-2 tabular-nums">
                  {ROL_LABEL[usuario.rol]} · {usuario.cursosInscritos} curso
                  {usuario.cursosInscritos === 1 ? "" : "s"}
                </p>
                <div className="flex flex-wrap items-center gap-1.5">
                  {usuario.suscripcionEstado ? (
                    <StatusBadge tone={SUSCRIPCION_TONO[usuario.suscripcionEstado]}>
                      {SUSCRIPCION_LABEL[usuario.suscripcionEstado]}
                    </StatusBadge>
                  ) : (
                    <StatusBadge tone="neutral">Sin suscripción</StatusBadge>
                  )}
                  {usuario.tipoAccesoSuscripcion && suscripcionEstaVigentePorEstado(usuario.suscripcionEstado) && (
                    <StatusBadge tone="accent">
                      {ETIQUETA_TIPO_ACCESO[usuario.tipoAccesoSuscripcion]}
                    </StatusBadge>
                  )}
                </div>
                <p className="font-mono text-[11.5px] text-uva-muted-2 tabular-nums">
                  Registro {formatFecha(usuario.fechaRegistro)}
                  {usuario.ultimaActividad && ` · Actividad ${formatFecha(usuario.ultimaActividad)}`}
                </p>
              </div>
            ))}
          </div>
        )}

        {usuarios.length > 0 && (
          <Table className="hidden pointer-fine:md:table">
            <TableHeader>
              <TableRow>
                <TableHead />
                <TableHead>Nombre</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>Cursos</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Suscripción</TableHead>
                <TableHead>Registro</TableHead>
                {/* "en contenido" no es un adorno: la columna sale del progreso
                    de reproducción, así que alguien que entró pero no abrió
                    ningún video aparece vacío. */}
                <TableHead>Actividad en contenido</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {usuarios.map((usuario) => (
                <TableRow key={usuario.id} className={pendiente ? "opacity-60" : undefined}>
                  <TableCell className="w-px pr-0">
                    <Avatar className="size-[30px] bg-uva-divider after:hidden">
                      <AvatarFallback className="bg-uva-divider font-heading text-[11px] font-bold text-uva-muted">
                        {iniciales(usuario.nombre)}
                      </AvatarFallback>
                    </Avatar>
                  </TableCell>
                  <TableCell className="font-semibold">
                    <Link
                      href={`/admin/usuarios/${usuario.id}`}
                      className="text-uva-text hover:text-uva-accent-text"
                    >
                      {usuario.nombre}
                    </Link>
                  </TableCell>
                  <TableCell className="text-uva-muted">{usuario.correo}</TableCell>
                  <TableCell className="text-uva-muted">{ROL_LABEL[usuario.rol]}</TableCell>
                  <TableCell className="font-mono tabular-nums">{usuario.cursosInscritos}</TableCell>
                  <TableCell>
                    {/* `estado` es binario (ACTIVO/SUSPENDIDO) y ya se alternaba
                        con un clic: se muestra con el mismo switch que `activo`
                        en Categorias. Encendido = cuenta activa. */}
                    <SwitchEstado
                      checked={usuario.estado === "ACTIVO"}
                      onCheckedChange={() => handleToggleEstado(usuario)}
                      etiquetas={["Activo", "Suspendido"]}
                      acciones={["Activar usuario", "Suspender usuario"]}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {usuario.suscripcionEstado ? (
                        <StatusBadge tone={SUSCRIPCION_TONO[usuario.suscripcionEstado]}>
                          {SUSCRIPCION_LABEL[usuario.suscripcionEstado]}
                        </StatusBadge>
                      ) : (
                        <StatusBadge tone="neutral">Sin suscripción</StatusBadge>
                      )}
                      {/* Solo mientras la suscripción siga dando acceso: una
                          CANCELADA o VENCIDA no debería seguir luciendo
                          "Acceso otorgado" junto a su propio estado — leía
                          como si el acceso siguiera en pie después de
                          revocarlo. */}
                      {usuario.tipoAccesoSuscripcion && suscripcionEstaVigentePorEstado(usuario.suscripcionEstado) && (
                        <StatusBadge tone="accent">
                          {ETIQUETA_TIPO_ACCESO[usuario.tipoAccesoSuscripcion]}
                        </StatusBadge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-[12px] text-uva-muted-2 tabular-nums">
                    {formatFecha(usuario.fechaRegistro)}
                  </TableCell>
                  <TableCell className="font-mono text-[12px] text-uva-muted-2 tabular-nums">
                    {usuario.ultimaActividad ? formatFecha(usuario.ultimaActividad) : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </AdminCard>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-mono text-xs text-uva-text-faint tabular-nums">
          {total} usuario{total === 1 ? "" : "s"}
        </p>
        <Paginacion
          pagina={pagina}
          totalPaginas={totalPaginas}
          onCambiarPagina={(destino) => actualizarUrl({ page: String(destino) })}
        />
      </div>
    </div>
  );
}
