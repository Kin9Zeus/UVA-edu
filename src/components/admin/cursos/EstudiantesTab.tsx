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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AdminCard } from "@/components/admin/AdminCard";
import { StatusBadge } from "@/components/admin/StatusBadge";
import type { EstudianteDeCurso } from "@/lib/admin/cursoDetalle";

const ACCESO_ITEMS = { todos: "Todo acceso", MEMBRESIA: "Membresía", CORTESIA: "Cortesía" };
const ESTADO_ITEMS = { todos: "Todo estado", EN_PROGRESO: "En progreso", COMPLETADO: "Completado" };

function iniciales(nombre: string) {
  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  return partes.slice(0, 2).map((parte) => parte[0]?.toUpperCase() ?? "").join("") || "U";
}

export function EstudiantesTab({ estudiantes }: { estudiantes: EstudianteDeCurso[] }) {
  const [busqueda, setBusqueda] = useState("");
  const [filtroAcceso, setFiltroAcceso] = useState("todos");
  const [filtroEstado, setFiltroEstado] = useState("todos");

  const filtrados = useMemo(() => {
    return estudiantes.filter((estudiante) => {
      const coincideBusqueda = !busqueda || estudiante.nombre.toLowerCase().includes(busqueda.toLowerCase());
      const coincideAcceso = filtroAcceso === "todos" || estudiante.tipoAcceso === filtroAcceso;
      const coincideEstado = filtroEstado === "todos" || estudiante.estado === filtroEstado;
      return coincideBusqueda && coincideAcceso && coincideEstado;
    });
  }, [estudiantes, busqueda, filtroAcceso, filtroEstado]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-[260px] flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-uva-text-faint" />
          <Input
            placeholder="Buscar por nombre"
            value={busqueda}
            onChange={(event) => setBusqueda(event.target.value)}
            className="pl-9"
          />
        </div>
        <Select
          items={ACCESO_ITEMS}
          value={filtroAcceso}
          onValueChange={(value) => setFiltroAcceso(value ?? "todos")}
        >
          <SelectTrigger><SelectValue placeholder="Acceso" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todo acceso</SelectItem>
            <SelectItem value="MEMBRESIA">Membresía</SelectItem>
            <SelectItem value="CORTESIA">Cortesía</SelectItem>
          </SelectContent>
        </Select>
        <Select
          items={ESTADO_ITEMS}
          value={filtroEstado}
          onValueChange={(value) => setFiltroEstado(value ?? "todos")}
        >
          <SelectTrigger><SelectValue placeholder="Estado" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todo estado</SelectItem>
            <SelectItem value="EN_PROGRESO">En progreso</SelectItem>
            <SelectItem value="COMPLETADO">Completado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <AdminCard flush>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Estudiante</TableHead>
              <TableHead>Progreso</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Obtenido por</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtrados.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-uva-text-faint">
                  No hay estudiantes inscritos que coincidan.
                </TableCell>
              </TableRow>
            )}
            {filtrados.map((estudiante) => (
              <TableRow key={estudiante.inscripcionId ?? estudiante.usuarioId}>
                <TableCell>
                  <Link href={`/admin/usuarios/${estudiante.usuarioId}`} className="flex items-center gap-2.5">
                    <Avatar size="sm" className="bg-uva-divider">
                      <AvatarFallback className="bg-uva-divider text-xs text-uva-text">
                        {iniciales(estudiante.nombre)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-uva-text">{estudiante.nombre}</span>
                  </Link>
                </TableCell>
                <TableCell className="min-w-[140px]">
                  <div className="flex items-center gap-2">
                    <Progress value={estudiante.progreso} className="w-24" />
                    <span className="font-mono text-xs tabular-nums">{estudiante.progreso}%</span>
                  </div>
                </TableCell>
                <TableCell>
                  <StatusBadge tone={estudiante.estado === "COMPLETADO" ? "success" : "accent"}>
                    {estudiante.estado === "COMPLETADO" ? "Completado" : "En progreso"}
                  </StatusBadge>
                </TableCell>
                <TableCell>
                  <StatusBadge tone={estudiante.tipoAcceso === "CORTESIA" ? "warning" : "neutral"}>
                    {estudiante.tipoAcceso === "CORTESIA" ? "Cortesía" : "Membresía"}
                  </StatusBadge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </AdminCard>
    </div>
  );
}
