"use client"

import { Switch as SwitchPrimitive } from "@base-ui/react/switch"

import { cn } from "@/lib/utils"

/**
 * `.switch` del mockup del panel admin
 * (design-spec/project/Uva - Panel Admin.dc.html): 38x22 con pista
 * var(--border), magenta al encender, y un punto de 18px que recorre 16px.
 */
function Switch({
  className,
  size = "default",
  ...props
}: SwitchPrimitive.Root.Props & {
  size?: "sm" | "default"
}) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      data-size={size}
      className={cn(
        "peer group/switch relative inline-flex shrink-0 items-center rounded-full border-0 p-0 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-uva-accent data-[size=default]:h-[22px] data-[size=default]:w-[38px] data-[size=sm]:h-[18px] data-[size=sm]:w-[31px] data-checked:bg-uva-accent data-unchecked:bg-uva-divider data-disabled:cursor-not-allowed data-disabled:opacity-50",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="pointer-events-none absolute top-0.5 left-0.5 block rounded-full bg-uva-text ring-0 transition-[left] duration-150 ease-out group-data-[size=default]/switch:size-[18px] group-data-[size=sm]/switch:size-[14px] group-data-[size=default]/switch:data-checked:left-[18px] group-data-[size=sm]/switch:data-checked:left-[15px]"
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
