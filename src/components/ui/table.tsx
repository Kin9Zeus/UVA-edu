"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

/* Reglas `table` / `th` / `td` del mockup del panel admin
   (design-spec/project/Uva - Panel Admin.dc.html): el borde vive en la celda,
   no en la fila, y la ultima fila no lo lleva. El mockup no pinta hover de
   fila, asi que aqui tampoco. */
/* Si la tabla no cabe, se desplaza dentro de su caja y no la página. Esa
   caja tiene que poder recibir el foco para desplazarse con las flechas del
   teclado (WCAG 2.1.1); solo lo recibe cuando de verdad desborda, para no
   sumar una parada de tabulación vacía. `etiqueta` la nombra como región
   ("Tabla de usuarios") y `contenedorClassName` va a la caja (p. ej. para
   ocultarla en celular junto con la tabla). */
function Table({
  className,
  etiqueta,
  contenedorClassName,
  ...props
}: React.ComponentProps<"table"> & { etiqueta?: string; contenedorClassName?: string }) {
  const contenedorRef = React.useRef<HTMLDivElement>(null)
  const [desborda, setDesborda] = React.useState(false)

  React.useEffect(() => {
    const el = contenedorRef.current
    if (!el) return
    const medir = () => setDesborda(el.scrollWidth > el.clientWidth + 1)
    medir()
    const observador = new ResizeObserver(medir)
    observador.observe(el)
    if (el.firstElementChild) observador.observe(el.firstElementChild)
    return () => observador.disconnect()
  }, [])

  return (
    <div
      ref={contenedorRef}
      data-slot="table-container"
      role={desborda && etiqueta ? "region" : undefined}
      aria-label={desborda ? etiqueta : undefined}
      tabIndex={desborda ? 0 : undefined}
      className={cn(
        "relative w-full overflow-x-auto outline-hidden focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-solid focus-visible:outline-uva-accent",
        contenedorClassName
      )}
    >
      <table
        data-slot="table"
        className={cn("w-full caption-bottom border-collapse text-[13px]", className)}
        {...props}
      />
    </div>
  )
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead
      data-slot="table-header"
      className={cn(className)}
      {...props}
    />
  )
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      className={cn("[&_tr:last-child>td]:border-b-0", className)}
      {...props}
    />
  )
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn(
        "border-t bg-muted/50 font-medium [&>tr]:last:border-b-0",
        className
      )}
      {...props}
    />
  )
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn(className)}
      {...props}
    />
  )
}

function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        "border-b border-uva-divider px-3.5 py-2.5 text-left align-middle font-mono text-[11px] font-semibold tracking-[0.06em] whitespace-nowrap text-uva-muted-2 uppercase [&:has([role=checkbox])]:pr-0",
        className
      )}
      {...props}
    />
  )
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        "border-b border-uva-divider px-3.5 py-[13px] align-middle whitespace-nowrap text-uva-text [&:has([role=checkbox])]:pr-0",
        className
      )}
      {...props}
    />
  )
}

function TableCaption({
  className,
  ...props
}: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("mt-4 text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
}
