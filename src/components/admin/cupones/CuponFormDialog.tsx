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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAdminToast } from "@/components/admin/Toast";
import { crearCupon, actualizarCupon } from "@/actions/admin/cupones";
import {
  ETIQUETA_TIPO,
  MAX_LARGO_CODIGO,
  TIPOS_DESCUENTO,
  normalizarCodigoCupon,
  type TipoDescuentoCupon,
} from "@/lib/admin/cupones-tipos";
import type { CuponAdmin } from "@/lib/admin/cupones";

/** `yyyy-MM-dd` para el <input type="date">, en hora local. */
function comoValorDeInput(fecha: Date): string {
  const local = new Date(fecha.getTime() - fecha.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

/** Por defecto vence en 30 días: lo que dura una campaña corta. */
function vencimientoPorDefecto(): string {
  return comoValorDeInput(new Date(Date.now() + 30 * 86_400_000));
}

/**
 * Pasa el valor guardado a la unidad que se le muestra al administrador —
 * la inversa de `aValorDeColumna` en el Server Action. Solo MONTO_FIJO se
 * guarda en centavos; un porcentaje se guarda tal cual.
 */
function comoValorDeFormulario(cupon: CuponAdmin): string {
  return cupon.tipoDescuento === "PORCENTAJE"
    ? String(cupon.valor)
    : String(cupon.valor / 100);
}

export function CuponFormDialog({
  open,
  onOpenChange,
  cupon,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null = crear uno nuevo. */
  cupon?: CuponAdmin | null;
}) {
  const editando = cupon != null;

  const [codigo, setCodigo] = useState(cupon?.codigo ?? "");
  const [tipo, setTipo] = useState<TipoDescuentoCupon>(cupon?.tipoDescuento ?? "PORCENTAJE");
  const [valor, setValor] = useState(cupon ? comoValorDeFormulario(cupon) : "");
  const [vencimiento, setVencimiento] = useState(
    cupon ? comoValorDeInput(new Date(cupon.fechaVencimiento)) : vencimientoPorDefecto(),
  );
  const [sinLimite, setSinLimite] = useState(cupon ? cupon.limiteUsos === null : false);
  const [limite, setLimite] = useState(String(cupon?.limiteUsos ?? 50));
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const showToast = useAdminToast();

  // El mínimo del <input type="date"> se fija al montar, no en cada render:
  // leer el reloj durante el render es impuro y el valor cambiaría solo
  // porque el componente se repintó. Mismo criterio que CodigoFormDialog.
  const [minimoVencimiento] = useState(() => comoValorDeInput(new Date(Date.now() + 86_400_000)));

  const esPorcentaje = tipo === "PORCENTAJE";

  function cerrar() {
    setError(null);
    onOpenChange(false);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const comun = {
      valor: Number(valor),
      fechaVencimiento: vencimiento,
      limiteUsos: sinLimite ? null : Number(limite),
    };

    const resultado = editando
      ? await actualizarCupon(cupon.id, comun)
      : await crearCupon({ ...comun, codigo, tipoDescuento: tipo });

    setPending(false);

    if (resultado.error) {
      setError(resultado.error);
      return;
    }

    showToast(editando ? "Cupón actualizado." : "Cupón creado.");
    cerrar();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) cerrar();
        else onOpenChange(next);
      }}
    >
      <DialogContent className="w-[460px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{editando ? `Editar ${cupon.codigo}` : "Nuevo cupón"}</DialogTitle>
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
              <Label htmlFor="cupon-codigo">Código</Label>
              {editando ? (
                // El código es la identidad del cupón y ya se repartió:
                // cambiarlo no lo renombra, mata el que está publicado y crea
                // otro que nadie tiene. Para corregir un código mal escrito
                // que nunca se usó, se elimina y se vuelve a crear.
                <p className="mt-1 font-mono text-[13.5px] tracking-[0.06em] text-uva-muted">
                  {cupon.codigo} <span className="font-sans tracking-normal text-uva-text-faint">· no se puede cambiar</span>
                </p>
              ) : (
                <>
                  <Input
                    id="cupon-codigo"
                    value={codigo}
                    // Se normaliza mientras se escribe para que el campo
                    // muestre exactamente lo que se va a guardar, no una
                    // versión que el servidor corrige por detrás.
                    onChange={(event) => setCodigo(normalizarCodigoCupon(event.target.value))}
                    placeholder="LANZAMIENTO"
                    maxLength={MAX_LARGO_CODIGO}
                    autoComplete="off"
                    className="font-mono tracking-[0.06em] uppercase"
                    required
                  />
                  <p className="mt-1.5 text-xs text-uva-text-faint">
                    Es lo que teclea el estudiante en el checkout. Se guarda siempre en
                    mayúsculas y sin espacios, porque así se compara al canjearlo.
                  </p>
                </>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="cupon-tipo">Tipo de descuento</Label>
                {editando ? (
                  // El tipo decide cómo se lee `valor` (porcentaje o
                  // centavos). Cambiarlo sin tocar el número convertiría un
                  // 20% en veinte centavos — ver `actualizarCupon`.
                  <p className="mt-1 text-[13.5px] text-uva-muted">
                    {ETIQUETA_TIPO[cupon.tipoDescuento]}{" "}
                    <span className="text-uva-text-faint">· no se puede cambiar</span>
                  </p>
                ) : (
                  <Select
                    value={tipo}
                    onValueChange={(value) => setTipo(value as TipoDescuentoCupon)}
                  >
                    <SelectTrigger id="cupon-tipo" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIPOS_DESCUENTO.map((valorTipo) => (
                        <SelectItem key={valorTipo} value={valorTipo}>
                          {ETIQUETA_TIPO[valorTipo]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              <div>
                <Label htmlFor="cupon-valor">{esPorcentaje ? "Porcentaje" : "Monto"}</Label>
                <Input
                  id="cupon-valor"
                  type="number"
                  min={esPorcentaje ? 1 : 0.01}
                  max={esPorcentaje ? 100 : undefined}
                  step={esPorcentaje ? 1 : 0.01}
                  value={valor}
                  onChange={(event) => setValor(event.target.value)}
                  placeholder={esPorcentaje ? "20" : "30000"}
                  required
                />
                <p className="mt-1.5 text-xs text-uva-text-faint">
                  {esPorcentaje
                    ? "Entero entre 1 y 100. Se descuenta sobre el precio del plan."
                    : // La columna no guarda moneda, así que el monto se
                      // aplica igual a un plan en COP que a uno en USD. Si
                      // llega a cubrirlo entero, el checkout lo rechaza en vez
                      // de dejar el total en cero.
                      "En pesos. El mismo monto se aplica a cualquier plan, sin importar su moneda."}
                </p>
              </div>
            </div>

            <div>
              <Label htmlFor="cupon-vencimiento">Vence el</Label>
              <Input
                id="cupon-vencimiento"
                type="date"
                value={vencimiento}
                min={minimoVencimiento}
                onChange={(event) => setVencimiento(event.target.value)}
                required
              />
              <p className="mt-1.5 text-xs text-uva-text-faint">
                Vale hasta el final de ese día. Después deja de aplicarse, pero los cobros que
                ya descontó no cambian.
              </p>
            </div>

            <div>
              <Label htmlFor="cupon-limite">Límite de usos</Label>
              <Input
                id="cupon-limite"
                type="number"
                min={1}
                step={1}
                value={sinLimite ? "" : limite}
                onChange={(event) => setLimite(event.target.value)}
                disabled={sinLimite}
                placeholder={sinLimite ? "Sin tope" : undefined}
                className="max-w-[140px]"
                required={!sinLimite}
              />
              {/* A diferencia de los códigos de invitación, acá `limite_usos`
                  SÍ es nullable: un cupón de descuento no regala acceso, así
                  que una campaña abierta ("20% todo noviembre") es un caso
                  legítimo y no el agujero que sería un código sin tope. */}
              <label className="mt-2 flex w-fit cursor-pointer items-center gap-2 text-[13px] text-uva-muted">
                <Checkbox
                  checked={sinLimite}
                  onCheckedChange={(marcado) => setSinLimite(marcado === true)}
                />
                Sin límite de usos
              </label>
              <p className="mt-1.5 text-xs text-uva-text-faint">
                Solo cuenta los pagos aprobados: validar el código o abandonar el checkout no
                gasta un uso.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={cerrar} disabled={pending}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary" disabled={pending}>
              {pending ? "Guardando…" : editando ? "Guardar" : "Crear cupón"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
