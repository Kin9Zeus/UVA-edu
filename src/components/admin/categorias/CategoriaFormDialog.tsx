"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { crearCategoria, actualizarCategoria } from "@/actions/admin/categorias";
import { useAdminToast } from "@/components/admin/Toast";
import { slugificar } from "@/lib/slug";
import {
  MAX_CARACTERES_INTRODUCCION,
  MAX_CARACTERES_PREGUNTA,
  MAX_CARACTERES_RESPUESTA,
  MAX_PREGUNTAS,
  PALABRAS_SUGERIDAS,
  contarPalabras,
  type PreguntaFrecuente,
} from "@/lib/escuela-contenido";

const FILA_VACIA: PreguntaFrecuente = { pregunta: "", respuesta: "" };

export function CategoriaFormDialog({
  open,
  onOpenChange,
  categoria,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categoria?: {
    id: string;
    slug: string;
    nombre: string;
    descripcion: string | null;
    introduccion: string | null;
    preguntas: PreguntaFrecuente[];
  } | null;
}) {
  const [nombre, setNombre] = useState(categoria?.nombre ?? "");
  const [descripcion, setDescripcion] = useState(categoria?.descripcion ?? "");
  const [introduccion, setIntroduccion] = useState(categoria?.introduccion ?? "");
  const [preguntas, setPreguntas] = useState<PreguntaFrecuente[]>(
    categoria?.preguntas.length ? categoria.preguntas : [FILA_VACIA],
  );
  const palabras = contarPalabras(introduccion);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const showToast = useAdminToast();

  // El slug guardado manda mientras el nombre no se toque; en cuanto cambia,
  // se muestra el que generaría el servidor (salvo un posible sufijo de
  // desempate, que solo se conoce al guardar).
  const nombreSinCambios = categoria != null && nombre.trim() === categoria.nombre;
  const slugPrevisto = nombreSinCambios
    ? categoria.slug
    : nombre.trim() === ""
      ? null
      : slugificar(nombre);
  const urlVaACambiar = categoria != null && slugPrevisto !== categoria.slug;

  function resetAndClose() {
    setError(null);
    onOpenChange(false);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const datos = { nombre, descripcion, introduccion, preguntas };
    const resultado = categoria ? await actualizarCategoria(categoria.id, datos) : await crearCategoria(datos);

    setPending(false);

    if (resultado.error) {
      setError(resultado.error);
      return;
    }

    showToast(categoria ? "Categoría actualizada." : "Categoría creada.");
    resetAndClose();
    if (!categoria) {
      setNombre("");
      setDescripcion("");
      setIntroduccion("");
      setPreguntas([FILA_VACIA]);
    }
  }

  function cambiarPregunta(indice: number, cambio: Partial<PreguntaFrecuente>) {
    setPreguntas((actuales) => actuales.map((p, i) => (i === indice ? { ...p, ...cambio } : p)));
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) resetAndClose();
        else onOpenChange(next);
      }}
    >
      <DialogContent className="max-h-[calc(100dvh-2rem)] w-[620px] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{categoria ? "Editar categoría" : "Nueva categoría"}</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-3.5">
            {error && (
              <div role="alert" className="rounded-uva-md bg-uva-error-soft px-3.5 py-2.5 text-uva-detalle text-uva-error-text">
                {error}
              </div>
            )}
            <div>
              <Label htmlFor="categoria-nombre">Nombre</Label>
              <Input
                id="categoria-nombre"
                value={nombre}
                onChange={(event) => setNombre(event.target.value)}
                placeholder="Presupuestos y Costos"
                required
              />
              {/* Mientras el nombre no cambie se muestra el slug REAL que
                  tiene guardado la categoría, no `slugificar(nombre)`: si al
                  crearse hubo un choque, el guardado lleva sufijo ("diseno-2")
                  y recalcularlo acá mostraría una URL que no existe.
                  Al cambiar el nombre sí se previsualiza el que se generaría,
                  advirtiendo que la URL se va a mover. */}
              {slugPrevisto && (
                <p className="mt-1.5 font-mono text-uva-etiqueta text-uva-text-faint">
                  /catalogo/{slugPrevisto}
                  {urlVaACambiar && (
                    <span className="ml-1.5 font-sans text-uva-badge-warn-fg">
                      · la URL actual dejará de funcionar
                    </span>
                  )}
                </p>
              )}
            </div>
            <div>
              <Label htmlFor="categoria-descripcion">Descripción</Label>
              <Textarea
                id="categoria-descripcion"
                value={descripcion}
                onChange={(event) => setDescripcion(event.target.value)}
                className="min-h-[70px]"
                placeholder="Descripción breve de la categoría"
                aria-describedby="categoria-descripcion-ayuda"
              />
              <p id="categoria-descripcion-ayuda" className="mt-1.5 text-uva-detalle text-uva-text-muted">
                Sale arriba de los cursos, en la página de la categoría.
              </p>
            </div>

            {/* Contenido propio de la página de la escuela (SEO fase 14). */}
            <div>
              <Label htmlFor="categoria-introduccion">Introducción de la página</Label>
              <Textarea
                id="categoria-introduccion"
                value={introduccion}
                onChange={(event) => setIntroduccion(event.target.value)}
                className="min-h-[160px]"
                maxLength={MAX_CARACTERES_INTRODUCCION}
                placeholder="Qué se aprende en esta escuela, para qué cargos y qué problemas resuelve."
                aria-describedby="categoria-introduccion-ayuda"
              />
              <p id="categoria-introduccion-ayuda" className="mt-1.5 text-uva-detalle text-uva-text-muted">
                Sale debajo de los cursos. Se recomiendan de {PALABRAS_SUGERIDAS.minimo} a {PALABRAS_SUGERIDAS.maximo}{" "}
                palabras; deja una línea en blanco entre párrafos.{" "}
                <span className="font-mono">
                  {palabras} {palabras === 1 ? "palabra" : "palabras"}
                </span>
                {palabras > 0 && palabras < PALABRAS_SUGERIDAS.minimo && " · corta"}
                {palabras > PALABRAS_SUGERIDAS.maximo && " · larga"}
              </p>
            </div>

            <fieldset className="flex flex-col gap-3">
              <legend className="mb-1 text-uva-detalle font-bold text-uva-text">Preguntas frecuentes</legend>
              <p className="-mt-1 text-uva-detalle text-uva-text-muted">
                De 3 a {MAX_PREGUNTAS}, con respuestas cortas y concretas. Se ven en la página de la escuela.
              </p>
              {preguntas.map((p, i) => (
                <div key={i} className="flex flex-col gap-2 rounded-uva-md border border-uva-divider p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-uva-detalle font-bold text-uva-text">Pregunta {i + 1}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setPreguntas((actuales) => actuales.filter((_, j) => j !== i))}
                      aria-label={`Quitar la pregunta ${i + 1}`}
                    >
                      Quitar
                    </Button>
                  </div>
                  <Label htmlFor={`categoria-pregunta-${i}`} className="sr-only">
                    Pregunta {i + 1}
                  </Label>
                  <Input
                    id={`categoria-pregunta-${i}`}
                    value={p.pregunta}
                    maxLength={MAX_CARACTERES_PREGUNTA}
                    onChange={(event) => cambiarPregunta(i, { pregunta: event.target.value })}
                    placeholder="¿Necesito experiencia previa?"
                  />
                  <Label htmlFor={`categoria-respuesta-${i}`} className="sr-only">
                    Respuesta {i + 1}
                  </Label>
                  <Textarea
                    id={`categoria-respuesta-${i}`}
                    value={p.respuesta}
                    maxLength={MAX_CARACTERES_RESPUESTA}
                    onChange={(event) => cambiarPregunta(i, { respuesta: event.target.value })}
                    className="min-h-[70px]"
                    placeholder="Respuesta"
                  />
                </div>
              ))}
              {preguntas.length < MAX_PREGUNTAS && (
                <Button
                  type="button"
                  variant="outline"
                  className="self-start"
                  onClick={() => setPreguntas((actuales) => [...actuales, FILA_VACIA])}
                >
                  Agregar pregunta
                </Button>
              )}
            </fieldset>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={resetAndClose} disabled={pending}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary" disabled={pending}>
              {pending ? "Guardando…" : "Guardar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
