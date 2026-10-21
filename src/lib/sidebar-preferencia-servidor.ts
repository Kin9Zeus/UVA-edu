import { cookies } from "next/headers";
import { SIDEBAR_COOKIE, type PreferenciaSidebar } from "@/lib/sidebar-preferencia";

/** `true` si el usuario dejó el menú lateral colapsado (ver sidebar-preferencia.ts). */
export async function leerSidebarColapsado(): Promise<boolean> {
  const almacen = await cookies();
  return almacen.get(SIDEBAR_COOKIE)?.value === "1";
}

/** La elección guardada del menú lateral, o `null` si no hay (ver PreferenciaSidebar). */
export async function leerPreferenciaSidebar(): Promise<PreferenciaSidebar> {
  const valor = (await cookies()).get(SIDEBAR_COOKIE)?.value;
  return valor === "1" ? "colapsado" : valor === "0" ? "expandido" : null;
}
