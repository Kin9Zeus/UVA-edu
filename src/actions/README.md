# Server Actions

Todas las mutaciones internas viven aquí, una carpeta por módulo:
`admin/`, `auth/`, `certificados/`, `codigos-invitacion/`, `comentarios/`,
`comunidad/`, `cupones/`, `cursos/`, `examenes/`, `notas/`, `perfil/`,
`progreso/`, `seguridad/`, `suscripciones/`, `video/` y `notificaciones.ts`.

Este archivo describe el contrato **que el código cumple hoy**
(revisado el 2026-11-25, P2-15 de `auditorias/AUDIT-2026-11-23.md`). Si
cambias una regla, cámbiala aquí en el mismo PR.

## Qué pasa por `/api` y qué no

Ninguna mutación interna pasa por `src/app/api/`. Hay tres excepciones,
y cada una explica en su archivo por qué no puede ser una Server Action:

- `api/webhooks/*`: Stripe, Wompi, Mux y el hook de correos de Supabase Auth.
- `api/health`: chequeo de solo lectura para el monitor de disponibilidad.
- `api/progreso/beacon`: el último segundo visto al cerrar la pestaña.
  `navigator.sendBeacon` no puede enviar el header `Next-Action`. Hace lo
  mismo que `guardarSegundoActual`.

## Respuesta

- Con éxito: `{ success: true, ...datos }`.
- Con fallo: `{ error: string }` con un mensaje para la persona. Algunas
  acciones llevan `success: false` junto al `error`. Si el llamador no
  necesita un mensaje, basta `{ success: false }` (`guardarSegundoActual`).
- Las acciones de formulario con `useActionState` devuelven ese mismo tipo,
  o `null` en el estado inicial.
- Las que terminan navegando (`redirect()`) no devuelven nada en el éxito.
- **No** usar `ok` ni `exito` en una acción nueva. Las RPC de la base sí
  devuelven `ok`, y la acción lo traduce.

Cómo se escribe el `error` (nunca un vacío por un fallo, `PGRST116`, fallar
cerrado): CLAUDE.md §3.2.

## Validación de la entrada

Todo lo que llega del navegador se valida antes de tocar la base:

- **Zod** cuando la entrada es un objeto o un formulario con varios campos
  (`admin/cursos.ts`, `admin/examenes.ts`, `comunidad/crear.ts`…).
- **A mano** cuando es un id o un valor suelto: recortar, revisar el largo,
  `Number.isFinite`, buscar la fila. Si la fila no existe o RLS no la deja
  ver, eso es «no existe».
- RLS y las restricciones de la base son la segunda línea, no la única.

## Sesión y permisos

- Las acciones de estudiante empiezan con `getUsuarioActual()`. Sin sesión
  devuelven `{ error: "Tu sesión expiró…" }` sin consultar nada.
- Las de `admin/` empiezan con `requireAdmin()` (`src/lib/admin/requireAdmin.ts`):
  rol `ADMINISTRADOR` y sesión con segundo factor (aal2), y falla cerrado.
  `admin/autorizacion.test.ts` hace fallar la suite si una acción de admin
  no pasa por ahí.
- Se usa el cliente con sesión (`@/lib/supabase/server`) para que mande RLS.
  `@/lib/supabase/admin` (service role) solo después de comprobar los
  permisos, y para lo que RLS no puede hacer (Storage privado, Auth, Mux).
- Toda mutación de admin deja rastro en la bitácora (`registrarBitacora`).

## Pruebas

Una acción que toca datos personales, da acceso o borra algo llega con su
prueba en el mismo PR (`docs/ops/decisiones-de-seguridad.md` §8). Para
simular Supabase, usa `servidorFalso` (`src/test/servidor-falso.ts`). Hay
dos pruebas transversales:

- `error-como-vacio-acciones.test.ts`: un fallo de la base no se muestra
  como un vacío.
- `limites-uso-acciones.test.ts`: los límites de uso de comentarios y comunidad.
