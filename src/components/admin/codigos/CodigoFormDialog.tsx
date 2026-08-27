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
import { useAdminToast } from "@/components/admin/Toast";
import {
  crearCodigoInvitacion,
  actualizarCodigoInvitacion,
} from "@/actions/admin/codigosInvitacion";
import type { CodigoInvitacion } from "@/lib/admin/codigosInvitacion";

/** `yyyy-MM-dd` para el <input type="date">, en hora local. */
function comoValorDeInput(fecha: Date): string {
  const local = new Date(fecha.getTime() - fecha.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

/** Por defecto vence en 30 días: suficiente para una campaña corta. */
function vencimientoPorDefecto(): string {
  return comoValorDeInput(new Date(Date.now() + 30 * 86_400_000));
}

/** Duración por defecto del acceso que otorga un código nuevo. */
const DURACION_POR_DEFECTO = "30";

export function CodigoFormDialog({
  open,
  onOpenChange,
  codigo,
  onCreado,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null = crear uno nuevo. */
  codigo?: CodigoInvitacion | null;
  onCreado: (codigo: string) => void;
}) {
  const editando = codigo != null;

  const [duracion, setDuracion] = useState(
    codigo ? String(codigo.duracionDias) : DURACION_POR_DEFECTO,
  );
  const [vencimiento, setVencimiento] = useState(
    codigo ? comoValorDeInput(new Date(codigo.fechaVencimiento)) : vencimientoPorDefecto(),
  );
  const [limite, setLimite] = useState(String(codigo?.limiteUsos ?? 1));
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const showToast = useAdminToast();

  // El mínimo del <input type="date"> se fija al montar el diálogo, no en
  // cada render: leer el reloj durante el render es impuro y haría que el
  // valor cambiara solo porque el componente se repintó.
  const [minimoVencimiento] = useState(() =>
    comoValorDeInput(new Date(Date.now() + 86_400_000)),
  );

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);

    // Se manda el final del día elegido: si no, un código "válido hasta el
    // 30" vencería a las 00:00 de ese día, un día antes de lo que el
    // administrador entendió al elegirlo.
    const fechaVencimiento = `${vencimiento}T23:59:59`;
    const limiteUsos = Number(limite);

    // Ramas separadas en vez de un ternario: solo crearCodigoInvitacion
    // devuelve `codigo`, y unir los dos resultados pierde ese campo.
    if (editando) {
      const resultado = await actualizarCodigoInvitacion(codigo.id, {
        fechaVencimiento,
        limiteUsos,
      });
      setPending(false);

      if (resultado.error) {
        setError(resultado.error);
        return;
      }
      showToast("Código actualizado.");
    } else {
      const resultado = await crearCodigoInvitacion({
        duracionDias: Number(duracion),
        fechaVencimiento,
        limiteUsos,
      });
      setPending(false);

      if (resultado.error || !resultado.codigo) {
        setError(resultado.error ?? "No pudimos generar el código.");
        return;
      }
      onCreado(resultado.codigo);
    }

    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : onOpenChange(false))}>
      <DialogContent className="w-[440px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {editando ? `Editar ${codigo.codigo}` : "Nuevo código de invitación"}
            </DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-3.5">
            {error && (
              <div
                role="alert"
                className="rounded-uva-md bg-uva-error-soft px-3.5 py-2.5 text-sm text-uva-error-text"
              >
                {error}
              </div>
            )}

            <div>
              <Label htmlFor="codigo-duracion">Días de acceso</Label>
              {editando ? (
                // La duración es inmutable: el código ya se compartió (y
                // quizá se canjeó) prometiendo ese acceso concreto, y
                // cambiarla no corregiría las suscripciones ya creadas —
                // su fecha de fin se calculó en el momento del canje.
                <p className="mt-1 text-[13.5px] text-uva-muted">
                  {codigo.duracionDias} días{" "}
                  <span className="text-uva-text-faint">· no se puede cambiar</span>
                </p>
              ) : (
                <>
                  <Input
                    id="codigo-duracion"
                    type="number"
                    min={1}
                    max={730}
                    step={1}
                    value={duracion}
                    onChange={(event) => setDuracion(event.target.value)}
                    className="max-w-[120px]"
                    required
                  />
                  <p className="mt-1.5 text-xs text-uva-text-faint">
                    Cuánto dura el acceso desde el momento en que se canjea, sin cobro.
                  </p>
                </>
              )}
            </div>

            <div>
              <Label htmlFor="codigo-vencimiento">Vence el</Label>
              <Input
                id="codigo-vencimiento"
                type="date"
                value={vencimiento}
                min={minimoVencimiento}
                onChange={(event) => setVencimiento(event.target.value)}
                required
              />
              <p className="mt-1.5 text-xs text-uva-text-faint">
                Después de esa fecha el código deja de canjearse. No afecta a las suscripciones
                ya otorgadas.
              </p>
            </div>

            <div>
              {/* Sin interruptor de "ilimitado": un código sin tope no se
                  puede contener si se filtra, así que la base lo prohíbe
                  (limite_usos NOT NULL + CHECK >= 1). Para uso único, 1. */}
              <Label htmlFor="codigo-limite">Límite de usos</Label>
              <Input
                id="codigo-limite"
                type="number"
                min={1}
                step={1}
                value={limite}
                onChange={(event) => setLimite(event.target.value)}
                className="max-w-[120px]"
                required
              />
              <p className="mt-1.5 text-xs text-uva-text-faint">
                Cuántas personas distintas pueden canjearlo. Cada una solo puede una vez.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              Cancelar
            </Button>
            <Button type="submit" variant="primary" disabled={pending}>
              {pending ? "Guardando…" : editando ? "Guardar" : "Generar código"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
