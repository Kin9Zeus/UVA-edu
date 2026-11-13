# Checklist de implementación de los textos legales

**Fase 7. Textos legales**
**Fecha:** 13 de noviembre de 2026
**Código revisado:** rama `master`, commit `11693df`. Solo reporto qué existe y qué falta. La implementación es de Andres y Miguel.

Convención: **Existe**, **Parcial** o **Falta**.

## Resumen

| Elemento | Estado |
| --- | --- |
| Rutas públicas de los cinco textos | Existe |
| Texto cargado y publicado | **Falta** |
| Casillas separadas y sin marcar en el registro | **Parcial** (una sola casilla) |
| Tabla de consentimientos | **Falta** |
| Aceptación para quien entra con Google | **Falta** |
| Banner de cookies | **Falta** |
| Canal de solicitudes de los titulares | **Parcial** |

## Detalle

### 1. Rutas públicas

| Ruta | Estado | Evidencia |
| --- | --- | --- |
| `/legal/terminos` | Existe | `src/app/(public)/legal/[slug]/page.tsx`; `src/lib/legal/slugs.ts:23` |
| `/legal/datos-personales` | Existe | `slugs.ts:24` |
| `/legal/privacidad` | Existe | `slugs.ts:25` |
| `/legal/cookies` | Existe | `slugs.ts:26` |
| `/legal/comunidad` | Existe | `slugs.ts:27` |

Las rutas aparecen en el pie y en el sitemap solo si la bandera `NEXT_PUBLIC_LEGAL_ENABLED` está en `true` (`src/lib/features.ts:29`, `Footer.tsx:87`, `sitemap.ts:67`) y solo para los textos que tengan una versión vigente.

### 2. Texto cargado y publicado

**Falta.** `TEXTOS_LEGALES_FUENTE` está vacío (`src/content/legal/index.ts:29`). El comentario del archivo explica que los cinco textos se cargan ahí cuando tengan la aprobación del abogado y del CEO. La base guarda la versión publicada en la tabla `textos_legales`, inmutable una vez publicada (`prisma/schema.prisma:1853`). Los comandos que cargan y publican son `npm run legal:sembrar` y `npm run legal:publicar` (`package.json:29-30`). La publicación se niega a continuar mientras quede un dato entre corchetes.

### 3. Casillas del registro

| Casilla | Estado | Evidencia |
| --- | --- | --- |
| Aceptación de los términos | **Parcial.** Existe y parte desmarcada. | `RegistroForm.tsx:48,186-190` |
| Autorización de tratamiento de datos, separada de los términos | **Falta.** Hoy una sola casilla dice «Acepto los Términos y la Política de privacidad». | `RegistroForm.tsx:193-207` |
| Mayoría de edad | **Falta** | Ninguna referencia a la edad en `src/` |
| Comunicaciones (opcional) | **Falta.** No se envían comunicaciones de mercadeo hoy, así que solo hace falta si se van a enviar. | |

Además, los enlaces de la casilla llevan al centro de soporte (`/soporte?tema=terminos` y `?tema=privacidad`) y no a las rutas legales. Ver H01 en `docs/textos/01-hallazgos.md`.

### 4. Tabla de consentimientos

**Falta.** No existe ninguna tabla ni columna que guarde usuario, tipo de consentimiento, versión, fecha y hora, IP y origen. La casilla del registro es un estado local del formulario: se pierde al enviar (`RegistroForm.tsx:48,57`). Busqué en `prisma/schema.prisma` y en `supabase/sql/` por «consentimiento», «aceptacion», «acepta_terminos» y «mayor edad» y no hay resultados.

### 5. Aceptación para quien entra con Google

**Falta.** El botón de Google inicia sesión directamente (`src/components/auth/GoogleAuthButton.tsx:35-38`, redirige a `/auth/callback`). No hay ningún paso intermedio que muestre los textos ni registre la aceptación de una cuenta nueva creada por Google.

### 6. Banner de cookies

**Falta.** No hay ningún componente de aviso o consentimiento de cookies. Ver `docs/legal/00-texto-vs-codigo.md`, sección 2, para lo que se usa hoy. Si el abogado decide que hace falta un banner, hay que instalar uno **antes** de agregar cualquier analítica (la plataforma no tiene ninguna).

### 7. Canal de solicitudes de los titulares

| Elemento | Estado | Evidencia |
| --- | --- | --- |
| Correo de contacto para datos personales | Existe | `src/lib/contacto.ts` (`soporte@uvarq.com`) |
| Descarga de los propios datos | Existe | `src/actions/perfil/exportar-datos.ts`, botón en `PerfilForm.tsx:419-423` |
| Eliminación de la cuenta por la propia persona | Existe | `src/actions/perfil/eliminar-cuenta.ts` |
| Supresión por un administrador (Habeas Data) | Existe | `private.anonimizar_usuario` (ver `docs/ops/inventario-de-datos.md`) |
| Registro de cada solicitud, con fecha y plazo | **Falta** | Ninguna tabla de solicitudes en `prisma/schema.prisma` |

El registro de solicitudes puede ser, al comienzo, una hoja de cálculo interna. No hace falta código para eso. Lo dejo como decisión mía.

## Qué pasar a Andres y Miguel

Quedó en `docs/pendientes-equipo.md`: tabla de consentimientos, aceptación para Google, separación de las casillas, enlaces a las rutas legales y banner de cookies (si el abogado lo pide).
