// Lee RESEND_API_KEY: importarlo desde un componente de cliente hace fallar el build (fase 7).
import "server-only";
import { Resend } from "resend";

/**
 * El cliente se crea en el primer uso, no al cargar el módulo (fase 11.1).
 * `next build` carga las rutas para recoger su configuración, y `new
 * Resend()` sin llave lanza: así, construir la app exigía tener la llave
 * secreta en el momento del build. Una imagen de Docker no debe llevar
 * secretos dentro; los recibe al arrancar.
 */
let cliente: Resend | null = null;

function obtenerCliente(): Resend {
  cliente ??= new Resend(process.env.RESEND_API_KEY!);
  return cliente;
}

export const resend: Resend = new Proxy({} as Resend, {
  get: (_objetivo, propiedad) => Reflect.get(obtenerCliente(), propiedad),
});
