"use client";

import { useState } from "react";
import { Copy, Check, Download } from "lucide-react";
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
import { crearLoteCodigosInvitacion } from "@/actions/admin/lotesCodigosInvitacion";
import { exportarCodigosInvitacionCsv } from "@/actions/admin/exportarCodigosInvitacion";

/** `yyyy-MM-dd` para el <input type="date">, en hora local. */
function comoValorDeInput(fecha: Date): string {
  const local = new Date(fecha.getTime() - fecha.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function vencimientoPorDefecto(): string {
  return comoValorDeInput(new Date(Date.now() + 30 * 86_400_000));
}

/**
 * Generar N códigos individuales de un uso cada uno — opción "Lote de
 * códigos" (rev.md), alternativa a "Código único con cupo N"
 * (CodigoFormDialog). Ver el comentario de
 * src/actions/admin/lotesCodigosInvitacion.ts sobre por qué este componente
 * es independiente del otro modo.
 */
export function LoteFormDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [cantidad, setCantidad] = useState("100");
  const [duracion, setDuracion] = useState("30");
  const [vencimiento, setVencimiento] = useState(vencimientoPorDefecto());
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [exportando, setExportando] = useState(false);
  // Lote recién creado: se ofrece descargarlo de una vez, que es el motivo
  // por el que se entró a esta pantalla (rev.md: "genera 100 códigos, los
  // exporta").
  const [loteCreado, setLoteCreado] = useState<{ id: string; codigos: string[] } | null>(null);
  const [copiadoTodo, setCopiadoTodo] = useState(false);
  const showToast = useAdminToast();

  const [minimoVencimiento] = useState(() => comoValorDeInput(new Date(Date.now() + 86_400_000)));

  function reiniciar() {
    setCantidad("100");
    setDuracion("30");
    setVencimiento(vencimientoPorDefecto());
    setError(null);
    setLoteCreado(null);
    setCopiadoTodo(false);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const fechaVencimiento = `${vencimiento}T23:59:59`;

    const resultado = await crearLoteCodigosInvitacion({
      cantidad: Number(cantidad),
      duracionDias: Number(duracion),
      fechaVencimiento,
    });
    setPending(false);

    if (resultado.error || !resultado.loteId || !resultado.codigos) {
      setError(resultado.error ?? "No pudimos generar el lote.");
      return;
    }

    setLoteCreado({ id: resultado.loteId, codigos: resultado.codigos });
  }

  async function handleCopiarTodo() {
    if (!loteCreado) return;
    try {
      await navigator.clipboard.writeText(loteCreado.codigos.join("\n"));
      setCopiadoTodo(true);
      setTimeout(() => setCopiadoTodo(false), 2000);
    } catch {
      showToast("No pudimos copiar. Descarga el CSV en su lugar.", "error");
    }
  }

  async function handleDescargarCsv() {
    if (!loteCreado) return;
    setExportando(true);
    try {
      const respuesta = await exportarCodigosInvitacionCsv(loteCreado.id);
      if (respuesta.error || !respuesta.csv || !respuesta.nombreArchivo) {
        showToast(respuesta.error ?? "No pudimos generar la exportación.", "error");
        return;
      }
      const blob = new Blob([respuesta.csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const enlace = document.createElement("a");
      enlace.href = url;
      enlace.download = respuesta.nombreArchivo;
      enlace.click();
      URL.revokeObjectURL(url);
      showToast("Exportación descargada.");
    } finally {
      setExportando(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) reiniciar();
      }}
    >
      <DialogContent className="w-[480px]">
        {!loteCreado ? (
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>Nuevo lote de códigos</DialogTitle>
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
                <Label htmlFor="lote-cantidad">Cantidad de códigos</Label>
                <Input
                  id="lote-cantidad"
                  type="number"
                  min={2}
                  max={500}
                  step={1}
                  value={cantidad}
                  onChange={(event) => setCantidad(event.target.value)}
                  className="max-w-[120px]"
                  required
                />
                <p className="mt-1.5 text-xs text-uva-text-faint">
                  Cada código generado sirve para un solo canje, de una sola persona.
                </p>
              </div>

              <div>
                <Label htmlFor="lote-duracion">Días de acceso</Label>
                <Input
                  id="lote-duracion"
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
                  Cuánto dura el acceso de cada persona desde el momento en que canjea su código.
                </p>
              </div>

              <div>
                <Label htmlFor="lote-vencimiento">Vence el</Label>
                <Input
                  id="lote-vencimiento"
                  type="date"
                  value={vencimiento}
                  min={minimoVencimiento}
                  onChange={(event) => setVencimiento(event.target.value)}
                  required
                />
                <p className="mt-1.5 text-xs text-uva-text-faint">
                  Fecha límite para canjear cualquier código del lote. Aplica igual a los{" "}
                  {cantidad || "N"} códigos.
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
                {pending ? "Generando…" : "Generar lote"}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>{loteCreado.codigos.length} códigos generados</DialogTitle>
            </DialogHeader>

            <div className="flex flex-col gap-3">
              <div className="max-h-[240px] overflow-y-auto rounded-uva-md border border-uva-divider bg-uva-surface-2 p-3">
                <ul className="grid grid-cols-2 gap-x-3 gap-y-1 font-mono text-[12.5px] text-uva-text">
                  {loteCreado.codigos.map((codigo) => (
                    <li key={codigo}>{codigo}</li>
                  ))}
                </ul>
              </div>

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-auto"
                  onClick={handleCopiarTodo}
                >
                  {copiadoTodo ? <Check className="size-4" /> : <Copy className="size-4" />}
                  {copiadoTodo ? "Copiados" : "Copiar todos"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-auto"
                  onClick={handleDescargarCsv}
                  disabled={exportando}
                >
                  <Download className="size-4" />
                  {exportando ? "Preparando…" : "Descargar CSV"}
                </Button>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="primary" onClick={() => onOpenChange(false)}>
                Listo
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
