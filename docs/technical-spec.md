# **Technical Specification: U.V.A — Plataforma de Cursos v2**

## **1\. Stack Tecnológico**

El proyecto utiliza un stack moderno basado en React y servicios gestionados para minimizar la carga operativa.

> * **Framework Principal:** Next.js (App Router, versión 14+) con TypeScript.  
> * **Estilos y UI:** Tailwind CSS \+ shadcn/ui (Librería base de componentes accesibles).  
> * **Base de Datos y Auth:** Supabase (PostgreSQL) \+ Supabase Auth.  
> * **ORM / Esquema:** Prisma (Exclusivamente para migraciones y definición de esquema schema.prisma).  
> * **Video y Streaming:** Mux (con @mux/mux-player-react para el reproductor).  
> * **Pagos:** Stripe (Facturación internacional) y Wompi (Local Colombia).  
> * **Correos Transaccionales:** Resend \+ React Email.  
> * **Generación PDF:** pdf-lib (Generación de certificados ultraligera en backend).  
> * **Hosting / Infraestructura:** Railway.

## **2\. Arquitectura General y Decisiones Técnicas Relevantes**

### **2.1 Enfoque Híbrido de Base de Datos (Prisma \+ Supabase SDK)**

> * **Decisión:** Se utilizará Prisma **únicamente** para gestionar migraciones y versionar el esquema de la base de datos de forma declarativa. Para el CRUD diario (consultas e inserciones desde Next.js), se usará el cliente oficial @supabase/supabase-js.  
> * **Justificación:** El cliente de Supabase envía automáticamente el token JWT del usuario, lo que activa el *Row Level Security (RLS)* de Postgres. Si usáramos Prisma Client para consultar datos, el RLS no funcionaría nativamente sin configuraciones complejas.

### **2.2 Patrón de Comunicación (Server Actions vs API Routes)**

> * Las mutaciones (crear curso, editar perfil, guardar progreso) se realizarán principalmente mediante **Next.js Server Actions**, eliminando la necesidad de crear endpoints REST tradicionales (/api/) para uso interno.  
> * Las rutas /api/ (Route Handlers) se reservarán estrictamente para recibir **Webhooks externos** (Mux, Stripe, Wompi).

## **3\. Estructura del Proyecto**

Se adoptará una arquitectura *Feature-based* adaptada al App Router de Next.js:

UVA_EDU/  
├── prisma/                 \# Esquema (schema.prisma) y migraciones  
├── src/  
│   ├── app/                \# Next.js App Router (Páginas y Layouts)  
│   │   ├── (public)/       \# Rutas públicas (Home, Catálogo)  
│   │   ├── (student)/      \# Área de estudiante (Mis cursos, Reproductor)  
│   │   ├── (admin)/        \# Panel de administración (CMS)  
│   │   └── api/            \# Route Handlers para Webhooks  
│   ├── components/  
│   │   ├── ui/             \# Componentes base (shadcn/ui: botones, modales)  
│   │   └── features/       \# Componentes de negocio (VideoPlayer, CourseCard)  
│   ├── lib/                \# Utilidades, configuración de Supabase, Stripe  
│   └── actions/            \# Server Actions (Lógica de mutación de datos)

## **4\. Base de Datos: Diccionario de Datos (Esquema de Tablas)**

A continuación se detallan todas las entidades con sus atributos y tipos de datos sugeridos para PostgreSQL / Prisma.

### **Módulo de Usuarios y Membresía**

#### **Tabla: Perfiles**

Nota: La contraseña y proveedor de login viven en auth.users de Supabase.

| Parámetro | Tipo de Dato | Descripción   |
| :---- | :---- | :---- |
| **id** | UUID (Primary Key) | Referencia directa a auth.users.id |
| **nombre** | String | Nombre del usuario |
| **correo** | String (Unique) | Correo electrónico |
| **celular** | String? | Teléfono/celular, informativo (opcional) |
| **rol** | Enum | ESTUDIANTE, ADMINISTRADOR |
| **estado** | Enum | ACTIVO, SUSPENDIDO |
| **fecha\_registro** | DateTime | Default now() |

#### **Tabla: Planes**

| Parámetro | Tipo de Dato | Descripción   |
| :---- | :---- | :---- |
| **id** | UUID (Primary Key) | Identificador único |
| **nombre** | String | Ej. Básico, Premium, Anual |
| **descripcion** | String (nullable) | Descripción del plan |
| **precio\_centavos** | BigInt | Precio de referencia del catálogo. Entero en la unidad mínima: evita coma flotante, y BigInt porque en centavos de COP un Int de 4 bytes tope en $21.474.836 |
| **moneda** | String (CHECK ISO-4217) | Ej. 'USD', 'COP' |
| **duracion\_dias** | Int | 30 para mensual, 365 para anual |
| **nivel\_acceso** | String (nullable) | Nivel de acceso que otorga |
| **activo** | Boolean | Default true |
| **orden** | Int | Orden en la UI |

#### **Tabla: Suscripciones**

| Parámetro | Tipo de Dato | Descripción   |
| :---- | :---- | :---- |
| **id** | UUID (Primary Key) | Identificador único |
| **id\_usuario** | UUID (Foreign Key) | A qué usuario pertenece |
| **id\_plan** | UUID (Foreign Key) | Qué plan eligió |
| **fecha\_inicio** | Timestamptz | Inicio de la suscripción |
| **fecha\_renovacion** | Timestamptz (nullable) | Próxima fecha de cobro, o fin del acceso si es manual |
| **estado** | Enum | ACTIVA, PAST\_DUE, VENCIDA, CANCELADA |
| **proveedor** | String (CHECK) | El ORIGEN del acceso: 'stripe', 'wompi', 'manual', 'invitacion' |
| **id\_cliente\_externo** | String (nullable) | Customer ID de pasarela |
| **id\_suscripcion\_externa** | String (nullable) | Subscription ID de pasarela |
| **monto\_centavos** | BigInt | Valor realmente pagado, en la unidad mínima |
| **moneda** | String (CHECK ISO-4217) | Ej. 'COP', 'USD' |
| **id\_cupon** | UUID (Foreign Key) | Cupón aplicado, si tiene |
| **acceso\_manual** | Boolean | Default false |
| **otorgado\_por** | UUID (Foreign Key) | Admin que otorgó acceso manual |

#### **Tabla: Pagos**

| Parámetro | Tipo de Dato | Descripción   |
| :---- | :---- | :---- |
| **id** | UUID (Primary Key) | Identificador único |
| **id\_suscripcion** | UUID (Foreign Key) | A qué suscripción pertenece |
| **creado\_en** | Timestamptz | Cuándo insertamos NOSOTROS la fila |
| **fecha\_pago** | Timestamptz (nullable) | Cuándo cobró la pasarela, según la pasarela |
| **estado** | Enum | EXITOSO, FALLIDO, PENDIENTE, REEMBOLSADO, REVERSADO |
| **proveedor** | String (CHECK) | Qué pasarela procesó el cobro: 'stripe' o 'wompi' |
| **monto\_centavos** | BigInt | Valor cobrado, en la unidad mínima |
| **moneda** | String (CHECK ISO-4217) | Moneda del cobro |
| **ref\_transaccion\_externa** | String | **Clave de idempotencia**, única junto a `proveedor` |
| **ref\_factura\_dian** | String (nullable) | Referencia factura electrónica |
| **url\_pdf\_factura** | String (nullable) | Enlace al PDF de la factura |

Tabla **vacía**: nada la escribe todavía. `creado_en` y `fecha_pago` son
distintas a propósito — Stripe reintenta la entrega de un webhook hasta tres
días, y sin separarlas el estudiante vería la fecha del reintento como la de su
pago.

#### **Tabla: Planes\_Precios**

Precio de un plan **en una pasarela concreta**. Vacía: llenarla es parte de la
integración de cobro.

| Parámetro | Tipo de Dato | Descripción   |
| :---- | :---- | :---- |
| **id** | UUID (Primary Key) | Identificador único |
| **id\_plan** | UUID (Foreign Key) | Qué plan se está cotizando |
| **proveedor** | String (CHECK) | 'stripe' o 'wompi' |
| **id\_precio\_externo** | String | `price_...` en Stripe. Único junto a `proveedor` |
| **monto\_centavos** | BigInt | Lo que se cobra por esta pasarela |
| **moneda** | String (CHECK ISO-4217) | Permite el mismo plan en COP y en USD |
| **activo** | Boolean | Retirar un precio sin borrar la fila |

Existe por dos motivos que se resuelven juntos: sin ella no hay contra qué
conciliar un webhook (no hay mapeo plan → precio del proveedor), y `Planes`
tiene una sola pareja precio/moneda cuando el stack define Stripe para
facturación internacional y Wompi para Colombia.

### **Módulo de Contenido (Catálogo LMS)**

#### **Tabla: Categorías**

| Parámetro | Tipo de Dato | Descripción   |
| :---- | :---- | :---- |
| **id** | UUID (Primary Key) | Identificador único |
| **nombre** | String | Nombre de la categoría |
| **descripcion** | String (nullable) | Descripción breve |
| **activo** | Boolean | Default true. Agregado para el panel admin (prompt-panel-admin-claude-code.md) |
| **id\_admin\_creador** | UUID (Foreign Key, nullable) | Admin que la creó. Agregado para el panel admin |

#### **Tabla: Instructores**

Información de catálogo, **no cuentas de usuario**: un instructor no existe en
`auth.users`, no inicia sesión y no tiene perfil. Solo sirve para identificar
quién dicta cada curso, y lo gestiona el administrador desde el panel.
Sustituye al antiguo campo de texto libre `Cursos.instructor`.

| Parámetro | Tipo de Dato | Descripción   |
| :---- | :---- | :---- |
| **id** | UUID (Primary Key) | Identificador único |
| **nombre** | String (Unique) | Nombre del instructor. Único: el formulario de curso permite dar de alta uno nuevo sin salir, y sin la restricción se duplicarían |
| **especialidad** | String (nullable) | Área en la que dicta. Nullable porque los instructores migrados desde el texto libre no la traían |
| **id\_admin\_creador** | UUID (Foreign Key, nullable) | Admin que lo creó. Solo para auditoría — no se muestra en el listado |
| **fecha\_creacion** | DateTime | Default now() |

#### **Tabla: Cursos**

| Parámetro | Tipo de Dato | Descripción   |
| :---- | :---- | :---- |
| **id** | UUID (Primary Key) | Identificador único |
| **id\_categoria** | UUID (Foreign Key) | Categoría a la que pertenece |
| **titulo** | String | Nombre del curso |
| **descripcion** | Text | Descripción del curso |
| **imagen\_portada** | String | URL de Supabase Storage |
| **id\_instructor** | UUID (Foreign Key) | Instructor que dicta el curso |
| **nivel** | Enum | BASICO, INTERMEDIO, AVANZADO. Agregado para el panel admin |
| **destacado** | Boolean | Default false. Agregado para el panel admin |
| **orden\_visualizacion** | Int | Default 0. Agregado para el panel admin |
| **mostrado** | Boolean | Default false |
| **id\_admin\_creador** | UUID (Foreign Key) | Admin que lo creó |
| **fecha\_creacion** | DateTime | Default now() |
| **fecha\_edicion** | DateTime | Última edición (updated\_at) |

#### **Tabla: Módulos**

| Parámetro | Tipo de Dato | Descripción   |
| :---- | :---- | :---- |
| **id** | UUID (Primary Key) | Identificador único |
| **id\_curso** | UUID (Foreign Key) | Curso al que pertenece |
| **titulo** | String | Nombre del módulo |
| **orden** | Int | Posición dentro del curso |

#### **Tabla: Lecciones**

| Parámetro | Tipo de Dato | Descripción   |
| :---- | :---- | :---- |
| **id** | UUID (Primary Key) | Identificador único |
| **id\_modulo** | UUID (Foreign Key) | Módulo al que pertenece |
| **titulo** | String | Nombre de la lección |
| **orden** | Int | Posición dentro del módulo |
| **id\_video\_mux** | String (nullable) | Playback ID de Mux |
| **duracion** | Int (nullable) | En segundos |
| **estado\_procesamiento** | Enum | SUBIENDO, PROCESANDO, LISTO |
| **resumen** | Text (nullable) | Descripción en markdown |

### **Módulo de Operaciones y Seguimiento**

#### **Tabla: Progreso**

| Parámetro | Tipo de Dato | Descripción   |
| :---- | :---- | :---- |
| **id** | UUID (Primary Key) | Identificador único |
| **id\_usuario** | UUID (Foreign Key) | Usuario |
| **id\_leccion** | UUID (Foreign Key) | Lección |
| **completado** | Boolean | Default false |
| **segundo\_actual** | Int | Default 0 |
| **fecha\_actualizacion** | DateTime | Última vez visto |

#### **Tabla: Certificados**

| Parámetro | Tipo de Dato | Descripción   |
| :---- | :---- | :---- |
| **id** | UUID (Primary Key) | Identificador único |
| **id\_usuario** | UUID (Foreign Key) | Usuario que lo obtuvo |
| **id\_curso** | UUID (Foreign Key) | Curso completado |
| **fecha\_emision** | DateTime | Fecha de emisión |
| **codigo\_verificacion** | String (Unique) | Código único para validación pública |
| **archivo\_pdf** | String (nullable) | Enlace al archivo (opcional si se genera on the fly) |

#### **Tabla: Cupones**

| Parámetro | Tipo de Dato | Descripción   |
| :---- | :---- | :---- |
| **id** | UUID (Primary Key) | Identificador único |
| **codigo** | String (Unique) | Código del cupón |
| **tipo\_descuento** | String | Porcentaje o monto fijo |
| **valor** | BigInt | Valor del descuento. **La unidad depende de `tipo_descuento`**: centavos si es MONTO\_FIJO, porcentaje entero si es PORCENTAJE |
| **fecha\_vencimiento** | Timestamptz | Vigencia del cupón |
| **limite\_usos** | Int (nullable) | Máximo de usos permitidos |
| **veces\_usado** | Int | Default 0 |

#### **Tabla: Inscripciones**

| Parámetro | Tipo de Dato | Descripción   |
| :---- | :---- | :---- |
| **id** | UUID (Primary Key) | Identificador único |
| **id\_usuario** | UUID (Foreign Key) | A qué usuario pertenece |
| **id\_curso** | UUID (Foreign Key, nullable) | A qué curso da acceso |
| **otorgado\_por** | UUID (Foreign Key, nullable) | Admin que otorgó el acceso (cortesía) |
| **tipo\_acceso** | String | Ej. suscripción, compra suelta, cortesía |

#### **Tabla: Bitácora Administrativa**

| Parámetro | Tipo de Dato | Descripción   |
| :---- | :---- | :---- |
| **id** | UUID (Primary Key) | Identificador único |
| **id\_admin** | UUID (Foreign Key) | Administrador que realizó la acción |
| **accion** | String | Qué se hizo (ej. otorgó acceso, publicó curso) |
| **id\_entidad\_afectada** | UUID | ID del registro afectado |
| **entidad\_afectada** | String | Tabla o entidad (ej. 'Cursos', 'Inscripciones') |
| **fecha** | DateTime | Fecha de la acción |
| **detalles** | Text (nullable) | Detalle extendido de la acción |

#### **Tabla: Eventos Webhook**

| Parámetro | Tipo de Dato | Descripción   |
| :---- | :---- | :---- |
| **id** | UUID (Primary Key) | Identificador único |
| **proveedor** | String | Ej. 'stripe', 'mux' |
| **id\_evento\_externo** | String | Identificador del evento del lado del proveedor. **Único junto a `proveedor`**: bajo un índice global convivirían `evt_...` de Stripe, un UUID de Mux y un checksum SHA-256 de Wompi |
| **tipo\_evento** | String | Ej. invoice.payment\_succeeded |
| **payload** | JSONB | Data completa recibida |
| **procesado** | Boolean | Default false |
| **fecha\_recibida** | DateTime | Default now() |

#### **Tabla: Recursos Descargables**

| Parámetro | Tipo de Dato | Descripción   |
| :---- | :---- | :---- |
| **id** | UUID (Primary Key) | Identificador único |
| **id\_leccion** | UUID (Foreign Key) | A qué lección pertenece |
| **nombre** | String | Nombre del archivo |
| **tipo\_archivo** | String | Tipo de recurso (PDF, ZIP, etc.) |
| **url\_archivo** | String | URL en Supabase Storage |
| **tamano\_bytes** | Int (nullable) | Peso del archivo |
| **fecha\_creacion** | DateTime | Default now() |

## **5\. Seguridad y RLS (Row Level Security)**

Al usar Postgres en Supabase, la seguridad se delega a la base de datos:

> * **Tabla Progreso y Certificados:** SELECT, INSERT, UPDATE limitados a auth.uid() \= id\_usuario.  
> * **Tablas Cursos, Módulos, Lecciones:**  
  * SELECT habilitado para todos los usuarios, condicionado a mostrado \= true.  
  * INSERT, UPDATE, DELETE restringidos estrictamente a perfiles donde rol \= 'administrador'.  
> * **Generación de Firmas (Mux):** Las URLs firmadas de Mux solo se generan en el backend si el sistema detecta que existe un registro válido en Suscripciones (estado \= 'activa' o 'past\_due') o en Inscripciones asociado al usuario solicitante.  
> * **Verificación de correo:** private.correo\_verificado() (SECURITY DEFINER, mismo criterio que private.es\_administrador()) chequea auth.users.email\_confirmed\_at para auth.uid() y se agrega al with check de inscripciones\_insert\_propio y progreso\_propio — un usuario sin correo confirmado no puede autoinscribirse a una membresía ni escribir su progreso de reproducción, ver Flujo 02.

## **6\. Autenticación e Identidad**

> * **Proveedor:** Supabase Auth (Email/Contraseña \+ Google OAuth).  
> * **Sincronización:** Se creará un *Database Trigger* en Postgres que, al insertar un registro en auth.users, cree automáticamente la fila correspondiente en la tabla pública Perfiles asignando el rol estudiante por defecto.  
> * **Sesión:** Manejo nativo mediante Supabase Auth Helpers para Next.js App Router (Persistencia en cookies HTTP-Only).  
> * **Verificación de correo obligatoria:** el token del correo "Confirm signup" expira a los 15 minutos (config. en el Dashboard de Supabase, Authentication → Emails). El reenlace ("Reenviar enlace de verificación") está limitado a 1 solicitud cada 60 segundos por correo, vía la función public.registrar\_reenvio\_verificacion(). Un job de pg\_cron (private.limpiar\_usuarios\_no\_verificados(), diario) elimina de auth.users las cuentas sin confirmar con más de 7 días de antigüedad; la fila de Perfiles se limpia en cascada gracias al FK perfiles\_id\_fkey (auth.users(id) on delete cascade). Ver Flujo 02.

## **7\. Flujo de Pago e Idempotencia**

> 1. El usuario inicia el checkout. El backend crea una sesión en Stripe/Wompi.  
> 2. La pasarela aprueba el cobro y dispara un webhook apuntando a /api/webhooks/stripe.  
> 3. El endpoint registra el id\_evento\_externo en la tabla Eventos\_Webhook. Si este evento ya existe, el sistema retorna un código 200 OK para detener la ejecución y evitar la duplicación del procesamiento.  
> 4. Una vez confirmada la novedad, se actualiza el estado de la suscripción a activa y se inserta el respectivo Pago.

### **7.1 Cómo se conecta una pasarela (el esquema ya está listo)**

El cobro está diferido, pero el esquema quedó preparado para que enchufar una
pasarela sea un trabajo aislado. **No hay que modificar ninguna tabla
existente**; son cuatro pasos, y todos escriben en estructuras que ya existen y
están vacías.

**1. Registrar los precios.** Insertar una fila en `Planes_Precios` por cada
plan × pasarela × moneda, con el `id_precio_externo` que devuelve el proveedor
(`price_...` en Stripe). Es lo que permite resolver "de qué plan me está
hablando este webhook".

**2. Escribir el checkout.** Va en `src/actions/suscripciones/` (hoy vacío, con
solo un `.gitkeep`), como Server Action — no como ruta `/api/`, que está
reservada a webhooks entrantes (§2.2). Crea la sesión en la pasarela y guarda
`id_cliente_externo` en la suscripción.

**3. Rellenar el TODO del webhook.** `src/app/api/webhooks/stripe/route.ts` y
`.../wompi/route.ts` ya verifican la firma y registran el evento en
`Eventos_Webhook` antes de cualquier otra cosa; el bloque de negocio va
exactamente donde está el `TODO`, y no hay forma de agregarlo salteándose la
idempotencia. Al procesar:
>
> * Se **inserta** una fila en `Suscripciones` con `proveedor = 'stripe'` (o
>   `'wompi'`). Nada más: el muro de acceso es agnóstico al origen, así que el
>   acceso queda abierto sin tocar una línea de autorización.
> * Se inserta el `Pago` con su `proveedor` y su `ref_transaccion_externa`, que
>   juntos son la clave de idempotencia de la tabla.
> * La moneda que reporta el proveedor se normaliza con `normalizarMoneda()`
>   (`src/lib/pagos/proveedores.ts`) antes de escribirla: Stripe la envía en
>   minúsculas y la base exige ISO-4217 en mayúsculas.

**4. Nada más.** `tieneAccesoVigente()` (`src/lib/mux/acceso.ts`) y su gemela en
SQL `private.suscripcion_da_acceso()` solo miran `estado` y `fecha_renovacion`.
No consultan `proveedor`, `acceso_manual` ni `id_codigo_invitacion`, así que una
suscripción de pago abre el contenido por el mismo camino que una invitación.

**Restricciones que hay que tener presentes:**
>
> * El índice único parcial `suscripcion_activa_unica_por_usuario` admite **una
>   sola** suscripción en ACTIVA o PAST\_DUE por usuario. No se puede modelar
>   una renovación programada ni un cambio de plan solapado sin cerrar antes la
>   vigente; `private.cerrar_suscripcion_caducada()` es el camino existente.
> * Los valores admitidos de `proveedor` están acotados por CHECK
>   (`supabase/sql/042`) y su contraparte tipada vive en
>   `src/lib/pagos/proveedores.ts`, con un test que falla si las dos listas se
>   separan. Agregar una pasarela nueva es editar los dos sitios.
> * Un reembolso **no** se registra como monto negativo (hay un CHECK que lo
>   impide): se modela con `EstadoPago = 'REEMBOLSADO'` en su propia fila, para
>   que el rastro contable quede completo de cara a la factura electrónica.

## **8\. Upload de Imágenes y Streaming de Video**

> * **Imágenes (Portadas/PDFs):** Se subirán directamente a Supabase Storage. Se restringirá mediante políticas de Storage para aceptar exclusivamente MIME types de imagen (imagen/\*) o PDF (application/pdf), con un límite prudente (ej. 5MB).  
> * **Video (Mux Direct Uploads):**  
  * El navegador del administrador solicita una URL de subida temporal a nuestro backend (POST /api/video/upload).  
  * El navegador transfiere el .mp4 directamente a la infraestructura de Mux, evitando agotar recursos o el ancho de banda del servidor de Next.js.  
  * Al terminar, Mux notifica vía Webhook cuando el activo está listo para actualizar la base de datos (id\_video\_mux).

## **9\. Envío de Emails (Correos Transaccionales)**

> * **Stack:** Resend (Infraestructura de envío por API) \+ React Email (Para diseñar las plantillas).  
> * **Flujos Configurados:**  
  * Bienvenida (Disparado tras la confirmación de la primera suscripción activa).  
  * Confirmación de registro / verificación de correo (Integrado de forma nativa con Supabase Auth, token de 15 minutos, reenvío limitado a 1 cada 60 segundos).  
  * Recuperación de contraseña (Integrado de forma nativa con Supabase Auth).  
  * Aviso de fallo de pago y entrada al período de gracia.

## **10\. Entornos y CI/CD (Deploy)**

> * **Entornos (Environments):**  
  1. **Staging (Pruebas):** Conectado a un proyecto de prueba independiente en Supabase, llaves de test de Stripe, y un entorno de prueba en Mux.  
  2. **Production (Producción):** Datos reales, cobros reales, URLs definitivas al público.  
> * **Flujo de Despliegue (Continuous Deployment):**  
  * El repositorio de código fuente en GitHub estará enlazado directamente a Railway.  
  * Al hacer *push* o *merge* a la rama main, Railway detecta los cambios, inicia la fase de construcción de Next.js (npm run build), y despliega automáticamente la nueva versión.

## **11\. Variables de Entorno (Secretos)**

El sistema requerirá la configuración de las siguientes variables para su operación:

\# Base de Datos y Auth  
NEXT\_PUBLIC\_SUPABASE\_URL=  
NEXT\_PUBLIC\_SUPABASE\_ANON\_KEY=  
SUPABASE\_SERVICE\_ROLE\_KEY=  
DATABASE\_URL= \# Cadena de conexión para migraciones de Prisma

\# Pasarelas de Pago  
STRIPE\_SECRET\_KEY=  
STRIPE\_WEBHOOK\_SECRET=  
WOMPI\_PRV\_KEY=

\# Mux (Video)  
MUX\_TOKEN\_ID=  
MUX\_TOKEN\_SECRET=  
MUX\_WEBHOOK\_SECRET=  
MUX\_SIGNING\_KEY\_ID= \# Key ID del signing key de Mux, para firmar playback URLs  
MUX\_SIGNING\_KEY\_PRIVATE= \# Private key (base64) del mismo signing key

\# Correo y Utilidades  
RESEND\_API\_KEY=

\# Observabilidad (Sentry — P1-3, AUDIT-2026-08-24.md)  
NEXT\_PUBLIC\_SENTRY\_DSN= \# init del cliente (src/instrumentation-client.ts)  
SENTRY\_DSN= \# init del servidor/edge (src/instrumentation.ts)  
SENTRY\_ORG= \# opcional — solo para subir source maps en el build  
SENTRY\_PROJECT= \# opcional — solo para subir source maps en el build  
SENTRY\_AUTH\_TOKEN= \# opcional — solo para subir source maps en el build
