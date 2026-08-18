import Link from "next/link";
import { Button } from "@/components/ui/button";

export function Proximamente({
  titulo,
  descripcion,
}: {
  titulo: string;
  descripcion?: string;
}) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="max-w-[420px] rounded-uva-md border border-uva-divider bg-uva-surface px-8 py-10 text-center">
        <h1 className="text-xl text-uva-text">{titulo}</h1>
        <p className="mt-2 text-sm text-uva-text-muted">
          {descripcion ?? "Este módulo todavía no está disponible. Estamos trabajando en él."}
        </p>
        <Button
          render={<Link href="/dashboard" />}
          nativeButton={false}
          variant="uva-primary"
          size="uva"
          className="mt-6"
        >
          Volver a Inicio
        </Button>
      </div>
    </div>
  );
}
