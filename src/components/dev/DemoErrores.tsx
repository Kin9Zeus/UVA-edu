"use client";

import { useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

/**
 * Un fallo dentro de una transición sube al `error.tsx` más cercano: así
 * llega ahí una Server Action que falla sin conexión.
 */
export function DemoErrores() {
  const [pendiente, iniciar] = useTransition();
  return (
    <div className="flex flex-wrap gap-3">
      <Button
        variant="primary"
        size="lg"
        disabled={pendiente}
        onClick={() =>
          iniciar(async () => {
            const respuesta = await fetch("/api/health", { cache: "no-store" });
            if (!respuesta.ok) throw new Error(`/api/health respondió ${respuesta.status}`);
          })
        }
      >
        Pedir algo al servidor
      </Button>
      <Button render={<Link href="/dev/error?de=servidor" />} nativeButton={false} variant="outline" size="lg">
        Fallar en el servidor
      </Button>
    </div>
  );
}
