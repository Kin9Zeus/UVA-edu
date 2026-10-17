"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Download, List, Lock } from "lucide-react";
import { LogoUva } from "@/components/home/LogoUva";
import { RichTextRenderer } from "@/components/editor/RichTextRenderer";
import { ComentariosLectura } from "@/components/player/ComentariosLectura";
import { contarComentarios } from "@/components/player/PlayerTabs";
import { TemarioDrawer } from "@/components/player/TemarioDrawer";
import { VideoFrame } from "@/components/player/VideoFrame";
import { extensionArchivo, formatTamanoArchivo } from "@/lib/admin/format";
import type { ComentarioConRespuestas } from "@/lib/comentarios";
import { PRECIOS_HABILITADOS } from "@/lib/features";
import type { LeccionPlayer, RecursoLeccion } from "@/lib/leccion";
import { cn } from "@/lib/utils";

type Pestana = "resumen" | "recursos" | "comentarios";

/** Desde aquí la clase va en dos columnas y los comentarios pasan a la lateral. */
const ESCRITORIO = "(min-width: 1024px)";

const BOTON_PRIMARIO =
  "inline-flex min-h-12 items-center justify-center gap-2.5 rounded-uva-md bg-uva-btn px-5 text-center text-uva-cuerpo font-semibold text-uva-on-accent hover:bg-uva-btn-hover hover:no-underline";
const BOTON_SECUNDARIO =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-uva-md border-[1.5px] border-uva-line-strong px-4 text-center text-uva-detalle font-semibold text-uva-text hover:border-uva-text hover:no-underline";

/**
 * Clase para un visitante sin sesión (`/cursos/[curso]/[clase]`), dirección
 * visual «Maqueta» (artboards "leccion" y "leccion movil" del canvas "UVA
 * Cursos"). Sin sesión solo existe la primera clase de cada curso
 * (`getLeccionPlayer`), así que nunca hay "Anterior".
 *
 * El diseño está hecho con sesión; sin ella cambia esto:
 * - "Progreso" no existe: la tarjeta lateral dice que esta clase es gratis y
 *   lleva a entrar o crear la cuenta.
 * - "Siguiente clase" lleva candado y pasa por iniciar sesión, que vuelve a
 *   esa clase.
 * - Sin pestaña de notas (son privadas de cada cuenta).
 * - Recursos y comentarios se ven, pero descargar y comentar piden entrar.
 *
 * La clase con sesión sigue en `PlayerContent`.
 */
export function LeccionSinSesion({
  data,
  comentarios,
  comentariosNoDisponibles,
}: {
  data: LeccionPlayer;
  comentarios: ComentarioConRespuestas[];
  comentariosNoDisponibles: boolean;
}) {
  const router = useRouter();
  const ruta = `/cursos/${data.cursoSlug}/${data.leccionSlug}`;
  const rutaEntrar = `/login?redirect=${encodeURIComponent(ruta)}`;
  const siguiente = data.siguienteSlug
    ? data.lecciones.find((leccion) => leccion.slug === data.siguienteSlug) ?? null
    : null;
  const rutaSiguiente = siguiente
    ? `/login?redirect=${encodeURIComponent(`/cursos/${data.cursoSlug}/${siguiente.slug}`)}`
    : null;
  const totalComentarios = contarComentarios(comentarios);
  const notaSiguienteId = useId();
  const [temarioAbierto, setTemarioAbierto] = useState(false);
  const abrirTemario = () => setTemarioAbierto(true);
  // Las clases con candado pasan por iniciar sesión y vuelven a esa clase.
  function irALeccion(leccionId: string) {
    setTemarioAbierto(false);
    const leccion = data.lecciones.find((item) => item.id === leccionId);
    if (!leccion?.slug || leccion.id === data.leccionId) return;
    router.push(`/login?redirect=${encodeURIComponent(`/cursos/${data.cursoSlug}/${leccion.slug}`)}`);
  }

  const [pestana, setPestana] = useState<Pestana>("resumen");
  // En escritorio los comentarios viven en la columna lateral y su pestaña no
  // existe: si quedó elegida en celular y la ventana crece, vuelve a Resumen.
  useEffect(() => {
    const consulta = window.matchMedia(ESCRITORIO);
    const ajustar = () => {
      if (consulta.matches) setPestana((actual) => (actual === "comentarios" ? "resumen" : actual));
    };
    ajustar();
    consulta.addEventListener("change", ajustar);
    return () => consulta.removeEventListener("change", ajustar);
  }, []);

  const comentariosProps = {
    comentarios,
    noDisponibles: comentariosNoDisponibles,
    rutaEntrar,
    onReintentar: () => router.refresh(),
  };

  return (
    <div className="flex min-h-dvh flex-col bg-uva-bg">
      <header className="border-b border-uva-divider">
        <div className="mx-auto flex w-full max-w-uva items-center gap-3 px-4 py-2.5 sm:px-6 lg:gap-6 lg:px-8">
          <Link
            href="/"
            aria-label="U.V.A., ir al inicio"
            className="hidden min-h-11 items-center text-uva-text lg:inline-flex"
          >
            <LogoUva className="h-7.5 w-auto" />
          </Link>
          <span aria-hidden className="hidden h-7 w-px bg-uva-divider lg:block" />
          <Link
            href={`/cursos/${data.cursoSlug}`}
            aria-label={`Volver al curso ${data.cursoTitulo}`}
            className="-ml-2 inline-flex min-h-11 min-w-11 items-center gap-1.5 px-2 font-semibold text-uva-text hover:no-underline lg:ml-0 lg:min-w-0 lg:px-0"
          >
            <ChevronLeft className="size-5 shrink-0" strokeWidth={2} aria-hidden />
            <span className="hidden truncate text-uva-cuerpo lg:inline">{data.cursoTitulo}</span>
          </Link>
          <span className="flex-1" />
          <button
            type="button"
            onClick={abrirTemario}
            aria-label={`Temario del curso, clase ${data.numero} de ${data.totalClases}`}
            className={cn(BOTON_SECUNDARIO, "cursor-pointer bg-transparent lg:hidden")}
          >
            <List className="size-4.5 shrink-0" strokeWidth={2} aria-hidden />
            Temario
            <span className="font-mono text-uva-text-muted">
              {data.numero}/{data.totalClases}
            </span>
          </button>
          <Link href={rutaEntrar} className={cn(BOTON_SECUNDARIO, "hidden shrink-0 lg:inline-flex")}>
            Entra o crea tu cuenta
          </Link>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-uva flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_clamp(340px,30vw,440px)]">
        <div className="flex min-w-0 flex-col gap-5 pb-10 lg:gap-6 lg:px-10 lg:pt-7 lg:pb-12">
          <VideoFrame
            leccionId={data.leccionId}
            videoListo={data.videoListo}
            titulo={data.leccionTitulo}
            posterUrl={data.posterUrl}
            className="aspect-video h-auto rounded-none lg:rounded-uva-lg"
          />

          <div className="flex flex-col gap-4 px-4 sm:px-6 lg:flex-row lg:items-end lg:justify-between lg:gap-6 lg:px-0">
            <div className="min-w-0">
              <p className="m-0 font-mono text-uva-detalle text-uva-text-muted">{ubicacionDeLaClase(data)}</p>
              <h1 className="m-0 mt-1.5 text-uva-titulo-3 text-balance text-uva-text lg:text-uva-titulo-4">
                {data.leccionTitulo}
              </h1>
            </div>
            {siguiente && rutaSiguiente && (
              <div className="flex shrink-0 flex-col gap-1.5 lg:items-end">
                <Link
                  href={rutaSiguiente}
                  aria-describedby={notaSiguienteId}
                  className={cn(BOTON_PRIMARIO, "w-full lg:w-auto")}
                >
                  <Lock className="size-4.5 shrink-0" strokeWidth={2} aria-hidden />
                  Siguiente clase
                  <ChevronRight className="size-4.5 shrink-0" strokeWidth={2} aria-hidden />
                </Link>
                <p id={notaSiguienteId} className="m-0 text-center text-uva-detalle text-uva-text-muted lg:text-right">
                  Entra para seguir con la clase {siguiente.numero}.
                </p>
              </div>
            )}
          </div>

          <div className="px-4 sm:px-6 lg:hidden">
            <ClaseGratis data={data} rutaEntrar={rutaEntrar} onTemario={abrirTemario} />
          </div>

          <Pestanas
            pestana={pestana}
            onPestana={setPestana}
            totalRecursos={data.recursos.length}
            totalComentarios={comentariosNoDisponibles ? null : totalComentarios}
          />

          <div className="px-4 sm:px-6 lg:px-0">
            <section
              id="clase-panel-resumen"
              role="tabpanel"
              aria-labelledby="clase-pestana-resumen"
              hidden={pestana !== "resumen"}
            >
              {data.contenido?.content?.length ? (
                <RichTextRenderer contenido={data.contenido} escala="lectura" />
              ) : (
                <p className="m-0 text-uva-cuerpo text-uva-text-muted">
                  El instructor todavía no publicó el resumen de esta clase.
                </p>
              )}
            </section>
            <section
              id="clase-panel-recursos"
              role="tabpanel"
              aria-labelledby="clase-pestana-recursos"
              hidden={pestana !== "recursos"}
            >
              <Recursos recursos={data.recursos} rutaEntrar={rutaEntrar} />
            </section>
            <section
              id="clase-panel-comentarios"
              role="tabpanel"
              aria-labelledby="clase-pestana-comentarios"
              hidden={pestana !== "comentarios"}
              className="lg:hidden"
            >
              <ComentariosLectura {...comentariosProps} />
            </section>
          </div>
        </div>

        <aside
          aria-label="Clase gratis y comentarios"
          className="hidden flex-col gap-5 border-l border-uva-divider px-7 pt-7 pb-12 lg:flex"
        >
          <ClaseGratis data={data} rutaEntrar={rutaEntrar} onTemario={abrirTemario} />
          <section
            aria-labelledby="clase-comentarios-titulo"
            className="flex flex-col gap-3.5 rounded-uva-lg border border-uva-divider bg-uva-surface px-6 pt-5 pb-3"
          >
            <h2 id="clase-comentarios-titulo" className="m-0 flex items-baseline gap-2 text-uva-titulo-4 text-uva-text">
              Comentarios
              {!comentariosNoDisponibles && totalComentarios > 0 && (
                <span className="font-mono text-uva-detalle font-medium text-uva-text-muted">{totalComentarios}</span>
              )}
            </h2>
            <ComentariosLectura {...comentariosProps} />
          </section>
        </aside>
      </div>

      <TemarioDrawer
        abierto={temarioAbierto}
        onCerrar={() => setTemarioAbierto(false)}
        lecciones={data.lecciones}
        leccionActualId={data.leccionId}
        completadas={0}
        total={data.totalClases}
        porcentaje={0}
        onIrALeccion={irALeccion}
        sinSesion={{ nota: `Esta clase es gratis. ${notaDeAcceso(data.totalClases - 1)}` }}
      />
    </div>
  );
}

/** Qué se abre con la cuenta: mismo texto en la tarjeta y en el temario. */
function notaDeAcceso(restantes: number): string {
  const como = PRECIOS_HABILITADOS ? "con tu suscripción" : "con tu código de invitación";
  return restantes === 1
    ? `La otra clase del curso se abre ${como}.`
    : `Las otras ${restantes} clases del curso se abren ${como}.`;
}

/** "Módulo 01, clase 1 de 3": la posición dentro de su módulo, como el diseño. */
function ubicacionDeLaClase(data: LeccionPlayer): string {
  const actual = data.lecciones.find((leccion) => leccion.id === data.leccionId);
  if (!actual) return `Clase ${data.numero} de ${data.totalClases}`;
  const modulos = [...new Set(data.lecciones.map((leccion) => leccion.moduloId))];
  const delModulo = data.lecciones.filter((leccion) => leccion.moduloId === actual.moduloId);
  const modulo = String(modulos.indexOf(actual.moduloId) + 1).padStart(2, "0");
  return `Módulo ${modulo}, clase ${delModulo.indexOf(actual) + 1} de ${delModulo.length}`;
}

/** Ocupa el lugar de "Progreso" del diseño: sin cuenta no hay avance. */
function ClaseGratis({
  data,
  rutaEntrar,
  onTemario,
}: {
  data: LeccionPlayer;
  rutaEntrar: string;
  onTemario: () => void;
}) {
  const tituloId = useId();
  const restantes = data.totalClases - 1;
  const mensaje = notaDeAcceso(restantes);
  const siguiente = data.siguienteSlug
    ? data.lecciones.find((leccion) => leccion.slug === data.siguienteSlug) ?? null
    : null;

  return (
    <section
      aria-labelledby={tituloId}
      className="rounded-uva-lg border border-uva-divider bg-uva-surface p-4.5 lg:px-6 lg:py-5.5"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 id={tituloId} className="m-0 text-uva-titulo-4 text-uva-text">
          Clase gratis
        </h2>
        <button
          type="button"
          onClick={onTemario}
          className={cn(BOTON_SECUNDARIO, "hidden shrink-0 cursor-pointer bg-transparent lg:inline-flex")}
        >
          <List className="size-4.5 shrink-0" strokeWidth={2} aria-hidden />
          Temario
        </button>
      </div>
      {restantes > 0 && <p className="m-0 mt-2 text-uva-detalle text-uva-text-muted">{mensaje}</p>}
      <Link href={rutaEntrar} className={cn(BOTON_PRIMARIO, "mt-4 w-full")}>
        Entra o crea tu cuenta
      </Link>
      {siguiente && (
        <p className="m-0 mt-3.5 text-uva-detalle text-uva-text-muted">
          <Lock className="mr-1.5 inline size-4 align-[-0.15em]" strokeWidth={2} aria-hidden />
          Sigue:{" "}
          <Link
            href={`/login?redirect=${encodeURIComponent(`/cursos/${data.cursoSlug}/${siguiente.slug}`)}`}
            className="font-semibold text-uva-text underline-offset-4 hover:underline"
          >
            {siguiente.titulo}
            <span className="sr-only">, pide entrar a tu cuenta</span>
          </Link>
        </p>
      )}
    </section>
  );
}

/**
 * Pestañas de la clase (patrón de pestañas WAI-ARIA: flechas, Inicio y Fin).
 * "Comentarios" solo existe en celular; en escritorio van en la lateral. Las
 * flechas saltan las pestañas ocultas por CSS.
 */
function Pestanas({
  pestana,
  onPestana,
  totalRecursos,
  totalComentarios,
}: {
  pestana: Pestana;
  onPestana: (pestana: Pestana) => void;
  totalRecursos: number;
  /** null: no se pudieron leer, no se muestra un 0 engañoso. */
  totalComentarios: number | null;
}) {
  const listaRef = useRef<HTMLDivElement>(null);
  const pestanas: { id: Pestana; etiqueta: string; total: number | null; soloCelular?: boolean }[] = [
    { id: "resumen", etiqueta: "Resumen", total: null },
    { id: "recursos", etiqueta: "Recursos", total: totalRecursos },
    { id: "comentarios", etiqueta: "Comentarios", total: totalComentarios, soloCelular: true },
  ];

  function alTeclear(evento: KeyboardEvent<HTMLDivElement>) {
    const visibles = [...(listaRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]') ?? [])].filter(
      (boton) => boton.offsetParent !== null,
    );
    const actual = visibles.findIndex((boton) => boton === document.activeElement);
    if (actual === -1) return;
    const destino = {
      ArrowRight: (actual + 1) % visibles.length,
      ArrowLeft: (actual - 1 + visibles.length) % visibles.length,
      Home: 0,
      End: visibles.length - 1,
    }[evento.key];
    if (destino === undefined) return;
    evento.preventDefault();
    visibles[destino].focus();
    onPestana(visibles[destino].dataset.pestana as Pestana);
  }

  return (
    <div
      ref={listaRef}
      role="tablist"
      aria-label="Secciones de la clase"
      onKeyDown={alTeclear}
      // La raya de abajo es una sombra interior y no un borde: así la fila
      // puede desplazarse sola (cifras muy largas a 320 px) sin cortar el
      // subrayado de la pestaña elegida ni empujar la página de lado.
      className="mx-4 flex justify-between gap-2 overflow-x-auto shadow-[inset_0_-1px_0_var(--color-uva-divider)] [scrollbar-width:none] sm:mx-6 sm:justify-start sm:gap-7 lg:mx-0 [&::-webkit-scrollbar]:hidden"
    >
      {pestanas.map(({ id, etiqueta, total, soloCelular }) => {
        const elegida = pestana === id;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            id={`clase-pestana-${id}`}
            data-pestana={id}
            aria-selected={elegida}
            aria-controls={`clase-panel-${id}`}
            tabIndex={elegida ? 0 : -1}
            onClick={() => onPestana(id)}
            className={cn(
              "flex min-h-12 shrink-0 cursor-pointer items-center border-0 border-b-[2.5px] bg-transparent px-0.5 text-uva-cuerpo whitespace-nowrap",
              elegida
                ? "border-uva-btn font-bold text-uva-text"
                : "border-transparent font-medium text-uva-text-muted hover:text-uva-text",
              soloCelular && "lg:hidden",
            )}
          >
            {/* Etiqueta y cifra en su propia fila de línea base: con el
                centrado del botón, la cifra (letra más chica) quedaba alzada. */}
            <span className="inline-flex items-baseline gap-1.5">
              {etiqueta}
              {total !== null && total > 0 && (
                <span className="font-mono text-uva-detalle font-medium text-uva-text-muted">{total}</span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** Material de la clase: se ve la lista, pero descargar pide entrar. */
function Recursos({ recursos, rutaEntrar }: { recursos: RecursoLeccion[]; rutaEntrar: string }) {
  if (recursos.length === 0) {
    return (
      <p className="m-0 text-uva-cuerpo text-uva-text-muted">Esta clase todavía no tiene material para descargar.</p>
    );
  }

  return (
    <div className="flex flex-col gap-3.5">
      <p className="m-0 text-uva-detalle text-uva-text-muted">
        Material que el instructor dejó para esta clase. Para descargarlo, entra a tu cuenta.
      </p>
      <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
        {recursos.map((recurso) => {
          const extension = extensionArchivo(recurso.nombre);
          const tamano = formatTamanoArchivo(recurso.tamanoBytes);
          return (
            <li
              key={recurso.id}
              className="flex items-center gap-3 rounded-uva-md border border-uva-divider bg-uva-surface p-3"
            >
              <span
                aria-hidden
                className={cn(
                  "grid h-10.5 min-w-10.5 shrink-0 place-items-center rounded-uva-sm px-1 font-mono text-uva-detalle font-extrabold",
                  colorDeArchivo(extension),
                )}
              >
                {extension.slice(0, 4)}
              </span>
              <span className="min-w-0 flex-1">
                <b className="block truncate text-uva-detalle font-bold text-uva-text">{recurso.nombre}</b>
                {tamano && <small className="block text-uva-detalle text-uva-text-muted">{tamano}</small>}
              </span>
              <Link
                href={rutaEntrar}
                aria-label={`Entra para descargar ${recurso.nombre}`}
                className="grid size-11 shrink-0 place-items-center rounded-uva-md border-[1.5px] border-uva-line-strong text-uva-text hover:border-uva-text"
              >
                <Download className="size-5" strokeWidth={2} aria-hidden />
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Hojas de cálculo en amarillo y PDF en magenta, con el contraste de cada tema. */
function colorDeArchivo(extension: string): string {
  if (["XLS", "XLSX", "CSV", "ODS"].includes(extension)) return "bg-uva-success-soft text-uva-success-text";
  if (extension === "PDF") return "bg-uva-danger-soft text-uva-danger-text";
  return "bg-uva-chip text-uva-text";
}
