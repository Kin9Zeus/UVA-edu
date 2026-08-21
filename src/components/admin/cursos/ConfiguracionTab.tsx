"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

/**
 * Controlado desde CursoDetalleView: el guardado es compartido con InfoTab
 * a través de un solo botón en la cabecera (ver comentario ahí), así que
 * este tab no guarda su propio estado ni dispara la mutación.
 */
export function ConfiguracionTab({
  mostrado,
  onMostradoChange,
  destacado,
  onDestacadoChange,
  orden,
  onOrdenChange,
  error,
}: {
  mostrado: boolean;
  onMostradoChange: (value: boolean) => void;
  destacado: boolean;
  onDestacadoChange: (value: boolean) => void;
  orden: number;
  onOrdenChange: (value: number) => void;
  error: string | null;
}) {
  return (
    // El mockup no envuelve esta pestaña en `.card`: es una columna suelta.
    <div className="flex max-w-[480px] flex-col gap-4">
      {error && (
        <div
          role="alert"
          className="rounded-uva-md bg-uva-error-soft px-3.5 py-2.5 text-sm text-uva-error-text"
        >
          {error}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-uva-text">Curso visible</p>
          <p className="text-xs text-uva-text-faint">
            Se muestra en el catálogo público.
          </p>
        </div>
        <Switch
          checked={mostrado}
          onCheckedChange={onMostradoChange}
          aria-label="Curso visible"
        />
      </div>

      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-uva-text">Curso destacado</p>
          <p className="text-xs text-uva-text-faint">
            Aparece resaltado en el catálogo.
          </p>
        </div>
        <Switch
          checked={destacado}
          onCheckedChange={onDestacadoChange}
          aria-label="Curso destacado"
        />
      </div>

      <div>
        <Label htmlFor="config-orden">Orden de visualización</Label>
        <Input
          id="config-orden"
          type="number"
          value={orden}
          onChange={(event) => onOrdenChange(Number(event.target.value))}
          className="max-w-[120px]"
        />
      </div>
    </div>
  );
}
