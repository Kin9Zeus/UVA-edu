import Link from "next/link";
import { ChevronLeft, CircleCheck, Lock, PlayCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatFecha, formatHoras } from "@/lib/admin/format";
import { esPortadaReal } from "@/lib/media";
import type { CursoPublico } from "@/lib/curso";

const NIVEL_LABEL = { BASICO: "Básico", INTERMEDIO: "Intermedio", AVANZADO: "Avanzado" } as const;

const PORTADA_TRAMA = {
  backgroundColor: "#141417",
  backgroundImage:
    "repeating-linear-gradient(135deg, rgba(250,250,250,.045) 0 2px, transparent 2px 9px)",
};

export function CursoDetalleContent({
  curso,
  basePath = "/catalogo",
  sesionActiva,
}: {
  curso: CursoPublico;
  basePath?: string;
  /**
   * Sin esto el CTA de "sin acceso" no puede distinguir un visitante
   * anónimo de un estudiante registrado sin código canjeado — son dos
   * pasos distintos (iniciar sesión vs. canjear) y hoy no hay pasarela de
   * pago activa (MVP del 12 de septiembre: acceso solo por código de
   * invitación, ver actions/codigos-invitacion/canjear.ts), así que
   * ninguno de los dos estados sin acceso debe mandar a /dashboard/planes.
   */
  sesionActiva: boolean;
}) {
  const primeraLeccionId = curso.modulos.find((modulo) => modulo.lecciones.length > 0)?.lecciones[0]
    ?.id;
  // Si ya hay progreso guardado en alguna clase del curso, el botón retoma
  // ahí en vez de mandar de nuevo a la primera clase (ver Revcurso: "seguir
  // viendo" solo debe aparecer si el estudiante ya empezó).
  const siguiendoProgreso = curso.progresoIniciado && curso.leccionContinuarId !== null;
  const leccionDestinoId = siguiendoProgreso ? curso.leccionContinuarId! : primeraLeccionId;
  // Si ya completó todo el curso no hay "siguiente" a la que volver: se
  // ofrece repasar desde la primera clase en vez de un botón sin destino.
  const cursoCompletado = curso.progresoIniciado && curso.leccionContinuarId === null;

  return (
    <div className="mx-auto grid max-w-[1180px] grid-cols-1 gap-8 px-[clamp(20px,4vw,56px)] py-[clamp(32px,5vw,56px)] lg:grid-cols-[minmax(0,1fr)_340px]">
      {/* `contents` en mobile aplana estos wrappers dentro del grid de arriba,
          para que `order-N` en los bloques internos pueda intercalar portada
          y CTA (columna derecha en desktop) justo después de la presentación,
          en vez de que salgan hasta el final del temario. Los valores de
          order ya quedan en orden ascendente por wrapper (1/5 acá, 2/3/4 en
          el de al lado) para que en desktop —donde el wrapper vuelve a ser
          flex-col real— el order no tenga ningún efecto y el DOM mande. */}
      <div className="contents lg:flex lg:flex-col lg:gap-8">
        <div className="order-1 lg:order-none">
          {/* Vuelve al catálogo general (con su buscador y filtro de
              categoría), no a la subpágina de esta categoría: de ahí es de
              donde normalmente se llega a un curso, y es donde se puede
              seguir explorando por nombre, instructor o cualquier
              categoría. Mismo patrón que CategoriaContent.tsx. */}
          <Link
            href={basePath}
            className="mb-3 inline-flex items-center gap-1 text-[13px] text-uva-text-muted hover:text-uva-text"
          >
            <ChevronLeft className="size-4" strokeWidth={1.9} />
            Catálogo
          </Link>
          <div className="mb-3 flex flex-wrap gap-2">
            {curso.categorias.map((categoria) => (
              <span
                key={categoria.id}
                className="rounded-uva-xs bg-uva-accent-soft px-2.5 py-1 text-xs text-uva-accent-text"
              >
                {categoria.nombre}
              </span>
            ))}
            <span className="rounded-uva-xs bg-[#27272A] px-2.5 py-1 text-xs text-uva-text-muted">
              {NIVEL_LABEL[curso.nivel]}
            </span>
          </div>
          <h1 className="mb-3 text-[clamp(28px,3.4vw,40px)] leading-tight text-uva-text">
            {curso.titulo}
          </h1>
          <p className="max-w-[620px] text-[15px] text-uva-text-muted">{curso.descripcion}</p>

          <div className="mt-6 flex flex-wrap gap-6 rounded-uva-md bg-white/5 px-5 py-4">
            <div>
              <p className="font-heading text-xl text-uva-text">{curso.totalClases}</p>
              <p className="text-[11.5px] text-uva-text-faint">clases</p>
            </div>
            <div>
              <p className="font-heading text-xl text-uva-text">
                {formatHoras(curso.duracionTotalSegundos)}
              </p>
              <p className="text-[11.5px] text-uva-text-faint">contenido</p>
            </div>
            <div>
              <p className="font-heading text-xl text-uva-text">{curso.totalRecursos}</p>
              <p className="text-[11.5px] text-uva-text-faint">recursos descargables</p>
            </div>
            <div className="self-center text-[12.5px] text-uva-text-faint">
              Actualizado el {formatFecha(curso.fechaEdicion)}
            </div>
          </div>
        </div>

        <div className="order-5 lg:order-none">
          <h2 className="mb-3.5 text-base text-uva-text">Temario</h2>
          <div className="flex flex-col gap-4">
            {curso.modulos.map((modulo) => (
              <div key={modulo.id}>
                <div className="mb-2 flex items-center gap-2.5">
                  <p className="text-[13.5px] font-bold text-uva-text">{modulo.titulo}</p>
                  <span className="text-[11.5px] text-uva-text-faint">
                    {modulo.lecciones.length}{" "}
                    {modulo.lecciones.length === 1 ? "clase" : "clases"}
                  </span>
                </div>
                <div className="flex flex-col gap-px overflow-hidden rounded-uva-md bg-white/5">
                  {modulo.lecciones.map((leccion, index) =>
                    curso.tieneAcceso ? (
                      <Link
                        key={leccion.id}
                        href={`/cursos/${curso.id}/${leccion.id}`}
                        className="flex items-center gap-3 px-4 py-3 text-[13.5px] text-uva-text hover:bg-white/5"
                      >
                        <span className="w-4 text-uva-text-faint">{index + 1}</span>
                        {leccion.completado ? (
                          <CircleCheck className="size-4 shrink-0 text-uva-accent-2" strokeWidth={1.8} />
                        ) : (
                          <PlayCircle className="size-4 shrink-0 text-uva-text-faint" strokeWidth={1.8} />
                        )}
                        <span className="min-w-0 flex-1 truncate">{leccion.titulo}</span>
                        <span className="font-mono text-xs text-uva-text-faint tabular-nums">
                          {leccion.duracion ? formatHoras(leccion.duracion) : "—"}
                        </span>
                      </Link>
                    ) : (
                      <div
                        key={leccion.id}
                        className="flex items-center gap-3 px-4 py-3 text-[13.5px] text-uva-text"
                      >
                        <span className="w-4 text-uva-text-faint">{index + 1}</span>
                        {/* El candado sustituye al play, pero el ✓ de lo ya
                            visto se conserva: el progreso no se pierde al
                            vencerse el acceso. */}
                        {leccion.completado ? (
                          <CircleCheck className="size-4 shrink-0 text-uva-accent-2/60" strokeWidth={1.8} />
                        ) : null}
                        <Lock className="size-4 shrink-0 text-uva-text-faint" strokeWidth={1.8} />
                        <span className="min-w-0 flex-1 truncate">{leccion.titulo}</span>
                        <span className="font-mono text-xs text-uva-text-faint tabular-nums">
                          {leccion.duracion ? formatHoras(leccion.duracion) : "—"}
                        </span>
                      </div>
                    ),
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="contents lg:flex lg:flex-col lg:gap-4">
        <div className="order-2 lg:order-none">
          {esPortadaReal(curso.imagenPortada) ? (
            // eslint-disable-next-line @next/next/no-img-element -- imagen de Supabase Storage
            <img
              src={curso.imagenPortada}
              alt=""
              className="aspect-video w-full rounded-uva-md object-cover"
            />
          ) : (
            <div className="aspect-video overflow-hidden rounded-uva-md" style={PORTADA_TRAMA} />
          )}
        </div>

        <div className="order-3 lg:order-none">
          {curso.tieneAcceso ? (
            leccionDestinoId ? (
              <Button
                render={<Link href={`/cursos/${curso.id}/${leccionDestinoId}`} />}
                nativeButton={false}
                variant="uva-primary"
                size="uva"
                className="min-h-12 flex-col gap-0.5 py-2"
              >
                <span>
                  {siguiendoProgreso ? "Seguir viendo" : cursoCompletado ? "Repasar curso" : "Comenzar curso"}
                </span>
                {siguiendoProgreso && curso.leccionContinuarTitulo && (
                  <span className="truncate text-[11.5px] font-normal opacity-80">
                    Clase {curso.leccionContinuarNumero} · {curso.leccionContinuarTitulo}
                  </span>
                )}
              </Button>
            ) : (
              <Button variant="uva-primary" size="uva" className="min-h-12" disabled>
                El curso todavía no tiene clases
              </Button>
            )
          ) : curso.accesoVencido ? (
            // Ya estuvo dentro: se le habla de retomar, no de empezar. El
            // progreso sigue guardado, así que al renovar vuelve a su clase.
            <Button
              render={<Link href="/dashboard/suscripcion" />}
              nativeButton={false}
              variant="uva-primary"
              size="uva"
              className="min-h-12 flex-col gap-0.5 py-2"
            >
              <span>Renueva tu acceso</span>
              <span className="truncate text-[11.5px] font-normal opacity-80">
                {siguiendoProgreso ? "Tu progreso queda guardado" : "Tu periodo de acceso terminó"}
              </span>
            </Button>
          ) : sesionActiva ? (
            <Button
              render={<Link href="/dashboard/suscripcion" />}
              nativeButton={false}
              variant="uva-primary"
              size="uva"
              className="min-h-12"
            >
              Canjea tu código
            </Button>
          ) : (
            <Button
              render={<Link href={`/login?redirect=/cursos/${curso.id}`} />}
              nativeButton={false}
              variant="uva-primary"
              size="uva"
              className="min-h-12"
            >
              Regístrate para canjear tu código
            </Button>
          )}
        </div>

        <div className="order-4 lg:order-none flex flex-col gap-3.5 rounded-uva-md border border-uva-divider bg-uva-surface p-5">
          <div className="flex items-center gap-3">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-[#27272A] font-heading text-[15px] text-uva-text">
              {curso.instructorNombre
                .split(/\s+/)
                .slice(0, 2)
                .map((parte) => parte[0]?.toUpperCase())
                .join("")}
            </div>
            <div className="min-w-0">
              <p className="font-heading text-[15px] text-uva-text">{curso.instructorNombre}</p>
              {curso.instructorEspecialidad && (
                <p className="text-[11.5px] text-uva-text-faint">{curso.instructorEspecialidad}</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
