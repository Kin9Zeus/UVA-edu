import Link from "next/link";
import { BITACORA_POR_TANDA, BITACORA_VENTANA, diaEnColombia, sumarDias, type EntradaBitacora } from "@/lib/admin/bitacora";
import { COLOR_TIPO, TIPOS_BITACORA, accionEnFrase } from "@/lib/admin/bitacora-tipos";

/** Etiqueta y pantalla del panel de cada entidad, cuando tiene una propia. */
const ENTIDAD_INFO: Record<string, { etiqueta: string; ruta?: (id: string) => string }> = {
  perfiles: { etiqueta: "Usuario", ruta: (id) => `/admin/usuarios/${id}` },
  suscripciones: { etiqueta: "Membresía", ruta: (id) => `/admin/usuarios/${id}` },
  inscripciones: { etiqueta: "Cortesía", ruta: (id) => `/admin/usuarios/${id}` },
  intentos_examen: { etiqueta: "Intento de examen", ruta: (id) => `/admin/usuarios/${id}` },
  // Módulos, lecciones y exámenes no tienen pantalla propia: se editan dentro
  // del curso, y su `idEntidadAfectada` es el del CURSO (ver actions/admin).
  cursos: { etiqueta: "Curso", ruta: (id) => `/admin/cursos/${id}` },
  modulos: { etiqueta: "Curso", ruta: (id) => `/admin/cursos/${id}` },
  lecciones: { etiqueta: "Curso", ruta: (id) => `/admin/cursos/${id}` },
  examenes: { etiqueta: "Curso", ruta: (id) => `/admin/cursos/${id}` },
  categorias: { etiqueta: "Categorías", ruta: () => "/admin/categorias" },
  codigos_invitacion: { etiqueta: "Códigos de invitación", ruta: () => "/admin/codigos" },
  lotes_codigos_invitacion: { etiqueta: "Códigos de invitación", ruta: () => "/admin/codigos" },
  cupones: { etiqueta: "Cupones", ruta: () => "/admin/cupones" },
  planes: { etiqueta: "Planes", ruta: () => "/admin/planes" },
  // El admin entra a Comunidad por rol (084_comunidad_gate_sin_requisito_temporal.sql).
  comunidad_posts: { etiqueta: "Comunidad", ruta: (id) => `/dashboard/comunidad/${id}` },
  // Solo filas HISTÓRICAS: `instructores` dejó de ser tabla; la bitácora no se reescribe.
  instructores: { etiqueta: "Instructor" },
};

const NOMBRE_TIPO = Object.fromEntries(TIPOS_BITACORA.map((t) => [t.clave, t.nombre]));

/**
 * A dónde lleva la fila, o nada. Una publicación eliminada responde 404
 * (borrado lógico), así que esa fila no enlaza: mandaría a una página muerta.
 */
function rutaDe(entrada: EntradaBitacora): string | undefined {
  if (entrada.accion === "Eliminó una publicación de Comunidad (moderación)") return undefined;
  const info = ENTIDAD_INFO[entrada.entidadAfectada];
  if (!info?.ruta) return undefined;
  const id = entrada.slugEntidad ?? entrada.idEntidadAfectada;
  return id ? info.ruta(id) : undefined;
}

const horaColombia = new Intl.DateTimeFormat("es-CO", { timeZone: "America/Bogota", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const nombreDelDia = new Intl.DateTimeFormat("es-CO", { timeZone: "UTC", weekday: "long", day: "numeric", month: "short" });

function tituloDia(dia: string, hoy: string): string {
  if (dia === hoy) return "Hoy";
  if (dia === sumarDias(hoy, -1)) return "Ayer";
  // "viernes, 23 oct." → "Viernes 23 oct"
  const texto = nombreDelDia.format(new Date(`${dia}T12:00:00Z`)).replace(",", "").replace(".", "");
  return texto.charAt(0).toLocaleUpperCase("es") + texto.slice(1);
}

function iniciales(nombre: string) {
  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  return partes.slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("") || "A";
}

export function LineaTiempoBitacora({
  entradas,
  total,
  truncada,
  mostrar,
  hayFiltros,
  parametros,
}: {
  entradas: EntradaBitacora[];
  total: number;
  truncada: boolean;
  mostrar: number;
  hayFiltros: boolean;
  /** Query string actual, para que "Cargar más" conserve los filtros. */
  parametros: string;
}) {
  if (entradas.length === 0) {
    return (
      <div className="rounded-uva-lg border border-dashed border-uva-divider px-5 py-10 text-center">
        <p className="text-uva-cuerpo font-bold text-uva-text">
          {hayFiltros ? "Ninguna acción con estos filtros" : "Todavía no hay acciones registradas"}
        </p>
        <p className="mt-1 text-uva-detalle text-uva-text-muted">
          {hayFiltros
            ? "Prueba con otro tipo, otro administrador o un rango de fechas más amplio."
            : "Cada vez que alguien del equipo cambie algo en el panel, quedará aquí."}
        </p>
        {hayFiltros && (
          <Link href="/admin/bitacora" className="mt-3 inline-flex min-h-11 items-center text-uva-detalle font-bold text-uva-accent-ink">
            Limpiar filtros
          </Link>
        )}
      </div>
    );
  }

  const hoy = diaEnColombia(new Date());
  const porDia = new Map<string, EntradaBitacora[]>();
  for (const entrada of entradas) porDia.set(entrada.dia, [...(porDia.get(entrada.dia) ?? []), entrada]);

  const params = new URLSearchParams(parametros);
  params.set("mostrar", String(mostrar + BITACORA_POR_TANDA));

  return (
    <div className="flex flex-col gap-6">
      {truncada && (
        <p className="rounded-uva-md bg-uva-warning-soft px-3.5 py-2.5 text-uva-detalle text-uva-badge-warn-fg">
          Este rango tiene más de {BITACORA_VENTANA.toLocaleString("es-CO")} acciones: se muestran las más recientes. Acota las fechas para ver las anteriores.
        </p>
      )}
      {[...porDia.entries()].map(([dia, lista]) => (
        <section key={dia} aria-labelledby={`dia-${dia}`}>
          <h3 id={`dia-${dia}`} className="mb-1 flex justify-between text-uva-detalle font-extrabold text-uva-text-muted">
            {tituloDia(dia, hoy)}
          </h3>
          <ol>
            {lista.map((entrada) => {
              const ruta = rutaDe(entrada);
              const hora = horaColombia.format(new Date(entrada.creadoEn));
              const etiquetaSujeto = entrada.sujeto ?? (ruta ? ENTIDAD_INFO[entrada.entidadAfectada]?.etiqueta : null);
              return (
                <li key={entrada.id} className="grid grid-cols-[2.25rem_minmax(0,1fr)] gap-x-3.5 border-t border-uva-divider py-3.5 sm:grid-cols-[3.25rem_2.25rem_minmax(0,1fr)]">
                  <time dateTime={entrada.creadoEn} className="pt-1.5 font-mono text-uva-detalle text-uva-text-muted max-sm:hidden">
                    {hora}
                  </time>
                  <span aria-hidden className="grid size-9 place-items-center rounded-full bg-uva-surface-2 text-uva-etiqueta font-bold text-uva-text">
                    {iniciales(entrada.adminNombre)}
                  </span>
                  <div className="min-w-0">
                    <time dateTime={entrada.creadoEn} className="block font-mono text-uva-etiqueta text-uva-text-muted sm:hidden">
                      {hora}
                    </time>
                    <p className="text-uva-cuerpo text-uva-text sm:pt-1">
                      <span className="font-bold">{entrada.adminNombre}</span> {accionEnFrase(entrada.accion)}
                      {etiquetaSujeto && (
                        <>
                          {" "}
                          {ruta ? (
                            <Link href={ruta} className="font-bold text-uva-accent-ink">
                              {etiquetaSujeto} <span aria-hidden>→</span>
                            </Link>
                          ) : (
                            <span className="font-bold">{etiquetaSujeto}</span>
                          )}
                        </>
                      )}
                    </p>
                    {entrada.detalles && <p className="mt-0.5 text-uva-detalle break-words text-uva-text-muted">{entrada.detalles}</p>}
                    <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-uva-etiqueta text-uva-text-muted">
                      <span className="inline-flex items-center gap-1.5">
                        <span aria-hidden className="size-2 rounded-uva-xs" style={{ background: COLOR_TIPO[entrada.tipo] }} />
                        {NOMBRE_TIPO[entrada.tipo]}
                      </span>
                      {entrada.sensible && (
                        <span className="inline-flex items-center gap-1.5 font-bold text-uva-error-text">
                          <span aria-hidden className="size-2 rounded-full bg-uva-error" />
                          Sensible
                        </span>
                      )}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      ))}
      {total > entradas.length ? (
        <Link
          href={`/admin/bitacora?${params.toString()}`}
          scroll={false}
          className="inline-flex min-h-11 items-center justify-center self-center rounded-uva-md border border-uva-line-strong px-4 text-uva-detalle font-semibold text-uva-text hover:bg-uva-hover md:pointer-fine:min-h-9"
        >
          Cargar más ({total - entradas.length} {total - entradas.length === 1 ? "restante" : "restantes"})
        </Link>
      ) : (
        <p className="text-center text-uva-detalle text-uva-text-muted">
          {hayFiltros ? `Son todas las acciones con estos filtros (${total}).` : `Son todas las acciones (${total}).`}
        </p>
      )}
    </div>
  );
}
