"use client"

import { Tabs as TabsPrimitive } from "@base-ui/react/tabs"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

function Tabs({
  className,
  orientation = "horizontal",
  ...props
}: TabsPrimitive.Root.Props) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      data-orientation={orientation}
      className={cn(
        "group/tabs flex data-horizontal:flex-col",
        className
      )}
      {...props}
    />
  )
}

/* `.tabs` / `.tab` / `.tab-active` del mockup del panel admin: una fila con
   borde inferior donde la pestaña activa se marca con un subrayado magenta de
   2px, no el grupo de píldoras sobre fondo `--muted` de shadcn/ui. */
const tabsListVariants = cva(
  "group/tabs-list flex w-full items-center gap-1 border-b border-uva-divider group-data-vertical/tabs:h-fit group-data-vertical/tabs:w-fit group-data-vertical/tabs:flex-col",
  {
    variants: {
      variant: {
        default: "",
        line: "",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function TabsList({
  className,
  variant = "default",
  ...props
}: TabsPrimitive.List.Props & VariantProps<typeof tabsListVariants>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      data-variant={variant}
      className={cn(tabsListVariants({ variant }), className)}
      {...props}
    />
  )
}

/* Se exporta aparte porque la pantalla "Crear curso" del mockup dibuja sus
   tres pestañas inertes (`<span class="tab tab-disabled">`) sin un Tabs real. */
const tabTriggerVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-1.5 border-0 border-b-2 border-transparent bg-transparent px-1 py-[11px] text-[13.5px] font-semibold whitespace-nowrap outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-uva-accent [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      state: {
        interactive:
          "cursor-pointer text-uva-muted hover:text-uva-text data-active:border-uva-accent data-active:text-uva-text",
        active: "border-uva-accent text-uva-text",
        disabled: "cursor-not-allowed text-uva-dim",
      },
    },
    defaultVariants: {
      state: "interactive",
    },
  }
)

function TabsTrigger({ className, ...props }: TabsPrimitive.Tab.Props) {
  return (
    <TabsPrimitive.Tab
      data-slot="tabs-trigger"
      className={cn(tabTriggerVariants({ state: "interactive" }), className)}
      {...props}
    />
  )
}

function TabsContent({ className, ...props }: TabsPrimitive.Panel.Props) {
  return (
    <TabsPrimitive.Panel
      data-slot="tabs-content"
      className={cn("flex-1 text-sm outline-none", className)}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants, tabTriggerVariants }
