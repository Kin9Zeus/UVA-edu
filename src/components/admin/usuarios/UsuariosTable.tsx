"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { useAdminToast } from "@/components/admin/Toast";
import { suspenderActivarUsuario } from "@/actions/admin/usuarios";
import { formatFecha } from "@/lib/admin/format";
import type { UsuarioListado } from "@/lib/admin/usuarios";

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
const ESTADO_CUENTA_ITEMS = { todos: "Toda cuenta", ACTIVO: "Activo", SUSPENDIDO: "Suspendido" };
const SUSCRIPCION_ITEMS = { todos: "Toda suscripción", ...SUSCRIPCION_LABEL };

function iniciales(nombre: string) {
  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  return partes.slice(0, 2).map((parte) => parte[0]?.toUpperCase() ?? "").join("") || "U";
}

export function UsuariosTable({ usuarios: usuariosIniciales }: { usuarios: UsuarioListado[] }) {
  const [usuarios, setUsuarios] = useState(usuariosIniciales);
  const [busqueda, setBusqueda] = useState("");
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
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-[280px] flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-uva-text-faint" />
          <Input
            placeholder="Buscar por nombre o correo"
            value={busqueda}
            onChange={(event) => setBusqueda(event.target.value)}
            className="pl-9"
          />
        </div>
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
            <SelectItem value="todos">Toda cuenta</SelectItem>
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

      <div className="rounded-uva-md border border-uva-divider bg-uva-surface">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Usuario</TableHead>
              <TableHead>Rol</TableHead>
              <TableHead>Cursos</TableHead>
              <TableHead>Cuenta</TableHead>
              <TableHead>Suscripción</TableHead>
              <TableHead>Registro</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtrados.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-uva-text-faint">
                  No hay usuarios que coincidan con los filtros.
                </TableCell>
              </TableRow>
            )}
            {filtrados.map((usuario) => (
              <TableRow key={usuario.id}>
                <TableCell>
                  <Link href={`/admin/usuarios/${usuario.id}`} className="flex items-center gap-2.5">
                    <Avatar size="sm" className="bg-uva-divider">
                      <AvatarFallback className="bg-uva-divider text-xs text-uva-text">
                        {iniciales(usuario.nombre)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-uva-text">{usuario.nombre}</p>
                      <p className="text-xs text-uva-text-faint">{usuario.correo}</p>
                    </div>
                  </Link>
                </TableCell>
                <TableCell className="text-uva-text-muted">{ROL_LABEL[usuario.rol]}</TableCell>
                <TableCell className="font-mono tabular-nums">{usuario.cursosInscritos}</TableCell>
                <TableCell>
                  <StatusBadge tone={usuario.estado === "ACTIVO" ? "success" : "error"}>
                    {usuario.estado === "ACTIVO" ? "Activo" : "Suspendido"}
                  </StatusBadge>
                </TableCell>
                <TableCell>
                  {usuario.suscripcionEstado ? (
                    <StatusBadge tone={SUSCRIPCION_TONO[usuario.suscripcionEstado]}>
                      {SUSCRIPCION_LABEL[usuario.suscripcionEstado]}
                    </StatusBadge>
                  ) : (
                    <StatusBadge tone="neutral">Sin suscripción</StatusBadge>
                  )}
                </TableCell>
                <TableCell className="font-mono text-xs text-uva-text-faint tabular-nums">
                  {formatFecha(usuario.fechaRegistro)}
                </TableCell>
                <TableCell className="text-right">
                  <Button type="button" variant="outline" size="sm" onClick={() => handleToggleEstado(usuario)}>
                    {usuario.estado === "ACTIVO" ? "Suspender" : "Activar"}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
