"use client";

import { useState } from "react";
import { Copy, Check, ExternalLink, Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAdminToast } from "@/components/admin/Toast";
import {
  crearEnlaceVistaPrevia,
  revocarEnlaceVistaPrevia,
} from "@/actions/admin/vistaPrevia";
import { tiempoRelativo } from "@/lib/admin/format";
import {
  MINUTOS_VIGENCIA_VISTA_PREVIA,
  VIGENCIAS_VISTA_PREVIA,
} from "@/lib/vistaPrevia";
import type { EnlaceVistaPrevia } from "@/lib/admin/cursoDetalle";

/**
 * Vista previa de un curso en borrador (Revcurso, requisitos 3 y 5).
 *
 * Hay dos usos con necesidades distintas y la interfaz los separa:
 *
 *  - "Abrir vista previa": el administrador repasa su propio trabajo antes
 *    de publicar. Es el caso que pide el requisito y el 90% de las veces.
 *    Un clic, se abre en otra pestaña, y el enlace caduca en 30 minutos.
 *  - "Generar enlace para compartir": se lo pasa a alguien sin cuenta. Ahí
 *    la espera no la controla el administrador, así que puede alargar la
 *    vigencia — pero eligiéndolo a propósito.
 *
 * El token se muestra UNA vez: la base solo guarda su hash, así que al
 * recargar deja de poder mostrarse. Es intencional — un enlace que se puede
 * releer desde el panel es un enlace que lee cualquiera con acceso al panel.
 */
export function EnlacesVistaPrevia({
  cursoId,
  enlaces,
}: {
  cursoId: string;
  enlaces: EnlaceVistaPrevia[];
}) {
  const [enlaceNuevo, setEnlaceNuevo] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  // `number` explícito: VIGENCIAS_VISTA_PREVIA es `as const`, así que el
  // valor inicial se infiere como el literal 30 y el selector no podría
  // asignar las otras opciones.
  const [minutos, setMinutos] = useState<number>(MINUTOS_VIGENCIA_VISTA_PREVIA);
  const [pending, setPending] = useState<"abrir" | "compartir" | null>(null);
  const showToast = useAdminToast();

  async function generar(vigencia: number): Promise<string | null> {
    const resultado = await crearEnlaceVistaPrevia(cursoId, vigencia);
    if (resultado.error || !resultado.url) {
      showToast(resultado.error ?? "No pudimos generar el enlace.", "error");
      return null;
    }
    // El Server Action devuelve la ruta relativa; el origen lo pone el
    // navegador, así que funciona igual en local y en producción sin
    // depender de una variable de entorno.
    return `${window.location.origin}${resultado.url}`;
  }

  async function handleAbrir() {
    // La pestaña se abre ANTES del await: si se abriera después, el
    // navegador ya no la trataría como respuesta directa a un clic y la
    // bloquearía como popup.
    const pestana = window.open("", "_blank");
    setPending("abrir");
    const url = await generar(MINUTOS_VIGENCIA_VISTA_PREVIA);
    setPending(null);

    if (!url) {
      pestana?.close();
      return;
    }
    if (pestana) pestana.location.href = url;
    else showToast("Permite las ventanas emergentes para abrir la vista previa.", "error");
  }

  async function handleCompartir() {
    setPending("compartir");
    const url = await generar(minutos);
    setPending(null);
    if (!url) return;
    setEnlaceNuevo(url);
    setCopiado(false);
  }

  async function handleCopiar() {
    if (!enlaceNuevo) return;
    try {
      await navigator.clipboard.writeText(enlaceNuevo);
      setCopiado(true);
    } catch {
      showToast("No pudimos copiar. Selecciona el enlace y cópialo a mano.", "error");
    }
  }

  async function handleRevocar(tokenId: string) {
    const resultado = await revocarEnlaceVistaPrevia(tokenId, cursoId);
    if (resultado.error) {
      showToast(resultado.error, "error");
      return;
    }
    showToast("Enlace revocado.");
  }

  return (
    <div className="border-t border-uva-divider pt-4">
      <p className="text-sm text-uva-text">Vista previa</p>
      <p className="mt-0.5 text-xs text-uva-text-faint">
        Abre el curso como lo vería un estudiante, aunque esté en borrador.
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="primary"
          size="sm"
          className="w-auto"
          onClick={handleAbrir}
          disabled={pending !== null}
        >
          <ExternalLink className="size-4" />
          {pending === "abrir" ? "Abriendo…" : "Abrir vista previa"}
        </Button>
        <span className="font-mono text-[11.5px] text-uva-text-faint">
          caduca en {MINUTOS_VIGENCIA_VISTA_PREVIA} min
        </span>
      </div>

      <div className="mt-4">
        <p className="text-xs text-uva-muted">
          ¿Necesitas que lo revise alguien sin cuenta? Genera un enlace para compartir:
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Select
            items={Object.fromEntries(
              VIGENCIAS_VISTA_PREVIA.map((opcion) => [String(opcion.minutos), opcion.etiqueta]),
            )}
            value={String(minutos)}
            onValueChange={(value) => value && setMinutos(Number(value))}
          >
            <SelectTrigger className="w-[140px]" aria-label="Vigencia del enlace">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {VIGENCIAS_VISTA_PREVIA.map((opcion) => (
                <SelectItem key={opcion.minutos} value={String(opcion.minutos)}>
                  {opcion.etiqueta}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-auto"
            onClick={handleCompartir}
            disabled={pending !== null}
          >
            {pending === "compartir" ? "Generando…" : "Generar enlace"}
          </Button>
        </div>
      </div>

      {enlaceNuevo && (
        <div className="mt-3 rounded-uva-md border border-uva-accent/40 bg-uva-accent-soft px-3.5 py-3">
          <p className="text-xs font-semibold text-uva-accent-text">
            Copia el enlace ahora: no se vuelve a mostrar.
          </p>
          <div className="mt-2 flex items-center gap-2">
            <code className="flex-1 overflow-x-auto rounded-uva-md bg-uva-surface-2 px-2.5 py-1.5 font-mono text-[11.5px] whitespace-nowrap text-uva-text">
              {enlaceNuevo}
            </code>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-auto shrink-0"
              onClick={handleCopiar}
            >
              {copiado ? <Check className="size-4" /> : <Copy className="size-4" />}
              {copiado ? "Copiado" : "Copiar"}
            </Button>
          </div>
        </div>
      )}

      {enlaces.length > 0 && (
        <ul className="mt-3 flex list-none flex-col gap-1.5 p-0">
          {enlaces.map((enlace) => (
            <li
              key={enlace.id}
              className="flex items-center justify-between gap-3 rounded-uva-md bg-uva-surface-2 px-3 py-2"
            >
              {/* Relativo, no una fecha: con vigencias de 30 minutos
                  "caduca en 24 minutos" se lee de un vistazo y una fecha
                  con hora no. */}
              <span className="text-[12.5px] text-uva-muted">
                Caduca {tiempoRelativo(enlace.expiraEn)}
                {" · "}
                {enlace.vecesUsado === 0
                  ? "sin abrir"
                  : `abierto ${enlace.vecesUsado} ${enlace.vecesUsado === 1 ? "vez" : "veces"}`}
              </span>
              {/* Icono de "prohibido", no una papelera: esto NO borra nada.
                  El enlace se anula (queda con `revocado_en`) y la fila se
                  conserva como rastro de qué se compartió y cuándo — ver
                  025_rls_tokens_vista_previa, que a propósito no define
                  policy de DELETE. Una papelera prometería un borrado que
                  no ocurre. */}
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Anular enlace"
                title="Anular enlace: dejará de abrir, pero queda el registro"
                className="text-uva-muted-2 hover:text-uva-accent"
                onClick={() => handleRevocar(enlace.id)}
              >
                <Ban className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
