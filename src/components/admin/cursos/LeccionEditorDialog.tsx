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

export function LeccionEditorDialog({
  leccion,
  cursoId,
  onOpenChange,
}: {
  leccion: LeccionDetalle;
  cursoId: string;
  onOpenChange: (open: boolean) => void;
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
    const resultado = await actualizarLeccion(leccion.id, cursoId, {
      titulo,
      duracion: duracion ? Number(duracion) : null,
      resumen,
    });
    setPending(false);

    if (resultado.error) {
      setError(resultado.error);
      return;
    }
    showToast("Lección guardada.");
    onOpenChange(false);
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar lección</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
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
            <Input id="leccion-video" type="file" accept="video/*" disabled />
            <p className="mt-1 text-xs text-uva-text-faint">
              La carga a Mux (Direct Upload) se conecta en la Fase 2 del roadmap — por ahora este campo es solo
              visual.
            </p>
          </div>

          <div>
            <Label htmlFor="leccion-duracion">Duración (segundos)</Label>
            <Input
              id="leccion-duracion"
              type="number"
              value={duracion}
              onChange={(event) => setDuracion(event.target.value)}
              className="max-w-[160px]"
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
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleGuardar} disabled={pending}>
            {pending ? "Guardando…" : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
