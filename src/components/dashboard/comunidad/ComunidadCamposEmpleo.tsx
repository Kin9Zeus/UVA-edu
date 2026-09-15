"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EMPLEO_MODALIDADES, type EmpleoModalidad } from "@/lib/comunidad-validacion";

export const MODALIDAD_LABEL: Record<EmpleoModalidad, string> = {
  PRESENCIAL: "Presencial",
  REMOTO: "Remoto",
  HIBRIDO: "Híbrido",
};

export type ValoresEmpleo = { empresa: string; modalidad: string; ubicacion: string; enlace: string };

export const VALORES_EMPLEO_VACIOS: ValoresEmpleo = { empresa: "", modalidad: "", ubicacion: "", enlace: "" };

/** Bloque de campos propios de la categoría Empleo — compartido entre
 * `ComunidadComposer` (crear) y `ComunidadPostEditor` (editar), mismos 4
 * campos que exige el CHECK de la base (comunidad_posts_empleo_coherente,
 * 101_comunidad_empleo_campos.sql): empresa/modalidad/enlace obligatorios,
 * ubicación opcional (no aplica igual a un puesto remoto). */
export function ComunidadCamposEmpleo({
  valores,
  onCambiar,
}: {
  valores: ValoresEmpleo;
  onCambiar: (valores: ValoresEmpleo) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 rounded-uva-md border border-uva-divider bg-uva-bg p-3 sm:grid-cols-2">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="empleo-empresa">Empresa</Label>
        <Input
          id="empleo-empresa"
          placeholder="Nombre de la empresa"
          value={valores.empresa}
          onChange={(e) => onCambiar({ ...valores, empresa: e.target.value })}
          maxLength={120}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="empleo-modalidad">Modalidad</Label>
        <Select
          name="modalidad"
          value={valores.modalidad || undefined}
          onValueChange={(valor) => onCambiar({ ...valores, modalidad: valor as string })}
        >
          <SelectTrigger id="empleo-modalidad" aria-label="Modalidad">
            <SelectValue placeholder="Selecciona una modalidad" />
          </SelectTrigger>
          <SelectContent>
            {EMPLEO_MODALIDADES.map((modalidad) => (
              <SelectItem key={modalidad} value={modalidad}>
                {MODALIDAD_LABEL[modalidad]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="empleo-ubicacion">Ubicación (opcional)</Label>
        <Input
          id="empleo-ubicacion"
          placeholder="Ciudad, país"
          value={valores.ubicacion}
          onChange={(e) => onCambiar({ ...valores, ubicacion: e.target.value })}
          maxLength={120}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="empleo-enlace">Enlace para postularse</Label>
        <Input
          id="empleo-enlace"
          type="url"
          placeholder="https://…"
          value={valores.enlace}
          onChange={(e) => onCambiar({ ...valores, enlace: e.target.value })}
          maxLength={500}
        />
      </div>
    </div>
  );
}

/** `true` cuando faltan los 3 campos obligatorios (empresa/modalidad/enlace)
 * — mismo criterio de "requerido" que el CHECK de la base, sin validar
 * formato acá (eso lo hace `empleoEnlaceSchema` del lado del servidor); solo
 * decide si el botón "Publicar"/"Guardar" se puede habilitar. */
export function faltanCamposEmpleoObligatorios(valores: ValoresEmpleo): boolean {
  return !valores.empresa.trim() || !valores.modalidad || !valores.enlace.trim();
}
