import type { Metadata } from "next";
import Link from "next/link";
import { Users, BookOpen, FileEdit, GraduationCap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { getDashboardData } from "@/lib/admin/dashboard";
import { tiempoRelativo } from "@/lib/admin/format";

export const metadata: Metadata = {
  title: "U.V.A. Admin — Dashboard",
};

const TONO_PUNTO = {
  accent: "bg-uva-accent",
  success: "bg-uva-valid",
  warning: "bg-uva-warning",
};

export default async function AdminDashboardPage() {
  const { metricas, actividad, cursosPopulares } = await getDashboardData();

  const tarjetas = [
    { label: "Usuarios registrados", valor: metricas.usuariosRegistrados, icon: Users },
    { label: "Cursos publicados", valor: metricas.cursosPublicados, icon: BookOpen },
    { label: "Cursos en borrador", valor: metricas.cursosBorrador, icon: FileEdit },
    { label: "Inscripciones", valor: metricas.inscripciones, icon: GraduationCap },
  ];

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl text-uva-text">Dashboard</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tarjetas.map(({ label, valor, icon: Icon }) => (
          <Card key={label}>
            <CardContent className="flex items-center justify-between">
              <div>
                <p className="text-xs text-uva-text-faint">{label}</p>
                <p className="font-mono text-2xl text-uva-text tabular-nums">{valor}</p>
              </div>
              <div className="flex size-9 items-center justify-center rounded-uva-md bg-uva-accent-soft text-uva-accent-text">
                <Icon className="size-[18px]" strokeWidth={1.9} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Actividad reciente</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {actividad.length === 0 && (
              <p className="text-sm text-uva-text-faint">Todavía no hay actividad registrada.</p>
            )}
            {actividad.map((item) => (
              <div key={item.id} className="flex items-start gap-3">
                <span className={`mt-1.5 size-1.5 shrink-0 rounded-full ${TONO_PUNTO[item.tono]}`} />
                <div className="flex-1">
                  <p className="text-sm text-uva-text-muted">{item.texto}</p>
                  <p className="font-mono text-xs text-uva-text-faint">{tiempoRelativo(item.fecha)}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Cursos más populares</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Curso</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead>Estudiantes</TableHead>
                  <TableHead>% Finalización</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cursosPopulares.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-uva-text-faint">
                      Aún no hay cursos creados.
                    </TableCell>
                  </TableRow>
                )}
                {cursosPopulares.map((curso) => (
                  <TableRow key={curso.id}>
                    <TableCell>
                      <Link href={`/admin/cursos/${curso.id}`} className="text-uva-text hover:text-uva-accent-text">
                        {curso.titulo}
                      </Link>
                    </TableCell>
                    <TableCell className="text-uva-text-muted">{curso.categoria}</TableCell>
                    <TableCell className="font-mono tabular-nums">{curso.estudiantes}</TableCell>
                    <TableCell className="font-mono tabular-nums">{curso.porcentajeFinalizacion}%</TableCell>
                    <TableCell>
                      <StatusBadge tone={curso.mostrado ? "success" : "neutral"}>
                        {curso.mostrado ? "Publicado" : "Borrador"}
                      </StatusBadge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
