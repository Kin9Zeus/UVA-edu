import { cookies } from "next/headers";
import { SIDEBAR_COOKIE, type PreferenciaSidebar } from "@/lib/sidebar-preferencia";

/** La elección guardada del menú lateral, o `null` si no hay (ver PreferenciaSidebar). */
export async function leerPreferenciaSidebar(): Promise<PreferenciaSidebar> {
  const valor = (await cookies()).get(SIDEBAR_COOKIE)?.value;
  return valor === "1" ? "colapsado" : valor === "0" ? "expandido" : null;
}
