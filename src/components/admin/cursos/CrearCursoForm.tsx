"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
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
import { crearCurso, subirPortadaCurso, type NivelCurso } from "@/actions/admin/cursos";
import { useAdminToast } from "@/components/admin/Toast";
import { InstructorFormDialog } from "@/components/admin/instructores/InstructorFormDialog";

const NIVEL_ITEMS = { BASICO: "Básico", INTERMEDIO: "Intermedio", AVANZADO: "Avanzado" };

// Mismo valor que TAMANO_MAXIMO_PORTADA en actions/admin/cursos.ts. No se
// puede importar desde ahí: ese módulo tiene "use server" a nivel de
// archivo, así que solo puede exportar funciones async.
const TAMANO_MAXIMO_PORTADA = 5 * 1024 * 1024;

export function CrearCursoForm({
  categorias,
  instructores: instructoresIniciales,
}: {
  categorias: { id: string; nombre: string }[];
  instructores: { id: string; nombre: string }[];
}) {
  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [portadaArchivo, setPortadaArchivo] = useState<File | null>(null);
  const [errorPortada, setErrorPortada] = useState<string | null>(null);
  const [categoriaId, setCategoriaId] = useState("");
  const [nivel, setNivel] = useState<NivelCurso>("BASICO");
  const [instructores, setInstructores] = useState(instructoresIniciales);
  const [idInstructor, setIdInstructor] = useState("");
  const [instructorDialogOpen, setInstructorDialogOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<"borrador" | "publicar" | null>(null);
  const inputPortadaRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const showToast = useAdminToast();

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

    if (!archivo.type.startsWith("image/")) {
      setErrorPortada("El archivo debe ser una imagen.");
      return;
    }
    if (archivo.size > TAMANO_MAXIMO_PORTADA) {
      setErrorPortada("La imagen no puede superar los 5 MB.");
      return;
    }
    setErrorPortada(null);
    setPortadaArchivo(archivo);
  }

  const categoriaItems = useMemo(
    () => Object.fromEntries(categorias.map((c) => [c.id, c.nombre])),
    [categorias],
  );

  const instructorItems = useMemo(
    () => Object.fromEntries(instructores.map((i) => [i.id, i.nombre])),
    [instructores],
  );

  // El instructor recién creado se añade a la lista local y queda
  // seleccionado, para no perder lo que ya se llevaba escrito en el resto
  // del formulario mientras el Server Component se revalida.
  function handleInstructorCreado(id: string, nombre: string) {
    setInstructores((actuales) =>
      [...actuales, { id, nombre }].sort((a, b) => a.nombre.localeCompare(b.nombre)),
    );
    setIdInstructor(id);
  }

  async function handleGuardar(publicar: boolean) {
    setPending(publicar ? "publicar" : "borrador");
    setError(null);

    const resultado = await crearCurso({
      titulo,
      descripcion,
      categoriaId,
      nivel,
      idInstructor,
      publicar,
    });

    if (resultado.error || !resultado.id) {
      setPending(null);
      setError(resultado.error ?? "No pudimos crear el curso.");
      return;
    }

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
    showToast(publicar ? "Curso publicado." : "Curso guardado como borrador.");
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
            Recomendado: 1280×720px (relación 16:9), como se ve en la vista previa.
          </p>
          <input
            ref={inputPortadaRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleSeleccionarPortada}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="curso-categoria">Categoría</Label>
            <Select
              items={categoriaItems}
              value={categoriaId}
              onValueChange={(value) => setCategoriaId(value ?? "")}
            >
              <SelectTrigger id="curso-categoria" className="w-full"><SelectValue placeholder="Selecciona una categoría" /></SelectTrigger>
              <SelectContent>
                {categorias.map((categoria) => (
                  <SelectItem key={categoria.id} value={categoria.id}>
                    {categoria.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
          <Label htmlFor="curso-instructor">Instructor</Label>
          <div className="flex items-center gap-2">
            <Select
              items={instructorItems}
              value={idInstructor}
              onValueChange={(value) => setIdInstructor(value ?? "")}
            >
              <SelectTrigger id="curso-instructor" className="w-full">
                <SelectValue placeholder="Selecciona un instructor" />
              </SelectTrigger>
              <SelectContent>
                {instructores.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="outline"
              className="w-auto shrink-0"
              onClick={() => setInstructorDialogOpen(true)}
            >
              <Plus className="size-4" />
              Nuevo
            </Button>
          </div>
          {instructores.length === 0 && (
            <p className="mt-1.5 text-xs text-uva-text-faint">
              Todavía no hay instructores. Crea el primero con el botón de al lado.
            </p>
          )}
        </div>

      </div>

      <div className="flex gap-2.5 border-t border-uva-divider pt-1.5">
        <Button type="button" disabled={pending !== null} onClick={() => handleGuardar(false)}>
          {pending === "borrador" ? "Guardando…" : "Guardar como borrador"}
        </Button>
        <Button type="button" variant="primary" disabled={pending !== null} onClick={() => handleGuardar(true)}>
          {pending === "publicar" ? "Publicando…" : "Publicar curso"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="ml-auto text-uva-muted"
          render={<Link href="/admin/cursos" />}
          nativeButton={false}
        >
          Cancelar
        </Button>
      </div>

      <InstructorFormDialog
        open={instructorDialogOpen}
        onOpenChange={setInstructorDialogOpen}
        onCreado={handleInstructorCreado}
      />
    </div>
  );
}
