"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
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
import { useAdminToast } from "@/components/admin/Toast";
import { useAdminSearch } from "@/components/admin/SearchContext";
import { suspenderActivarUsuario } from "@/actions/admin/usuarios";
import { formatFecha } from "@/lib/admin/format";
import type { UsuarioListado } from "@/lib/admin/usuarios";
import type { TipoAccesoGratuito } from "@/lib/estadoAcceso";

/** Misma etiqueta que ve el estudiante en su tarjeta "Tu acceso" (perfil) y el admin en la ficha de usuario. */
const TIPO_ACCESO_LABEL: Record<TipoAccesoGratuito, string> = {
  INVITACION: "Invitación gratuita",
  OTORGADO_ADMIN: "Acceso otorgado",
};

const ROL_LABEL: Record<UsuarioListado["rol"], string> = {
  ESTUDIANTE: "Estudiante",
  ADMINISTRADOR: "Administrador",
};

const SUSCRIPCION_LABEL: Record<NonNullable<UsuarioListado["suscripcionEstado"]>, string> = {
  ACTIVA: "Activa",
  PAST_DUE: "Pago pendiente",
  VENCIDA: "Vencida",
  CANCELADA: "Cancelada",
};

const SUSCRIPCION_TONO: Record<NonNullable<UsuarioListado["suscripcionEstado"]>, "success" | "warning" | "error" | "neutral"> = {
  ACTIVA: "success",
  PAST_DUE: "warning",
  VENCIDA: "error",
  CANCELADA: "neutral",
};

const ROL_ITEMS = { todos: "Todos los roles", ...ROL_LABEL };
const ESTADO_CUENTA_ITEMS = { todos: "Todos los estados", ACTIVO: "Activo", SUSPENDIDO: "Suspendido" };
const SUSCRIPCION_ITEMS = { todos: "Toda suscripción", ...SUSCRIPCION_LABEL };

function iniciales(nombre: string) {
  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  return partes.slice(0, 2).map((parte) => parte[0]?.toUpperCase() ?? "").join("") || "U";
}

export function UsuariosTable({ usuarios: usuariosIniciales }: { usuarios: UsuarioListado[] }) {
  const [usuarios, setUsuarios] = useState(usuariosIniciales);
  // El texto de búsqueda lo escribe el header (mockup: `showSearch`).
  const { query: busqueda } = useAdminSearch();
  const [filtroRol, setFiltroRol] = useState<string>("todos");
  const [filtroEstado, setFiltroEstado] = useState<string>("todos");
  const [filtroSuscripcion, setFiltroSuscripcion] = useState<string>("todos");
  const showToast = useAdminToast();

  const filtrados = useMemo(() => {
    return usuarios.filter((usuario) => {
      const coincideBusqueda =
        !busqueda ||
        usuario.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
        usuario.correo.toLowerCase().includes(busqueda.toLowerCase());
      const coincideRol = filtroRol === "todos" || usuario.rol === filtroRol;
      const coincideEstado = filtroEstado === "todos" || usuario.estado === filtroEstado;
      const coincideSuscripcion =
        filtroSuscripcion === "todos" || usuario.suscripcionEstado === filtroSuscripcion;
      return coincideBusqueda && coincideRol && coincideEstado && coincideSuscripcion;
    });
  }, [usuarios, busqueda, filtroRol, filtroEstado, filtroSuscripcion]);

  async function handleToggleEstado(usuario: UsuarioListado) {
    const nuevoEstado = usuario.estado === "ACTIVO" ? "SUSPENDIDO" : "ACTIVO";
    const resultado = await suspenderActivarUsuario(usuario.id, nuevoEstado);
    if (resultado.error) {
      showToast(resultado.error, "error");
      return;
    }
    setUsuarios((current) =>
      current.map((item) => (item.id === usuario.id ? { ...item, estado: nuevoEstado } : item)),
    );
    showToast(nuevoEstado === "SUSPENDIDO" ? "Usuario suspendido." : "Usuario activado.");
  }

  return (
    <div className="flex flex-col gap-[18px]">
      <div className="flex flex-wrap items-center gap-3">
        <Select items={ROL_ITEMS} value={filtroRol} onValueChange={(value) => setFiltroRol(value ?? "todos")}>
          <SelectTrigger><SelectValue placeholder="Rol" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los roles</SelectItem>
            <SelectItem value="ESTUDIANTE">Estudiante</SelectItem>
            <SelectItem value="ADMINISTRADOR">Administrador</SelectItem>
          </SelectContent>
        </Select>
        <Select
            items={ESTADO_CUENTA_ITEMS}
            value={filtroEstado}
            onValueChange={(value) => setFiltroEstado(value ?? "todos")}
          >
          <SelectTrigger><SelectValue placeholder="Estado de cuenta" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los estados</SelectItem>
            <SelectItem value="ACTIVO">Activo</SelectItem>
            <SelectItem value="SUSPENDIDO">Suspendido</SelectItem>
          </SelectContent>
        </Select>
        <Select
            items={SUSCRIPCION_ITEMS}
            value={filtroSuscripcion}
            onValueChange={(value) => setFiltroSuscripcion(value ?? "todos")}
          >
          <SelectTrigger><SelectValue placeholder="Suscripción" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Toda suscripción</SelectItem>
            <SelectItem value="ACTIVA">Activa</SelectItem>
            <SelectItem value="PAST_DUE">Pago pendiente</SelectItem>
            <SelectItem value="VENCIDA">Vencida</SelectItem>
            <SelectItem value="CANCELADA">Cancelada</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <AdminCard flush>
        <Table>
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
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtrados.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-uva-muted-2">
                  No hay usuarios que coincidan con los filtros.
                </TableCell>
              </TableRow>
            )}
            {filtrados.map((usuario) => (
              <TableRow key={usuario.id}>
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
                    {usuario.tipoAccesoSuscripcion && (
                      <StatusBadge tone="accent">
                        {TIPO_ACCESO_LABEL[usuario.tipoAccesoSuscripcion]}
                      </StatusBadge>
                    )}
                  </div>
                </TableCell>
                <TableCell className="font-mono text-[12px] text-uva-muted-2 tabular-nums">
                  {formatFecha(usuario.fechaRegistro)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </AdminCard>
    </div>
  );
}
