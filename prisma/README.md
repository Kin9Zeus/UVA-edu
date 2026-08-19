# Prisma: esquema, migraciones y seed

Prisma se usa **exclusivamente** para definir `schema.prisma`, correr migraciones
y sembrar datos de prueba (ver `docs/technical-spec.md` §2.1). El CRUD de la app
va por `@supabase/supabase-js` para que actúe el RLS.

- `schema.prisma` — fuente de verdad del esquema (15 tablas).
- `migrations/` — historial de migraciones aplicadas.
- `seed.ts` — datos de prueba reproducibles (ver abajo).

Las políticas RLS y el trigger `auth.users → perfiles` **no** viven aquí: son SQL
plano en `supabase/sql/` (ver el README de esa carpeta).

---

## Seed de datos de prueba

### ⚠️ Salvaguarda: `ALLOW_SEED`

`prisma/seed.ts` **borra y recrea datos**. Nunca debe correr contra Producción.

No hay forma fiable de distinguir un proyecto de Supabase de producción por su
URL — todas tienen la forma `https://<ref>.supabase.co` y el `ref` es opaco. Por
eso la protección es explícita, de triple llave, y el script aborta antes de
tocar la base si alguna falla:

1. **`ALLOW_SEED` debe valer exactamente `"true"`.** Está deliberadamente **fuera
   de `.env.local`**: hay que escribirla a mano en cada ejecución, para que
   sembrar sea siempre un acto consciente y nunca un efecto colateral de otro
   comando.
2. Si `NODE_ENV === "production"`, aborta aunque `ALLOW_SEED` esté puesta.
3. Si `NEXT_PUBLIC_SUPABASE_URL` o `DATABASE_URL` contienen `prod`, aborta.

Además, antes de escribir imprime el host de Supabase al que se conectó, para que
puedas confirmar de un vistazo que es el proyecto correcto.

### Comandos

```powershell
# PowerShell (Windows)
$env:ALLOW_SEED="true"; npx prisma db seed      # limpiar + sembrar
$env:ALLOW_SEED="true"; npm run db:seed:clean   # solo limpiar
```

```bash
# bash
ALLOW_SEED=true npx prisma db seed
ALLOW_SEED=true npm run db:seed:clean
```

> **Nota de configuración:** en Prisma 7 el comando de seed se declara en
> `prisma.config.ts` bajo `migrations.seed`, **no** en el bloque
> `"prisma": { "seed": ... }` de `package.json` (ese formato quedó obsoleto y ya
> no se lee). Requiere `tsx` como devDependency.

### Qué crea

**5 usuarios** — creados con `supabase.auth.admin.createUser({ email_confirm: true })`
usando la `SUPABASE_SERVICE_ROLE_KEY`. Prisma no puede crear cuentas de Supabase
Auth, así que el flujo es: Admin API → el trigger `on_auth_user_created` inserta
la fila en `perfiles` como `ESTUDIANTE`/`ACTIVO` → el seed espera a que aparezca
y **luego** corrige rol y estado con Prisma (única forma de obtener un
`ADMINISTRADOR`, porque el trigger nunca lo crea así).

| Correo | Contraseña | Rol | Estado | Suscripción |
| :-- | :-- | :-- | :-- | :-- |
| `admin@uva.test` | `UvaSeed2026!` | ADMINISTRADOR | ACTIVO | — |
| `estudiante-activo@uva.test` | `UvaSeed2026!` | ESTUDIANTE | ACTIVO | ACTIVA (+ una CANCELADA de historial) |
| `estudiante-sin-plan@uva.test` | `UvaSeed2026!` | ESTUDIANTE | ACTIVO | ninguna |
| `estudiante-suspendido@uva.test` | `UvaSeed2026!` | ESTUDIANTE | SUSPENDIDO | VENCIDA |
| `estudiante-pastdue@uva.test` | `UvaSeed2026!` | ESTUDIANTE | ACTIVO | PAST_DUE |

**Contenido y operación:**

- 4 categorías de arquitectura/construcción.
- 3 instructores con especialidad (`Ana Ruiz`, `Daniel Castaño`,
  `Mauricio Gallego`). No son cuentas: no existen en `auth.users` ni inician
  sesión. Se siembran antes que los cursos porque `cursos.id_instructor` es
  una FK obligatoria.
- 3 planes: Mensual y Anual activos, Trimestral con `activo = false`.
- 6 cursos (4 con `mostrado = true`, 2 ocultos), 14 módulos, 30 lecciones.
  28 lecciones en `LISTO`; 1 en `PROCESANDO` y 1 en `SUBIENDO` — estas dos sin
  `id_video_mux`, que es como se ven realmente antes de que Mux notifique
  (Flujo 09 de `docs/functional-spec.md`).
- 4 suscripciones cubriendo los 4 estados del Flujo 06.
- 3 pagos (2 `EXITOSO`, 1 `FALLIDO`).
- 4 cupones: `PORCENTAJE` vigente, `MONTO_FIJO` vigente, uno vencido y uno con
  `veces_usado == limite_usos`.
- 2 inscripciones: una `MEMBRESIA` con `otorgado_por = null` (como exige la
  policy `inscripciones_insert_propio`) y una `CORTESIA` otorgada por el admin
  (Flujo 11).
- 2 filas de progreso, 1 certificado (`UVA-2026-REVIT-7F3A9C2E`), 2 recursos
  descargables.

**No siembra** `bitacora_administrativa` (se genera con acciones reales) ni
`eventos_webhook` (son eventos reales de las pasarelas).

### Idempotencia

Correr el seed dos veces seguidas deja la base idéntica. Tres mecanismos:

- **UUID fijos y deterministas** para toda entidad sembrada (helper `uuid()`),
  así las referencias cruzadas no cambian entre corridas y el borrado puede
  identificar con precisión qué es dato sembrado.
- **Limpieza previa** respetando el orden de las Foreign Keys. `cursos` cascadea
  a `modulos` → `lecciones` → `progreso`, pero `recursos_descargables`,
  `certificados` e `inscripciones` **no** cascadean: se borran antes a mano o el
  `DELETE` de cursos falla. `instructores` va justo *después* de `cursos`:
  `cursos.id_instructor` es `ON DELETE RESTRICT`.
- **Borrado por nombre además de por id** en `instructores`, porque
  `instructores.nombre` es `UNIQUE` y pueden existir filas con esos mismos
  nombres pero otro id — las creó la migración que convirtió
  `cursos.instructor` de texto libre a relación. Filtrando solo por id
  sobrevivirían y la siembra fallaría con P2002.
- **Reutilización de cuentas de Auth**: si un usuario `@uva.test` sobrevivió a
  una limpieza parcial, se reutiliza su `id` y se le reescribe la contraseña, en
  vez de fallar con «email already registered».

### Qué NO toca

El criterio de «dato sembrado» es el dominio `@uva.test` para usuarios (TLD
reservado por RFC 2606: ningún correo real puede colisionar) y los UUID/códigos
fijos para el resto. Cualquier cuenta o fila fuera de ese criterio queda intacta.
