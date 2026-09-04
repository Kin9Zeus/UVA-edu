/**
 * Origen público y canónico de la aplicación.
 *
 * P1-1 (AUDIT-2026-09-04.md): antes, seis archivos repetían literalmente la
 * misma función `getOrigin()`, que armaba el origen con el header `Host` de
 * la petición entrante:
 *
 *     const host = headersList.get("host");   // ← lo escribe el cliente
 *     return `${proto}://${host}`;
 *
 * Ese valor terminaba dentro del `redirectTo` de `resetPasswordForEmail`, del
 * `emailRedirectTo` de la confirmación de cuenta, del enlace del correo de
 * bienvenida y del QR impreso en el PDF del certificado. Una petición con
 * `Host: evil.tld` producía un correo auténtico, firmado por el dominio real,
 * cuyo botón entregaba el token de recuperación al atacante — y un PDF de
 * certificado cuyo QR llevaba al dominio del atacante durante toda la vida del
 * archivo. Lo único que lo frenaba era la lista de Redirect URLs de Supabase
 * Auth, un ajuste que vive fuera de este repositorio y que ninguna capa del
 * código comprobaba.
 *
 * El origen no puede salir de la petición: es una propiedad del despliegue.
 *
 * Por qué NO se resuelve con un `process.env.NEXT_PUBLIC_SITE_URL!` a secas:
 * este módulo lo importan Server Actions que corren en `next dev`, en el job
 * `e2e` de CI (que arranca `npm run dev` contra localhost:3000) y en las
 * pruebas unitarias, ninguno de los cuales define la variable. Un `!` los
 * rompería a todos por un problema que solo existe en producción. De ahí las
 * dos ramas: en producción falta la variable y se lanza —fallar ruidoso es
 * preferible a mandar un enlace envenenado—, y fuera de producción cae al
 * mismo `http://localhost:3000` que ya usa `playwright.config.ts` como
 * `baseURL`.
 *
 * La excepción deliberada a esta regla es `cors_origin` en
 * `src/actions/admin/mux.ts`: ver el comentario de ese archivo.
 */
export function siteUrl(): string {
  const configurada = process.env.NEXT_PUBLIC_SITE_URL?.trim();

  if (configurada) {
    // Sin barra final: todos los llamadores concatenan `${siteUrl()}/ruta`,
    // y "https://uva.co//auth/confirm" no es la misma URL para la lista de
    // Redirect URLs de Supabase que "https://uva.co/auth/confirm".
    return configurada.replace(/\/+$/, "");
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "NEXT_PUBLIC_SITE_URL es obligatoria en producción: es el origen con el " +
        "que se arman los enlaces de los correos de autenticación y el QR de " +
        "los certificados. Defínela en las variables de entorno del servicio " +
        "(Railway) — ver README.md.",
    );
  }

  return "http://localhost:3000";
}
