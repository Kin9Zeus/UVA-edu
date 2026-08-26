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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  // El mockup rotula siempre "Confirmar": el título y el cuerpo ya dicen
  // qué se va a hacer, así que la etiqueta no repite la acción.
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  // Cuando viene con valor, exige escribir exactamente ese texto (el nombre
  // del curso/módulo/lección) antes de habilitar el botón de confirmar.
  // Reservado para acciones destructivas de verdad: un simple Sí/No es
  // demasiado fácil de aceptar sin leer.
  confirmText,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmText?: string;
  onConfirm: () => Promise<void> | void;
}) {
  const [pending, setPending] = useState(false);
  const [escrito, setEscrito] = useState("");
  const [openAnterior, setOpenAnterior] = useState(open);

  // Se limpia cada vez que el diálogo se abre, para que un "Eliminar" previo
  // no deje el texto correcto ya cargado en el siguiente elemento. Se ajusta
  // durante el render (no en un efecto) — es el patrón que React recomienda
  // para "resetear estado cuando cambia una prop", sin el render extra que
  // dispararía un setState dentro de un efecto.
  if (open !== openAnterior) {
    setOpenAnterior(open);
    if (open) setEscrito("");
  }

  const bloqueadoPorTexto = confirmText !== undefined && escrito.trim() !== confirmText.trim();

  async function handleConfirm() {
    if (bloqueadoPorTexto) return;
    setPending(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[360px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {confirmText !== undefined && (
          <div>
            <Label htmlFor="confirm-dialog-texto">
              Escribe <span className="font-semibold text-uva-text">{confirmText}</span> para confirmar
            </Label>
            <Input
              id="confirm-dialog-texto"
              autoFocus
              autoComplete="off"
              value={escrito}
              onChange={(event) => setEscrito(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && handleConfirm()}
            />
          </div>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            {cancelLabel}
          </Button>
          {/* El mockup pinta SIEMPRE el boton de confirmacion en magenta
              solido, incluso cuando la accion es destructiva. */}
          <Button
            type="button"
            variant="primary"
            onClick={handleConfirm}
            disabled={pending || bloqueadoPorTexto}
          >
            {pending ? "Procesando…" : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
