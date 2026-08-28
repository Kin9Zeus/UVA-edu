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
 * Diálogo de revocación compartido por cortesía y membresía manual
 * (f4accesos.md): exige un motivo (obligatorio en el servidor también, ver
 * quitarCortesia/revocarMembresia) y muestra el nombre del usuario afectado
 * en la confirmación — un ConfirmDialog genérico no lleva campo de texto
 * libre, así que este no reutiliza ese componente.
 */
export function RevokeAccessDialog({
  open,
  onOpenChange,
  title,
  usuarioNombre,
  recurso,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  usuarioNombre: string;
  /** Lo que se revoca, p. ej. `"el curso Fundamentos de Vectores"` o `"su membresía"`. */
  recurso: string;
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
      setError("Escribe el motivo de la revocación.");
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
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            ¿Revocar {recurso} a <span className="font-semibold text-uva-text">{usuarioNombre}</span>? El
            acceso se corta en la siguiente petición.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div role="alert" className="rounded-uva-md bg-uva-error-soft px-3.5 py-2.5 text-sm text-uva-error-text">
            {error}
          </div>
        )}

        <div>
          <Label htmlFor="revoke-motivo">Motivo</Label>
          <Textarea
            id="revoke-motivo"
            autoFocus
            value={motivo}
            onChange={(event) => setMotivo(event.target.value)}
            placeholder="Por qué se revoca este acceso"
          />
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={cerrar} disabled={pending}>
            Cancelar
          </Button>
          <Button type="button" variant="destructive" onClick={confirmar} disabled={pending}>
            {pending ? "Revocando…" : "Revocar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
