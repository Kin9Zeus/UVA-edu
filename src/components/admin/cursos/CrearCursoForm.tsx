"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { tabsListVariants, tabTriggerVariants } from "@/components/ui/tabs";
import { SelectorCategorias } from "@/components/admin/cursos/SelectorCategorias";
import { SelectorInstructores } from "@/components/admin/cursos/SelectorInstructores";
import { crearCurso, subirPortadaCurso, type NivelCurso } from "@/actions/admin/cursos";
import { useAdminToast } from "@/components/admin/Toast";
import { useAvisoNavegacionSinGuardar } from "@/lib/admin/useAvisoNavegacionSinGuardar";
import {
  ACCEPT_PORTADA,
  ERROR_FORMATO_PORTADA,
  ERROR_TAMANO_PORTADA,
  FORMATOS_PORTADA,
  TAMANO_MAXIMO_PORTADA,
} from "@/lib/media";

const NIVEL_ITEMS = { BASICO: "Básico", INTERMEDIO: "Intermedio", AVANZADO: "Avanzado" };

export function CrearCursoForm({
  categorias,
  instructores,
}: {
  categorias: { id: string; nombre: string }[];
  /** Cuentas con rol PROFESOR (getPerfilesProfesor). Puede venir vacía. */
  instructores: { id: string; nombre: string }[];
}) {
  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [portadaArchivo, setPortadaArchivo] = useState<File | null>(null);
  const [errorPortada, setErrorPortada] = useState<string | null>(null);
  const [categoriaIds, setCategoriaIds] = useState<string[]>([]);
  const [nivel, setNivel] = useState<NivelCurso>("BASICO");
  const [idsInstructores, setIdsInstructores] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<"borrador" | "publicar" | null>(null);
  // Se apaga en cuanto crearCurso() confirma el id: a partir de ahí ya no
  // hay nada que perder acá, la pantalla va camino al detalle del curso.
  const [creado, setCreado] = useState(false);
  const inputPortadaRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const showToast = useAdminToast();

  // Sin esto, escribir el título, la descripción y elegir instructor y
  // categorías para perderlo todo con un clic en "Cancelar" (o el menú
  // lateral) es el escenario exacto que el equipo de UVA no puede tener.
  const hayCambiosSinGuardar =
    !creado &&
    (titulo.trim() !== "" ||
      descripcion.trim() !== "" ||
      categoriaIds.length > 0 ||
      portadaArchivo !== null ||
      idsInstructores.length > 0);

  useEffect(() => {
    function avisar(event: BeforeUnloadEvent) {
      if (!hayCambiosSinGuardar) return;
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", avisar);
    return () => window.removeEventListener("beforeunload", avisar);
  }, [hayCambiosSinGuardar]);

  useAvisoNavegacionSinGuardar(hayCambiosSinGuardar);

  // El curso todavía no existe mientras se llena este formulario (no hay
  // cursoId para subirla ya), así que la imagen se guarda en memoria y solo
  // se sube a Storage después de que crearCurso() confirme el id.
  const previewPortada = useMemo(
    () => (portadaArchivo ? URL.createObjectURL(portadaArchivo) : null),
    [portadaArchivo],
  );
  useEffect(() => {
    return () => {
      if (previewPortada) URL.revokeObjectURL(previewPortada);
    };
  }, [previewPortada]);

  function handleSeleccionarPortada(event: React.ChangeEvent<HTMLInputElement>) {
    const archivo = event.target.files?.[0];
    event.target.value = "";
    if (!archivo) return;

    // Pre-chequeo para dar el error de inmediato; la validación que manda
    // es la de procesarPortada() en el servidor, que mira los magic bytes.
    if (!ACCEPT_PORTADA.split(",").includes(archivo.type)) {
      setErrorPortada(ERROR_FORMATO_PORTADA);
      return;
    }
    if (archivo.size > TAMANO_MAXIMO_PORTADA) {
      setErrorPortada(ERROR_TAMANO_PORTADA);
      return;
    }
    setErrorPortada(null);
    setPortadaArchivo(archivo);
  }

  async function handleGuardar() {
    setPending("borrador");
    setError(null);

    const resultado = await crearCurso({
      titulo,
      descripcion,
      categoriaIds,
      nivel,
      idsInstructores,
    });

    if (resultado.error || !resultado.id) {
      setPending(null);
      setError(resultado.error ?? "No pudimos crear el curso.");
      return;
    }

    setCreado(true);

    // El curso ya quedó creado en este punto: si la portada falla, no tiene
    // sentido bloquear ni deshacer la creación — se avisa y se sigue.
    if (portadaArchivo) {
      const formData = new FormData();
      formData.set("archivo", portadaArchivo);
      const resultadoPortada = await subirPortadaCurso(resultado.id, formData);
      if (resultadoPortada.error) {
        showToast(`Curso creado, pero la portada no se pudo subir: ${resultadoPortada.error}`, "error");
      }
    }

    setPending(null);
    showToast("Curso creado como borrador. Añade el contenido para publicarlo.");
    router.push(`/admin/cursos/${resultado.id}`);
  }

  return (
    <div className="flex max-w-[720px] flex-col gap-[18px]">
      {/* Las tres pestañas del mockup en esta pantalla son inertes: solo
          existe "Información" hasta que el curso esté creado. */}
      <div className={tabsListVariants()}>
        <span className={tabTriggerVariants({ state: "active" })}>Información</span>
        <span
          className={tabTriggerVariants({ state: "disabled" })}
          title="Disponible después de crear el curso"
        >
          Configuración
        </span>
        <span
          className={tabTriggerVariants({ state: "disabled" })}
          title="Disponible después de crear el curso"
        >
          Contenido
        </span>
      </div>

      <div className="flex flex-col gap-4">
        {error && (
          <div role="alert" className="rounded-uva-md bg-uva-error-soft px-3.5 py-2.5 text-sm text-uva-error-text">
            {error}
          </div>
        )}

        <div>
          <Label htmlFor="curso-titulo">Nombre del curso</Label>
          <Input
            id="curso-titulo"
            value={titulo}
            onChange={(event) => setTitulo(event.target.value)}
            placeholder="Fundamentos de presupuesto de obra"
            required
          />
        </div>

        <div>
          <Label htmlFor="curso-descripcion">Descripción</Label>
          <Textarea
            id="curso-descripcion"
            value={descripcion}
            onChange={(event) => setDescripcion(event.target.value)}
            rows={4}
            placeholder="De qué trata el curso y qué aprenderá el estudiante"
          />
        </div>

        <div>
          <Label>Portada</Label>
          {errorPortada && (
            <div
              role="alert"
              className="mb-2 rounded-uva-md bg-uva-error-soft px-3.5 py-2.5 text-sm text-uva-error-text"
            >
              {errorPortada}
            </div>
          )}
          <button
            type="button"
            onClick={() => inputPortadaRef.current?.click()}
            className="block aspect-video w-full max-w-[280px] overflow-hidden rounded-uva-md border-[1.5px] border-dashed border-uva-divider text-center text-[13px] text-uva-muted-2 hover:border-uva-text-faint"
          >
            {previewPortada ? (
              // eslint-disable-next-line @next/next/no-img-element -- preview local (URL.createObjectURL), no un asset optimizable
              <img src={previewPortada} alt="" className="size-full object-cover" />
            ) : (
              <div className="flex size-full items-center justify-center px-4">
                Arrastra una imagen aquí o <span className="text-uva-accent">selecciona un archivo</span>
              </div>
            )}
          </button>
          {previewPortada && (
            <p className="mt-1.5 text-xs text-uva-text-faint">Click en la imagen para reemplazarla.</p>
          )}
          <p className="mt-1 text-xs text-uva-text-faint">
            {FORMATOS_PORTADA.join(", ")} hasta {TAMANO_MAXIMO_PORTADA / 1024 / 1024} MB. Se guarda
            recortada a 1280×720px (16:9), igual que la vista previa.
          </p>
          <input
            ref={inputPortadaRef}
            type="file"
            accept={ACCEPT_PORTADA}
            className="hidden"
            onChange={handleSeleccionarPortada}
          />
        </div>

        {/* items-start: la lista de categorías es más alta que el Select de
            nivel, y sin esto el grid estiraría el Select para igualarla. */}
        <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2">
          <div>
            <Label id="curso-categorias-label">Categorías</Label>
            <SelectorCategorias
              id="curso-categorias"
              categorias={categorias}
              seleccionadas={categoriaIds}
              onChange={setCategoriaIds}
            />
          </div>
          <div>
            <Label htmlFor="curso-nivel">Nivel</Label>
            <Select
              items={NIVEL_ITEMS}
              value={nivel}
              onValueChange={(value) => value && setNivel(value as NivelCurso)}
            >
              <SelectTrigger id="curso-nivel" className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="BASICO">Básico</SelectItem>
                <SelectItem value="INTERMEDIO">Intermedio</SelectItem>
                <SelectItem value="AVANZADO">Avanzado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          {/* Múltiple: un curso puede dictarlo más de un profesor. El botón
              "+ Nuevo instructor" desapareció con la migración
              20260903000000_multi_instructores — un instructor es una cuenta
              real, y no se crea desde un modal de dos campos. */}
          <Label id="curso-instructores-label">Instructores</Label>
          <SelectorInstructores
            id="curso-instructores"
            instructores={instructores}
            seleccionados={idsInstructores}
            onChange={setIdsInstructores}
          />
        </div>

      </div>

      {/* El mockup traía aquí un segundo botón "Publicar curso". Se quitó:
          un curso recién creado no tiene portada, ni módulos, ni lecciones,
          así que nunca pasaría las validaciones de publicación — el botón
          solo podía dar error. Se publica desde el detalle, con el contenido
          ya cargado. */}
      {/* Apiladas a todo el ancho en mobile: lado a lado, "Crear curso" queda
          chico a la izquierda y "Cancelar" empujado al extremo derecho con
          un hueco vacío en medio — dos targets pequeños en esquinas
          opuestas, nada pensado para el pulgar. Desde `sm` vuelven a su
          fila original. */}
      <div className="flex flex-col gap-2.5 border-t border-uva-divider pt-1.5 sm:flex-row">
        <Button type="button" variant="primary" disabled={pending !== null} onClick={handleGuardar}>
          {pending === "borrador" ? "Creando…" : "Crear curso"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="text-uva-muted sm:ml-auto"
          render={<Link href="/admin/cursos" />}
          nativeButton={false}
        >
          Cancelar
        </Button>
      </div>
    </div>
  );
}
