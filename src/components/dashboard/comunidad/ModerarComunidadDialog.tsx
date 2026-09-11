"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

/**
 * Confirmación al eliminar contenido AJENO en Comunidad (moderación) — exige
 * un motivo (obligatorio en el servidor también, ver eliminarPostComunidad/
 * eliminarRespuestaComunidad), que se le informa al autor por correo. Mismo
 * patrón que RevokeAccessDialog (src/components/admin/usuarios/). Cuando el
 * propio autor elimina lo suyo no pasa por acá — sigue siendo un solo clic.
 */
export function ModerarComunidadDialog({
  open,
  onOpenChange,
  tipoContenido,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tipoContenido: "publicación" | "respuesta";
  onConfirm: (motivo: string) => Promise<{ error?: string }>;
}) {
  const [motivo, setMotivo] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function cerrar() {
    onOpenChange(false);
    setMotivo("");
    setError(null);
  }

  async function confirmar() {
    if (!motivo.trim()) {
      setError("Escribe el motivo de la eliminación.");
      return;
    }
    setPending(true);
    setError(null);
    const resultado = await onConfirm(motivo);
    setPending(false);

    if (resultado.error) {
      setError(resultado.error);
      return;
    }
    cerrar();
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(next) : cerrar())}>
      <DialogContent className="w-[420px]">
        <DialogHeader>
          <DialogTitle>Eliminar {tipoContenido}</DialogTitle>
          <DialogDescription>
            El autor va a recibir un correo con el motivo que escribas acá.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div role="alert" className="rounded-uva-md bg-uva-error-soft px-3.5 py-2.5 text-sm text-uva-error-text">
            {error}
          </div>
        )}

        <div>
          <Label htmlFor="moderar-comunidad-motivo">Motivo</Label>
          <Textarea
            id="moderar-comunidad-motivo"
            autoFocus
            value={motivo}
            onChange={(event) => setMotivo(event.target.value)}
            placeholder={`Por qué se elimina esta ${tipoContenido}`}
          />
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={cerrar} disabled={pending}>
            Cancelar
          </Button>
          <Button type="button" variant="destructive" onClick={confirmar} disabled={pending}>
            {pending ? "Eliminando…" : "Eliminar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
