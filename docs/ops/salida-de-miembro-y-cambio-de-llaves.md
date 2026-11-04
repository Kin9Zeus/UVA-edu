# Salida de un miembro y cambio de llaves

Fase 7 del plan de blindaje (secretos 4 y 5). Dos procedimientos:
qué hacer cuando alguien deja el equipo, y cómo cambiar cada llave sin
tumbar la app. El segundo también sirve cuando una llave se filtra.

**Regla:** este documento y el registro de seguridad llevan solo nombres
de llaves, nunca valores.

## 1. Cuando alguien sale del equipo

Hacerlo **el mismo día**, en este orden: primero cortar accesos, después
cambiar lo que esa persona pudo ver.

### 1.1 Quitar accesos

| Dónde | Qué hacer |
| --- | --- |
| GitHub | Quitarlo como colaborador del repo. Revisar Settings → Deploy keys y que no quede ningún token suyo en Actions |
| Railway | Quitarlo del proyecto (Members) |
| Supabase | Quitarlo de la organización. Afecta a staging y a producción |
| Mux, Resend, Sentry | Quitarlo de cada equipo |
| Google (AI Studio / Cloud) | Quitarlo del proyecto que tiene la llave de Gemini |
| Gestor de contraseñas | Sacarlo de la bóveda compartida |
| Notion y WhatsApp | Quitarlo del espacio y de los grupos |
| La app (U.V.A) | Si era administrador: quitarle el rol en `perfiles` (hoy solo por SQL, con la skill `pasar-a-produccion`) y cerrar todas sus sesiones |

### 1.2 Cambiar lo que pudo ver

Las variables de Railway están selladas: nadie las lee desde el panel.
Pero quien tuvo la bóveda o un archivo `.env.*` en su computador pudo ver
los valores. Si la persona tenía cualquiera de las dos cosas, se cambian
**todas** las llaves de la sección 2 que estaban ahí. Si no, basta con el
paso 1.1.

Anotar en el registro de seguridad: fecha, quién salió, qué accesos se
quitaron y qué llaves se cambiaron.

## 2. Cómo cambiar cada llave

### Regla general (sin tumbar la app)

1. **Crear la llave nueva** sin borrar la vieja, cuando el servicio lo
   permite (casi todos).
2. **Ponerla en Railway** en cada servicio que la usa: la app `UVA-edu` y
   los crons. Railway → servicio → Variables → buscar el nombre. Al
   guardar, Railway redespliega la app sola. **Los crons no se redespliegan
   solos**: hay que hacerlo a mano.
3. **Probar:** `/api/health` en verde, iniciar sesión, ver un video, que
   llegue un correo.
4. **Borrar o revocar la vieja** en el panel del servicio.
5. Actualizar la bóveda y anotar la fecha en el registro.

Si es una llave de **staging**, también se cambia en GitHub (Settings →
Environments → `supabase-test`), que es donde la lee el CI, y en el
`.env.local` de cada desarrollador.

### Llave por llave

| Variable | Dónde se genera | Cómo se cambia | ¿Corta algo? |
| --- | --- | --- | --- |
| `SUPABASE_SERVICE_ROLE_KEY` (llave maestra) | Supabase → Project Settings → API Keys | Con las llaves nuevas de Supabase (`sb_secret_…`): crear una, cambiarla, borrar la vieja. Con las llaves antiguas (JWT), cambiarla obliga a cambiar el secreto JWT del proyecto, y eso también cambia la llave pública y cierra la sesión de todos | Con las nuevas, no. Con las antiguas, sí: todos vuelven a entrar |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` (llave pública) | Igual que la anterior (`sb_publishable_…`) | Igual. Es pública a propósito (viaja en el navegador); se cambia solo si se cambia el secreto JWT | Igual que la anterior |
| `DATABASE_URL` (contraseña de la base) | Supabase → Database → Settings → Reset password | No admite dos a la vez: la vieja deja de valer al instante. **Ya no vive en Railway** (se quitó el 2026-11-04: ni la app ni los crons la usan); solo está en el `.env.produccion.local` de quien corre scripts de producción y en la bóveda. Cambiarla en esos dos lugares | No: la app no se conecta directo a Postgres. Solo fallan los scripts de producción hasta actualizar el archivo |
| `SEND_EMAIL_HOOK_SECRET` | Supabase → Authentication → Hooks → Send Email | Generar uno nuevo y cambiarlo en Railway enseguida | Sí: hasta el redespliegue, los correos de Auth (confirmar cuenta, recuperar contraseña) fallan |
| `RESEND_API_KEY` | Resend → API Keys | Crear una con permiso **solo de envío** ("Sending access") y limitada al dominio. Cambiar y borrar la vieja | No |
| `MUX_TOKEN_ID` + `MUX_TOKEN_SECRET` | Mux → Settings → Access Tokens | Crear un token nuevo (permiso Mux Video, lectura y escritura), cambiar **los dos valores juntos**, revocar el viejo | No |
| `MUX_SIGNING_KEY_ID` + `MUX_SIGNING_KEY_PRIVATE` | Mux → Settings → Signing Keys | Crear una llave nueva y cambiar los dos valores juntos. Los videos ya abiertos siguen funcionando hasta borrar la vieja | No |
| `MUX_WEBHOOK_SECRET` | Mux → Settings → Webhooks | Generar el secreto nuevo y cambiarlo en Railway enseguida | Sí: los avisos de Mux de esos minutos fallan, pero Mux los reintenta |
| `GEMINI_API_KEY` | Google AI Studio → API Keys | Crear una nueva en el mismo proyecto (conserva el tope de gasto), cambiar y borrar la vieja | No |
| `SENTRY_AUTH_TOKEN` | Sentry → Settings → Auth Tokens | Crear uno nuevo (solo para subir source maps), cambiar y revocar el viejo. Solo se usa al compilar | No |
| `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN` | Sentry → proyecto → Client Keys | Es pública (viaja en el navegador). Se cambia solo si alguien la usa para llenar Sentry de basura: crear una nueva y desactivar la vieja | No |
| `RESPALDO_DATABASE_URL` (fase 11.3, GitHub → environment `respaldo-produccion`) | Supabase producción, usuario `respaldo_lector` (solo lectura) | `alter role respaldo_lector password '…'` en el SQL Editor y cambiar el secreto en GitHub | No: solo falla el respaldo de ese día |
| `RESPALDO_S3_LLAVE_ID` + `RESPALDO_S3_LLAVE_SECRETA` | El proveedor del bucket de respaldos (p. ej. Cloudflare R2 → API Tokens) | Crear una llave nueva solo de escritura en ese bucket, cambiar los dos secretos en GitHub, borrar la vieja | No |
| Llave privada de `age` de los respaldos | La genera `age-keygen`; vive **solo** en el gestor de contraseñas | No se cambia por rutina: con una nueva, los respaldos viejos solo se abren con la vieja. Si se filtró, generar otra, cambiar `RESPALDO_AGE_PUBLICA` y guardar las dos | No |
| Llave de ingreso de registros (fase 10.1, cuando exista) | Better Stack o Axiom | Crear una nueva, cambiarla en el servicio de Vector de Railway, borrar la vieja | No: se pierden los registros de esos minutos |
| `WOMPI_*`, `STRIPE_*` | Paneles de Wompi y Stripe | Hoy sin valor real (el cobro está apagado). Se documentan al conectar una pasarela | — |

### Llaves por entorno

Staging y producción **nunca** comparten una llave. Si un mismo valor
aparece en `.env.local` y en Railway de producción, se cambia el de
producción. Hoy son proyectos distintos en Supabase. En Mux, Resend y
Gemini hay que confirmar en cada panel que staging tenga su propia llave
(fase 7, secretos 5).

## 3. Si una llave se filtró

1. Cambiarla **ya**, con la tabla de arriba, aunque corte algo unos
   minutos. Una llave filtrada es peor que un corte de 3 minutos.
2. Revisar en el panel del servicio qué se hizo con ella desde la fecha
   de la filtración (registros de Supabase, correos enviados en Resend,
   gasto en Google AI Studio).
3. Si estaba en git, cambiarla no basta para borrarla del historial: el
   CI (gitleaks) la seguirá marcando. Se cambia la llave y se anota en
   `.gitleaksignore` el hallazgo, con la fecha en que se cambió.
4. Anotar en el registro de seguridad qué pasó, cuándo y qué se cambió.
