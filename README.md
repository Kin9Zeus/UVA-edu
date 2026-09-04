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
   SEND_EMAIL_HOOK_SECRET=
   ```

   `DATABASE_URL` y las claves de Supabase salen del panel del proyecto
   (Project Settings → API / Database). Las de Mux, Stripe, Wompi y Resend
   solo son necesarias para probar esos flujos puntuales — el resto de la
   app funciona sin ellas.

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

## Errores a evitar

No cambiar el esquema ni las políticas directamente desde el panel web de
Supabase. Ese cambio no queda versionado y el entorno de otro desarrollador
deja de coincidir — todo cambio de esquema va por una migración de Prisma, y
todo cambio de RLS/triggers va por un nuevo archivo en `supabase/sql/`.
