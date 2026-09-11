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
 * Denunciar contenido ajeno en Comunidad — a diferencia de
 * ModerarComunidadDialog, esto no elimina nada: solo entra a la cola de
 * /admin/comunidad para que un admin decida. Por eso el botón de
 * confirmación no es destructivo y el copy es "Enviar reporte", no
 * "Eliminar".
 */
export function ReportarComunidadDialog({
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
  const [enviado, setEnviado] = useState(false);

  function cerrar() {
    onOpenChange(false);
    setMotivo("");
    setError(null);
    setEnviado(false);
  }

  async function confirmar() {
    if (!motivo.trim()) {
      setError("Escribe el motivo del reporte.");
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
    setEnviado(true);
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(next) : cerrar())}>
      <DialogContent className="w-[420px]">
        {enviado ? (
          <>
            <DialogHeader>
              <DialogTitle>Reporte enviado</DialogTitle>
              <DialogDescription>Gracias, un administrador va a revisarlo.</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={cerrar}>
                Cerrar
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Reportar {tipoContenido}</DialogTitle>
              <DialogDescription>
                Contanos por qué — un administrador la va a revisar. Esto no elimina ni oculta nada por sí solo.
              </DialogDescription>
            </DialogHeader>

            {error && (
              <div role="alert" className="rounded-uva-md bg-uva-error-soft px-3.5 py-2.5 text-sm text-uva-error-text">
                {error}
              </div>
            )}

            <div>
              <Label htmlFor="reportar-comunidad-motivo">Motivo</Label>
              <Textarea
                id="reportar-comunidad-motivo"
                autoFocus
                value={motivo}
                onChange={(event) => setMotivo(event.target.value)}
                placeholder={`Por qué reportás esta ${tipoContenido}`}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={cerrar} disabled={pending}>
                Cancelar
              </Button>
              <Button type="button" variant="primary" onClick={confirmar} disabled={pending}>
                {pending ? "Enviando…" : "Enviar reporte"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
