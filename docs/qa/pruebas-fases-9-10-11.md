# Pruebas de las fases 9, 10 y 11 del plan de blindaje

Fecha: 2026-11-04. Rama `seguridad-fase9`, subida directo a `master` (commits
`7f25003` → `89389dc`; el PR #28 quedó marcado como mezclado).

Leyenda: ✅ salió bien · ❌ falló (y cómo se arregló) · ⏳ pendiente · ⚠️ no
se pudo probar.

## Resumen

| Resultado | Cuántas |
| --- | --- |
| ✅ Salieron bien | 22 |
| ❌ Fallaron y se arreglaron | 8 (7 fallas distintas, ver sección 9) |
| ⏳ Pendientes (dependen de GitHub o de otras personas) | 4 |
| ⚠️ No se pudieron probar | 2 (más los 3 casos de la sección 7) |

Lo más importante que encontraron las pruebas: **la imagen de Docker para
desplegar no se habría podido construir** (falla 6). El CI no lo habría
visto. Se arregló antes de subir.

---

## 1. Verificaciones del código (en el computador)

| # | Prueba | Resultado |
| --- | --- | --- |
| 1.1 | `npx tsc --noEmit` (tipos) | ✅ Sin errores, en cada paso y al final |
| 1.2 | `npm run lint` | ✅ Sin errores |
| 1.3 | `npx vitest run`, suite completa | ✅ 140 archivos, **1.894 pruebas** en verde (antes 1.892; +2 del webhook de Auth) |
| 1.4 | `npm run build` normal (el que usa Railway) | ✅ Termina bien y **no** genera `.next/standalone`: Railway sigue igual |
| 1.5 | Validar el YAML de `ci.yml`, `codeql.yml`, `respaldo.yml` y `dependabot.yml` | ✅ Válidos |

Pruebas nuevas agregadas:

| Archivo | Qué prueba |
| --- | --- |
| `src/lib/eventos-seguridad.test.ts` | La línea JSON lleva tipo, evento y hora; descarta campos fuera de la lista (contraseña, correo, token); redacta un correo escondido en un campo permitido; quita la query de una ruta; recorta textos largos; solo los eventos graves van a Sentry y sin IP; nunca lanza aunque falle escribir |
| `src/actions/auth/login.test.ts` | Contraseña incorrecta registra `login_fallido`; tope de intentos registra `login_bloqueado` |
| `src/actions/limites-uso-acciones.test.ts` | Cada una de las acciones con límite registra `limite_de_uso` con un nombre de acción que existe en la base |
| `src/app/api/webhooks/supabase-auth/route.test.ts` | Sin el secreto del hook responde 500 y no manda correo; con una firma falsa responde 401 |

## 2. Fase 9: CI/CD

| # | Prueba | Resultado |
| --- | --- | --- |
| 2.1 | Buscar los SHA de las acciones | ✅ `checkout` v5.1.0 y `setup-node` v5.0.0, la misma versión mayor de hoy (la última era v7; no se subió para no cambiar el comportamiento de paso) |
| 2.2 | Leer el environment `supabase-test` por la API de GitHub | ✅ Tiene revisores (Kin9Zeus, andresescobar12, JuanLarrota) y no está limitado a una rama. Se dejó así a propósito: limitarlo a master apaga las pruebas de RLS en los PR |
| 2.3 | Confirmar qué base usa el job `rls` | ✅ Staging: los usuarios `rls-test-*` que deja la prueba están en staging |
| 2.4 | Buscar reglas de protección de master | ⚠️ No hay ninguna (0 rulesets). CODEOWNERS no bloquea hasta que un administrador cree la regla |
| 2.5 | Correr CodeQL en GitHub | ⏳ En cola (ver sección 6) |

## 3. Fase 10.2: eventos de seguridad, en la app real

App construida (`npm run build`) y arrancada con `next start`, contra la base
de **staging**.

| # | Prueba | Resultado |
| --- | --- | --- |
| 3.1 | Iniciar sesión con un correo inventado | ❌ → ✅ La prueba fallaba por tiempo de espera. **No era un bug de la app**: un correo que no existe lleva al registro (dos campos de contraseña), no al login. Se repitió con `rls-test-con-acceso-…@uva.test`, un usuario de prueba de staging |
| 3.2 | Contraseña incorrecta con ese usuario | ✅ Muestra "Correo o contraseña incorrectos." y el servidor escribe `{"tipo":"seguridad","evento":"login_fallido","ip":"::1","accion":"login"}`. **Sin el correo** |
| 3.3 | Petición sin el secreto de origen (`ORIGEN_SECRETO` de prueba) a `/login?token=abc` | ✅ 403 y evento `origen_rechazado` con `"ruta":"/login"`: la query con el token **no** se guardó |
| 3.4 | Misma petición con la cabecera `x-origen-uva` correcta | ✅ 200 |
| 3.5 | `/api/health` con el cierre de origen encendido | ✅ 200: sigue abierta para el monitor |
| 3.6 | Revisar qué copia la bitácora a los registros (`idEntidadAfectada` en las 25 acciones) | ✅ Todo son UUID: ningún código de invitación ni correo |
| 3.7 | Revisar la guardia del panel de administración | ❌ → ✅ Un estudiante que entraba a `/admin` generaba **dos** eventos y dos avisos a Sentry, porque el layout y la página llaman la guardia en la misma petición. Arreglo: un registro de "ya avisado" por petición con `cache()` de React (`src/lib/admin/guardiaPagina.ts`) |

## 4. Fase 11.1: imagen de Docker

Docker no está instalado en el computador, así que se probó lo que corre
dentro de la imagen: el servidor `standalone` de Next.

| # | Prueba | Resultado |
| --- | --- | --- |
| 4.1 | Build `standalone` con las variables de staging | ✅ Genera `server.js` e incluye `sharp` y las fuentes del certificado (`outputFileTracingIncludes`) |
| 4.2 | Arrancar ese servidor y pedir `/`, `/catalogo`, `/login`, `/verificar-certificado` y un CSS de `/_next/static` | ✅ Todas 200 |
| 4.3 | `/api/health` de ese servidor | ✅ 503, **esperado**: Supabase y Mux respondieron bien; faltaban las variables de Resend en el `.env.local` |
| 4.4 | Build **sin** `.env.local`, como dentro de Docker | ❌ → ✅ **Falla 1:** `Missing API key` de Resend. El cliente se creaba al cargar el módulo y exigía la llave secreta durante el build. Arreglo: el cliente se crea en el primer uso (`src/lib/resend/client.ts`) |
| 4.5 | Repetir 4.4 | ❌ → ✅ **Falla 2:** `Cannot read properties of undefined (reading 'replace')`. El secreto del hook de Auth se leía al cargar el módulo. Arreglo: se lee en cada petición, y si falta, responde 500 (falla cerrado) (`src/app/api/webhooks/supabase-auth/route.ts`) |
| 4.6 | Repetir 4.4 | ❌ → ✅ **Falla 3:** el sitemap se arma consultando la base durante el build, y sin Supabase no puede. No es un bug: la imagen real recibe la URL pública y la llave anónima (son públicas). Para el CI, que no las tiene, se usa `--experimental-build-mode=compile` (compila sin pre-generar páginas) |
| 4.7 | Build `compile` sin variables | ✅ Termina bien y genera `standalone` |
| 4.8 | Arrancar ese servidor sin **ninguna** variable y pedir `/api/health` | ✅ Arranca y responde 503 con el JSON de `checks`: lo mismo que comprueba el job del CI |
| 4.9 | El cliente de Resend diferido con la librería real | ✅ `resend.emails.send` sigue siendo una función y el objeto es el mismo en cada llamada |
| 4.10 | Revisión de la segunda pasada: ¿la imagen trae el cliente de Prisma? | ❌ → ✅ **Falla 6, la importante.** `prisma generate` crea `src/generated/prisma` en la etapa de dependencias, pero la etapa de build no lo copiaba. El build normal revisa los tipos de `prisma/seed.ts`, que lo importa, así que **la imagen para desplegar no se habría podido construir**. En el computador no se veía porque esa carpeta ya existía. Se confirmó quitándola: `tsc` falla con `Cannot find module '../src/generated/prisma/client'`. Arreglo: copiarla desde la etapa de dependencias y excluir la copia local (`infra/Dockerfile`, `infra/Dockerfile.dockerignore`) |
| 4.11 | ¿Por qué el CI no lo habría visto? | ❌ → ✅ El modo `compile` se salta la revisión de tipos (el log no muestra "Running TypeScript"). Arreglo: en modo `compile`, la imagen corre `next typegen` y `tsc --noEmit` antes de compilar |
| 4.12 | Sintaxis del comando de build del Dockerfile | ❌ → ✅ Al editarlo, un comentario quedó dentro del `RUN` y se habría tragado el resto del comando. Se reescribió y se comprobó con `sh -n`: sintaxis correcta |

Un efecto de estas pruebas: el servidor de prueba mandó 3 errores "chequeo de
salud falló" a Sentry (por las variables que faltaban en local). No son de
producción.

## 5. Fase 11.3 y documentos

| # | Prueba | Resultado |
| --- | --- | --- |
| 5.1 | Validar `respaldo.yml` | ✅ YAML válido |
| 5.2 | Correr el respaldo | ⚠️ No se puede todavía: está apagado hasta crear el environment `respaldo-produccion` y sus secretos. Sin ellos termina en verde con un aviso |
| 5.3 | Restaurar un respaldo en staging | ⏳ Pendiente del primer respaldo real (`respaldos-y-restauracion.md`, Parte D) |
| 5.4 | Envío de registros de Railway a otro servicio | ✅ Investigado: Railway no tiene envío nativo. Se recomienda Vector (guía oficial) y se descarta Locomotive porque pide una llave de toda la cuenta de Railway |

## 6. En GitHub y en producción

| # | Prueba | Resultado |
| --- | --- | --- |
| 6.1 | CI del PR #28 y de master (tipos, pruebas, gitleaks, RLS, imagen de Docker, CodeQL) | ⏳ **En cola sin runner** por la caída de GitHub Actions. Es la prueba final de la imagen de Docker |
| 6.2 | `/api/health` de producción después de subir | ✅ 200 (tres veces seguidas) |
| 6.3 | Probar en producción, después del despliegue | ⏳ Login con contraseña incorrecta (ver el evento en Railway con `"tipo":"seguridad"`), recuperar contraseña o registrarse (que llegue el correo), y una acción de administrador (`accion_admin` en los registros) |

## 7. Lo que no se pudo probar aquí

| Qué | Por qué | Quién lo cubre |
| --- | --- | --- |
| Construir la imagen con Docker | Docker no está instalado en el computador | El job "Imagen de Docker" del CI (6.1) |
| Evento `admin_denegado` de un estudiante con sesión, en la app real | Necesitaría la contraseña de una cuenta de estudiante | Código revisado; el arreglo de 3.7 lo deja en un evento por visita |
| Respaldo y restauración | Faltan el bucket, la llave de cifrado y el usuario de solo lectura | `revision-mensual.md` y Parte D de `respaldos-y-restauracion.md` |

## 8. Datos de prueba que quedaron

- El usuario de staging `rls-test-con-acceso-1793743499674@uva.test` recibió
  un intento fallido de contraseña (se borra solo a los 15 minutos).
- Producción no se tocó durante las pruebas.

## 9. Fallas encontradas, en una línea cada una

| # | Falla | Gravedad | Arreglo | Commit |
| --- | --- | --- | --- | --- |
| 1 | Resend exigía la llave secreta durante el build | Media (bloqueaba la imagen sin secretos) | Cliente creado en el primer uso | `511e292` |
| 2 | El secreto del hook de Auth se leía al cargar el módulo | Media | Leído en cada petición; 500 si falta | `511e292` |
| 3 | El sitemap consulta la base durante el build | Ninguna (comportamiento esperado) | Modo `compile` en el CI; la imagen real recibe las variables públicas | `511e292` |
| 4 | Prueba de login con un correo inexistente | Ninguna (error de la prueba, no de la app) | Usar un usuario de prueba de staging | — |
| 5 | Dos eventos por cada entrada negada al panel | Baja (ruido en Sentry y conteos dobles) | Un aviso por petición con `cache()` | `89389dc` |
| 6 | La imagen no copiaba el cliente de Prisma generado (pruebas 4.10 y 4.11) | **Alta** (la imagen para desplegar no se construía, y el CI no lo veía) | Copiarlo y revisar tipos también en modo `compile` | `89389dc` |
| 7 | Un comentario quedó dentro del comando de build del Dockerfile al editarlo | Alta si se hubiera subido (el build no habría corrido); se encontró antes del commit | Reescrito y comprobado con `sh -n` | `89389dc` |
