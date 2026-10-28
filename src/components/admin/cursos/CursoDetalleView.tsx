"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, CircleAlert } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { InfoTab } from "@/components/admin/cursos/InfoTab";
import { ContenidoTab } from "@/components/admin/cursos/ContenidoTab";
import { ExamenTab } from "@/components/admin/cursos/ExamenTab";
import { EstudiantesTab } from "@/components/admin/cursos/EstudiantesTab";
import { textoDespublicar } from "@/components/admin/cursos/CursosTable";
import { useAdminToast } from "@/components/admin/Toast";
import {
  actualizarInfoCurso,
  actualizarConfiguracionCurso,
  alternarPublicacionCurso,
  type NivelCurso,
} from "@/actions/admin/cursos";
import { esPortadaReal } from "@/lib/media";
import { motivosParaNoPublicar } from "@/lib/admin/publicacion";
import { useAvisoNavegacionSinGuardar } from "@/lib/admin/useAvisoNavegacionSinGuardar";
import type { CursoDetalle } from "@/lib/admin/cursoDetalle";
import type { ExamenDetalle } from "@/lib/admin/examenDetalle";

const NIVEL_LABEL = { BASICO: "Básico", INTERMEDIO: "Intermedio", AVANZADO: "Avanzado" } as const;

export type PestanaCurso = "informacion" | "contenido" | "examen" | "estudiantes";

/**
 * Ficha del curso. Publicar va en la cabecera y actúa al instante, igual que
 * el interruptor de la lista. Lo demás de Información (con lo que antes era
 * la pestaña Configuración) se guarda con la barra que aparece al cambiar
 * algo; por eso el estado de ese formulario vive acá y no en la pestaña.
 */
export function CursoDetalleView({
  curso,
  categorias,
  instructores,
  examen,
  pestanaInicial,
}: {
  curso: CursoDetalle;
  categorias: { id: string; nombre: string; activo?: boolean }[];
  /** Cuentas con rol PROFESOR disponibles para asignar (getPerfilesProfesor). */
  instructores: { id: string; nombre: string }[];
  /** `null` si el curso no tiene examen final: es el caso normal, no un
   * estado incompleto — ver el comentario de ExamenTab. */
  examen: ExamenDetalle | null;
  /** Desde la lista, "Dónde se atasca la gente" abre Estudiantes. */
  pestanaInicial: PestanaCurso;
}) {
  const [titulo, setTitulo] = useState(curso.titulo);
  const [imagenPortada, setImagenPortada] = useState(curso.imagenPortada);
  const [descripcion, setDescripcion] = useState(curso.descripcion);
  const [categoriaIds, setCategoriaIds] = useState(curso.categoriaIds);
  const [idsInstructores, setIdsInstructores] = useState(curso.instructorIds);
  const [nivel, setNivel] = useState<NivelCurso>(curso.nivel);
  const [mostrado, setMostrado] = useState(curso.mostrado);
  const [destacado, setDestacado] = useState(curso.destacado);
  const [orden, setOrden] = useState(curso.ordenVisualizacion);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [publicando, setPublicando] = useState(false);
  const [despublicando, setDespublicando] = useState(false);
  // Reportado por ContenidoTab: una lección con título/duración/resumen sin
  // guardar también debe bloquear salir de esta pantalla, no solo cambiar
  // de lección dentro de la pestaña.
  const [contenidoSinGuardar, setContenidoSinGuardar] = useState(false);
  // Igual que `contenidoSinGuardar`, pero reportado por ExamenTab: una
  // pregunta a medio editar también tiene que bloquear la salida.
  const [examenSinGuardar, setExamenSinGuardar] = useState(false);
  const showToast = useAdminToast();

  // Red de seguridad para teléfonos muy angostos: si las pestañas no caben,
  // se desplazan y un degradado avisa que hay más a ese lado.
  const tabsRef = useRef<HTMLDivElement>(null);
  const [hayMasTabs, setHayMasTabs] = useState(false);
  const [hayTabsAntes, setHayTabsAntes] = useState(false);

  useEffect(() => {
    const el = tabsRef.current;
    if (!el) return;
    function actualizar() {
      if (!el) return;
      setHayMasTabs(el.scrollWidth - el.scrollLeft - el.clientWidth > 4);
      setHayTabsAntes(el.scrollLeft > 4);
    }
    actualizar();
    el.addEventListener("scroll", actualizar);
    window.addEventListener("resize", actualizar);
    return () => {
      el.removeEventListener("scroll", actualizar);
      window.removeEventListener("resize", actualizar);
    };
  }, []);

  // Lo último guardado en el servidor, para saber si hay algo pendiente. La
  // portada no entra acá: se guarda sola al confirmarla en InfoTab.
  const [guardadoComo, setGuardadoComo] = useState({
    titulo: curso.titulo,
    descripcion: curso.descripcion,
    categoriaIds: curso.categoriaIds,
    idsInstructores: curso.instructorIds,
    nivel: curso.nivel,
    destacado: curso.destacado,
    orden: curso.ordenVisualizacion,
  });

  const infoSinGuardar =
    titulo !== guardadoComo.titulo ||
    descripcion !== guardadoComo.descripcion ||
    nivel !== guardadoComo.nivel ||
    categoriaIds.length !== guardadoComo.categoriaIds.length ||
    categoriaIds.some((id) => !guardadoComo.categoriaIds.includes(id)) ||
    idsInstructores.length !== guardadoComo.idsInstructores.length ||
    idsInstructores.some((id) => !guardadoComo.idsInstructores.includes(id));
  const catalogoSinGuardar = destacado !== guardadoComo.destacado || orden !== guardadoComo.orden;
  const sinGuardar = infoSinGuardar || catalogoSinGuardar;

  const hayCambiosSinGuardar = sinGuardar || contenidoSinGuardar || examenSinGuardar;

  useEffect(() => {
    function avisar(event: BeforeUnloadEvent) {
      if (!hayCambiosSinGuardar) return;
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", avisar);
    return () => window.removeEventListener("beforeunload", avisar);
  }, [hayCambiosSinGuardar]);

  // Cubre lo que beforeunload no cubre: navegación interna (Volver a
  // cursos, menú lateral) vía <Link>, que no descarga la página.
  const dialogAvisoNavegacion = useAvisoNavegacionSinGuardar(hayCambiosSinGuardar);

  const handleContenidoDirtyChange = useCallback((dirty: boolean) => setContenidoSinGuardar(dirty), []);
  const handleExamenDirtyChange = useCallback((dirty: boolean) => setExamenSinGuardar(dirty), []);

  // Se recalcula con el título y la portada en vivo y con los módulos tal
  // como vinieron del servidor (ContenidoTab revalida la ruta al añadir
  // contenido). Es la misma regla que aplica el servidor en bloqueoDePublicacion().
  const motivosSinPublicar = motivosParaNoPublicar({
    titulo,
    imagenPortada,
    modulos: curso.modulos.map((modulo) => ({
      lecciones: modulo.lecciones.map((leccion) => ({
        estadoProcesamiento: leccion.estadoProcesamiento,
      })),
    })),
  });

  const categoria =
    categorias
      .filter((item) => categoriaIds.includes(item.id))
      .map((item) => item.nombre)
      .join(", ") || "Sin categoría";
  const profesores = instructores.filter((item) => idsInstructores.includes(item.id)).map((item) => item.nombre);
  const totalClases = curso.modulos.reduce((total, modulo) => total + modulo.lecciones.length, 0);
  const empezaron = curso.estudiantes.filter((estudiante) => estudiante.ultimaVez).length;
  // Agotaron la tanda de intentos sin aprobar: el admin les puede dar otro.
  const sinIntentos = examen?.estudiantes.filter((estudiante) => estudiante.estado === "EN_ESPERA_LARGA").length ?? 0;

  function descartar() {
    setTitulo(guardadoComo.titulo);
    setDescripcion(guardadoComo.descripcion);
    setCategoriaIds(guardadoComo.categoriaIds);
    setIdsInstructores(guardadoComo.idsInstructores);
    setNivel(guardadoComo.nivel);
    setDestacado(guardadoComo.destacado);
    setOrden(guardadoComo.orden);
    setError(null);
  }

  async function handleGuardar() {
    setPending(true);
    setError(null);

    // Solo se llama a lo que cambió: cada acción deja su línea en la bitácora.
    const [resultadoInfo, resultadoCatalogo] = await Promise.all([
      infoSinGuardar
        ? actualizarInfoCurso(curso.id, { titulo, descripcion, categoriaIds, nivel, idsInstructores })
        : Promise.resolve(null),
      catalogoSinGuardar
        ? actualizarConfiguracionCurso(curso.id, { mostrado, destacado, ordenVisualizacion: orden })
        : Promise.resolve(null),
    ]);
    setPending(false);

    const fallo = resultadoInfo?.error ?? resultadoCatalogo?.error;
    if (fallo) {
      setError(fallo);
      showToast(fallo, "error");
      return;
    }

    setGuardadoComo({ titulo, descripcion, categoriaIds, idsInstructores, nivel, destacado, orden });
    // actualizarInfoCurso regenera el slug desde el título. Si cambió, la URL
    // abierta ya no resuelve: se reemplaza en el historial sin navegar —Next
    // la sincroniza con su router— para no remontar la vista ni perder la pestaña.
    const slug = resultadoInfo?.slug;
    if (slug && window.location.pathname !== `/admin/cursos/${slug}`) {
      window.history.replaceState(null, "", `/admin/cursos/${slug}${window.location.search}${window.location.hash}`);
    }
    showToast("Guardaste los cambios.");
  }

  async function cambiarPublicacion(publicar: boolean) {
    setPublicando(true);
    const resultado = await alternarPublicacionCurso(curso.id, publicar);
    setPublicando(false);
    if (resultado.error) {
      showToast(resultado.error, "error");
      return;
    }
    setMostrado(publicar);
    showToast(publicar ? `Publicaste ${titulo}.` : `Despublicaste ${titulo}.`);
  }

  return (
    <div className="flex flex-col gap-5">
      <Link
        href="/admin/cursos"
        className="-mb-2 flex min-h-11 w-fit items-center gap-1.5 text-uva-detalle text-uva-muted-2 hover:text-uva-text pointer-fine:min-h-0"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Volver a cursos
      </Link>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <div className="flex min-w-0 flex-1 basis-[22rem] items-center gap-4">
          {esPortadaReal(imagenPortada) ? (
            <Image
              src={imagenPortada}
              alt=""
              width={1280}
              height={720}
              sizes="96px"
              className="aspect-video w-20 shrink-0 rounded-uva-sm object-cover sm:w-24"
            />
          ) : (
            <div
              aria-hidden
              className="aspect-video w-20 shrink-0 rounded-uva-sm bg-uva-surface-2 sm:w-24"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(135deg, var(--uva-stripe) 0 2px, transparent 2px 9px)",
              }}
            />
          )}
          <div className="min-w-0">
            <h1 className="text-uva-titulo-3 text-balance break-words text-uva-text">{titulo}</h1>
            <p className="mt-0.5 text-uva-detalle text-uva-muted">
              {categoria} · {NIVEL_LABEL[nivel]}
              {profesores.length > 0 && ` · Con ${profesores.join(", ")}`}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 max-sm:w-full">
          <StatusBadge tone={mostrado ? "success" : "neutral"}>{mostrado ? "Publicado" : "Borrador"}</StatusBadge>
          {mostrado && (
            <Link
              href={`/cursos/${curso.slug}`}
              className="inline-flex min-h-11 items-center font-codigo text-uva-etiqueta break-all text-uva-accent-text underline-offset-4 hover:underline pointer-fine:min-h-0"
            >
              /cursos/{curso.slug}
            </Link>
          )}
          {mostrado ? (
            <Button
              type="button"
              variant="outline"
              className="max-sm:w-full"
              disabled={publicando}
              onClick={() => setDespublicando(true)}
            >
              Despublicar
            </Button>
          ) : (
            <Button
              type="button"
              variant="primary"
              className="max-sm:flex-1"
              disabled={publicando || motivosSinPublicar.length > 0}
              aria-describedby={motivosSinPublicar.length > 0 ? "curso-falta" : undefined}
              onClick={() => cambiarPublicacion(true)}
            >
              {publicando ? "Publicando…" : "Publicar"}
            </Button>
          )}
        </div>
      </div>

      {/* El botón deshabilitado no explica nada por sí solo: se listan los
          motivos concretos. El servidor aplica la misma regla. */}
      {!mostrado && motivosSinPublicar.length > 0 && (
        <div id="curso-falta" className="rounded-uva-lg border border-uva-line-strong bg-uva-surface px-4 py-3.5 sm:px-5">
          <p className="m-0 font-bold text-uva-text">Para publicarlo falta esto</p>
          <ul className="m-0 mt-2 flex list-none flex-wrap gap-x-5 gap-y-1.5 p-0">
            {motivosSinPublicar.map((motivo) => (
              <li key={motivo} className="flex items-start gap-1.5 text-uva-detalle font-semibold text-uva-accent-2-text">
                <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                {motivo}
              </li>
            ))}
          </ul>
        </div>
      )}

      <Tabs
        defaultValue={pestanaInicial}
        // La pestaña tocada puede quedar medio tapada por el degradado: se
        // desplaza hasta verse entera, en el siguiente frame.
        onValueChange={() =>
          requestAnimationFrame(() =>
            tabsRef.current
              ?.querySelector<HTMLElement>("[data-active]")
              ?.scrollIntoView({ block: "nearest", inline: "nearest" }),
          )
        }
      >
        <div className="relative">
          <TabsList ref={tabsRef} className="overflow-x-auto">
            <TabsTrigger value="informacion">Información</TabsTrigger>
            <TabsTrigger value="contenido">
              Contenido
              {totalClases > 0 && <Contador>{totalClases}</Contador>}
            </TabsTrigger>
            <TabsTrigger value="examen">
              Examen
              {sinIntentos > 0 && <Contador alerta>{sinIntentos}</Contador>}
            </TabsTrigger>
            <TabsTrigger value="estudiantes">
              Estudiantes
              {curso.estudiantes.length > 0 && <Contador>{curso.estudiantes.length}</Contador>}
            </TabsTrigger>
          </TabsList>
          {hayTabsAntes && (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-uva-bg to-transparent"
            />
          )}
          {hayMasTabs && (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-uva-bg to-transparent"
            />
          )}
        </div>

        <TabsContent value="informacion" className="pt-[18px]">
          <InfoTab
            cursoId={curso.id}
            titulo={titulo}
            onTituloChange={setTitulo}
            imagenPortada={imagenPortada}
            onImagenPortadaChange={setImagenPortada}
            descripcion={descripcion}
            onDescripcionChange={setDescripcion}
            categoriaIds={categoriaIds}
            onCategoriaIdsChange={setCategoriaIds}
            nivel={nivel}
            onNivelChange={setNivel}
            categorias={categorias}
            idsInstructores={idsInstructores}
            onIdsInstructoresChange={setIdsInstructores}
            instructores={instructores}
            destacado={destacado}
            onDestacadoChange={setDestacado}
            orden={orden}
            onOrdenChange={setOrden}
            enPortada={curso.enPortada}
            enlacesVistaPrevia={curso.enlacesVistaPrevia}
            error={error}
          />
        </TabsContent>
        <TabsContent value="contenido" className="pt-[18px]">
          <ContenidoTab
            key={curso.modulos.map((modulo) => `${modulo.id}:${modulo.lecciones.map((l) => l.id).join(",")}`).join("|")}
            cursoId={curso.id}
            modulosIniciales={curso.modulos}
            onDirtyChange={handleContenidoDirtyChange}
          />
        </TabsContent>
        <TabsContent value="examen" className="pt-[18px]">
          {/* La key remonta el tab cuando cambia el conjunto de preguntas:
              igual que ContenidoTab, el estado local de cada editor tiene que
              partir de los datos recién revalidados y no de los anteriores. */}
          <ExamenTab
            key={examen ? `${examen.id}:${examen.preguntas.map((p) => p.id).join(",")}` : "sin-examen"}
            cursoId={curso.id}
            examen={examen}
            onDirtyChange={handleExamenDirtyChange}
          />
        </TabsContent>
        <TabsContent value="estudiantes" className="pt-[18px]">
          <EstudiantesTab estudiantes={curso.estudiantes} modulos={curso.modulos} />
        </TabsContent>
      </Tabs>

      {/* Aparece solo con algo pendiente, encima de la barra de abajo del
          celular. Contenido y Examen guardan con sus propios botones. */}
      {sinGuardar && (
        <div className="sticky bottom-[calc(env(safe-area-inset-bottom)+88px)] z-30 flex flex-wrap items-center gap-2.5 rounded-uva-lg border border-uva-divider bg-uva-surface px-4 py-3 shadow-uva-flotante md:bottom-4">
          <p role="status" className="m-0 mr-auto font-semibold text-uva-text max-sm:w-full">
            Tienes cambios sin guardar
          </p>
          <Button type="button" variant="outline" className="max-sm:flex-1" disabled={pending} onClick={descartar}>
            Descartar
          </Button>
          <Button type="button" variant="primary" className="max-sm:flex-1" disabled={pending} onClick={handleGuardar}>
            {pending ? "Guardando…" : "Guardar cambios"}
          </Button>
        </div>
      )}

      <ConfirmDialog
        open={despublicando}
        onOpenChange={setDespublicando}
        title={`Despublicar ${titulo}`}
        confirmLabel="Despublicar"
        description={textoDespublicar({ empezaron, enPortada: curso.enPortada?.id === curso.id })}
        onConfirm={() => cambiarPublicacion(false)}
      />

      {dialogAvisoNavegacion}
    </div>
  );
}

function Contador({ children, alerta }: { children: React.ReactNode; alerta?: boolean }) {
  return (
    <span
      className={
        alerta
          ? "rounded-full bg-uva-badge-warn-bg px-1.5 font-mono text-uva-etiqueta font-bold text-uva-badge-warn-fg max-sm:hidden"
          : "rounded-full bg-uva-surface-2 px-1.5 font-mono text-uva-etiqueta font-bold text-uva-text-muted max-sm:hidden"
      }
    >
      {children}
    </span>
  );
}
