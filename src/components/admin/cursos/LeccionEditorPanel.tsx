"use client";

import { useState } from "react";
import { X } from "lucide-react";
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
import { actualizarLeccion } from "@/actions/admin/cursos";
import { useAdminToast } from "@/components/admin/Toast";
import type { LeccionDetalle } from "@/lib/admin/cursoDetalle";

const TIPO_CONTENIDO_ITEMS = { video: "Video", lectura: "Lectura", quiz: "Quiz" };

/**
 * Editor de lección del mockup del panel admin: NO es un modal, es la columna
 * derecha fija de la pestaña Contenido (`position:sticky;top:88px`). Se monta
 * dentro de la tarjeta que ContenidoTab deja siempre visible.
 *
 * El formulario se remonta con `key={leccion.id}` desde ContenidoTab, así los
 * campos arrancan con los valores de la lección elegida sin sincronizar estado
 * desde un efecto.
 */
export function LeccionEditorPanel({
  leccion,
  cursoId,
  onCerrar,
  onGuardado,
}: {
  leccion: LeccionDetalle;
  cursoId: string;
  onCerrar: () => void;
  onGuardado: (cambios: Pick<LeccionDetalle, "titulo" | "duracion" | "resumen">) => void;
}) {
  const [titulo, setTitulo] = useState(leccion.titulo);
  const [tipoContenido, setTipoContenido] = useState("video");
  const [duracion, setDuracion] = useState(leccion.duracion?.toString() ?? "");
  const [resumen, setResumen] = useState(leccion.resumen ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const showToast = useAdminToast();

  async function handleGuardar() {
    setPending(true);
    setError(null);
    const cambios = {
      titulo,
      duracion: duracion ? Number(duracion) : null,
      resumen,
    };
    const resultado = await actualizarLeccion(leccion.id, cursoId, cambios);
    setPending(false);

    if (resultado.error) {
      setError(resultado.error);
      return;
    }
    showToast("Lección guardada.");
    onGuardado(cambios);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center">
        <h4 className="font-heading text-[14.5px] font-bold tracking-[-0.02em] text-uva-text">
          Editor de lección
        </h4>
        <Button
          type="button"
          variant="ghost"
          size="auto"
          aria-label="Cerrar el editor de lección"
          className="ml-auto px-2 py-1 text-uva-muted-2 hover:text-uva-text"
          onClick={onCerrar}
        >
          <X className="size-4" />
        </Button>
      </div>

      {error && (
        <div role="alert" className="rounded-uva-md bg-uva-error-soft px-3.5 py-2.5 text-sm text-uva-error-text">
          {error}
        </div>
      )}

      <div>
        <Label htmlFor="leccion-nombre">Nombre</Label>
        <Input id="leccion-nombre" value={titulo} onChange={(event) => setTitulo(event.target.value)} />
      </div>

      <div>
        <Label htmlFor="leccion-tipo">Tipo de contenido</Label>
        <Select
          items={TIPO_CONTENIDO_ITEMS}
          value={tipoContenido}
          onValueChange={(value) => setTipoContenido(value ?? "video")}
        >
          <SelectTrigger id="leccion-tipo" className="w-full"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="video">Video</SelectItem>
            <SelectItem value="lectura">Lectura</SelectItem>
            <SelectItem value="quiz">Quiz</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="leccion-video">Video</Label>
        {/* TODO(Fase 2): Direct Upload a Mux. El mockup dibuja aquí una zona
            punteada de arrastre; hasta que exista la carga real es solo visual. */}
        <div
          id="leccion-video"
          className="rounded-uva-md border-[1.5px] border-dashed border-uva-divider px-3 py-5 text-center text-xs text-uva-muted-2"
        >
          Arrastra tu video aquí o selecciona un archivo
        </div>
      </div>

      <div>
        <Label htmlFor="leccion-duracion">Duración (segundos)</Label>
        <Input
          id="leccion-duracion"
          type="number"
          value={duracion}
          onChange={(event) => setDuracion(event.target.value)}
        />
      </div>

      <div>
        <Label htmlFor="leccion-material">Material adicional</Label>
        <Input id="leccion-material" type="file" disabled />
      </div>

      <div>
        <Label htmlFor="leccion-resumen">Resumen</Label>
        <Textarea
          id="leccion-resumen"
          value={resumen}
          onChange={(event) => setResumen(event.target.value)}
          rows={3}
        />
      </div>

      <Button type="button" variant="primary" onClick={handleGuardar} disabled={pending}>
        {pending ? "Guardando…" : "Guardar cambios"}
      </Button>
    </div>
  );
}
