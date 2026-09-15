import type { Metadata } from "next";
import Link from "next/link";
import { Users, BookOpen, UserCheck, Gift } from "lucide-react";
import { cn } from "@/lib/utils";
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
import { getDashboardData, type ActividadItem } from "@/lib/admin/dashboard";
import { tiempoRelativo } from "@/lib/admin/format";

export const metadata: Metadata = {
  title: "U.V.A. Admin — Dashboard",
};

/**
 * Punto de color de "Actividad reciente". Son los tres tonos del mockup —
 * magenta, ámbar y verde menta— tomados de los tokens de insignia en vez de
 * los hex sueltos, para que no se separen del resto del panel si la paleta
 * cambia.
 *
 * `dashboard.ts` venía calculando este `tono` para cada ítem desde siempre,
 * pero nadie lo leía y el punto no se pintaba: quedaba el dato muerto y un
 * envoltorio `flex gap-3` con un único hijo, que es lo mismo que no tener
 * envoltorio. O se pintaba o se borraban las dos cosas.
 */
const COLOR_PUNTO: Record<ActividadItem["tono"], string> = {
  accent: "bg-uva-accent",
  success: "bg-uva-badge-success-fg",
  warning: "bg-uva-badge-warn-fg",
};

export default async function AdminDashboardPage() {
  const { metricas, actividad, cursosPopulares } = await getDashboardData();

  /**
   * Cuatro cifras, cada una con la línea que la hace interpretable — el mismo
   * criterio que /admin/usuarios, que ya usaba `detalle` en las suyas
   * mientras esta pantalla mostraba números desnudos.
   *
   * Publicados y borradores eran dos tarjetas para decir una sola cosa
   * ("cuántos cursos hay, y cuántos faltan por publicar"). Unidas liberan la
   * ranura que ocupa ahora el acceso vigente, que es lo que el dashboard no
   * decía por ninguna parte: cuánta gente está adentro y cuánta de esa está
   * pagando.
   *
   * Solo la primera va en magenta. Las cuatro en `accent` era el
   * comportamiento por defecto de MetricaCard, y cuatro acentos idénticos en
   * fila no jerarquizan nada — además de gastar en un conteo el color que
   * CLAUDE.md §3.3 reserva para CTAs, estados activos y progreso.
   */
  const tarjetas = [
    {
      label: "Usuarios registrados",
      valor: metricas.usuariosRegistrados,
      detalle: `${metricas.usuariosActivos7d} vieron contenido esta semana`,
      icon: Users,
      tono: "accent" as const,
      href: "/admin/usuarios",
    },
    {
      label: "Con acceso vigente",
      valor: metricas.conAcceso,
      detalle: `${metricas.accesoDePago} de pago · ${metricas.accesoSinCobro} sin cobro`,
      icon: UserCheck,
      tono: "neutral" as const,
      href: "/admin/usuarios",
    },
    {
      label: "Cursos",
      valor: metricas.cursosTotal,
      detalle: `${metricas.cursosPublicados} publicados · ${metricas.cursosBorrador} en borrador`,
      icon: BookOpen,
      tono: "neutral" as const,
      href: "/admin/cursos",
    },
    {
      // Antes decía "Inscripciones", que se leía como "cuánta gente se
      // apuntó a cursos". No es lo que mide: un estudiante con suscripción
      // NUNCA deja fila en `inscripciones` —su acceso se valida en caliente
      // contra `suscripciones`—, así que la tabla solo guarda las cortesías
      // de curso suelto que otorga un admin. Sin salida propia en el panel:
      // se otorgan y se revocan desde la ficha de cada usuario.
      label: "Cortesías activas",
      valor: metricas.cortesiasActivas,
      detalle: "cursos sueltos otorgados por un admin",
      icon: Gift,
      tono: "neutral" as const,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <p className="-mt-3.5 text-sm text-uva-muted">
        Resumen general de la plataforma.
      </p>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {/* El mockup solo pinta etiqueta y valor; el icono es un añadido del
            panel, así que va como acento en la esquina para no romper esa
            lectura de arriba abajo. El markup vive en MetricaCard para que
            esta pantalla y /admin/usuarios se lean igual. */}
        {tarjetas.map((tarjeta) => (
          <MetricaCard key={tarjeta.label} {...tarjeta} />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
        {/* Por debajo de `lg` las tarjetas apilan en 1 columna: el orden
            visual se controla con `order`, no reordenando el JSX, así que
            desde `lg` (donde vuelven a ir lado a lado) recupera su lugar
            original a la izquierda. */}
        <AdminCard className="order-2 lg:order-1">
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
                <span
                  aria-hidden
                  className={cn("mt-1.5 size-2 shrink-0 rounded-full", COLOR_PUNTO[item.tono])}
                />
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
        <AdminCard flush className="order-1 gap-3 lg:order-2">
          <div className="px-5 pt-[18px]">
            <h2 className="font-heading text-[15px] font-bold tracking-[-0.02em] text-uva-text">
              Cursos más populares
            </h2>
          </div>
          {cursosPopulares.length === 0 && (
            <p className="px-5 pb-[18px] text-sm text-uva-muted-2">
              Aún no hay cursos creados.
            </p>
          )}

          {/* Las 5 columnas de la tabla no caben sin scroll horizontal dentro
              de una tarjeta ya vertical — la peor clase de interacción
              táctil, porque nada avisa que hay más a la derecha. Por eso el
              corte no es solo de ancho (`md`): un iPad Pro ya cruza esa
              medida en `portrait` y sigue siendo dedo, no mouse, así que
              `pointer-fine:` exige además un puntero preciso antes de
              mostrar la tabla — un teléfono o tablet táctil ve la lista
              apilada sin importar cuán ancha esté la pantalla. */}
          {cursosPopulares.length > 0 && (
            <div className="flex flex-col pointer-fine:md:hidden">
              {cursosPopulares.map((curso) => (
                <div
                  key={curso.id}
                  className="flex flex-col gap-1.5 border-b border-uva-divider px-5 py-3.5 last:border-b-0"
                >
                  <div className="flex items-start justify-between gap-3">
                    <Link
                      href={`/admin/cursos/${curso.slug}`}
                      className="text-sm font-medium text-uva-text hover:text-uva-accent-text"
                    >
                      {curso.titulo}
                    </Link>
                    <StatusBadge tone={curso.mostrado ? "success" : "neutral"} className="shrink-0">
                      {curso.mostrado ? "Publicado" : "Borrador"}
                    </StatusBadge>
                  </div>
                  <p className="text-xs text-uva-muted">{curso.categoria}</p>
                  <div className="flex items-center gap-2 font-mono text-xs text-uva-muted-2 tabular-nums">
                    <span>{curso.estudiantes} estudiantes</span>
                    <span aria-hidden>·</span>
                    <span>{curso.porcentajeFinalizacion}% completado</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {cursosPopulares.length > 0 && (
            <Table className="hidden pointer-fine:md:table">
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
                {cursosPopulares.map((curso) => (
                  <TableRow key={curso.id}>
                    <TableCell>
                      <Link
                        href={`/admin/cursos/${curso.slug}`}
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
          )}
        </AdminCard>
      </div>
    </div>
  );
}
