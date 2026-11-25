// Lee RESEND_API_KEY: importarlo desde un componente de cliente hace fallar el build (fase 7).
import "server-only";
import { Resend } from "resend";
import { LIMITE_RED_MS } from "@/lib/limite-de-red";

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

/**
 * P2-14: el SDK no tiene opción de límite de tiempo, pero pasa las opciones
 * de cada envío a `fetch`. Un correo que no sale en 10 s LANZA (el SDK
 * relanza el aborto) en vez de dejar colgada la petición: los que envían
 * (src/lib/resend.ts y el webhook de Supabase Auth) ya lo atrapan y registran.
 */
function emailsConLimite(cliente: Resend): Resend["emails"] {
  return new Proxy(cliente.emails, {
    get: (emails, propiedad) =>
      propiedad === "send"
        ? (...[envio, opciones]: Parameters<Resend["emails"]["send"]>) =>
            emails.send(envio, { signal: AbortSignal.timeout(LIMITE_RED_MS), ...opciones })
        : Reflect.get(emails, propiedad),
  });
}

export const resend: Resend = new Proxy({} as Resend, {
  get: (_objetivo, propiedad) =>
    propiedad === "emails" ? emailsConLimite(obtenerCliente()) : Reflect.get(obtenerCliente(), propiedad),
});
