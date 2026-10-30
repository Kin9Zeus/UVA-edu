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
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { suspenderActivarUsuario } from "@/actions/admin/usuarios";
import { exportarUsuariosCsv } from "@/actions/admin/exportarUsuarios";
import { formatFecha } from "@/lib/admin/format";
import { dejoDeEstudiar, textoAcceso, textoEstudio } from "@/lib/admin/acceso-texto";
import type { ResultadoUsuarios, UsuarioListado } from "@/lib/admin/usuarios";
import { cn } from "@/lib/utils";

const ROL_LABEL: Record<UsuarioListado["rol"], string> = {
  ESTUDIANTE: "Estudiante",
  ADMINISTRADOR: "Administrador",
  PROFESOR: "Profesor",
};

type Opciones = Record<string, string>;

const ESTUDIO: Opciones = {
  todos: "Cualquier estudio",
  SEMANA: "Estudió en los últimos 7 días",
  PARADOS: "Lleva 14 días sin estudiar",
  NUNCA: "Nunca ha estudiado",
};
const ROL: Opciones = { todos: "Todos los roles", ...ROL_LABEL };
const CUENTA: Opciones = { todos: "Todas las cuentas", ACTIVO: "Cuenta activa", SUSPENDIDO: "Cuenta suspendida" };

function opcionesAcceso(conCobro: boolean): Opciones {
  return {
    todos: "Cualquier acceso",
    ACTIVA: "Con acceso",
    ...(conCobro ? { PAST_DUE: "Pago pendiente" } : {}),
    VENCIDA: "Vencido",
    CANCELADA: conCobro ? "Revocado o cancelado" : "Revocado",
    SIN_SUSCRIPCION: "Nunca tuvo",
  };
}
function opcionesOrigen(conCobro: boolean): Opciones {
  return {
    todos: "Cualquier origen",
    INVITACION: "Por invitación",
    MANUAL: "Dado por U.V.A.",
    ...(conCobro ? { PAGO: "Pagado" } : {}),
  };
}

function iniciales(nombre: string) {
  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  return partes.slice(0, 2).map((parte) => parte[0]?.toUpperCase() ?? "").join("") || "U";
}

function Filtro({
  clave,
  opciones,
  valor,
  onCambiar,
  etiqueta,
}: {
  clave: string;
  opciones: Opciones;
  valor: string;
  onCambiar: (clave: string, valor: string) => void;
  etiqueta: string;
}) {
  return (
    <Select items={opciones} value={valor in opciones ? valor : "todos"} onValueChange={(v) => onCambiar(clave, v ?? "todos")}>
      <SelectTrigger className="shrink-0" aria-label={etiqueta}>
        <SelectValue placeholder={etiqueta} />
      </SelectTrigger>
      <SelectContent>
        {Object.entries(opciones).map(([v, texto]) => (
          <SelectItem key={v} value={v}>
            {texto}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function Persona({ usuario }: { usuario: UsuarioListado }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <Avatar className="size-9 shrink-0 bg-uva-divider after:hidden">
        <AvatarFallback className="bg-uva-divider font-heading text-uva-etiqueta font-bold text-uva-muted">
          {iniciales(usuario.nombre)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <Link
          href={`/admin/usuarios/${usuario.slug}`}
          className="font-bold text-uva-text underline-offset-4 hover:text-uva-accent-text hover:underline"
        >
          {usuario.nombre}
        </Link>
        {usuario.rol !== "ESTUDIANTE" && (
          <span className="ml-1.5 inline-block rounded-full bg-uva-accent-soft px-2 py-px align-middle text-uva-etiqueta font-bold text-uva-accent-text">
            {ROL_LABEL[usuario.rol]}
          </span>
        )}
        <p className="m-0 text-uva-detalle break-all text-uva-text-muted">{usuario.correo}</p>
      </div>
    </div>
  );
}

function Acceso({ usuario, ahora, conCobro }: { usuario: UsuarioListado; ahora: string; conCobro: boolean }) {
  const texto = textoAcceso(usuario.acceso, usuario.rol, ahora, conCobro);
  return (
    <div className="flex flex-col items-start gap-1">
      <StatusBadge tone={texto.tono}>{texto.etiqueta}</StatusBadge>
      {texto.lineas.map((linea) => (
        <span
          key={linea.texto}
          className={cn("text-uva-detalle", linea.alerta ? "font-bold text-uva-warning-text" : "text-uva-text-muted")}
        >
          {linea.texto}
        </span>
      ))}
    </div>
  );
}

function Estudio({ usuario, ahora }: { usuario: UsuarioListado; ahora: string }) {
  const parado = dejoDeEstudiar(usuario.acceso, usuario.ultimaActividad, ahora);
  return (
    <div className="flex flex-col gap-0.5">
      <span className={cn("text-uva-detalle", parado ? "font-bold text-uva-warning-text" : "text-uva-text")}>
        {textoEstudio(usuario.ultimaActividad, ahora)}
      </span>
      <span className="text-uva-detalle text-uva-text-muted">
        {usuario.cursosInscritos === 0
          ? "Ningún curso empezado"
          : `${usuario.cursosInscritos} ${usuario.cursosInscritos === 1 ? "curso empezado" : "cursos empezados"}`}
      </span>
    </div>
  );
}

export function UsuariosTable({
  resultado,
  conCobro,
  ahora,
}: {
  resultado: ResultadoUsuarios;
  conCobro: boolean;
  /** Del servidor: el "hace 3 días" no cambia entre el render del servidor y el del navegador. */
  ahora: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const showToast = useAdminToast();
  const [suspendiendo, setSuspendiendo] = useState<UsuarioListado | null>(null);
  const [pendiente, startTransition] = useTransition();
  const [exportando, setExportando] = useState(false);

  // Avisa que hay más filtros a la derecha en la franja con scroll horizontal
  // de celular, y solo cuando de verdad sobra contenido.
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
   * página cargada daría resultados falsos.
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
  const cambiarFiltro = (clave: string, valor: string) => actualizarUrl({ [clave]: valor });

  // Suspender cierra la sesión del usuario y le corta el acceso: se pide
  // confirmación. Reactivar no hace daño, así que va directo.
  function handleToggleEstado(usuario: UsuarioListado) {
    if (usuario.estado === "ACTIVO") setSuspendiendo(usuario);
    else cambiarEstado(usuario, "ACTIVO");
  }

  async function cambiarEstado(usuario: UsuarioListado, nuevoEstado: "ACTIVO" | "SUSPENDIDO") {
    const respuesta = await suspenderActivarUsuario(usuario.id, nuevoEstado);
    if (respuesta.error) {
      showToast(respuesta.error, "error");
      return;
    }
    // Sin estado local: la acción revalida /admin/usuarios y el servidor
    // devuelve la página con los filtros aplicados.
    showToast(nuevoEstado === "SUSPENDIDO" ? "Cuenta suspendida." : "Cuenta activada.");
  }

  async function handleExportar() {
    setExportando(true);
    try {
      const filtro = (clave: string) => searchParams.get(clave) ?? undefined;
      const respuesta = await exportarUsuariosCsv({
        query: filtro("q"),
        desde: filtro("desde"),
        hasta: filtro("hasta"),
        rol: filtro("rol"),
        estado: filtro("estado"),
        suscripcion: filtro("suscripcion"),
        estudio: filtro("estudio"),
        origen: filtro("origen"),
      });

      if (respuesta.error || !respuesta.csv || !respuesta.nombreArchivo) {
        showToast(respuesta.error ?? "No pudimos generar la exportación.", "error");
        return;
      }

      // El Server Action devuelve el CSV como texto y la descarga se dispara
      // aquí: CLAUDE.md §3.1 reserva /api/ para webhooks externos.
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
  const hayFiltros = ["q", "desde", "hasta", "rol", "estado", "suscripcion", "estudio", "origen"].some((clave) =>
    searchParams.has(clave),
  );

  const switchCuenta = (usuario: UsuarioListado) =>
    usuario.rol === "ADMINISTRADOR" ? (
      <span className="text-uva-detalle text-uva-text-muted">{usuario.estado === "ACTIVO" ? "Activa" : "Suspendida"}</span>
    ) : (
      <SwitchEstado
        checked={usuario.estado === "ACTIVO"}
        onCheckedChange={() => handleToggleEstado(usuario)}
        etiquetas={["Activa", "Suspendida"]}
        acciones={[`Activar la cuenta de ${usuario.nombre}`, `Suspender la cuenta de ${usuario.nombre}`]}
      />
    );

  return (
    <section aria-label="Lista de usuarios" className="flex flex-col gap-[18px]">
      <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center">
        {/* Los filtros no caben en una fila en celular sin envolver feo: se
            deslizan en horizontal en vez de partirse en varias líneas. */}
        <div className="relative min-w-0">
          <div ref={filtrosRef} className="flex gap-2 overflow-x-auto pb-1 lg:flex-wrap lg:overflow-visible lg:pb-0">
            <Filtro clave="estudio" etiqueta="Estudio" opciones={ESTUDIO} valor={valorFiltro("estudio")} onCambiar={cambiarFiltro} />
            <Filtro
              clave="suscripcion"
              etiqueta="Acceso"
              opciones={opcionesAcceso(conCobro)}
              valor={valorFiltro("suscripcion")}
              onCambiar={cambiarFiltro}
            />
            <Filtro
              clave="origen"
              etiqueta="Origen del acceso"
              opciones={opcionesOrigen(conCobro)}
              valor={valorFiltro("origen")}
              onCambiar={cambiarFiltro}
            />
            <Filtro clave="rol" etiqueta="Rol" opciones={ROL} valor={valorFiltro("rol")} onCambiar={cambiarFiltro} />
            <Filtro clave="estado" etiqueta="Cuenta" opciones={CUENTA} valor={valorFiltro("estado")} onCambiar={cambiarFiltro} />
          </div>
          {hayMasFiltros && (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-uva-bg to-transparent lg:hidden"
            />
          )}
        </div>

        {/* Rango sobre la fecha de registro. Solo filtra la tabla. */}
        <div className="flex flex-wrap items-center gap-2">
          <label className="shrink-0 text-uva-detalle text-uva-muted" htmlFor="filtro-desde">
            Se registró entre
          </label>
          <input
            id="filtro-desde"
            type="date"
            value={searchParams.get("desde") ?? ""}
            onChange={(evento) => actualizarUrl({ desde: evento.target.value || null })}
            className="min-h-11 min-w-[9.5rem] flex-1 rounded-uva-md border border-uva-line-strong bg-uva-surface px-2.5 py-1.5 text-base text-uva-text md:flex-none md:pointer-fine:min-h-9 md:pointer-fine:text-uva-detalle outline-hidden focus-within:border-uva-accent focus-within:outline-2 focus-within:outline-solid focus-within:outline-uva-accent"
            aria-label="Se registró desde"
          />
          <span className="shrink-0 text-uva-detalle text-uva-muted-2">y</span>
          <input
            type="date"
            value={searchParams.get("hasta") ?? ""}
            onChange={(evento) => actualizarUrl({ hasta: evento.target.value || null })}
            className="min-h-11 min-w-[9.5rem] flex-1 rounded-uva-md border border-uva-line-strong bg-uva-surface px-2.5 py-1.5 text-base text-uva-text md:flex-none md:pointer-fine:min-h-9 md:pointer-fine:text-uva-detalle outline-hidden focus-within:border-uva-accent focus-within:outline-2 focus-within:outline-solid focus-within:outline-uva-accent"
            aria-label="Se registró hasta"
          />
        </div>

        <button
          type="button"
          onClick={handleExportar}
          disabled={exportando || total === 0}
          className="flex min-h-11 w-full items-center justify-center gap-2 rounded-uva-md border border-uva-line-strong px-3.5 py-2 text-uva-detalle font-semibold text-uva-text hover:border-uva-accent hover:text-uva-accent-text disabled:opacity-40 lg:ml-auto lg:w-auto pointer-fine:min-h-9"
        >
          <Download className="size-4" strokeWidth={1.9} aria-hidden />
          {exportando ? "Preparando…" : "Exportar CSV"}
        </button>
      </div>

      <AdminCard flush>
        {usuarios.length === 0 && (
          <div className="grid justify-items-center gap-1 px-5 py-10 text-center">
            <p className="m-0 font-bold text-uva-text">{hayFiltros ? "Nadie coincide con los filtros" : "Todavía no hay usuarios"}</p>
            <p className="m-0 text-uva-detalle text-uva-text-muted">
              {hayFiltros ? "Quita algún filtro para ver más personas." : "Aparecen aquí cuando alguien crea su cuenta."}
            </p>
          </div>
        )}

        {/* En pantallas táctiles, tarjetas: la tabla no cabe sin desplazar
            de lado y el interruptor de cuenta quedaría fuera de la vista. */}
        {usuarios.length > 0 && (
          <ul className={cn("m-0 flex list-none flex-col p-0 pointer-fine:md:hidden", pendiente && "opacity-60")}>
            {usuarios.map((usuario) => (
              <li key={usuario.id} className="flex flex-col gap-3 border-b border-uva-divider px-4 py-4 last:border-b-0">
                <Persona usuario={usuario} />
                <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                  <Acceso usuario={usuario} ahora={ahora} conCobro={conCobro} />
                  <Estudio usuario={usuario} ahora={ahora} />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-uva-detalle text-uva-text-muted">Se registró el {formatFecha(usuario.fechaRegistro)}</span>
                  {switchCuenta(usuario)}
                </div>
              </li>
            ))}
          </ul>
        )}

        {usuarios.length > 0 && (
          <Table contenedorClassName="hidden pointer-fine:md:block" etiqueta="Tabla de usuarios">
            <TableHeader>
              <TableRow>
                <TableHead>Persona</TableHead>
                <TableHead>Acceso</TableHead>
                <TableHead>Estudio</TableHead>
                <TableHead>Registro</TableHead>
                <TableHead>Cuenta</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {usuarios.map((usuario) => (
                <TableRow key={usuario.id} className={pendiente ? "opacity-60" : undefined}>
                  <TableCell className="max-w-72 whitespace-normal">
                    <Persona usuario={usuario} />
                  </TableCell>
                  <TableCell className="whitespace-normal">
                    <Acceso usuario={usuario} ahora={ahora} conCobro={conCobro} />
                  </TableCell>
                  <TableCell className="whitespace-normal">
                    <Estudio usuario={usuario} ahora={ahora} />
                  </TableCell>
                  <TableCell className="font-mono text-uva-detalle text-uva-text-muted tabular-nums">
                    {formatFecha(usuario.fechaRegistro)}
                  </TableCell>
                  <TableCell>{switchCuenta(usuario)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </AdminCard>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="m-0 font-mono text-uva-detalle text-uva-text-muted tabular-nums">
          {total} {total === 1 ? "persona" : "personas"}
        </p>
        <Paginacion
          pagina={pagina}
          totalPaginas={totalPaginas}
          onCambiarPagina={(destino) => actualizarUrl({ page: String(destino) })}
        />
      </div>

      <ConfirmDialog
        open={suspendiendo !== null}
        onOpenChange={(open) => !open && setSuspendiendo(null)}
        title={`¿Suspender a ${suspendiendo?.nombre ?? ""}?`}
        description="Se cerrará su sesión y no podrá entrar ni ver sus cursos hasta que la vuelvas a activar. Su avance y sus certificados se conservan."
        confirmLabel="Suspender cuenta"
        destructive
        onConfirm={async () => {
          if (suspendiendo) await cambiarEstado(suspendiendo, "SUSPENDIDO");
        }}
      />
    </section>
  );
}
