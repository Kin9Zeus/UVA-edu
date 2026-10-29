"use client";

import { useState } from "react";
import { Copy, Download, MessageSquare } from "lucide-react";
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
import { useAdminToast } from "@/components/admin/Toast";
import { descargarCsvLote } from "@/components/admin/codigos/descargarCsv";
import { actualizarCodigoInvitacion, crearCodigoInvitacion } from "@/actions/admin/codigosInvitacion";
import { crearLoteCodigosInvitacion } from "@/actions/admin/lotesCodigosInvitacion";
import { formatFecha } from "@/lib/admin/format";
import type { CodigoInvitacion } from "@/lib/admin/codigosInvitacion";
import { cn } from "@/lib/utils";

type Modo = "compartido" | "lote";

type Listo =
  | { tipo: "codigo"; codigo: string; personas: number; dias: number; vence: string; sitio: string }
  | { tipo: "lote"; loteId: string; codigos: string[] };

/** `yyyy-MM-dd` para el <input type="date">, en hora local. */
function comoValorDeInput(fecha: Date): string {
  const local = new Date(fecha.getTime() - fecha.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

const PERSONAS_POR_DEFECTO: Record<Modo, string> = { compartido: "20", lote: "100" };

function invitacion(listo: Extract<Listo, { tipo: "codigo" }>) {
  return (
    `Te invito a U.V.A, la plataforma de cursos de arquitectura. Entra a ${listo.sitio}/canjear, ` +
    `inicia sesión o crea tu cuenta y escribe este código: ${listo.codigo}\n` +
    `Te da ${listo.dias} días de acceso. Puedes canjearlo hasta el ${formatFecha(listo.vence)}.`
  );
}

/**
 * Crear un código (de las dos formas) y editar uno compartido. Al crear, el
 * diálogo no se cierra: muestra el código listo para copiar o el lote para
 * descargar, que es para lo que se entró a esta pantalla.
 *
 * Las dos formas siguen siendo dos acciones (`crearCodigoInvitacion` y
 * `crearLoteCodigosInvitacion`) porque cuál se queda es una decisión
 * pendiente (rev.md); aquí solo comparten el formulario.
 */
export function CodigoFormDialog({
  open,
  onOpenChange,
  codigo,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null = crear. */
  codigo: CodigoInvitacion | null;
}) {
  const editando = codigo !== null;
  const [modo, setModo] = useState<Modo>("compartido");
  const [personas, setPersonas] = useState(codigo ? String(codigo.limiteUsos) : PERSONAS_POR_DEFECTO.compartido);
  const [duracion, setDuracion] = useState("30");
  // El reloj se lee al montar el diálogo, no en cada render.
  const [hoy] = useState(() => Date.now());
  const [vencimiento, setVencimiento] = useState(() =>
    comoValorDeInput(
      codigo && new Date(codigo.fechaVencimiento).getTime() > hoy ? new Date(codigo.fechaVencimiento) : new Date(hoy + 30 * 86_400_000),
    ),
  );
  const minimoVencimiento = comoValorDeInput(new Date(hoy + 86_400_000));
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [listo, setListo] = useState<Listo | null>(null);
  const showToast = useAdminToast();
  const lote = !editando && modo === "lote";

  function elegirModo(nuevo: Modo) {
    setModo(nuevo);
    setPersonas(PERSONAS_POR_DEFECTO[nuevo]);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    // El final del día elegido: "hasta el 30" incluye el 30.
    const fechaVencimiento = `${vencimiento}T23:59:59`;
    const cantidad = Number(personas);

    if (editando) {
      const resultado = await actualizarCodigoInvitacion(codigo.id, { fechaVencimiento, limiteUsos: cantidad });
      setPending(false);
      if (resultado.error) return setError(resultado.error);
      showToast(`Guardaste los cambios de ${codigo.codigo}.`);
      onOpenChange(false);
      return;
    }

    if (lote) {
      const resultado = await crearLoteCodigosInvitacion({ cantidad, duracionDias: Number(duracion), fechaVencimiento });
      setPending(false);
      if (resultado.error || !resultado.loteId || !resultado.codigos) {
        return setError(resultado.error ?? "No pudimos crear los códigos.");
      }
      setListo({ tipo: "lote", loteId: resultado.loteId, codigos: resultado.codigos });
      return;
    }

    const resultado = await crearCodigoInvitacion({ duracionDias: Number(duracion), fechaVencimiento, limiteUsos: cantidad });
    setPending(false);
    if (resultado.error || !resultado.codigo) return setError(resultado.error ?? "No pudimos crear el código.");
    setListo({
      tipo: "codigo",
      codigo: resultado.codigo,
      personas: cantidad,
      dias: Number(duracion),
      vence: fechaVencimiento,
      sitio: window.location.origin,
    });
  }

  async function copiar(texto: string, aviso: string) {
    try {
      await navigator.clipboard.writeText(texto);
      showToast(aviso);
    } catch {
      showToast("No pudimos copiar. Selecciona el texto y cópialo a mano.", "error");
    }
  }

  async function descargar(loteId: string) {
    const fallo = await descargarCsvLote(loteId);
    showToast(fallo ?? "Descargaste el CSV del lote.", fallo ? "error" : undefined);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] w-[520px] overflow-y-auto">
        {listo?.tipo === "codigo" ? (
          <>
            <DialogHeader>
              <DialogTitle>Código listo</DialogTitle>
              <DialogDescription>
                Sirve para {listo.personas === 1 ? "1 persona" : `${listo.personas} personas`}. Compártelo con quienes vas a invitar.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-3">
              <p className="m-0 rounded-uva-md border border-uva-divider bg-uva-bg px-4 py-4 text-center font-codigo text-uva-titulo-4 font-semibold tracking-[0.08em] break-all text-uva-text">
                {listo.codigo}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="primary" className="max-sm:flex-1" onClick={() => copiar(listo.codigo, `Código ${listo.codigo} copiado.`)}>
                  <Copy aria-hidden />
                  Copiar código
                </Button>
                <Button type="button" variant="outline" className="max-sm:flex-1" onClick={() => copiar(invitacion(listo), "Invitación copiada. Pégala en WhatsApp o en un correo.")}>
                  <MessageSquare aria-hidden />
                  Copiar invitación
                </Button>
              </div>
              <p className="m-0 rounded-uva-md border border-uva-divider bg-uva-bg px-3.5 py-3 text-uva-detalle break-words whitespace-pre-line text-uva-text-muted">
                {invitacion(listo)}
              </p>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Listo
              </Button>
            </DialogFooter>
          </>
        ) : listo?.tipo === "lote" ? (
          <>
            <DialogHeader>
              <DialogTitle>{listo.codigos.length} códigos listos</DialogTitle>
              <DialogDescription>
                Cada uno sirve para una sola persona. Descárgalos o cópialos para repartirlos. Siempre los encuentras en
                la lista, en «Ver códigos».
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="primary" className="max-sm:flex-1" onClick={() => descargar(listo.loteId)}>
                <Download aria-hidden />
                Descargar CSV
              </Button>
              <Button
                type="button"
                variant="outline"
                className="max-sm:flex-1"
                onClick={() => copiar(listo.codigos.join("\n"), `Copiaste los ${listo.codigos.length} códigos, uno por línea.`)}
              >
                <Copy aria-hidden />
                Copiar todos
              </Button>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Listo
              </Button>
            </DialogFooter>
          </>
        ) : (
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>{editando ? `Editar ${codigo.codigo}` : "Nuevo código de invitación"}</DialogTitle>
            </DialogHeader>

            <div className="flex flex-col gap-4">
              {error && (
                <div role="alert" className="rounded-uva-md bg-uva-error-soft px-3.5 py-2.5 text-uva-detalle text-uva-error-text">
                  {error}
                </div>
              )}

              {editando ? (
                <div>
                  <p className="m-0 text-uva-detalle font-semibold text-uva-text">Días de acceso</p>
                  <p className="m-0 mt-1 text-uva-cuerpo text-uva-text">{codigo.duracionDias} días</p>
                  {/* Inmutable: el código ya se repartió prometiendo ese acceso,
                      y cambiarlo no corregiría los canjes ya hechos. */}
                  <p className="m-0 mt-1 text-uva-detalle text-uva-text-muted">
                    No se puede cambiar: el código ya se repartió prometiendo ese acceso.
                  </p>
                </div>
              ) : (
                <fieldset className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0">
                  <legend className="mb-2 p-0 text-uva-detalle font-semibold text-uva-text">Cómo lo vas a repartir</legend>
                  <div className="grid gap-2.5 sm:grid-cols-2">
                    {(
                      [
                        ["compartido", "Un código para varias personas", "El mismo para todos, por ejemplo para un grupo o una clase."],
                        ["lote", "Un código para cada persona", "Un lote de códigos de un solo uso, para repartir uno a uno."],
                      ] as const
                    ).map(([valor, titulo, texto]) => (
                      <button
                        key={valor}
                        type="button"
                        aria-pressed={modo === valor}
                        onClick={() => elegirModo(valor)}
                        className={cn(
                          "flex flex-col gap-1 rounded-uva-md border border-uva-line-strong bg-uva-surface px-3.5 py-3 text-left",
                          modo === valor && "border-uva-btn bg-uva-accent-soft ring-1 ring-uva-btn",
                        )}
                      >
                        <span className="text-uva-detalle font-bold text-uva-text">{titulo}</span>
                        <span className="text-uva-detalle text-uva-text-muted">{texto}</span>
                      </button>
                    ))}
                  </div>
                </fieldset>
              )}

              <div className="grid gap-3.5 sm:grid-cols-2">
                <div>
                  <Label htmlFor="codigo-personas">{lote ? "Cuántos códigos" : "Para cuántas personas"}</Label>
                  <Input
                    id="codigo-personas"
                    type="number"
                    inputMode="numeric"
                    min={lote ? 2 : Math.max(1, codigo?.vecesUsado ?? 1)}
                    max={lote ? 500 : undefined}
                    step={1}
                    value={personas}
                    onChange={(event) => setPersonas(event.target.value)}
                    required
                  />
                  <p className="m-0 mt-1.5 text-uva-detalle text-uva-text-muted">
                    {lote
                      ? "Hasta 500."
                      : editando && codigo.vecesUsado > 0
                        ? `Ya lo canjearon ${codigo.vecesUsado}.`
                        : "Cada persona lo canjea una sola vez."}
                  </p>
                </div>
                {!editando && (
                  <div>
                    <Label htmlFor="codigo-duracion">Días de acceso</Label>
                    <Input
                      id="codigo-duracion"
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={730}
                      step={1}
                      value={duracion}
                      onChange={(event) => setDuracion(event.target.value)}
                      required
                    />
                    <p className="m-0 mt-1.5 text-uva-detalle text-uva-text-muted">Cuentan desde que se canjea.</p>
                  </div>
                )}
                <div className={cn(!editando && "sm:col-span-2")}>
                  <Label htmlFor="codigo-vencimiento">Se puede canjear hasta</Label>
                  <Input
                    id="codigo-vencimiento"
                    type="date"
                    value={vencimiento}
                    min={minimoVencimiento}
                    onChange={(event) => setVencimiento(event.target.value)}
                    required
                  />
                  <p className="m-0 mt-1.5 text-uva-detalle text-uva-text-muted">
                    {editando
                      ? "Hasta el final de ese día."
                      : "Después de ese día ya no sirve para entrar. A quien ya lo canjeó no le cambia nada."}
                  </p>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
                Cancelar
              </Button>
              <Button type="submit" variant="primary" disabled={pending}>
                {pending
                  ? "Guardando…"
                  : editando
                    ? "Guardar cambios"
                    : lote
                      ? `Crear ${Number(personas) > 0 ? `${Number(personas)} ` : ""}códigos`
                      : "Crear código"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
