import Link from "next/link"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type Accion =
  | { etiqueta: string; href: string; onClick?: never }
  | { etiqueta: string; onClick: () => void; href?: never }

/**
 * Estado vacío con una acción: dice qué falta y qué hacer, nunca solo "no hay
 * nada". Solo para un vacío real (sin datos); un fallo de carga va en
 * `AvisoErrorCarga` (CLAUDE.md 3.2). `nivel` es el encabezado que cabe en la
 * página (2 por defecto).
 */
function EstadoVacio({
  titulo,
  texto,
  accion,
  nivel = 2,
  className,
}: {
  titulo: string
  texto: string
  accion?: Accion
  nivel?: 2 | 3
  className?: string
}) {
  const Titulo = nivel === 2 ? "h2" : "h3"
  return (
    <section
      className={cn(
        "flex flex-col items-start gap-3 rounded-uva-lg border border-uva-divider bg-uva-surface p-6",
        className
      )}
    >
      <Titulo className="text-uva-titulo-4 text-uva-text">{titulo}</Titulo>
      <p className="text-uva-cuerpo text-uva-text-muted">{texto}</p>
      {accion &&
        (accion.href ? (
          <Button
            render={<Link href={accion.href} />}
            nativeButton={false}
            variant="primary"
            size="lg"
          >
            {accion.etiqueta}
          </Button>
        ) : (
          <Button variant="primary" size="lg" onClick={accion.onClick}>
            {accion.etiqueta}
          </Button>
        ))}
    </section>
  )
}

export { EstadoVacio }
