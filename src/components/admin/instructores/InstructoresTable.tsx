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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StatusBadge } from "@/components/admin/StatusBadge";
import type { Instructor } from "@/lib/admin/instructores";

function iniciales(nombre: string) {
  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  return partes.slice(0, 2).map((parte) => parte[0]?.toUpperCase() ?? "").join("") || "I";
}

export function InstructoresTable({ instructores }: { instructores: Instructor[] }) {
  const [seleccionado, setSeleccionado] = useState<Instructor | null>(null);

  return (
    <div className="rounded-uva-md border border-uva-divider bg-uva-surface">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Instructor</TableHead>
            <TableHead>Cursos</TableHead>
            <TableHead>Estudiantes</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {instructores.length === 0 && (
            <TableRow>
              <TableCell colSpan={3} className="text-center text-uva-text-faint">
                Todavía no hay instructores asignados a ningún curso.
              </TableCell>
            </TableRow>
          )}
          {instructores.map((instructor) => (
            <TableRow key={instructor.nombre}>
              <TableCell>
                <button
                  type="button"
                  onClick={() => setSeleccionado(instructor)}
                  className="flex items-center gap-2.5 text-left"
                >
                  <Avatar size="sm" className="bg-uva-divider">
                    <AvatarFallback className="bg-uva-divider text-xs text-uva-text">
                      {iniciales(instructor.nombre)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-uva-text hover:text-uva-accent-text">{instructor.nombre}</span>
                </button>
              </TableCell>
              <TableCell className="font-mono tabular-nums">{instructor.numeroCursos}</TableCell>
              <TableCell className="font-mono tabular-nums">{instructor.numeroEstudiantes}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={seleccionado !== null} onOpenChange={(open) => !open && setSeleccionado(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cursos de {seleccionado?.nombre}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            {seleccionado?.cursos.map((curso) => (
              <Link
                key={curso.id}
                href={`/admin/cursos/${curso.id}`}
                className="flex items-center justify-between rounded-uva-md border border-uva-divider bg-uva-surface-soft px-3.5 py-2.5 text-sm text-uva-text hover:border-uva-accent"
              >
                {curso.titulo}
                <StatusBadge tone={curso.mostrado ? "success" : "neutral"}>
                  {curso.mostrado ? "Publicado" : "Borrador"}
                </StatusBadge>
              </Link>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
