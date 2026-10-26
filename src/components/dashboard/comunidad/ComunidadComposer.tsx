"use client";

import { useRef, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Check, Lightbulb } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useAviso } from "@/components/ui/toast";
import { EditorTextoEnriquecido, type EditorTextoEnriquecidoHandle } from "@/components/editor/EditorTextoEnriquecido";
import {
  ComunidadCamposEmpleo,
  VALORES_EMPLEO_VACIOS,
  faltanCamposEmpleoObligatorios,
  type ValoresEmpleo,
} from "@/components/dashboard/comunidad/ComunidadCamposEmpleo";
import { crearPostComunidad } from "@/actions/comunidad/crear";
import {
  CATEGORIA_LABEL,
  ICONO_CATEGORIA,
  armarFormDataAdjuntos,
  type CategoriaComunidad,
} from "@/lib/comunidad-tipos";
import { cn } from "@/lib/utils";

/** Lo que cambia según lo que se va a compartir: el nombre corto de la
 * opción, las etiquetas y ejemplos de los campos, un consejo y el botón,
 * que dice exactamente qué se publica. */
const TIPOS: Record<
  CategoriaComunidad,
  { opcion: string; titulo: string; ejemplo: string; detalles: string; consejo?: string; boton: string }
> = {
  PROYECTOS: {
    opcion: "Proyecto",
    titulo: "Nombre del proyecto",
    ejemplo: "Ej.: Pabellón en guadua",
    detalles: "Cuenta la idea, el proceso y qué te gustaría que te comenten.",
    consejo: "Agrega imágenes de planos, maquetas o renders con el clip: la primera se ve en el muro.",
    boton: "Publicar proyecto",
  },
  PREGUNTAS: {
    opcion: "Pregunta",
    titulo: "Tu pregunta",
    ejemplo: "Ej.: ¿Qué escala uso en A3?",
    detalles: "Qué programa usas, qué intentaste y qué te falta.",
    consejo: "Para que te respondan rápido, cuenta qué intentaste y agrega una imagen si la tienes.",
    boton: "Publicar pregunta",
  },
  EMPLEO: {
    opcion: "Empleo",
    titulo: "Cargo",
    ejemplo: "Ej.: Practicante de arquitectura",
    detalles: "Funciones, requisitos y cómo postularse.",
    consejo: "Revisa que el enlace para postularse abra la oferta.",
    boton: "Publicar empleo",
  },
  ANUNCIOS: {
    opcion: "Anuncio",
    titulo: "Título del anuncio",
    ejemplo: "Ej.: Nuevo curso disponible",
    detalles: "Lo que la comunidad necesita saber.",
    boton: "Publicar anuncio",
  },
};

/** Orden de las opciones; Anuncios solo para administradores (la acción y
 * RLS también lo exigen). */
const OPCIONES: CategoriaComunidad[] = ["PROYECTOS", "PREGUNTAS", "EMPLEO", "ANUNCIOS"];

/**
 * Formulario de una nueva publicación, dentro del diálogo de
 * `ComunidadNuevaPublicacion`. El contenido usa `EditorTextoEnriquecido`
 * (mismo `string` con marcadores de formato y de adjunto que espera
 * `crearPostComunidad`).
 *
 * Lo primero es qué se quiere compartir: llega marcado si se abrió desde
 * una categoría y sin marcar desde "Todas" o "Mis publicaciones", para no
 * archivar nada en una categoría por descuido. "Publicar" nunca queda
 * deshabilitado sin decir por qué: si falta algo, lo dice y lleva el foco
 * al campo.
 */
export function ComunidadComposer({
  ruta,
  categoriaInicial,
  esAdmin,
  onPublicado,
}: {
  ruta: string;
  categoriaInicial?: CategoriaComunidad;
  esAdmin: boolean;
  onPublicado: () => void;
}) {
  const router = useRouter();
  const aviso = useAviso();
  const opciones = OPCIONES.filter((opcion) => opcion !== "ANUNCIOS" || esAdmin);
  const [categoria, setCategoria] = useState<CategoriaComunidad | undefined>(
    categoriaInicial && opciones.includes(categoriaInicial) ? categoriaInicial : undefined,
  );
  const [titulo, setTitulo] = useState("");
  const [contenidoVacio, setContenidoVacio] = useState(true);
  const [datosEmpleo, setDatosEmpleo] = useState<ValoresEmpleo>(VALORES_EMPLEO_VACIOS);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const editorRef = useRef<EditorTextoEnriquecidoHandle>(null);
  const opcionesRef = useRef<HTMLFieldSetElement>(null);
  const tituloRef = useRef<HTMLInputElement>(null);
  const tipo = categoria ? TIPOS[categoria] : undefined;

  function faltaAlgo(): boolean {
    if (!categoria) {
      setError("Elige qué quieres compartir.");
      opcionesRef.current?.querySelector("input")?.focus();
      return true;
    }
    if (!titulo.trim()) {
      setError(`Escribe ${categoria === "PREGUNTAS" ? "tu pregunta" : "un título"}.`);
      tituloRef.current?.focus();
      return true;
    }
    if (contenidoVacio) {
      setError("Escribe los detalles de la publicación.");
      editorRef.current?.enfocar();
      return true;
    }
    if (categoria === "EMPLEO" && faltanCamposEmpleoObligatorios(datosEmpleo)) {
      setError("Completa la empresa, la modalidad y el enlace para postularse.");
      document.getElementById("empleo-empresa")?.focus();
      return true;
    }
    return false;
  }

  function publicar(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    setError(null);
    if (faltaAlgo() || !categoria) return;
    const elegida = categoria;
    const contenido = editorRef.current?.obtenerTexto() ?? "";
    const adjuntos = armarFormDataAdjuntos(editorRef.current?.obtenerAdjuntosPendientes() ?? new Map());
    startTransition(async () => {
      const resultado = await crearPostComunidad(
        elegida,
        titulo,
        contenido,
        ruta,
        adjuntos,
        elegida === "EMPLEO" ? datosEmpleo : undefined,
      );
      if ("error" in resultado) {
        setError(resultado.error);
        return;
      }
      aviso.exito(`Publicaste en ${CATEGORIA_LABEL[elegida]}`);
      onPublicado();
      // Si la lista que se está viendo no muestra esa categoría, se va a la
      // suya: publicar y no ver la publicación parece un fallo.
      const seVeAqui =
        ruta === "/dashboard/comunidad" || ruta.includes("mias=1") || ruta.endsWith(`categoria=${elegida}`);
      if (seVeAqui) router.refresh();
      else router.push(`/dashboard/comunidad?categoria=${elegida}`);
    });
  }

  return (
    <form onSubmit={publicar} noValidate className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-5 py-5">
        <fieldset ref={opcionesRef} className="m-0 border-0 p-0">
          <legend className="mb-2.5 p-0 text-uva-detalle font-bold text-uva-text">¿Qué quieres compartir?</legend>
          <div className={cn("grid gap-2", opciones.length === 4 ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-3")}>
            {opciones.map((opcion) => {
              const Icono = ICONO_CATEGORIA[opcion];
              const activa = categoria === opcion;
              return (
                <label
                  key={opcion}
                  className={cn(
                    "relative flex min-h-19 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-uva-md border border-uva-line-strong bg-uva-bg px-2 text-uva-detalle font-bold text-uva-text hover:border-uva-text has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-uva-accent",
                    activa && "border-uva-accent bg-uva-accent-soft ring-1 ring-uva-accent ring-inset hover:border-uva-accent",
                  )}
                >
                  <input
                    type="radio"
                    name="categoria"
                    value={opcion}
                    checked={activa}
                    onChange={() => {
                      setCategoria(opcion);
                      setError(null);
                    }}
                    className="sr-only"
                  />
                  {activa && (
                    <span
                      aria-hidden="true"
                      className="absolute top-1.5 right-1.5 grid size-[18px] place-items-center rounded-full bg-uva-btn text-uva-on-accent"
                    >
                      <Check className="size-3" strokeWidth={3} />
                    </span>
                  )}
                  <Icono className="size-5 text-uva-accent-2-text" aria-hidden="true" />
                  {TIPOS[opcion].opcion}
                </label>
              );
            })}
          </div>
        </fieldset>

        {tipo?.consejo && (
          <p className="m-0 flex gap-2.5 rounded-uva-md border border-uva-divider bg-uva-bg px-3.5 py-3 text-uva-detalle text-uva-text-muted">
            <Lightbulb className="mt-0.5 size-[18px] shrink-0 text-uva-accent-2-text" aria-hidden="true" />
            {tipo.consejo}
          </p>
        )}

        <div className="flex flex-col gap-2">
          <label htmlFor="nueva-publicacion-titulo" className="text-uva-detalle font-bold text-uva-text">
            {tipo?.titulo ?? "Título"}
          </label>
          <Input
            ref={tituloRef}
            id="nueva-publicacion-titulo"
            placeholder={tipo?.ejemplo ?? "Escribe un título corto"}
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            maxLength={150}
          />
        </div>

        <div className="flex flex-col gap-2">
          <span id="nueva-publicacion-detalles" className="text-uva-detalle font-bold text-uva-text">
            Detalles
          </span>
          <EditorTextoEnriquecido
            ref={editorRef}
            etiquetadoPor="nueva-publicacion-detalles"
            placeholder={tipo?.detalles ?? "Cuéntale a la comunidad…"}
            onCambiar={setContenidoVacio}
            onErrorAdjunto={setError}
          />
        </div>

        {categoria === "EMPLEO" && <ComunidadCamposEmpleo valores={datosEmpleo} onCambiar={setDatosEmpleo} />}
      </div>

      <div className="flex shrink-0 flex-col gap-2.5 border-t border-uva-divider px-5 pt-3 pb-[calc(env(safe-area-inset-bottom)+12px)] sm:flex-row sm:items-center sm:justify-between sm:pb-3">
        <div className="min-w-0 text-uva-detalle">
          {error ? (
            <p role="alert" className="m-0 text-uva-error">
              {error}
            </p>
          ) : (
            <p className="m-0 text-uva-text-muted">
              {categoria ? (
                <>
                  Se publica en <strong className="text-uva-text">{CATEGORIA_LABEL[categoria]}</strong>
                </>
              ) : (
                "Elige qué quieres compartir para continuar."
              )}
            </p>
          )}
        </div>
        <button
          type="submit"
          aria-disabled={pending || undefined}
          className="inline-flex min-h-12 shrink-0 items-center justify-center rounded-uva-md bg-uva-btn px-6 text-uva-cuerpo font-bold text-uva-on-accent hover:bg-uva-btn-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-uva-accent aria-disabled:opacity-60 sm:min-h-11 sm:pointer-fine:min-h-10"
        >
          {pending ? "Publicando…" : (tipo?.boton ?? "Publicar")}
        </button>
      </div>
    </form>
  );
}
