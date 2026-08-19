"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { actualizarConfiguracionCurso } from "@/actions/admin/cursos";
import { useAdminToast } from "@/components/admin/Toast";
import type { CursoDetalle } from "@/lib/admin/cursoDetalle";

export function ConfiguracionTab({ curso }: { curso: CursoDetalle }) {
  const [mostrado, setMostrado] = useState(curso.mostrado);
  const [destacado, setDestacado] = useState(curso.destacado);
  const [orden, setOrden] = useState(curso.ordenVisualizacion);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const showToast = useAdminToast();

  async function handleGuardar() {
    setPending(true);
    setError(null);
    const resultado = await actualizarConfiguracionCurso(curso.id, {
      mostrado,
      destacado,
      ordenVisualizacion: orden,
    });
    setPending(false);

    if (resultado.error) {
      setError(resultado.error);
      return;
    }
    showToast("Configuración guardada.");
  }

  return (
    <Card className="max-w-[560px]">
      <CardContent className="flex flex-col gap-5">
        {error && (
          <div role="alert" className="rounded-uva-md bg-uva-error-soft px-3.5 py-2.5 text-sm text-uva-error-text">
            {error}
          </div>
        )}

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-uva-text">Curso visible</p>
            <p className="text-xs text-uva-text-faint">Se muestra en el catálogo público.</p>
          </div>
          <Switch checked={mostrado} onCheckedChange={setMostrado} aria-label="Curso visible" />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-uva-text">Curso destacado</p>
            <p className="text-xs text-uva-text-faint">Aparece resaltado en el catálogo.</p>
          </div>
          <Switch checked={destacado} onCheckedChange={setDestacado} aria-label="Curso destacado" />
        </div>

        <div>
          <Label htmlFor="config-orden">Orden de visualización</Label>
          <Input
            id="config-orden"
            type="number"
            value={orden}
            onChange={(event) => setOrden(Number(event.target.value))}
            className="max-w-[140px]"
          />
        </div>

        <div>
          <Button type="button" disabled={pending} onClick={handleGuardar} className="w-auto">
            {pending ? "Guardando…" : "Guardar"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
