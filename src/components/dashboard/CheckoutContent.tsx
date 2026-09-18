"use client";

import { Fragment, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, TicketPercent, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { iniciarCheckout } from "@/actions/suscripciones/checkout";
import { validarCodigoCupon, type DesgloseVisible } from "@/actions/cupones/validar";
import {
  type PlanRow,
  sharedBenefits,
  BENEFICIOS_POR_NIVEL,
  BENEFICIOS_POR_DEFECTO,
  formatearPrecio,
  periodo,
  meta,
  ahorroPorcentaje,
} from "@/lib/planes";

/** Un plan con la vigencia ya calculada y formateada por el servidor. */
export type PlanCheckout = PlanRow & { vigenteHasta: string };

/**
 * Lo que trae el plan elegido.
 *
 * Se monta dos veces —una dentro de la rejilla de planes, otra debajo de
 * ella— y cada copia se apaga en el breakpoint de la otra. No es un capricho:
 * en móvil la lista tiene que caer pegada al plan que acabas de marcar, y para
 * eso debe ser hermana de las tarjetas; en escritorio la rejilla tiene dos
 * columnas, y un bloque a todo lo ancho metido ahí dejaría una celda vacía
 * cada vez que el número de planes activos sea impar.
 *
 * La copia oculta lo está con `display:none`, así que no se pinta ni la
 * anuncia un lector de pantalla: nunca hay dos encabezados "Qué incluye" a la
 * vez, solo el que corresponde al ancho actual.
 */
function QueIncluye({
  incluidos,
  className,
}: {
  incluidos: number;
  className?: string;
}) {
  return (
    <div className={cn("border-t border-uva-divider", className)}>
      <h2 className="m-0 mb-4 text-base text-uva-text">Qué incluye</h2>
      <ul className="m-0 flex list-none flex-col gap-2 p-0 text-[12.5px]">
        {sharedBenefits.map((beneficio, indice) => {
          const incluido = indice < incluidos;
          return (
            <li
              key={beneficio}
              className={cn(
                "flex items-center gap-2",
                incluido ? "text-uva-text" : "text-uva-text-disabled opacity-45",
              )}
            >
              <Check
                className={cn(
                  "size-3.5 shrink-0",
                  incluido ? "text-uva-accent-2-text" : "text-uva-text-disabled",
                )}
                aria-hidden
              />
              {beneficio}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * Confirmación de la compra: elegir plan a la izquierda, resumen a la derecha.
 *
 * El resumen es la pieza que faltaba. Antes el cupón vivía dentro de cada
 * tarjeta de plan, así que el descuento aparecía debajo del botón mientras el
 * precio de lista seguía intacto encima — dos cifras distintas para la misma
 * compra. Aquí el total es uno solo, y el cupón es una línea más del desglose,
 * no una pantalla aparte.
 *
 * El plan se puede cambiar sin perder el cupón: `elegirPlan` lo revalida
 * contra el plan nuevo. Es necesario, no un lujo — un cupón de PORCENTAJE
 * descuenta distinto sobre cada precio, y conservar el desglose anterior
 * mostraría el descuento del plan viejo aplicado al nuevo.
 *
 * Nada de lo que se muestra aquí se le cree al enviar: `iniciarCheckout`
 * vuelve a leer el plan y a validar el cupón contra la base. Esta pantalla
 * informa, el Server Action decide.
 */
export function CheckoutContent({
  planes,
  idPlanInicial,
}: {
  planes: PlanCheckout[];
  idPlanInicial: string;
}) {
  const [idPlan, setIdPlan] = useState(idPlanInicial);
  const [codigo, setCodigo] = useState("");
  /** El código que YA pasó la validación. Distinto de `codigo`, que es lo que
   *  se está escribiendo y todavía no vale nada. */
  const [cuponAplicado, setCuponAplicado] = useState<string | null>(null);
  const [desglose, setDesglose] = useState<DesgloseVisible | null>(null);
  const [mostrarCampo, setMostrarCampo] = useState(false);
  const [validando, setValidando] = useState(false);
  const [pagando, setPagando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Segundos que faltan para poder volver a probar un cupón tras el rate
  // limit (P2-1). null = sin bloqueo activo. Mismo patrón que
  // CanjearCodigoForm, que ya lo hace para los códigos de invitación.
  const [segundosBloqueo, setSegundosBloqueo] = useState<number | null>(null);

  // Cuenta regresiva de un segundo en segundo mientras dure el bloqueo.
  // Al llegar a 0 se limpia sola y el campo vuelve a habilitarse.
  useEffect(() => {
    if (segundosBloqueo === null || segundosBloqueo <= 0) return;
    const id = setTimeout(() => {
      setSegundosBloqueo((s) => (s !== null && s > 1 ? s - 1 : null));
    }, 1000);
    return () => clearTimeout(id);
  }, [segundosBloqueo]);

  const plan = planes.find((p) => p.id === idPlan) ?? planes[0];

  // Referencia del badge de ahorro: el plan activo más corto, igual criterio
  // que PlanesContent y que la home pública.
  const referencia = planes.reduce((menor, p) =>
    p.duracion_dias < menor.duracion_dias ? p : menor,
  );

  const incluidos = BENEFICIOS_POR_NIVEL[plan.nivel_acceso ?? ""] ?? BENEFICIOS_POR_DEFECTO;
  const precioLista = formatearPrecio(plan.precio_centavos, plan.moneda);
  const total = desglose ? desglose.total : precioLista;
  const ocupado = validando || pagando;
  /**
   * Deliberadamente FUERA de `ocupado`: el bloqueo es del cupón, no del pago.
   * Meterlo en `ocupado` deshabilitaría también el botón de pagar, y dejaría
   * a alguien que se equivocó tecleando códigos sin poder comprar a precio
   * de lista — un rate limit que termina costando la venta que protegía.
   */
  const cuponBloqueado = segundosBloqueo !== null && segundosBloqueo > 0;

  async function elegirPlan(nuevoId: string) {
    if (nuevoId === idPlan) return;
    setIdPlan(nuevoId);
    setError(null);

    if (!cuponAplicado) return;

    // Revalidar contra el plan nuevo. Si el cupón dejó de servir (por ejemplo
    // porque cubre el plan entero y el total quedaría en cero) se quita y se
    // dice por qué, en vez de dejar un descuento que ya no corresponde.
    setValidando(true);
    const resultado = await validarCodigoCupon(nuevoId, cuponAplicado);
    setValidando(false);

    if (resultado.ok) {
      setDesglose(resultado.desglose);
      return;
    }
    setCuponAplicado(null);
    setDesglose(null);
    setError(resultado.error);
    if (typeof resultado.segundosEspera === "number") {
      setSegundosBloqueo(resultado.segundosEspera);
    }
  }

  async function aplicarCupon() {
    setValidando(true);
    setError(null);

    const resultado = await validarCodigoCupon(idPlan, codigo);
    setValidando(false);

    if (resultado.ok) {
      setDesglose(resultado.desglose);
      setCuponAplicado(codigo.trim().toUpperCase());
      setMostrarCampo(false);
      setSegundosBloqueo(null);
      return;
    }
    setDesglose(null);
    setCuponAplicado(null);
    setError(resultado.error);
    // Solo viene cuando el rechazo fue por rate limit: deja el campo
    // deshabilitado hasta que expire, en vez de que seguir dando clic
    // muestre el mismo error una y otra vez.
    if (typeof resultado.segundosEspera === "number") {
      setSegundosBloqueo(resultado.segundosEspera);
    }
  }

  function cerrarCampo() {
    setMostrarCampo(false);
    setCodigo("");
    setError(null);
  }

  function quitarCupon() {
    setCuponAplicado(null);
    setDesglose(null);
    setCodigo("");
    setError(null);
  }

  async function pagar() {
    setPagando(true);
    setError(null);

    // Solo viaja el cupón que quedó validado. Mandar uno que ya falló haría
    // que el Server Action lo rechazara con el mismo mensaje que el
    // estudiante acaba de ver.
    const resultado = await iniciarCheckout(idPlan, cuponAplicado ?? undefined);

    // Solo se vuelve de `iniciarCheckout` cuando NO hubo redirect, es decir,
    // cuando algo impidió cobrar.
    setPagando(false);
    if (resultado?.error) setError(resultado.error);
  }

  return (
    <div className="px-[clamp(20px,3vw,44px)] py-8">
      <div className="max-w-[1000px]">
        <Link
          href="/dashboard/planes"
          className="mb-4 inline-flex items-center gap-1.5 text-[12.5px] text-uva-text-muted underline-offset-2 hover:text-uva-text hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-uva-accent"
        >
          <ArrowLeft className="size-3.5" aria-hidden />
          Volver a los planes
        </Link>

        <h1 className="mb-6 text-2xl text-uva-text">
          Confirma tu suscripción
        </h1>

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_336px]">
          {/* ---------- Izquierda: plan y contenido ---------- */}
          <div className="flex flex-col gap-5">
            <fieldset className="m-0 border-0 p-0">
              <legend className="mb-4 text-base text-uva-text">
                Elige tu plan
              </legend>

              <div className="grid gap-3 sm:grid-cols-2">
                {planes.map((p) => {
                  const elegido = p.id === idPlan;
                  const badge = ahorroPorcentaje(p, referencia);

                  return (
                    <Fragment key={p.id}>
                      <label
                        className={cn(
                          "flex cursor-pointer gap-3 rounded-uva-md border p-4 transition-colors focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-uva-accent",
                          elegido
                            ? "border-uva-accent bg-uva-accent/10"
                            : "border-uva-divider bg-uva-surface hover:bg-uva-hover",
                          ocupado && "cursor-not-allowed opacity-60",
                        )}
                      >
                        <input
                          type="radio"
                          name="plan"
                          value={p.id}
                          checked={elegido}
                          onChange={() => elegirPlan(p.id)}
                          disabled={ocupado}
                          className="sr-only"
                        />
                        <span
                          aria-hidden
                          className={cn(
                            "mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border",
                            elegido ? "border-uva-accent" : "border-uva-text-faint",
                          )}
                        >
                          {elegido && <span className="size-2 rounded-full bg-uva-accent" />}
                        </span>

                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span className="font-heading text-[15px] text-uva-text">
                              {p.nombre}
                            </span>
                            {badge && (
                              <span className="rounded-full bg-uva-accent-soft px-2 py-0.5 text-[10.5px] text-uva-accent-text">
                                {badge}
                              </span>
                            )}
                          </span>

                          <span className="mt-1.5 block">
                            <span className="font-heading text-[22px] text-uva-text">
                              {formatearPrecio(p.precio_centavos, p.moneda)}
                            </span>
                            <span className="text-[12.5px] text-uva-text-faint">
                              {" "}
                              {periodo(p.duracion_dias)}
                            </span>
                          </span>

                          <span className="mt-0.5 block text-[12px] text-uva-text-faint">
                            {meta(p)}
                          </span>
                        </span>
                      </label>

                      {/* En una sola columna, "Qué incluye" tiene que caer
                          aquí —bajo la tarjeta marcada— y no al final de la
                          lista de planes: en móvil el plan de abajo empuja el
                          detalle fuera de la pantalla y deja de leerse como
                          respuesta a la elección que se acaba de hacer. En
                          escritorio las tarjetas van lado a lado y ese
                          problema no existe, así que esta copia se apaga y
                          manda la de abajo. */}
                      {elegido && (
                        <QueIncluye
                          incluidos={incluidos}
                          className="mt-2 pt-4 pb-2 sm:hidden"
                        />
                      )}
                    </Fragment>
                  );
                })}
              </div>
            </fieldset>

            {/* Sin marco, a propósito: esto es el detalle de lo que trae el
                plan que acabas de elegir, no un objeto aparte. Enmarcado
                competía con las tarjetas de plan de arriba y con el Resumen
                —que sí gana su marco, por ser el bloque fijo con el que se
                interactúa— y dejaba la columna izquierda pareja, sin nada que
                indicara qué es principal y qué es apoyo. Una línea separa
                igual de bien. */}
            <QueIncluye incluidos={incluidos} className="hidden pt-5 sm:block" />
          </div>

          {/* ---------- Derecha: resumen ---------- */}
          <aside className="rounded-uva-md border border-uva-divider bg-uva-surface p-5 lg:sticky lg:top-6">
            <h2 className="m-0 text-base text-uva-text">Resumen</h2>

            {/* aria-live: aplicar o quitar un cupón cambia estas cifras sin
                que nada reciba el foco, así que un lector de pantalla no se
                enteraría del cambio. */}
            <div aria-live="polite">
              <div className="mt-4 flex items-baseline justify-between gap-3">
                <span className="text-sm font-semibold text-uva-text">Total a pagar hoy</span>
                <span className="font-mono text-xl font-semibold tabular-nums text-uva-text">
                  {total}
                </span>
              </div>

              <dl className="mt-4 flex flex-col gap-2 border-t border-uva-divider pt-4 text-[12.5px]">
                <div className="flex justify-between gap-3 text-uva-text-muted">
                  <dt className="min-w-0 truncate">{plan.nombre}</dt>
                  <dd className="m-0 shrink-0 font-mono tabular-nums">{precioLista}</dd>
                </div>

                {desglose && cuponAplicado && (
                  <div className="flex justify-between gap-3 text-uva-accent-2-text">
                    <dt className="min-w-0 truncate">Cupón {cuponAplicado}</dt>
                    <dd className="m-0 shrink-0 font-mono tabular-nums">
                      −{desglose.descuento}
                    </dd>
                  </div>
                )}
              </dl>
            </div>

            <p className="mt-4 border-t border-uva-divider pt-4 text-[12.5px] text-uva-text-muted">
              Tu acceso va hasta el{" "}
              <strong className="font-semibold text-uva-text">{plan.vigenteHasta}</strong>.
            </p>

            {/* ---- Promociones ---- */}
            <div className="mt-4 border-t border-uva-divider pt-4">
              <h3 className="m-0 mb-2 text-[11px] font-semibold tracking-[0.08em] text-uva-text-faint uppercase">
                Promociones
              </h3>

              {cuponAplicado ? (
                <div className="flex items-center gap-2 rounded-uva-md border border-dashed border-uva-divider px-3 py-2.5">
                  <Check className="size-3.5 shrink-0 text-uva-accent-2-text" aria-hidden />
                  <span className="min-w-0 flex-1 truncate font-mono text-[12px] text-uva-text">
                    {cuponAplicado}
                  </span>
                  <span className="shrink-0 text-[11.5px] text-uva-text-muted">aplicado</span>
                  <button
                    type="button"
                    onClick={quitarCupon}
                    disabled={ocupado}
                    aria-label={`Quitar el cupón ${cuponAplicado}`}
                    className="shrink-0 rounded-uva-md p-0.5 text-uva-text-faint hover:text-uva-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-uva-accent disabled:opacity-50"
                  >
                    <X className="size-3.5" aria-hidden />
                  </button>
                </div>
              ) : mostrarCampo ? (
                /* El campo va en su propio renglón y los botones debajo.
                   Ponerlos en la misma línea no era solo apretado: las
                   variantes `uva-*` traen `w-full` de fábrica (button.tsx),
                   así que el botón pedía el ancho completo y con `shrink-0`
                   no lo soltaba — el input quedaba aplastado contra su
                   `min-w-0`. En una columna de 336px un código de cupón
                   necesita el renglón entero de todos modos. */
                <div className="flex flex-col gap-2">
                  <Label htmlFor="cupon" className="sr-only">
                    Código de cupón
                  </Label>
                  <Input
                    id="cupon"
                    value={codigo}
                    onChange={(e) => setCodigo(e.target.value.toUpperCase())}
                    onKeyDown={(e) => {
                      // Enter aplica: el campo está suelto, no dentro de un
                      // <form> que pueda enviarse solo.
                      if (e.key === "Enter" && codigo.trim() && !ocupado && !cuponBloqueado) {
                        e.preventDefault();
                        void aplicarCupon();
                      }
                      if (e.key === "Escape") cerrarCampo();
                    }}
                    placeholder="LANZAMIENTO"
                    autoComplete="off"
                    autoFocus
                    disabled={ocupado || cuponBloqueado}
                    className="h-10 font-mono text-sm tracking-[0.06em] uppercase"
                  />
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="uva-secondary"
                      onClick={aplicarCupon}
                      disabled={ocupado || cuponBloqueado || codigo.trim().length === 0}
                      className="h-9 flex-1 text-[12.5px]"
                    >
                      {cuponBloqueado
                        ? `Espera ${segundosBloqueo}s`
                        : validando
                          ? "Validando…"
                          : "Aplicar"}
                    </Button>
                    <Button
                      type="button"
                      variant="uva-ghost"
                      onClick={cerrarCampo}
                      disabled={ocupado}
                      className="h-9 w-auto shrink-0 px-3 text-[12.5px] text-uva-text-muted"
                    >
                      Cancelar
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="uva-secondary"
                  onClick={() => setMostrarCampo(true)}
                  disabled={ocupado}
                  className="h-9 w-full gap-1.5 text-[12.5px]"
                >
                  <TicketPercent className="size-3.5" aria-hidden />
                  Aplicar cupón
                </Button>
              )}
            </div>

            {error && (
              <p
                role="alert"
                className="m-0 mt-4 rounded-uva-md bg-uva-error-soft px-3 py-2 text-[12.5px] text-uva-error-text"
              >
                {error}
              </p>
            )}

            <Button
              type="button"
              variant="uva-primary"
              size="uva"
              onClick={pagar}
              disabled={ocupado}
              className="mt-4 w-full"
            >
              {pagando ? "Llevándote a pagar…" : "Ir a pagar"}
            </Button>

            {/* El modelo es prepago: Wompi no cobra recurrente sobre PSE ni
                Nequi. Decir aquí "renovación automática" sería mentir, y es
                justo lo que el recibo y el aviso de vencimiento desmienten
                después (src/emails/recibo-pago.tsx). */}
            <p className="m-0 mt-3 text-[11.5px] leading-relaxed text-uva-text-faint">
              Es un pago único por el período. Tu acceso no se renueva solo: te
              escribimos unos días antes de que termine para que decidas si
              sigues. Te llevaremos a Wompi para completar el pago.
            </p>
          </aside>
        </div>
      </div>
    </div>
  );
}
