# U.V.A (Unidad Vectorial de Arquitectura) v2

Plataforma de cursos en línea. Next.js (App Router) + TypeScript + Supabase +
Prisma + Tailwind CSS. Ver `CLAUDE.md` para la arquitectura completa y
`docs/` (`functional-spec.md`, `technical-spec.md`, `development-plan.md`)
para las reglas de negocio y el esquema.

## Arrancar desde cero

Requiere un proyecto de Supabase vacío (nuevo, no el de producción) y Node 20+.

1. **Instalar dependencias**

   ```bash
   npm install
   ```

2. **Variables de entorno** — crear `.env.local` en la raíz con:

   ```
   DATABASE_URL=
   NEXT_PUBLIC_SUPABASE_URL=
   NEXT_PUBLIC_SUPABASE_ANON_KEY=
   SUPABASE_SERVICE_ROLE_KEY=
   MUX_TOKEN_ID=
   MUX_TOKEN_SECRET=
   MUX_SIGNING_KEY_ID=
   MUX_SIGNING_KEY_PRIVATE=
   MUX_WEBHOOK_SECRET=
   STRIPE_SECRET_KEY=
   STRIPE_WEBHOOK_SECRET=
   WOMPI_PRV_KEY=
   RESEND_API_KEY=
   RESEND_FROM_EMAIL=
   SEND_EMAIL_HOOK_SECRET=
   GEMINI_API_KEY=
   NEXT_PUBLIC_SITE_URL=
   ```

   `DATABASE_URL` y las claves de Supabase salen del panel del proyecto
   (Project Settings → API / Database). Las de Mux, Stripe, Wompi y Resend
   solo son necesarias para probar esos flujos puntuales — el resto de la
   app funciona sin ellas.

   **`GEMINI_API_KEY`** (aistudio.google.com → API keys) la usa solo la
   generación de exámenes con IA (`src/lib/examenes/generacion/`). Su ausencia
   no rompe nada al arrancar —el cliente se construye de forma perezosa, ver
   `src/lib/gemini/client.ts`— pero el botón «generar examen» del panel
   devuelve error hasta que exista. Es una clave de servidor: nunca la
   prefijes con `NEXT_PUBLIC_`, o viajaría en el bundle del navegador.

   El modelo está fijo en `MODELO_GENERACION_EXAMEN`
   (`src/lib/gemini/client.ts`), no en una variable de entorno: cambiarlo
   cambia la calidad de un examen calificable, así que debe pasar por revisión
   de código.

   **`NEXT_PUBLIC_SITE_URL` es obligatoria en producción** (en local puede
   omitirse: `siteUrl()` cae a `http://localhost:3000`). Es el origen con el
   que se arman los enlaces de los correos de autenticación —recuperar
   contraseña, confirmar cuenta, bienvenida al canjear— y el QR que se imprime
   en el PDF de los certificados. Antes se derivaba del header `Host` de la
   petición, que lo escribe quien llama: ver P1-1 en `AUDIT-2026-09-04.md` y
   `src/lib/site-url.ts`. Sin barra final y con protocolo, p. ej.
   `https://uva.co`.

   El valor tiene que estar además en la lista de **Authentication → URL
   Configuration → Redirect URLs** de Supabase, junto con el de staging y
   `http://localhost:3000`. Esa lista es la segunda capa del mismo control: la
   app ya no depende de ella, pero conviene dejarla cerrada a esos tres
   orígenes en lugar de a un comodín.

   **Opcional — `TRUSTED_PROXY_HOPS`** (por defecto `1`): cuántos proxies de
   confianza hay delante de la aplicación. Es lo que usa `src/lib/clientIp.ts`
   para saber qué entrada de `x-forwarded-for` no pudo escribir el cliente, y
   de ahí sale la clave de los límites por IP. En Railway sin CDN propio es
   `1` y no hay que tocarla. **Subirla por encima del número real
   reintroduce la vulnerabilidad P1-2** (se acaba leyendo justo el valor que
   puso el atacante), así que si algún día se añade un proxy delante, medir
   la cadena real antes de cambiarla — nunca suponerla.

3. **Esquema (Prisma)** — crea las tablas:

   ```bash
   npx prisma migrate deploy
   npx prisma generate
   ```

4. **RLS, triggers y funciones** — Prisma solo modela el esquema; las
   políticas de Row Level Security, triggers y funciones `private.*`/
   `public.*` viven en `supabase/sql/` y se aplican con:

   ```bash
   npm run db:rls:check   # verifica que los scripts aplican limpio, sin escribir
   npm run db:rls         # los aplica de verdad, en orden y en una sola transacción
   ```

   `scripts/apply-rls.ts` los ordena por su prefijo numérico y los corre
   dentro de un único `BEGIN`/`COMMIT`: si uno falla, revierte el lote
   completo — nunca queda la base con solo una parte aplicada. Ya no se
   pegan a mano en el SQL Editor de Supabase. Ver la explicación de cada
   script en **`supabase/sql/README.md`**.

5. **Seed de datos de prueba**

   ```bash
   # PowerShell
   $env:ALLOW_SEED="true"; npx prisma db seed

   # bash
   ALLOW_SEED=true npx prisma db seed
   ```

   Crea 6 usuarios de prueba (admin + 5 estudiantes cubriendo sin acceso,
   acceso manual y acceso por código de invitación), 6 cursos con módulos y
   lecciones, suscripciones, cupones, un código de invitación, etc. Detalle
   completo, idempotencia y salvaguardas contra correr esto en producción en
   **`prisma/README.md`**.

6. **Levantar la app**

   ```bash
   npm run dev
   ```

   Abrir [http://localhost:3000](http://localhost:3000). Credenciales de
   prueba: cualquier correo `@uva.test` sembrado, contraseña `UvaSeed2026!`
   (ver la tabla completa en `prisma/README.md`).

## Por qué dos sistemas de migraciones

- **Prisma Migrate** (`prisma/migrations/`) es la fuente de verdad del
  *schema*: tablas, columnas, FKs, enums. Numerado por timestamp,
  inmutable — una migración aplicada nunca se edita, se corrige con una
  nueva.
- **SQL manual numerado** (`supabase/sql/`) cubre lo que Prisma no puede
  expresar: RLS, triggers y funciones `SECURITY DEFINER`. Mismo criterio de
  inmutabilidad, pero versionado a mano porque es Supabase-específico.

El CRUD de la aplicación en tiempo de ejecución pasa siempre por
`@supabase/supabase-js` (para que apliquen las políticas de RLS), nunca por
Prisma Client — Prisma es solo para definir el esquema y sembrar datos de
prueba (`CLAUDE.md` §2).

## Otros comandos útiles

```bash
npx prisma studio              # explorar la base con UI
npm run db:seed:clean          # borrar solo los datos de seed
npm run test:rls               # probar RLS con 3 sesiones (anónimo / sin acceso / con acceso)
npm run lint
```

## Scripts npm (referencia completa)

Todos los scripts (`scripts/*.ts`) tienen su propio comentario de cabecera
con el detalle completo — esto es solo el mapa para saber cuál buscar. La
mayoría corre contra `DATABASE_URL`/las claves de Supabase de `.env.local`,
así que apunta al mismo proyecto que tengas configurado.

**Base de datos y RLS**

| Script | Qué hace |
|---|---|
| `npm run db:reset` | Borra TODO el contenido de la base (no el esquema) — confirmación explícita requerida, ver el propio archivo antes de usarlo. |
| `npm run db:rls` | Aplica `supabase/sql/*` contra `DATABASE_URL`, en orden numérico y en una sola transacción. |
| `npm run db:rls:check` | Igual que `db:rls` pero sin escribir — solo verifica que los scripts aplican limpio. |
| `npm run db:check-fk-indexes` | Falla si alguna FK de una sola columna no tiene un índice que la lidere (gate de CI). |
| `npm run db:check-rls-initplan` | Falla si una policy llama `private.es_administrador()` sin envolver en subconsulta escalar — re-evaluación por fila en vez de una vez por query (gate de CI, agregado tras P2-2). |

**Tests de integración (contra servicios reales, no mocks)**

| Script | Qué hace |
|---|---|
| `npm run test:rls` | Prueba RLS con 3 sesiones (anónimo, estudiante sin acceso, estudiante con acceso) llamando la API de Supabase directamente. |
| `npm run test:webhooks` | Prueba de los webhooks entrantes: verificación de firma e idempotencia. |
| `npm run test:pagos` | Prueba de punta a punta del cobro con Wompi, sin cuenta de comercio real y sin levantar el servidor. |
| `npm run test:canje` | Prueba de integración de `canjear_codigo_invitacion()` (código de invitación → acceso). |
| `npm run test:e2e` | Suite de Playwright (`e2e/*.spec.ts`) — recorridos completos contra un servidor real. |

**Operación (los mismos que corren como cron en producción, ver `docs/ops/`)**

| Script | Qué hace |
|---|---|
| `npm run mux:limpiar` | Drena `mux_assets_pendientes_eliminacion`: borra contra la API real de Mux los assets marcados para eliminar. |
| `npm run mux:verificar-atascados` | Alerta si una lección lleva demasiado tiempo sin salir de un estado intermedio de procesamiento de Mux. |
| `npm run examenes:liberar-atascados` | Libera los trabajos de generación de examen con IA que quedaron colgados en `PENDIENTE`, y avisa. |
| `npm run certificados:notificar` | Envía el correo de "certificado listo" pendiente y marca `notificado_en`. |
| `npm run rate-limit:limpiar` | Barre las filas caducadas de las tablas de rate limiting. |
| `npm run pagos:avisar-vencimientos` | Avisa por correo a quien tiene el acceso por vencer y marca `aviso_vencimiento_en`. |

**Utilidades puntuales, no automatizadas**

| Script | Qué hace |
|---|---|
| `npm run examenes:probar-generacion` | Prueba de humo de la generación de exámenes contra la API real de Gemini. |
| `npm run verificar:migraciones-reversibles` | Falla si una migración de Prisma nueva (contra la rama base) contiene un `DROP`/`RENAME` sobre columna o tabla sin el guardado previo que exige la regla del equipo — gate de CI en PRs. |
| `npm run certificados:regenerar-pdf` | Regenera y resube el PDF de cada certificado que ya tiene `archivo_pdf` cacheado en Storage. |
| `npm run pagos:rollback` | Deshace por completo el trabajo de la rama de pagos del lado de la base de datos (tabla `intentos_pago`, funciones y datos de prueba de Wompi) — solo para revertir ese trabajo específico, no un rollback genérico. |

**Auditoría visual/performance (`scripts/audit/`)**

| Script | Qué hace |
|---|---|
| `npm run audit:lighthouse` | Corre Lighthouse (mobile y desktop) contra cada ruta pública y guarda los reportes en `/lighthouse-baseline/{fecha}/`. |
| `npm run audit:lighthouse:compare` | Igual, pero comparando contra el baseline anterior. |
| `npm run audit:screenshots` | Captura screenshots de página completa de cada ruta pública en 5 anchos de viewport. |
| `npm run audit:overflow` | Detecta overflow horizontal en cada ruta pública, en los mismos 5 breakpoints. |

## Errores a evitar

No cambiar el esquema ni las políticas directamente desde el panel web de
Supabase. Ese cambio no queda versionado y el entorno de otro desarrollador
deja de coincidir — todo cambio de esquema va por una migración de Prisma, y
todo cambio de RLS/triggers va por un nuevo archivo en `supabase/sql/`.
