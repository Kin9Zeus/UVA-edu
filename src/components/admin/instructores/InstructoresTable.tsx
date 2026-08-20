"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AdminCard } from "@/components/admin/AdminCard";
import { StatusBadge } from "@/components/admin/StatusBadge";
import {
  InstructorFormDialog,
  type InstructorEditable,
} from "@/components/admin/instructores/InstructorFormDialog";
import type { Instructor } from "@/lib/admin/instructores";

function iniciales(nombre: string) {
  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  return partes.slice(0, 2).map((parte) => parte[0]?.toUpperCase() ?? "").join("") || "I";
}

export function InstructoresTable({ instructores }: { instructores: Instructor[] }) {
  const [verCursosDe, setVerCursosDe] = useState<Instructor | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editando, setEditando] = useState<InstructorEditable | null>(null);

  function abrirCrear() {
    setEditando(null);
    setFormOpen(true);
  }

  function abrirEditar(instructor: Instructor) {
    setEditando({
      id: instructor.id,
      nombre: instructor.nombre,
      especialidad: instructor.especialidad,
    });
    setFormOpen(true);
  }

  return (
    <div className="flex flex-col gap-[18px]">
      <div className="flex justify-end">
        <Button type="button" variant="primary" onClick={abrirCrear}>
          + Nuevo instructor
        </Button>
      </div>

      <AdminCard flush>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead />
              <TableHead>Nombre</TableHead>
              <TableHead>Especialidad</TableHead>
              <TableHead>Cursos</TableHead>
              <TableHead>Estudiantes</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {instructores.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-uva-muted-2">
                  Todavía no hay instructores. Crea el primero para poder asignarlo a un curso.
                </TableCell>
              </TableRow>
            )}
            {instructores.map((instructor) => (
              <TableRow key={instructor.id}>
                <TableCell className="w-px pr-0">
                  <Avatar className="size-[30px] bg-uva-divider after:hidden">
                    <AvatarFallback className="bg-uva-divider font-heading text-[11px] font-bold text-uva-muted">
                      {iniciales(instructor.nombre)}
                    </AvatarFallback>
                  </Avatar>
                </TableCell>
                <TableCell>
                  <button
                    type="button"
                    onClick={() => setVerCursosDe(instructor)}
                    className="text-left font-semibold text-uva-text hover:text-uva-accent-text"
                  >
                    {instructor.nombre}
                  </button>
                </TableCell>
                <TableCell className="text-uva-muted">
                  {instructor.especialidad ?? "—"}
                </TableCell>
                <TableCell className="font-mono tabular-nums">{instructor.numeroCursos}</TableCell>
                <TableCell className="font-mono tabular-nums">
                  {instructor.numeroEstudiantes}
                </TableCell>
                <TableCell className="text-right">
                  <Button type="button" size="sm" onClick={() => abrirEditar(instructor)}>
                    Editar
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </AdminCard>

      <InstructorFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        instructor={editando}
      />

      <Dialog
        open={verCursosDe !== null}
        onOpenChange={(open) => !open && setVerCursosDe(null)}
      >
        <DialogContent className="w-[440px]">
          <DialogHeader>
            <DialogTitle>Cursos de {verCursosDe?.nombre}</DialogTitle>
          </DialogHeader>
          <div className="flex max-h-[300px] flex-col gap-1.5 overflow-auto">
            {verCursosDe?.cursos.length === 0 && (
              <p className="text-[13.5px] text-uva-muted-2">
                Este instructor todavía no tiene cursos asignados.
              </p>
            )}
            {verCursosDe?.cursos.map((curso) => (
              <Link
                key={curso.id}
                href={`/admin/cursos/${curso.id}`}
                className="flex items-center justify-between rounded-uva-md bg-uva-surface-2 px-3 py-2.5 text-[13px] font-semibold text-uva-text hover:text-uva-accent-text"
              >
                {curso.titulo}
                <StatusBadge tone={curso.mostrado ? "success" : "neutral"}>
                  {curso.mostrado ? "Publicado" : "Borrador"}
                </StatusBadge>
              </Link>
            ))}
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setVerCursosDe(null)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
