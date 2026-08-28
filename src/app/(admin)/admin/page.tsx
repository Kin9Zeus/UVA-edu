import type { Metadata } from "next";
import Link from "next/link";
import { Users, BookOpen, FileEdit, GraduationCap } from "lucide-react";
import { AdminCard } from "@/components/admin/AdminCard";
import { MetricaCard } from "@/components/admin/MetricaCard";
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

/* Puntos de "Actividad reciente": el mockup usa magenta, el amarillo de marca
   (#F2C012) y el verde menta del badge de exito (#6EE7B7). */

export default async function AdminDashboardPage() {
  const { metricas, actividad, cursosPopulares } = await getDashboardData();

  const tarjetas = [
    {
      label: "Usuarios registrados",
      valor: metricas.usuariosRegistrados,
      icon: Users,
    },
    {
      label: "Cursos publicados",
      valor: metricas.cursosPublicados,
      icon: BookOpen,
    },
    {
      label: "Cursos en borrador",
      valor: metricas.cursosBorrador,
      icon: FileEdit,
    },
    {
      label: "Inscripciones",
      valor: metricas.inscripciones,
      icon: GraduationCap,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <p className="-mt-3.5 text-sm text-uva-muted">
        Resumen general de la plataforma.
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* El mockup solo pinta etiqueta y valor; el icono es un añadido del
            panel, así que va como acento en la esquina para no romper esa
            lectura de arriba abajo. El markup vive en MetricaCard para que
            esta pantalla y /admin/usuarios se lean igual. */}
        {tarjetas.map(({ label, valor, icon }) => (
          <MetricaCard key={label} label={label} valor={valor} icon={icon} />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
        <AdminCard>
          <h2 className="font-heading text-[15px] font-bold tracking-[-0.02em] text-uva-text">
            Actividad reciente
          </h2>
          <div className="flex flex-col gap-3.5">
            {actividad.length === 0 && (
              <p className="text-sm text-uva-muted-2">
                Todavía no hay actividad registrada.
              </p>
            )}
            {actividad.map((item) => (
              <div key={item.id} className="flex items-start gap-3">
                <div className="flex-1">
                  <p className="text-sm text-uva-text-muted">{item.texto}</p>
                  <p className="font-mono text-xs text-uva-text-faint">
                    {tiempoRelativo(item.fecha)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </AdminCard>

        {/* `.card` con `padding:0`: el título lleva su propio padding y la
            tabla va a sangre, como en el mockup. */}
        <AdminCard flush className="gap-3">
          <div className="px-5 pt-[18px]">
            <h2 className="font-heading text-[15px] font-bold tracking-[-0.02em] text-uva-text">
              Cursos más populares
            </h2>
          </div>
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
                  <TableCell
                    colSpan={5}
                    className="text-center text-uva-muted-2"
                  >
                    Aún no hay cursos creados.
                  </TableCell>
                </TableRow>
              )}
              {cursosPopulares.map((curso) => (
                <TableRow key={curso.id}>
                  <TableCell>
                    <Link
                      href={`/admin/cursos/${curso.id}`}
                      className="text-uva-text hover:text-uva-accent-text"
                    >
                      {curso.titulo}
                    </Link>
                  </TableCell>
                  <TableCell className="text-uva-muted">
                    {curso.categoria}
                  </TableCell>
                  <TableCell className="font-mono tabular-nums">
                    {curso.estudiantes}
                  </TableCell>
                  <TableCell className="font-mono tabular-nums">
                    {curso.porcentajeFinalizacion}%
                  </TableCell>
                  <TableCell>
                    <StatusBadge tone={curso.mostrado ? "success" : "neutral"}>
                      {curso.mostrado ? "Publicado" : "Borrador"}
                    </StatusBadge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </AdminCard>
      </div>
    </div>
  );
}
