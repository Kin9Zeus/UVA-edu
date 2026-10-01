import { cookies } from "next/headers";
import { SIDEBAR_COOKIE } from "@/lib/sidebar-preferencia";

/** `true` si el usuario dejó el menú lateral colapsado (ver sidebar-preferencia.ts). */
export async function leerSidebarColapsado(): Promise<boolean> {
  const almacen = await cookies();
  return almacen.get(SIDEBAR_COOKIE)?.value === "1";
}
