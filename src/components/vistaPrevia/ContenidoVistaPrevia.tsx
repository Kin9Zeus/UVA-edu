import Link from "next/link";
import Image from "next/image";
import { PlayCircle } from "lucide-react";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { formatFecha, formatHoras, formatDuracion } from "@/lib/admin/format";
import { esPortadaReal } from "@/lib/media";
import { SIN_INSTRUCTOR } from "@/lib/instructores";
import type { CursoVistaPrevia } from "@/lib/admin/resolverVistaPrevia";

const NIVEL_LABEL = { BASICO: "Básico", INTERMEDIO: "Intermedio", AVANZADO: "Avanzado" } as const;

const PORTADA_TRAMA = {
  backgroundColor: "#141417",
  backgroundImage:
    "repeating-linear-gradient(135deg, rgba(250,250,250,.045) 0 2px, transparent 2px 9px)",
};

/**
 * Ficha del curso con la MISMA maqueta que ve un estudiante con acceso
 * vigente en `/cursos/[slug]` (CursoDetalleContent.tsx) — mismas clases de
 * Tailwind, mismo orden de bloques, misma barra de estadísticas y tarjeta de
 * instructor. Solo cambian tres cosas, todas intencionales:
 *
 *  - Sin candados en el temario: en la vista previa el administrador (o a
 *    quien se le comparta el enlace) siempre puede abrir cualquier clase,
 *    así que las lecciones nunca se muestran bloqueadas.
 *  - El CTA no lleva al reproductor real, sino a la vista previa de la
 *    primera clase (sin video, ver LeccionVistaPreviaContent).
 *  - Badge extra de "Publicado"/"Borrador": no existe en la ficha real
 *    porque un estudiante nunca ve un curso en borrador.
 *
 * El indicador de que esto NO es la app real ya lo pone `BannerVistaPrevia`
 * (barra fija superior) — este componente no repite el aviso.
 */
export function ContenidoVistaPrevia({
  curso,
  token,
}: {
  curso: CursoVistaPrevia;
  token: string;
}) {
  const primeraLeccion = curso.modulos.find((modulo) => modulo.lecciones.length > 0)?.lecciones[0];

  return (
    <div className="mx-auto grid max-w-[1180px] grid-cols-1 gap-8 px-[clamp(20px,4vw,56px)] py-[clamp(32px,5vw,56px)] lg:grid-cols-[minmax(0,1fr)_340px]">
      {/* Mismo truco de `contents`/`order-N` que CursoDetalleContent.tsx: en
          mobile intercala portada y CTA justo después de la presentación en
          vez de dejarlos hasta el final del temario; en desktop el `order`
          no pinta nada y manda el orden del DOM. */}
      <div className="contents lg:flex lg:flex-col lg:gap-8">
        <div className="order-1 lg:order-none">
          <div className="mb-3 flex flex-wrap gap-2">
            <StatusBadge tone={curso.mostrado ? "success" : "warning"}>
              {curso.mostrado ? "Publicado" : "Borrador"}
            </StatusBadge>
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

          {curso.modulos.length === 0 && (
            <p className="text-[13.5px] text-uva-muted-2">
              Este curso todavía no tiene contenido cargado.
            </p>
          )}

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
                {modulo.lecciones.length === 0 ? (
                  <p className="mt-1 text-xs text-uva-text-faint">Módulo sin lecciones.</p>
                ) : (
                  <div className="flex flex-col gap-px overflow-hidden rounded-uva-md bg-white/5">
                    {modulo.lecciones.map((leccion, index) => (
                      <Link
                        key={leccion.id}
                        href={`/vista-previa/${token}/${leccion.id}`}
                        className="flex items-center gap-3 px-4 py-3 text-[13.5px] text-uva-text hover:bg-white/5"
                      >
                        <span className="w-4 text-uva-text-faint">{index + 1}</span>
                        <PlayCircle className="size-4 shrink-0 text-uva-text-faint" strokeWidth={1.8} />
                        <span className="min-w-0 flex-1 truncate">{leccion.titulo}</span>
                        <span className="font-mono text-xs text-uva-text-faint tabular-nums">
                          {formatDuracion(leccion.duracion)}
                        </span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="contents lg:flex lg:flex-col lg:gap-4">
        <div className="order-2 lg:order-none">
          {esPortadaReal(curso.imagenPortada) ? (
            <div className="relative aspect-video w-full overflow-hidden rounded-uva-md">
              <Image
                src={curso.imagenPortada}
                alt=""
                fill
                sizes="(max-width: 1024px) 100vw, 340px"
                className="object-cover"
              />
            </div>
          ) : (
            <div className="aspect-video overflow-hidden rounded-uva-md" style={PORTADA_TRAMA} />
          )}
        </div>

        <div className="order-3 lg:order-none">
          {primeraLeccion ? (
            <Link
              href={`/vista-previa/${token}/${primeraLeccion.id}`}
              className="flex min-h-12 w-full items-center justify-center rounded-uva-md bg-uva-accent px-4 text-[14px] font-semibold text-white no-underline hover:bg-uva-accent-hover"
            >
              Comenzar curso
            </Link>
          ) : (
            <div className="flex min-h-12 w-full items-center justify-center rounded-uva-md bg-uva-accent/40 px-4 text-center text-[14px] font-semibold text-white/70">
              El curso todavía no tiene clases
            </div>
          )}
        </div>

        {/* Un bloque por profesor, mismo patrón visual que la ficha real:
            círculo con iniciales + nombre + especialidad. */}
        <div className="order-4 lg:order-none flex flex-col gap-3.5 rounded-uva-md border border-uva-divider bg-uva-surface p-5">
          {(curso.instructores.length > 0
            ? curso.instructores
            : [{ id: "sin-instructor", nombre: SIN_INSTRUCTOR, especialidad: null, fotoUrl: null }]
          ).map((instructor) => (
            <div key={instructor.id} className="flex items-center gap-3">
              <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#27272A] font-heading text-[15px] text-uva-text">
                {instructor.fotoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- avatar chico servido desde Storage, mismo criterio que AvatarImage (ui/avatar.tsx)
                  <img src={instructor.fotoUrl} alt="" className="size-full object-cover" />
                ) : (
                  instructor.nombre
                    .split(/\s+/)
                    .slice(0, 2)
                    .map((parte) => parte[0]?.toUpperCase())
                    .join("")
                )}
              </div>
              <div className="min-w-0">
                <p className="font-heading text-[15px] text-uva-text">{instructor.nombre}</p>
                {instructor.especialidad && (
                  <p className="text-[11.5px] text-uva-text-faint">{instructor.especialidad}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
