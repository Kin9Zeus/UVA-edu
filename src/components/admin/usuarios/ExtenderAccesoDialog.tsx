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
import { extenderAcceso } from "@/actions/admin/usuarios";
import { useAdminToast } from "@/components/admin/Toast";
import { formatFecha } from "@/lib/admin/format";
import { MAXIMO_DIAS_EXTRA } from "@/lib/admin/acceso-texto";

/** Suma días a un acceso gratuito vigente, contados desde el día en que se le acaba. */
export function ExtenderAccesoDialog({
  open,
  onOpenChange,
  usuarioId,
  usuarioNombre,
  suscripcionId,
  fin,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  usuarioId: string;
  usuarioNombre: string;
  suscripcionId: string;
  /** Cuándo se le acaba hoy. */
  fin: string;
}) {
  const [dias, setDias] = useState("30");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const showToast = useAdminToast();

  const n = Number(dias);
  const valido = Number.isInteger(n) && n >= 1 && n <= MAXIMO_DIAS_EXTRA;
  const nuevoFin = new Date(fin);
  if (valido) nuevoFin.setDate(nuevoFin.getDate() + n);

  function cerrar() {
    onOpenChange(false);
    setDias("30");
    setError(null);
  }

  async function confirmar(evento: React.FormEvent) {
    evento.preventDefault();
    if (!valido) {
      setError(`Escribe un número de días entre 1 y ${MAXIMO_DIAS_EXTRA}.`);
      return;
    }
    setPending(true);
    setError(null);
    const resultado = await extenderAcceso(suscripcionId, usuarioId, n);
    setPending(false);
    if (resultado.error) {
      setError(resultado.error);
      return;
    }
    showToast(`Le diste ${n} días más. Ahora se le acaba el ${formatFecha(nuevoFin.toISOString())}.`);
    cerrar();
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(next) : cerrar())}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] w-[420px] overflow-y-auto">
        <form onSubmit={confirmar} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Darle más días a {usuarioNombre}</DialogTitle>
            <DialogDescription>
              Se suman al final de su acceso, que hoy se le acaba el {formatFecha(fin)}. No se le cobra nada.
            </DialogDescription>
          </DialogHeader>

          {error && (
            <div role="alert" className="rounded-uva-md bg-uva-error-soft px-3.5 py-2.5 text-uva-detalle text-uva-error-text">
              {error}
            </div>
          )}

          <div>
            <Label htmlFor="extender-dias">Cuántos días más</Label>
            <Input
              id="extender-dias"
              type="number"
              inputMode="numeric"
              min={1}
              max={MAXIMO_DIAS_EXTRA}
              autoFocus
              value={dias}
              onChange={(evento) => setDias(evento.target.value)}
              aria-describedby="extender-ayuda"
            />
            <p id="extender-ayuda" className="mt-1.5 text-uva-detalle text-uva-text-muted" aria-live="polite">
              {valido ? `Se le acabará el ${formatFecha(nuevoFin.toISOString())}.` : `Entre 1 y ${MAXIMO_DIAS_EXTRA} días.`}
            </p>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={cerrar} disabled={pending}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary" disabled={pending || !valido}>
              {pending ? "Guardando…" : valido ? `Dar ${n} ${n === 1 ? "día" : "días"} más` : "Dar más días"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
