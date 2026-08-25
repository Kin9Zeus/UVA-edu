"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { EnlacesVistaPrevia } from "@/components/admin/cursos/EnlacesVistaPrevia";
import type { EnlaceVistaPrevia } from "@/lib/admin/cursoDetalle";

/**
 * Controlado desde CursoDetalleView: el guardado es compartido con InfoTab
 * a través de un solo botón en la cabecera (ver comentario ahí), así que
 * este tab no guarda su propio estado ni dispara la mutación.
 */
export function ConfiguracionTab({
  mostrado,
  onMostradoChange,
  motivosSinPublicar,
  destacado,
  onDestacadoChange,
  orden,
  onOrdenChange,
  cursoId,
  enlacesVistaPrevia,
  error,
}: {
  mostrado: boolean;
  onMostradoChange: (value: boolean) => void;
  /** Vacío = el curso se puede publicar. Ver lib/admin/publicacion.ts. */
  motivosSinPublicar: string[];
  destacado: boolean;
  onDestacadoChange: (value: boolean) => void;
  orden: number;
  onOrdenChange: (value: number) => void;
  cursoId: string;
  enlacesVistaPrevia: EnlaceVistaPrevia[];
  error: string | null;
}) {
  // Un curso ya publicado se puede ocultar siempre, aunque le falte algo:
  // el bloqueo es solo para encender la visibilidad.
  const bloqueado = motivosSinPublicar.length > 0 && !mostrado;

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

      <div>
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
            disabled={bloqueado}
            aria-label="Curso visible"
            aria-describedby={bloqueado ? "config-bloqueo-publicacion" : undefined}
          />
        </div>

        {/* El interruptor deshabilitado no explica nada por sí solo, así que
            se listan los motivos concretos. El servidor aplica la misma
            regla: esto evita el viaje de ida y vuelta, no lo sustituye. */}
        {bloqueado && (
          <div
            id="config-bloqueo-publicacion"
            className="mt-2.5 rounded-uva-md bg-uva-surface-2 px-3.5 py-2.5"
          >
            <p className="text-xs font-semibold text-uva-text">
              Falta esto para poder publicarlo:
            </p>
            <ul className="mt-1.5 flex list-disc flex-col gap-1 pl-4 text-xs text-uva-muted">
              {motivosSinPublicar.map((motivo) => (
                <li key={motivo}>{motivo}</li>
              ))}
            </ul>
          </div>
        )}
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

      <EnlacesVistaPrevia cursoId={cursoId} enlaces={enlacesVistaPrevia} />
    </div>
  );
}
