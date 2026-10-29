"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SelectorCategorias } from "@/components/admin/cursos/SelectorCategorias";
import { SelectorInstructores } from "@/components/admin/cursos/SelectorInstructores";
import { EnlacesVistaPrevia } from "@/components/admin/cursos/EnlacesVistaPrevia";
import { AdminCard } from "@/components/admin/AdminCard";
import { Switch } from "@/components/ui/switch";
import type { EnlaceVistaPrevia } from "@/lib/admin/cursoDetalle";
import { subirPortadaCurso, type NivelCurso } from "@/actions/admin/cursos";
import { generarDescripcionCursoConIa } from "@/actions/admin/descripcionesIa";
import { useAdminToast } from "@/components/admin/Toast";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import {
  ACCEPT_PORTADA,
  ERROR_FORMATO_PORTADA,
  ERROR_TAMANO_PORTADA,
  FORMATOS_PORTADA,
  TAMANO_MAXIMO_PORTADA,
  esPortadaReal,
} from "@/lib/media";

const NIVEL_ITEMS = {
  BASICO: "Básico",
  INTERMEDIO: "Intermedio",
  AVANZADO: "Avanzado",
};

/**
 * Controlado desde CursoDetalleView: guarda la barra "Tienes cambios sin
 * guardar" de esa vista, así que este tab no dispara la mutación (salvo la
 * portada, que se guarda sola al confirmarla). A la derecha va lo que antes
 * era la pestaña Configuración, menos publicar, que pasó a la cabecera.
 */
export function InfoTab({
  cursoId,
  titulo,
  onTituloChange,
  imagenPortada,
  onImagenPortadaChange,
  descripcion,
  onDescripcionChange,
  categoriaIds,
  onCategoriaIdsChange,
  nivel,
  onNivelChange,
  categorias,
  idsInstructores,
  onIdsInstructoresChange,
  instructores,
  destacado,
  onDestacadoChange,
  orden,
  onOrdenChange,
  enPortada,
  enlacesVistaPrevia,
  error,
}: {
  cursoId: string;
  titulo: string;
  onTituloChange: (value: string) => void;
  imagenPortada: string;
  onImagenPortadaChange: (url: string) => void;
  descripcion: string;
  onDescripcionChange: (value: string) => void;
  categoriaIds: string[];
  onCategoriaIdsChange: (ids: string[]) => void;
  nivel: NivelCurso;
  onNivelChange: (value: NivelCurso) => void;
  categorias: { id: string; nombre: string; activo?: boolean }[];
  idsInstructores: string[];
  onIdsInstructoresChange: (ids: string[]) => void;
  /** Cuentas con rol PROFESOR (getPerfilesProfesor). Puede venir vacía. */
  instructores: { id: string; nombre: string }[];
  destacado: boolean;
  onDestacadoChange: (value: boolean) => void;
  orden: number;
  onOrdenChange: (value: number) => void;
  /** El curso que hoy sale en la portada, si hay uno. */
  enPortada: { id: string; titulo: string } | null;
  enlacesVistaPrevia: EnlaceVistaPrevia[];
  error: string | null;
}) {
  const [subiendoPortada, setSubiendoPortada] = useState(false);
  const [errorPortada, setErrorPortada] = useState<string | null>(null);
  // Elegir un archivo no lo sube: queda acá en memoria y se previsualiza
  // hasta que el administrador confirme. Reemplazar la portada de un curso
  // publicado es visible de inmediato en el catálogo, así que no debería
  // pasar por un clic accidental en el selector de archivos.
  const [portadaPendiente, setPortadaPendiente] = useState<File | null>(null);
  const inputPortadaRef = useRef<HTMLInputElement>(null);
  const showToast = useAdminToast();
  const [generandoDescripcion, setGenerandoDescripcion] = useState(false);
  const [errorDescripcion, setErrorDescripcion] = useState<string | null>(null);
  const [confirmandoIa, setConfirmandoIa] = useState(false);

  /** Carga la propuesta en el campo sin guardarla: queda como un cambio más
   * del formulario, que se guarda (o se descarta) con el botón de la cabecera. */
  function handleGenerarDescripcion() {
    if (descripcion.trim() === "") generarDescripcion();
    else setConfirmandoIa(true);
  }

  async function generarDescripcion() {
    setGenerandoDescripcion(true);
    setErrorDescripcion(null);
    const resultado = await generarDescripcionCursoConIa(cursoId);
    setGenerandoDescripcion(false);

    if (resultado.error || !resultado.descripcion) {
      setErrorDescripcion(resultado.error ?? "No pudimos generar la descripción.");
      return;
    }
    onDescripcionChange(resultado.descripcion);
    showToast("Propuesta lista. Revísala y guarda los cambios para publicarla.");
  }

  const previewPendiente = useMemo(
    () => (portadaPendiente ? URL.createObjectURL(portadaPendiente) : null),
    [portadaPendiente],
  );
  useEffect(() => {
    return () => {
      if (previewPendiente) URL.revokeObjectURL(previewPendiente);
    };
  }, [previewPendiente]);

  function handleSeleccionarPortada(event: React.ChangeEvent<HTMLInputElement>) {
    const archivo = event.target.files?.[0];
    event.target.value = "";
    if (!archivo) return;

    // Un pre-chequeo para no gastar una subida en un archivo que el
    // servidor va a rechazar igual; la validación que manda es la de
    // procesarPortada(), que mira los magic bytes y no este `type`.
    if (!ACCEPT_PORTADA.split(",").includes(archivo.type)) {
      setErrorPortada(ERROR_FORMATO_PORTADA);
      return;
    }
    if (archivo.size > TAMANO_MAXIMO_PORTADA) {
      setErrorPortada(ERROR_TAMANO_PORTADA);
      return;
    }

    setErrorPortada(null);
    setPortadaPendiente(archivo);
  }

  // Lo que se pinta en el recuadro: la imagen pendiente de confirmar si la
  // hay, si no la portada ya guardada, y si tampoco, nada (zona de arrastre).
  const fuenteVistaPrevia =
    previewPendiente ?? (esPortadaReal(imagenPortada) ? imagenPortada : null);

  function descartarPortadaPendiente() {
    setPortadaPendiente(null);
    setErrorPortada(null);
  }

  async function handleConfirmarPortada() {
    if (!portadaPendiente) return;

    setErrorPortada(null);
    setSubiendoPortada(true);
    try {
      const formData = new FormData();
      formData.set("archivo", portadaPendiente);
      const resultado = await subirPortadaCurso(cursoId, formData);

      if (resultado.error || !resultado.url) {
        setErrorPortada(resultado.error ?? "No pudimos subir la imagen.");
        return;
      }
      onImagenPortadaChange(resultado.url);
      setPortadaPendiente(null);
      showToast("Portada actualizada.");
    } catch {
      setErrorPortada("No pudimos subir la imagen.");
    } finally {
      setSubiendoPortada(false);
    }
  }

  // "Destacado" pone UN curso en la portada y en el inicio del estudiante:
  // el primero destacado y publicado por orden (lib/cursoDestacado.ts).
  const notaPortada = !enPortada
    ? "Hoy no sale ninguno."
    : enPortada.id === cursoId
      ? "Hoy sale este."
      : `Hoy sale ${enPortada.titulo}.`;

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <AdminCard className="gap-4">
      {error && (
        <div
          role="alert"
          className="rounded-uva-md bg-uva-error-soft px-3.5 py-2.5 text-uva-detalle text-uva-error-text"
        >
          {error}
        </div>
      )}

      <div>
        <Label htmlFor="info-titulo">Nombre del curso</Label>
        <Input
          id="info-titulo"
          value={titulo}
          onChange={(event) => onTituloChange(event.target.value)}
        />
      </div>

      <div>
        <div className="mb-[5px] flex items-center">
          <Label htmlFor="info-descripcion" className="mb-0">
            Descripción
          </Label>
          <Button
            type="button"
            variant="ghost"
            size="auto"
            className="ml-auto gap-1.5 px-2 py-1 text-uva-detalle text-uva-muted-2 hover:text-uva-accent-ink"
            onClick={handleGenerarDescripcion}
            disabled={generandoDescripcion}
            title="Escribe la descripción a partir del temario y el contenido de las lecciones"
          >
            <Sparkles className="size-3.5" />
            {generandoDescripcion ? "Generando…" : "Generar con IA"}
          </Button>
        </div>
        {errorDescripcion && (
          <div
            role="alert"
            className="mb-2 rounded-uva-md bg-uva-error-soft px-3.5 py-2.5 text-uva-detalle text-uva-error-text"
          >
            {errorDescripcion}
          </div>
        )}
        <Textarea
          id="info-descripcion"
          value={descripcion}
          onChange={(event) => onDescripcionChange(event.target.value)}
          rows={5}
        />
      </div>

      {/* items-start: la lista de categorías es más alta que el Select de
          nivel, y sin esto el grid estiraría el Select para igualarla. */}
      <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2">
        <div>
          <Label id="info-categorias-label">Categorías</Label>
          <SelectorCategorias
            id="info-categorias"
            categorias={categorias}
            seleccionadas={categoriaIds}
            onChange={onCategoriaIdsChange}
          />
        </div>
        <div>
          <Label htmlFor="info-nivel">Nivel</Label>
          <Select
            items={NIVEL_ITEMS}
            value={nivel}
            onValueChange={(value) => value && onNivelChange(value as NivelCurso)}
          >
            <SelectTrigger id="info-nivel" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="BASICO">Básico</SelectItem>
              <SelectItem value="INTERMEDIO">Intermedio</SelectItem>
              <SelectItem value="AVANZADO">Avanzado</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        {/* Múltiple: `curso_instructores` es muchos-a-muchos. Editarlo aquí es
            nuevo — antes el instructor solo se elegía al crear el curso y no
            había forma de cambiarlo desde el panel. */}
        <Label id="info-instructores-label">Instructores</Label>
        <SelectorInstructores
          id="info-instructores"
          instructores={instructores}
          seleccionados={idsInstructores}
          onChange={onIdsInstructoresChange}
        />
      </div>

      </AdminCard>

      <div className="flex flex-col gap-4">
        <AdminCard>
        <h2 className="text-uva-cuerpo font-extrabold text-uva-text">Portada</h2>
        {errorPortada && (
          <div
            role="alert"
            className="mb-2 rounded-uva-md bg-uva-error-soft px-3.5 py-2.5 text-uva-detalle text-uva-error-text"
          >
            {errorPortada}
          </div>
        )}
        {/* El recuadro muestra la imagen pendiente si hay una; si no, la
            portada guardada. Es aspect-video + object-cover, el mismo
            encuadre 16:9 centrado que el servidor aplica al guardar, así
            que la vista previa no miente sobre el recorte. */}
        <button
          type="button"
          onClick={() => inputPortadaRef.current?.click()}
          disabled={subiendoPortada}
          className="block aspect-video w-full overflow-hidden rounded-uva-md border-[1.5px] border-dashed border-uva-divider text-center text-uva-detalle text-uva-muted-2 hover:border-uva-text-faint disabled:pointer-events-none disabled:opacity-60"
        >
          {previewPendiente ? (
            // eslint-disable-next-line @next/next/no-img-element -- preview local (URL.createObjectURL), no un asset optimizable
            <img src={previewPendiente} alt="" className="size-full object-cover" />
          ) : fuenteVistaPrevia ? (
            <Image
              src={fuenteVistaPrevia}
              alt=""
              width={1280}
              height={720}
              sizes="320px"
              className="size-full object-cover"
            />
          ) : (
            <span className="flex size-full items-center justify-center px-4">
              <span>
                Arrastra una imagen aquí o <span className="text-uva-accent-ink">selecciona un archivo</span>
              </span>
            </span>
          )}
        </button>

        {portadaPendiente ? (
          <div className="mt-2 flex items-center gap-2">
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={handleConfirmarPortada}
              disabled={subiendoPortada}
            >
              {subiendoPortada ? "Subiendo…" : "Usar esta portada"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={descartarPortadaPendiente}
              disabled={subiendoPortada}
            >
              Descartar
            </Button>
          </div>
        ) : (
          esPortadaReal(imagenPortada) && (
            <p className="mt-1.5 text-uva-detalle text-uva-text-faint">
              Haz clic en la imagen para reemplazarla.
            </p>
          )
        )}

        <p className="mt-1 text-uva-detalle text-uva-text-faint">
          {FORMATOS_PORTADA.join(", ")} hasta {TAMANO_MAXIMO_PORTADA / 1024 / 1024} MB. Se guarda
          recortada a 1280 × 720 px (16:9), igual que la vista previa.
        </p>
        <input
          ref={inputPortadaRef}
          type="file"
          accept={ACCEPT_PORTADA}
          className="hidden"
          onChange={handleSeleccionarPortada}
        />
        </AdminCard>

        <AdminCard className="gap-4">
          <h2 className="text-uva-cuerpo font-extrabold text-uva-text">En el catálogo</h2>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p id="info-portada-titulo" className="text-uva-detalle font-semibold text-uva-text">Mostrar en la portada</p>
              <p id="info-portada-nota" className="text-uva-detalle text-uva-text-muted">
                Sale un solo curso en la portada y en el inicio del estudiante: el destacado y publicado con el orden
                menor. {notaPortada}
              </p>
            </div>
            <Switch
              checked={destacado}
              onCheckedChange={onDestacadoChange}
              aria-labelledby="info-portada-titulo"
              aria-describedby="info-portada-nota"
            />
          </div>
          <div>
            <Label htmlFor="info-orden">Orden en el catálogo</Label>
            <Input
              id="info-orden"
              type="number"
              value={orden}
              onChange={(event) => onOrdenChange(Number(event.target.value))}
              aria-describedby="info-orden-ayuda"
              className="max-w-[120px]"
            />
            <p id="info-orden-ayuda" className="mt-1 text-uva-detalle text-uva-text-muted">
              El número menor sale primero.
            </p>
          </div>
          <EnlacesVistaPrevia cursoId={cursoId} enlaces={enlacesVistaPrevia} />
        </AdminCard>
      </div>

      <ConfirmDialog
        open={confirmandoIa}
        onOpenChange={setConfirmandoIa}
        title="Reemplazar la descripción con IA"
        description="La propuesta de la IA reemplaza la descripción actual. Nada se guarda hasta que pulses «Guardar cambios»."
        confirmLabel="Reemplazar descripción"
        onConfirm={() => {
          setConfirmandoIa(false);
          generarDescripcion();
        }}
      />
    </div>
  );
}
