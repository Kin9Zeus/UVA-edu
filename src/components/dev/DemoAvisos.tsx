"use client";

import { Button } from "@/components/ui/button";
import { useAviso } from "@/components/ui/toast";

export function DemoAvisos() {
  const aviso = useAviso();
  return (
    <div className="flex flex-wrap gap-3">
      <Button onClick={() => aviso.exito("Curso guardado")}>Éxito</Button>
      <Button onClick={() => aviso.info("Nueva clase disponible", "Ya puedes verla en tu curso.")}>Información</Button>
      <Button onClick={() => aviso.error("No pudimos guardar", "Revisa tu conexión e inténtalo de nuevo.")}>Error</Button>
    </div>
  );
}
