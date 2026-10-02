import { cookies } from "next/headers";
import { parsearTema, TEMA_COOKIE, type Tema } from "@/lib/tema";

/** Tema guardado por el usuario, u oscuro si no eligió ninguno (ver tema.ts). */
export async function leerTema(): Promise<Tema> {
  const almacen = await cookies();
  return parsearTema(almacen.get(TEMA_COOKIE)?.value);
}
