# **Technical Specification: U.V.A — Plataforma de Cursos v2**

> **Revisada el 2026-11-25** (P2-15, `auditorias/AUDIT-2026-11-23.md`). Cuando esta spec y el código no coinciden, manda el código, y la spec se corrige en el mismo PR. El esquema exacto (columnas, tipos, índices) está en `prisma/schema.prisma`; RLS, triggers y funciones están en `supabase/sql/`. Este documento explica el porqué y las reglas que no se ven en esos archivos.

## **1\. Stack Tecnológico**

El proyecto utiliza un stack moderno basado en React y servicios gestionados para minimizar la carga operativa.

> * **Framework Principal:** Next.js 16 (App Router) con TypeScript estricto. La versión exacta está en `package.json`.  
> * **Estilos y UI:** Tailwind CSS \+ shadcn/ui (Librería base de componentes accesibles).  
> * **Base de Datos y Auth:** Supabase (PostgreSQL) \+ Supabase Auth.  
> * **ORM / Esquema:** Prisma (Exclusivamente para migraciones y definición de esquema schema.prisma).  
> * **Video y Streaming:** Mux (con @mux/mux-player-react para el reproductor).  
> * **Pagos:** Stripe (Facturación internacional) y Wompi (Local Colombia). El MVP es gratuito y por códigos de invitación: el código de pagos existe pero está apagado tras `NEXT_PUBLIC_PRICING_ENABLED` (§7).  
> * **IA:** Gemini (Developer API) para generar exámenes desde la transcripción del video y descripciones de cursos (§11).  
> * **Protección:** Cloudflare delante del sitio; Cloudflare Turnstile como CAPTCHA en registro e inicio de sesión (validado por Supabase Auth).  
> * **Observabilidad:** Sentry (errores, reportes de CSP) y registros enviados a Vector.  
> * **Correos Transaccionales:** Resend \+ React Email.  
> * **Generación PDF:** pdf-lib (Generación de certificados ultraligera en backend).  
> * **Hosting / Infraestructura:** Railway.

## **2\. Arquitectura General y Decisiones Técnicas Relevantes**

### **2.1 Enfoque Híbrido de Base de Datos (Prisma \+ Supabase SDK)**

> * **Decisión:** Se utilizará Prisma **únicamente** para gestionar migraciones y versionar el esquema de la base de datos de forma declarativa. Para el CRUD diario (consultas e inserciones desde Next.js), se usará el cliente oficial @supabase/supabase-js.  
> * **Justificación:** El cliente de Supabase envía automáticamente el token JWT del usuario, lo que activa el *Row Level Security (RLS)* de Postgres. Si usáramos Prisma Client para consultar datos, el RLS no funcionaría nativamente sin configuraciones complejas.

### **2.2 Patrón de Comunicación (Server Actions vs API Routes)**

> * Las mutaciones (crear curso, editar perfil, guardar progreso) se realizarán principalmente mediante **Next.js Server Actions**, eliminando la necesidad de crear endpoints REST tradicionales (/api/) para uso interno.  
> * Las rutas /api/ (Route Handlers) se reservan para recibir **Webhooks externos** (Mux, Stripe, Wompi y el hook de correos de Supabase Auth). Hay dos excepciones: `/api/health`, un chequeo de solo lectura para el monitor de disponibilidad, y `/api/progreso/beacon`, que guarda el último segundo visto al cerrar la pestaña porque `navigator.sendBeacon` no puede llamar a una Server Action.  
> * El contrato de las Server Actions (forma de la respuesta, validación, permisos y pruebas) está en `src/actions/README.md`.

## **3\. Estructura del Proyecto**

Se adoptará una arquitectura *Feature-based* adaptada al App Router de Next.js:

UVA_EDU/  
├── prisma/                 \# Esquema (schema.prisma) y migraciones  
├── supabase/sql/           \# RLS, triggers y funciones, numerados (ver su README)  
├── infra/                  \# Dockerfile (plan B de despliegue) y configuración  
├── scripts/                \# Tareas de operación (barredores, RLS, seed, auditorías)  
├── e2e/                    \# Pruebas de Playwright contra staging  
├── src/  
│   ├── app/                \# Next.js App Router (Páginas y Layouts)  
│   │   ├── (public)/       \# Portada, catálogo, ficha de curso, verificar certificado  
│   │   ├── (student)/      \# Panel del estudiante (/dashboard): cursos, lección, examen, perfil  
│   │   ├── (admin)/        \# Panel de administración (/admin)  
│   │   ├── auth/, seguridad/ \# Inicio de sesión, registro, recuperación, segundo factor  
│   │   └── api/            \# Webhooks, /api/health y /api/progreso/beacon  
│   ├── components/         \# ui/ (base) y una carpeta por módulo (curso, examen, admin…)  
│   ├── content/            \# Textos públicos (cifras y funciones anunciadas)  
│   ├── emails/             \# Plantillas de React Email  
│   ├── lib/                \# Clientes de Supabase, Mux, Resend, Gemini y lógica compartida  
│   ├── proxy.ts            \# Sesión, CSP con nonce y cierre de origen en cada petición  
│   └── actions/            \# Server Actions, una carpeta por módulo

## **4\. Base de Datos: Diccionario de Datos (Esquema de Tablas)**

La fuente de verdad del esquema es `prisma/schema.prisma`: cada modelo lleva un comentario `///` con sus reglas. Este capítulo tiene dos partes:

- **§4.0, índice de tablas:** las 47 tablas públicas, con una línea por tabla. `src/lib/spec-tablas.test.ts` hace fallar la suite si una tabla de `schema.prisma` no aparece aquí.
- **Los diccionarios por módulo** que siguen. Se escribieron al diseñar el MVP y explican la intención de cada columna. Para el tipo exacto, ve al esquema.

### **4.0 Índice de tablas**

**Usuarios, acceso y pagos**
- `perfiles`: una fila por cuenta de `auth.users`, con el rol (estudiante, profesor o administrador), el estado de la cuenta y los datos propios. `anonimizado_en` marca una cuenta suprimida.
- `consentimientos`: qué texto legal aceptó cada persona, en qué versión y desde dónde (Ley 1581). Se agrega y nunca se borra.
- `codigos_invitacion`: los códigos que dan acceso en el MVP, con su límite de usos y la duración del acceso.
- `lotes_codigos_invitacion`: agrupa los códigos creados juntos para exportarlos o desactivarlos. No duplica su estado.
- `suscripciones`: el acceso vigente de cada persona, sea por invitación, manual o de pago. Es el muro de acceso.
- `inscripciones`: el alta de una persona en un curso: automática por membresía, o una cortesía que otorga un administrador con fecha de fin.
- `planes`: duración y precio de cada plan.
- `planes_precios`: el id del precio en cada pasarela (Stripe y Wompi). Vacía hasta que entre el cobro.
- `intentos_pago`: la intención de cobro que crea el servidor. El navegador solo elige un plan y un cupón, nunca el monto.
- `pagos`: los cobros confirmados por webhook. Un reembolso es otra fila, nunca un monto negativo.
- `cupones`: descuentos para cuando entre el cobro.
- `eventos_webhook`: idempotencia de todo webhook entrante (§7).

**Catálogo y contenido**
- `categorias`: las escuelas del catálogo.
- `categorias_slugs_anteriores`: los slugs viejos de cada escuela, para redirigir con 308.
- `cursos`: el curso, con su estado de publicación.
- `cursos_slugs_anteriores`: los slugs viejos de cada curso, para redirigir con 308 (`supabase/sql/137`).
- `curso_categorias`: a qué escuelas pertenece un curso.
- `instructores`: tabla vestigial; la app no la lee ni la escribe. Se borra cuando los instructores sin cuenta se registren (ver su comentario en el esquema).
- `curso_instructores`: quién dicta cada curso. Apunta a `perfiles` con rol PROFESOR; las rutas públicas leen la vista `curso_instructores_publico`.
- `modulos`: las secciones del temario.
- `lecciones`: la clase, con su video de Mux y el estado del video. Solo cuentan para el avance las que tienen el video LISTO.
- `recursos_descargables`: los materiales de cada lección, guardados en Storage.
- `transcripciones_video`: la transcripción de cada video, que se usa para generar el examen.
- `mux_assets_pendientes_eliminacion`: los videos de Mux que hay que borrar, para reintentar si Mux falla.
- `tokens_vista_previa`: enlaces temporales para ver un curso sin publicar.

**Exámenes**
- `examenes`: el examen final de un curso.
- `preguntas_examen`: preguntas y respuestas correctas. Solo las leen los administradores (§5).
- `intentos_examen`: cada intento del estudiante. Solo el servidor escribe (§5).
- `trabajos_generacion_examen`: cada generación de un examen con IA, con su candado por curso y su estado.

**Avance del estudiante**
- `progreso`: lección vista, segundo actual y completado.
- `actividad_diaria`: los días con estudio, que alimentan la racha.
- `notas_leccion`: las notas privadas del estudiante en cada lección.
- `certificados`: los certificados emitidos, con el código que se verifica en `/verificar-certificado`.
- `notificaciones`: los avisos dentro de la app. Solo el servidor decide a quién le llegan.

**Comentarios, comunidad y reseñas**
- `comentarios`: las preguntas y comentarios bajo cada lección.
- `comentario_likes`: los «me gusta» de los comentarios.
- `comentario_moderacion`: el motivo cuando un administrador borra un comentario. Solo la leen los administradores.
- `configuracion_comunidad`: fila única de la ventana de acceso a Comunidad. Está en pausa desde `supabase/sql/084`; se conserva para reactivar el requisito.
- `comunidad_posts`, `comunidad_respuestas`, `comunidad_reacciones`, `comunidad_adjuntos`, `comunidad_moderacion`, `comunidad_reportes`: ver «Módulo de Comunidad».
- `curso_calificaciones`, `curso_calificacion_reacciones`: ver «Módulo de Calificaciones de Curso».

**Operación**
- `bitacora_administrativa`: quién hizo qué en el panel de administración.

**Tablas del esquema `private`** (las crea `supabase/sql/`, no Prisma; nadie las lee desde la app): los límites de intentos (`intentos_login`, `intentos_check_email`, `intentos_canjear_codigo`, `intentos_validar_cupon`, `intentos_verificar_certificado`, `intentos_generar_examen`, `limites_uso`, `verificacion_reenvios`, `recuperacion_reenvios`) y `reproduccion_activa`, que guarda el dispositivo que está reproduciendo para que una cuenta no vea videos en dos a la vez.

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

### **Módulo de Evaluación (Exámenes Finales)**

Ver `docs/functional-spec.md` Módulo 9 y Flujo 14. Migración:
`prisma/migrations/20260907020000_examenes_finales`. RLS y triggers:
`supabase/sql/067_examenes.sql` y `068_certificado_requiere_examen.sql`.

#### **Tabla: Examenes**

| Parámetro | Tipo de Dato | Descripción   |
| :---- | :---- | :---- |
| **id** | UUID (Primary Key) | Identificador único |
| **id\_curso** | UUID (FK, UNIQUE) | Como máximo un examen final por curso |
| **titulo** | String | Título que ve el estudiante |
| **instrucciones** | JSONB (nullable) | Documento Tiptap, mismo formato que `lecciones.contenido` |
| **nota\_aprobatoria** | Int | Default 75. CHECK `>= 75 AND <= 100` — el piso es regla de negocio, no del formulario |
| **intentos\_maximos** | Int (nullable) | Default 3. `null` \= sin límite |
| **minutos\_limite** | Int (nullable) | `null` \= sin límite de tiempo |
| **aleatorizar\_preguntas** | Boolean | Default true |
| **aleatorizar\_opciones** | Boolean | Default true |
| **publicado** | Boolean | Default false. Solo un examen publicado exige aprobación para certificar |
| **creado\_en / actualizado\_en** | DateTime | Timestamptz |

#### **Tabla: PreguntasExamen**

⚠️ Contiene las respuestas correctas. RLS abre SELECT **solo a administradores**;
el estudiante nunca la lee — recibe las preguntas ya despojadas desde
`intentos_examen.preguntas_congeladas`.

| Parámetro | Tipo de Dato | Descripción   |
| :---- | :---- | :---- |
| **id** | UUID (Primary Key) | Identificador único |
| **id\_examen** | UUID (Foreign Key) | Examen al que pertenece (ON DELETE CASCADE) |
| **tipo** | Enum TipoPregunta | Implementados: OPCION\_UNICA, OPCION\_MULTIPLE, VERDADERO\_FALSO, RELLENAR\_ESPACIO, EMPAREJAR. El enum de Postgres ya declara además ORDENAR\_PASOS y RESPUESTA\_ABIERTA (Fase 2, sin UI ni calificación) — `TIPOS_IMPLEMENTADOS` (`src/lib/examenes/tipos.ts`) es el único punto que decide cuáles acepta la app hoy |
| **enunciado** | JSONB | Documento Tiptap |
| **puntos** | Int | Default 1. CHECK `>= 1 AND <= 100`. Hoy no pondera nada: al eliminarse el criterio por porcentaje, todas las preguntas pesan igual (hay que acertarlas todas). Se conserva por si vuelve una calificación ponderada |
| **orden** | Int | Fraccionado, igual que módulos y lecciones (`src/lib/orden.ts`) |
| **opciones** | JSONB (nullable) | `[{ id, texto, correcta }]` para los tipos de opciones; `[{ id, izquierda, derecha }]` para EMPAREJAR (mismo id ata cada par, nunca se expone como "correcta"). Sin CHECK de forma en la base — la valida `preguntaEntradaSchema` (zod) según `tipo` |
| **respuestas\_aceptadas** | Text\[\] | Solo RELLENAR\_ESPACIO. Se comparan normalizadas (sin mayúsculas, tildes ni signos) |
| **explicacion** | JSONB (nullable) | Feedback interno; no se le muestra al estudiante en la v1 |

#### **Tabla: IntentosExamen**

**No tiene ninguna política de escritura** (ver §5). Todas las mutaciones pasan
por Server Actions con Service Role tras verificar identidad y acceso.

| Parámetro | Tipo de Dato | Descripción   |
| :---- | :---- | :---- |
| **id** | UUID (Primary Key) | Identificador único |
| **id\_examen** | UUID (Foreign Key) | Examen rendido |
| **id\_usuario** | UUID (FK, ON DELETE RESTRICT) | Un intento es evidencia de evaluación: no cascadea con el perfil |
| **estado** | Enum EstadoIntentoExamen | EN\_CURSO, APROBADO, REPROBADO, EN\_REVISION |
| **puntaje\_pct** | Decimal(5,2) (nullable) | 0-100. `null` mientras EN\_CURSO. **Informativo**: proporción de preguntas resueltas al cerrar. Ya no decide aprobado/reprobado; se sigue escribiendo porque la columna es NOT NULL al cerrar y tiene CHECK de rango |
| **nota\_requerida** | Int | Copia histórica de `nota_aprobatoria` al iniciar. **Sin uso**: no queda ningún lector — se sigue escribiendo al crear el intento solo porque la columna es NOT NULL |
| **preguntas\_congeladas** | JSONB | Las preguntas tal como se le presentaron a ESE estudiante, ya aleatorizadas, con sus respuestas correctas |
| **respuestas** | JSONB | `ProgresoIntento` (`src/lib/examenes/tipos.ts`): `{ resueltas, fallos, cola }` — las preguntas ya acertadas con su respuesta final, el contador de respuestas incorrectas (de donde salen las vidas) y los ids pendientes EN ORDEN. Sin CHECK de forma en la base; la convención es de la capa de aplicación, y `parsearProgreso` es el único lector. No hay autoguardado de borrador: se reescribe al confirmar cada respuesta |
| **iniciado\_en / finalizado\_en** | DateTime | Timestamptz |
| **expira\_en** | DateTime (nullable) | Corte por tiempo, congelado al iniciar. El servidor valida contra esto, nunca contra el reloj del cliente |

Índices y restricciones que importan:

> * `intentos_examen_uno_en_curso` — índice **parcial** UNIQUE sobre (id\_usuario, id\_examen) WHERE estado \= 'EN\_CURSO'. Dos pestañas abiertas no pueden gastar dos intentos.
> * `intentos_examen_cerrado_tiene_puntaje` — CHECK que impide un intento cerrado sin puntaje o uno EN\_CURSO con nota.
> * `examenes_nota_aprobatoria_minima` — CHECK del piso de 75% sobre `examenes.nota_aprobatoria`. La columna **se conserva tal cual** (default 75) pero ya no la escribe ni la lee ningún código: aprobar dejó de ser un umbral por porcentaje. No hizo falta migración para quitar el criterio, solo dejar de usarla.

**Intentos por rondas, no de por vida:** `calcularDisponibilidad` (`src/lib/examen.ts`) es la única fuente de verdad de cuándo un estudiante puede iniciar un intento — la usan tanto `iniciarIntento` (Server Action) como `getSituacionExamen` (pantalla previa), así que nunca pueden divergir. `intentos_maximos` no limita el total histórico de intentos: es el tamaño de una ronda. Con `cerrados.length % intentosMaximos === 0` (ronda recién agotada), el cooldown pasa de `COOLDOWN_REINTENTO_MINUTOS` (15 min) a `COOLDOWN_AGOTADO_HORAS` (5h); al cumplirse, vuelve a estar disponible con una ronda nueva. No hay ningún estado permanente de "sin intentos" — el estudiante siempre recupera acceso solo, sin admin de por medio.

**Aprobar = vaciar la cola. Reprobar = quedarse sin vidas.** No hay criterio por porcentaje, y por tanto tampoco una función `calificarIntento`: `responderPregunta` (`src/actions/examenes/intento.ts`) decide el veredicto con la cola y se lo pasa hecho a `cerrarIntento`, que solo escribe. Acertar saca la pregunta del frente de `ProgresoIntento.cola`; fallar la empuja al final y suma 1 a `fallos`. El intento cierra cuando `cola.length === 0` (APROBADO, `puntaje_pct` = 100 por construcción) o cuando las vidas llegan a 0 (REPROBADO inmediato, sin importar lo que quede en la cola). El cierre por tiempo (`enviarIntento` y la rama `vencido` de `responderPregunta`) **siempre reprueba**: terminar el examen completo es la única forma de aprobar.

**Vidas, derivadas y no persistidas:** `calcularVidasRestantes(fallos)` (`src/lib/examenes/calificar.ts`) es la única fuente de verdad — la usan `responderPregunta` (Server Action que escribe), `getIntentoEnCurso` (retomar un intento a medias) y `getResultadoIntento`, mismo criterio que `calcularDisponibilidad` para el cooldown. No hay columna `vidas_restantes`: se calcula como `VIDAS_INICIALES` (constante, 5, fija para toda la plataforma — no es un campo de `examenes`) menos `ProgresoIntento.fallos`. **No** se cuentan las respuestas incorrectas guardadas: con la cola de reintentos, una pregunta fallada y luego acertada solo deja en `resueltas` su respuesta buena, así que el contador es el único rastro del fallo. `RespuestaEstudiante` (`src/lib/examenes/tipos.ts`) se extendió a `string | string[] | Record<string,string>` para poder representar el mapeo de pares de EMPAREJAR.

**El orden lo manda el servidor:** con la cola de reintentos, "la siguiente pregunta" no es la del índice de al lado. `getIntentoEnCurso` devuelve `preguntaActualId` (= `cola[0]`) y cada `responderPregunta` que no cierra devuelve `siguientePreguntaId`; `ExamenRendir.tsx` solo los aplica. La validación de orden en el servidor es exactamente `preguntaId === cola[0]`.

**Intento extra otorgado por admin:** `otorgarIntentoExtra` (`src/actions/admin/examenes.ts`) crea un intento directo con Service Role para saltarse la espera larga (no para "desbloquear" algo que de otro modo quedaría cerrado — nunca lo está). Reusa `congelarPreguntas` (`src/lib/examenes/congelar.ts`), compartida con el flujo del estudiante para que un intento otorgado por admin tenga exactamente la misma forma que uno iniciado normalmente.

**Revisión de un intento (admin):** `getRevisionIntento` (`src/actions/admin/examenes.ts`) + `construirRevision` (`src/lib/examenes/revision.ts`, función pura) arman, pregunta por pregunta, qué marcó/escribió el estudiante, cuál era la respuesta correcta y si acertó — al contrario de `getResultadoIntento` (lo que ve el propio estudiante), que nunca revela la respuesta correcta. Se pide bajo demanda al expandir un intento en el panel, no precalculada para todos los intentos del examen.

### **Módulo de Comunidad**

Ver `docs/functional-spec.md` Módulo 10 y Flujo 15. Migraciones:
`prisma/migrations/20260909000000_comunidad_f1` y las demás carpetas con
`comunidad` en el nombre. RLS, triggers, vistas y bucket: `supabase/sql/083`
a `087`, `089`, `090`, `094`, `095`, `100`, `101`, `103` y `104`.

Todas las escrituras de la app van con el cliente de sesión (RLS aplica),
salvo la firma de URLs de adjuntos, que usa Service Role después de autorizar
con la sesión (ver `comunidad_adjuntos`).

#### **Tabla: ComunidadPosts** (`comunidad_posts`)

| Parámetro | Tipo de Dato | Descripción   |
| :---- | :---- | :---- |
| **id** | UUID (Primary Key) | Lo genera el servidor antes del INSERT, para subir los adjuntos a una ruta que ya lo referencia |
| **id\_usuario** | UUID (Foreign Key) | Autor. Siempre `auth.uid()` (policy de INSERT) |
| **categoria** | Enum CategoriaComunidad | ANUNCIOS, PROYECTOS, PREGUNTAS, EMPLEO. ANUNCIOS exige administrador en la policy de INSERT |
| **titulo** | String | Se vacía al eliminar |
| **slug** | String (Unique) | Lo asigna un trigger al publicar; no cambia al editar el título |
| **contenido** | String | Texto con marcadores `[[adjunto:<id>]]`. Se vacía al eliminar |
| **eliminado** | Boolean | Borrado lógico. Solo un administrador puede volver de true a false |
| **eliminado\_por\_admin** | Boolean | Lo recalcula el trigger según quién ejecuta el UPDATE; no se confía en el valor del cliente (089) |
| **fijado** | Boolean | Solo un administrador lo cambia (trigger) y nunca nace en true (policy de INSERT) |
| **empleo\_empresa / empleo\_modalidad / empleo\_ubicacion / empleo\_enlace** | String (nullable) | CHECK `comunidad_posts_empleo_coherente`: empresa, modalidad y enlace obligatorios en EMPLEO; los cuatro en null en otra categoría. Modalidad ∈ PRESENCIAL, REMOTO, HIBRIDO |
| **creado\_en / actualizado\_en** | DateTime | Timestamptz |

#### **Tabla: ComunidadRespuestas** (`comunidad_respuestas`)

Mismo criterio que `comunidad_posts`, sin `titulo`, `slug`, `fijado` ni campos de
Empleo. **No se editan:** el trigger solo permite vaciar `contenido` al eliminar.
FK a `comunidad_posts` con ON DELETE CASCADE (en la práctica no ocurre: no hay
DELETE real).

#### **Tabla: ComunidadReacciones** (`comunidad_reacciones`)

Una fila por usuario sobre un post **o** una respuesta: CHECK
`comunidad_reacciones_exactamente_uno` más dos índices UNIQUE **parciales**,
uno por tipo de objetivo. Como son parciales, PostgREST no puede usarlos en
`ON CONFLICT`: la app hace INSERT y trata el 23505 como "ya estaba". Sin UPDATE.

#### **Tabla: ComunidadAdjuntos** (`comunidad_adjuntos`)

| Parámetro | Tipo de Dato | Descripción   |
| :---- | :---- | :---- |
| **id** | UUID (Primary Key) | Se decide antes de insertar el post, para escribir el marcador definitivo en `contenido` |
| **id\_post / id\_respuesta** | UUID (FK, nullable) | Exactamente uno. La policy de INSERT exige que el post o la respuesta sean del propio usuario |
| **id\_usuario** | UUID (Foreign Key) | Dueño del archivo |
| **ruta\_storage** | String | `{id_usuario}/{id_post o id_respuesta}/{id}.{extension}` en el bucket privado `comunidad-adjuntos` |
| **nombre\_original / tipo\_archivo / es\_imagen / ancho / alto / tamano\_bytes** | Metadatos | `ancho`/`alto` solo para imágenes, ya normalizadas |

#### **Tabla: ComunidadModeracion** (`comunidad_moderacion`)

Evidencia de lo que un administrador eliminó: `contenido_original`,
`id_eliminado_por` (debe ser el propio administrador, según la policy de INSERT)
y `motivo`. SELECT e INSERT solo para administradores; sin UPDATE ni DELETE. Un
trigger AFTER INSERT notifica al autor moderado.

#### **Tabla: ComunidadReportes** (`comunidad_reportes`)

Cola de moderación: `id_post`/`id_respuesta` (exactamente uno), `id_reportante`,
`motivo`, `revisado`. UNIQUE parcial por reportante y contenido. INSERT solo con
acceso a Comunidad y nunca sobre contenido propio; SELECT y UPDATE (solo la
columna `revisado`) exclusivos de administradores. Un trigger AFTER UPDATE, al
pasar `revisado` a true, notifica al reportante con el veredicto: eliminado si el
contenido ya quedó eliminado, descartado si no (103).

#### **Tabla: ConfiguracionComunidad** (`configuracion_comunidad`)

Fila única (`CHECK id = 1`) con `fin_bootstrap`. **Sin uso desde 084:** el
requisito de actividad reciente está desactivado y la función de acceso no la
consulta. Se conserva para poder reintroducir el requisito sin rediseño. Solo la
leen y escriben administradores.

**Acceso — una sola fuente de verdad:** `private.comunidad_tiene_acceso(uuid)` =
administrador **o** `private.suscripcion_da_acceso(uuid)` (084). La app y las
policies usan el wrapper sin parámetro `public.comunidad_tiene_acceso()`, que
siempre responde por `auth.uid()`. `resolverAccesoComunidad` (`src/lib/comunidad.ts`)
solo lo consulta; el motivo que calcula se usa únicamente para el texto de la
pantalla de Comunidad pausada.

**Vistas públicas (085):** `comunidad_autor_publico` (id, nombre, foto) y
`comunidad_actividad_reciente` proyectan solo las columnas que la UI necesita,
con el mismo gate de acceso en el WHERE. Existen porque la RLS de `perfiles` y
`certificados` no deja leer filas ajenas, y abrir esas filas expondría correo y
celular.

**Notificaciones (`notificaciones`, 094/095/100/103):** sin policy de INSERT
para usuarios. Las generan triggers SECURITY DEFINER sobre la tabla de origen,
que deciden el destinatario leyendo la base:

| Tipo | Origen | Destinatario |
| :---- | :---- | :---- |
| COMUNIDAD\_RESPUESTA | INSERT en `comunidad_respuestas` | Autor del post, salvo que se responda a sí mismo |
| COMUNIDAD\_ANUNCIO | INSERT en `comunidad_posts` con categoría ANUNCIOS | Todos los que tienen acceso, menos quien publica |
| COMUNIDAD\_MODERACION | INSERT en `comunidad_moderacion` | Autor del contenido moderado |
| COMUNIDAD\_REPORTE\_ELIMINADO / COMUNIDAD\_REPORTE\_DESCARTADO | `comunidad_reportes.revisado` pasa a true | Reportante |

**Feed paginado en Postgres (P2-10, `112_feed_comunidad_paginado.sql`):**
`public.buscar_feed_comunidad(p_categoria, p_solo_propios, p_busqueda, p_orden,
p_pagina, p_por_pagina)` filtra, busca, ordena y pagina, y devuelve solo la
página con `total_resultados` y la `pagina` efectiva (acotada a la última) en
cada fila, más `total_respuestas`, `total_reacciones` y `me_reaccione`. Es
`security invoker`: la RLS de Comunidad decide qué filas entran, y "Mis
publicaciones" usa `auth.uid()`. La búsqueda compara `normalizar_busqueda()`
(034) contra título, contenido y el nombre de `comunidad_autor_publico`, con
`%`, `_` y `\` escapados, y tiene índices de trigramas sobre título y
contenido. `getComunidadFeed` (`src/lib/comunidad.ts`) solo enriquece las filas
de la página: autores, adjuntos y firma de imágenes. El riel "Más respondidas
esta semana" usa `public.comunidad_mas_respondidas(p_dias, p_limite)`.
Antes se traía el feed entero a Node, y eso además fallaba en silencio (URL
demasiado larga en los `.in()`, conteos truncados por el tope de filas de la
API).

**Acceso evaluado una vez por consulta (`113_comunidad_tiene_acceso_initplan.sql`):**
toda policy o vista de Comunidad llama `(select public.comunidad_tiene_acceso())`,
nunca la función desnuda. Sin la subconsulta, Postgres la ejecutaba por cada
fila: con 20.000 publicaciones el feed superaba el `statement_timeout`; con la
subconsulta responde en décimas de segundo. `npm run db:check-rls-initplan`
falla si una policy la vuelve a llamar sin envolver.

**Supresión (104):** `private.anonimizar_usuario()` vacía `titulo`/`contenido`
y marca `eliminado` y `eliminado_por_admin` en posts y respuestas del usuario.
`anonimizarUsuario` (`src/actions/admin/usuarios.ts`) borra antes sus adjuntos
(fila y archivo), porque SQL no puede llamar a la API de Storage.
⚠️ **Brecha conocida:** no vacía `empleo_empresa`, `empleo_modalidad`,
`empleo_ubicacion` ni `empleo_enlace`. Esas columnas siguen legibles vía API
para cualquiera con acceso a Comunidad, aunque la UI ya no muestre el post. Hoy
el trigger de transiciones y el CHECK de coherencia impiden vaciarlas; el
arreglo requiere un cambio en SQL.

### **Módulo de Calificaciones de Curso**

Ver `docs/functional-spec.md` Módulo 11 y Flujo 16. Migraciones:
`prisma/migrations/20260915000000_curso_calificaciones` y
`20260915010000_curso_calificaciones_id_eliminado_por_idx`. RLS, trigger y
vistas: `supabase/sql/102_curso_calificaciones.sql` (el trigger se redefine en
`104`).

#### **Tabla: CursoCalificaciones** (`curso_calificaciones`)

| Parámetro | Tipo de Dato | Descripción   |
| :---- | :---- | :---- |
| **id** | UUID (Primary Key) | Identificador único |
| **id\_curso** | UUID (FK, ON DELETE CASCADE) | Curso calificado |
| **id\_usuario** | UUID (Foreign Key) | Autor. Siempre `auth.uid()` (policy de INSERT) |
| **puntuacion** | Int | CHECK `between 1 and 5` |
| **comentario** | String (nullable) | Hasta 1000 caracteres (validación en la app). `null` si está vacío |
| **eliminado** | Boolean | Borrado lógico. Solo un administrador restaura |
| **eliminado\_por\_admin / id\_eliminado\_por** | Boolean / UUID (nullable) | Solo los fija un administrador, junto con `eliminado = true` y firmando con su propio id |
| **creado\_en / actualizado\_en** | DateTime | Timestamptz |

Índice UNIQUE **parcial** `curso_calificaciones_unica_por_usuario` sobre
(id\_curso, id\_usuario) WHERE NOT eliminado: una reseña activa por persona, y
se puede volver a calificar después de eliminarla. Por ser parcial no admite
`upsert`; `calificarCurso` busca la reseña activa y decide INSERT o UPDATE.

#### **Tabla: CursoCalificacionReacciones** (`curso_calificacion_reacciones`)

"Me gusta" a una reseña: `@@unique([id_calificacion, id_usuario])` normal, así
que acá la app sí usa `upsert` con `ignoreDuplicates`. INSERT solo sobre una
reseña no eliminada de un curso que el usuario puede ver; DELETE solo de la fila
propia; sin UPDATE.

**Vistas (102):** `curso_calificacion_autor_publico` (id, nombre, foto; abierta
también a `anon`, porque las reseñas son públicas) y
`curso_calificaciones_resumen` (promedio con dos decimales y total por curso,
calculados al vuelo). Ambas repiten en el WHERE el filtro de visibilidad del
curso.

**Lista por tandas (P2-10):** `getCalificacionesCurso` (`src/lib/curso-calificaciones.ts`)
trae solo la primera tanda (`RESENAS_POR_TANDA` = 9), con autores y reacciones
de esas filas nada más. La reseña propia se consulta aparte, porque puede no
estar en la primera tanda. "Ver más reseñas" llama a la Server Action
`cargarMasCalificacionesCurso(cursoId, desde)`: es de solo lectura, usa el
cliente de sesión (RLS decide) y valida el UUID y `desde`, que debe ser entero
entre 0 y 5.000. La paginación es por **desplazamiento**, ordenada por
`creado_en desc, id desc`, y pide una fila de más para saber si hay otra tanda.
No se usa un cursor porque llegaría del navegador y habría que interpolarlo en un
filtro `.or()` de PostgREST. El componente descarta repetidas por id
(`src/lib/curso-calificaciones-tandas.ts`). El promedio y el total siguen
saliendo de `curso_calificaciones_resumen`, así que el JSON-LD no cambia.

**Revalidación:** las Server Actions de `src/actions/cursos/calificaciones.ts`
no reciben la ruta desde el cliente; revalidan el patrón
`/cursos/[cursoSlug]` (P2-9).

**Supresión (104):** `private.anonimizar_usuario()` pone `comentario = null`,
`eliminado = true` y `eliminado_por_admin = true`, y conserva `puntuacion`. Como
el trigger de transiciones bloquea cambiar `comentario` en la misma transacción
en que se elimina, la función enciende el GUC local `uva.anonimizando`, que el
trigger reconoce. Es el mismo mecanismo que `purgar_bitacora_de_admin` (074).

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

Al usar Postgres en Supabase, la seguridad se delega a la base de datos. Las políticas, triggers y funciones viven en `supabase/sql/` (140 scripts numerados al 2026-11-25; orden y convenciones en su README). `npm run db:rls` los aplica todos; en producción se aplican con la skill `pasar-a-produccion` antes de fusionar. Railway no corre migraciones.

> * **Tabla Progreso y Certificados:** SELECT, INSERT, UPDATE limitados a auth.uid() \= id\_usuario.  
> * **Tablas de Exámenes (asimetría deliberada, ver supabase/sql/067):** `preguntas_examen` solo es legible por administradores —contiene las respuestas correctas, un SELECT sería el examen resuelto—. `intentos_examen` tiene SELECT para el dueño (o un administrador) y **ninguna** política de INSERT/UPDATE/DELETE: con RLS activo y sin política, Postgres deniega, así que un `PATCH /rest/v1/intentos_examen` con `{"estado":"APROBADO"}` no afecta ninguna fila. Es la excepción a la regla del proyecto de escribir con el cliente de sesión: el dato a escribir (la nota) es exactamente el que el usuario querría falsificar, y el trigger de certificación confía en él. Iniciar/autoguardar/enviar pasan por `src/actions/examenes/intento.ts`, que usa las lecturas de sesión para autorizar (RLS decide si ve el examen) y Service Role solo para escribir, siempre filtrando por el `id_usuario` de `auth.getUser()`.  
> * **Tablas de Comunidad (083–104, ver §4 Módulo de Comunidad):** lectura de posts, respuestas, reacciones y adjuntos condicionada a `public.comunidad_tiene_acceso()`. Toda escritura exige además `correo_verificado()` y `cuenta_activa()`. `comunidad_moderacion` y `comunidad_reportes` (salvo INSERT de reportes) son exclusivas de administradores. Posts y respuestas siguen el patrón "privilegio de columna + trigger de transiciones" (abajo): solo un administrador fija o restaura, solo el autor reescribe, y un administrador solo puede vaciar el contenido de otra persona. Sin DELETE real en posts ni respuestas.
> * **Tablas de Calificaciones de Curso (102):** SELECT abierto a `anon` para cursos publicados; en cursos ocultos, solo administradores o quien tiene acceso vigente, y el autor ve también su fila ya eliminada (necesario para que Postgres acepte el UPDATE que la elimina). INSERT solo con `private.tiene_acceso_vigente_curso`, correo verificado y cuenta activa.
> * **Tablas Cursos, Módulos, Lecciones:**  
  * SELECT habilitado para todos los usuarios, condicionado a mostrado \= true.  
  * INSERT, UPDATE, DELETE restringidos estrictamente a perfiles donde rol \= 'administrador'.  
> * **Generación de Firmas (Mux):** Las URLs firmadas de Mux solo se generan en el backend si el sistema detecta que existe un registro válido en Suscripciones (estado \= 'activa' o 'past\_due') o en Inscripciones asociado al usuario solicitante.  
> * **Una reproducción a la vez:** `private.reproduccion_activa` guarda qué dispositivo reproduce. Si la misma cuenta empieza a ver un video en otro dispositivo, el primero deja de guardar avance y avisa (RPC `reproduccion_vigente`).  
> * **Límites de intentos:** inicio de sesión, comprobación de correo, canje de códigos, cupones, verificación de certificados y generación de exámenes tienen su contador en `private.intentos_*`. Comentarios y comunidad usan `private.limites_uso`.  
> * **Verificación de correo:** private.correo\_verificado() (SECURITY DEFINER, mismo criterio que private.es\_administrador()) chequea auth.users.email\_confirmed\_at para auth.uid() y se agrega al with check de inscripciones\_insert\_propio y progreso\_propio — un usuario sin correo confirmado no puede autoinscribirse a una membresía ni escribir su progreso de reproducción, ver Flujo 02.  
> * **Patrón "privilegio de columna \+ trigger de transiciones" (P3-10, AUDIT-2026-09-15.md):** para una tabla donde el mismo UPDATE lo puede disparar tanto el autor (editar/borrar lo propio) como un administrador (moderar), una sola policy de RLS no alcanza — una policy autoriza la fila, no decide qué columnas cambian ni qué transición de estado es válida para cada rol. El patrón, usado en `comentarios` (065\_comentario\_moderacion.sql), `comunidad\_posts`/`comunidad\_respuestas` (083\_comunidad.sql, 087\_comunidad\_editar\_publicacion.sql) y `curso\_calificaciones` (102\_curso\_calificaciones.sql), tiene dos capas:  
>   1. **Privilegio por columna** (`revoke update on tabla from authenticated; grant update (col\_a, col\_b, …) on tabla to authenticated;`) — acota QUÉ columnas puede tocar el rol en general, cerrando por defecto las que Supabase concede abiertas al crear la tabla.  
>   2. **Trigger `before update`** (`private.<tabla>\_transiciones\_permitidas()`, SECURITY DEFINER) — decide, comparando `old.*` contra `new.*`, si la transición concreta es válida para quien la pide (ej.: el autor puede vaciar `contenido` pero no reescribirlo; solo un admin puede restaurar `eliminado = true → false`). Es la única capa que puede ver el valor anterior, algo que una policy de UPDATE no tiene disponible por columna.  
>   Reusar este patrón (no inventar uno nuevo) para el próximo módulo donde autor y administrador compartan permiso de UPDATE sobre la misma fila con reglas de transición distintas.

## **6\. Autenticación e Identidad**

> * **Proveedor:** Supabase Auth (Email/Contraseña \+ Google OAuth).  
> * **Sincronización:** Se creará un *Database Trigger* en Postgres que, al insertar un registro en auth.users, cree automáticamente la fila correspondiente en la tabla pública Perfiles asignando el rol estudiante por defecto.  
> * **Sesión:** Manejo nativo mediante Supabase Auth Helpers para Next.js App Router (Persistencia en cookies HTTP-Only).  
> * **Verificación de correo obligatoria:** el token del correo "Confirm signup" expira a los 15 minutos (config. en el Dashboard de Supabase, Authentication → Emails). El reenlace ("Reenviar enlace de verificación") está limitado a 1 solicitud cada 60 segundos por correo, vía la función public.registrar\_reenvio\_verificacion(). Un job de pg\_cron (private.limpiar\_usuarios\_no\_verificados(), diario) elimina de auth.users las cuentas sin confirmar con más de 7 días de antigüedad; la fila de Perfiles se limpia en cascada gracias al FK perfiles\_id\_fkey (auth.users(id) on delete cascade). Ver Flujo 02.  
> * **CAPTCHA:** registro e inicio de sesión mandan un token de Cloudflare Turnstile (`NEXT_PUBLIC_TURNSTILE_SITE_KEY`); Supabase Auth lo valida con la llave secreta configurada en su panel.  
> * **Consentimientos (Ley 1581):** al registrarse, con correo o con Google, se guarda en `consentimientos` qué texto aceptó la persona y en qué versión.  
> * **Verificación en dos pasos (FASE 8.1):** obligatoria para administradores. `requireAdmin()` exige sesión aal2: contraseña más un código TOTP de la app de autenticación. Desde Mi perfil se puede registrar un segundo dispositivo o quitar uno (`src/actions/seguridad/`), y eso también exige aal2.  
> * **Cerrar sesión en todos los dispositivos:** `logoutEnTodos()` revoca todas las sesiones de la cuenta.  
> * **Cuentas suspendidas y suprimidas:** el proxy cierra la sesión de una cuenta suspendida. La supresión (Habeas Data) anonimiza el perfil con `solicitar_supresion_propia` / `anonimizar_usuario`, y la persona puede descargar antes sus datos (`exportarMisDatos`).

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
  * El navegador del administrador pide una URL de subida temporal con la Server Action `iniciarSubidaVideoLeccion` (`src/actions/admin/mux.ts`).  
  * El navegador transfiere el .mp4 directamente a la infraestructura de Mux, evitando agotar recursos o el ancho de banda del servidor de Next.js.  
  * Al terminar, Mux notifica vía Webhook cuando el activo está listo para actualizar la base de datos (id\_video\_mux).
> * **Adjuntos de Comunidad (bucket privado `comunidad-adjuntos`, 086):** es el único bucket donde escribe un usuario que no es administrador. Límite de 10 MB. La policy de INSERT en Storage exige acceso a Comunidad y que la ruta empiece por `auth.uid()`. **No hay policy de SELECT en Storage:** la lectura se autoriza leyendo la fila de `comunidad_adjuntos` con el cliente de sesión, y solo entonces se firma la ruta con Service Role (1 h para imágenes del feed, 5 min para descargar documentos, `obtenerUrlAdjuntoComunidad`). Las imágenes se re-codifican a WebP (máximo 1600 px) con `sharp`; los documentos se validan por magic bytes contra la misma lista que los materiales de lección.

## **9\. Envío de Emails (Correos Transaccionales)**

> * **Stack:** Resend (Infraestructura de envío por API) \+ React Email (Para diseñar las plantillas).  
> * **Plantillas:** `src/emails/`, con un marco común (`src/emails/marco/`) y versión en texto plano. Sus pruebas están en `src/emails/correos.test.ts`.  
> * **Correos de Supabase Auth:** Supabase no envía sus propios correos: llama a `/api/webhooks/supabase-auth` (firmado con `SEND_EMAIL_HOOK_SECRET`) y la app los envía con Resend. Son tres: confirmar cuenta, recuperar contraseña y `confirmar-accion` para el resto (invitación, enlace mágico, cambio de correo).  
> * **Flujos Configurados:**  
  * Bienvenida (`welcome.tsx`): al canjear un código de invitación.  
  * Confirmación de registro / verificación de correo (token de 15 minutos, reenvío limitado a 1 cada 60 segundos).  
  * Recuperación de contraseña, y aviso de seguridad al cambiarla (`contrasena-actualizada.tsx`).  
  * Certificado emitido (`certificado-emitido.tsx`).  
  * Aviso de que el acceso está por terminar (`vencimiento-proximo.tsx`).  
  * Recibo de pago (`recibo-pago.tsx`): listo para cuando entre el cobro.
  * Aviso de moderación en Comunidad (`enviarCorreoComunidadModerada`, plantilla `src/emails/comunidad-moderada.tsx`): al autor cuyo contenido eliminó un administrador, con el motivo. Best-effort: si Resend falla, se registra y la moderación no se revierte.

## **10\. Entornos y CI/CD (Deploy)**

> * **Entornos (Environments):**  
  1. **Staging (Pruebas):** proyecto propio de Supabase. Lo usan el desarrollo local (`.env.local`), el CI (environment `supabase-test` de GitHub) y las pruebas e2e. Nunca se corre `test:rls`, `db:seed` ni `db:reset` contra otra base.  
  2. **Production (Producción):** Railway, detrás de Cloudflare. Sus llaves solo están en Railway y en `.env.produccion.local` (sin commitear). GitHub no tiene credenciales de producción.  
> * **Flujo de Despliegue (Continuous Deployment):**  
  * Railway construye y despliega cada push a `master` (`npm run build`, `npm start`). El comando de inicio vive en el panel de Railway, no en el repo.  
  * Railway **no** corre migraciones. Los cambios de base (Prisma y `supabase/sql/`) se aplican a producción con la skill `pasar-a-produccion` antes de fusionar.  
  * `infra/Dockerfile` es el plan B de despliegue (`docs/ops/plan-b-despliegue.md`); el job `imagen` del CI lo construye para que no se pudra. Antes de cambiar cómo construye o arranca Railway, se prueba en un servicio aparte: el 2026-11-24 pasar Railway al Dockerfile tumbó producción.  
> * **CI (`.github/workflows/ci.yml`):** tsc, lint y vitest en todo PR (`checks`); RLS contra staging (`rls`); recorrido crítico y examen en Playwright (`e2e`); Lighthouse, que solo avisa (`lighthouse`); capturas visuales (`capturas`), y la imagen de Docker (`imagen`). Aparte corren `codeql.yml` y `respaldo.yml` (copia cifrada de producción, apagada hasta tener su environment).

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

\# Pasarelas de Pago (resto; el cobro está apagado)  
WOMPI\_PUB\_KEY=  
WOMPI\_EVENTS\_SECRET= \# firma de los eventos del webhook de Wompi  
WOMPI\_INTEGRITY\_SECRET= \# firma de integridad del checkout  
WOMPI\_API\_URL=  
WOMPI\_CHECKOUT\_URL=  
WOMPI\_SIMULADOR= \# "1" simula el pago fuera de producción  
PAGOS\_SIN\_CORREO= \# "1" no envía el recibo (pruebas de pagos)

\# Correo y Utilidades  
RESEND\_API\_KEY=  
RESEND\_FROM\_EMAIL= \# remitente verificado en Resend  
SEND\_EMAIL\_HOOK\_SECRET= \# firma del hook de correos de Supabase Auth  
CORREO\_ORIGEN\_IMAGENES= \# opcional; de dónde cargan las imágenes de los correos

\# Sitio y navegador (NEXT\_PUBLIC\_*: se fijan al construir; deben estar como ARG en infra/Dockerfile, lo comprueba src/lib/dockerfile-variables.test.ts)  
NEXT\_PUBLIC\_SITE\_URL= \# dominio público: canonicals, sitemap y QR de certificados  
NEXT\_PUBLIC\_PRICING\_ENABLED= \# "true" muestra precios y /planes  
NEXT\_PUBLIC\_TURNSTILE\_SITE\_KEY= \# CAPTCHA de registro e inicio de sesión  
NEXT\_PUBLIC\_GA\_ID= \# opcional; GA4, solo con consentimiento  
NEXT\_PUBLIC\_CLARITY\_ID= \# opcional; Clarity, solo con consentimiento

\# Red y registros  
ORIGEN\_SECRETO= \# cierre de origen: solo se atiende lo que llega por Cloudflare ("nuevo,viejo" al rotarlo, docs/ops/cloudflare.md)  
TRUSTED\_PROXY\_HOPS= \# proxies delante de la app, para leer la IP real (1 por defecto)  
VECTOR\_URL= \# opcional; adónde se envían los registros  
MUX\_ATASCADO\_UMBRAL\_MINUTOS= \# 120; cuándo un video en proceso se da por atascado (scripts/mux-verificar-atascados.ts)

\# Observabilidad (Sentry — P1-3, AUDIT-2026-08-24.md)  
NEXT\_PUBLIC\_SENTRY\_DSN= \# init del cliente (src/instrumentation-client.ts)  
SENTRY\_DSN= \# init del servidor/edge (src/instrumentation.ts)  
SENTRY\_ORG= \# opcional — solo para subir source maps en el build  
SENTRY\_PROJECT= \# opcional — solo para subir source maps en el build  
SENTRY\_AUTH\_TOKEN= \# opcional — solo para subir source maps en el build

\# IA — generación de exámenes (src/lib/gemini/configuracion.ts)  
\# Solo la primera es un secreto. El resto son parámetros de operación: todos  
\# tienen el mismo valor por defecto en el código, así que borrar cualquiera  
\# de ellos no rompe nada.  
GEMINI\_API\_KEY= \# única credencial. No hace falta project id/number: se usa la  
\# Gemini Developer API, no Vertex AI  
GEMINI\_MODELS= \# cadena de respaldo separada por comas; se cae al siguiente ante 503/504/429  
GEMINI\_TIMEOUT\_MS= \# techo por intento (300000)  
GEMINI\_ATTEMPTS\_PER\_MODEL= \# intentos contra cada modelo antes de pasar al siguiente (1)  
GEMINI\_RETRY\_BASE\_MS= \# espera inicial entre reintentos al mismo modelo (2000)  
GEMINI\_TEMPERATURE= \# 0.3 — es un examen calificable, no texto creativo  
GEMINI\_TOP\_P= \# opcional; si no está, no se manda. Ajustar temperatura O top-p, no ambas  
GEMINI\_MAX\_OUTPUT\_TOKENS= \# 64000 — el riesgo es quedarse corto: trunca el JSON y pierde la corrida  
GEMINI\_TARGET\_LATENCY\_MS= \# objetivo, NO límite: registra en Sentry las corridas lentas (60000)  
GEMINI\_SYSTEM\_PROMPT= \# opcional; sustituye el prompt del código. Se valida antes de usarse  
GENERACION\_ATASCADA\_UMBRAL\_MINUTOS= \# 20 — ver la invariante de abajo

**Invariante del pipeline de IA.** `GEMINI_MODELS × GEMINI_ATTEMPTS_PER_MODEL × GEMINI_TIMEOUT_MS` debe quedar por debajo de `GENERACION_ATASCADA_UMBRAL_MINUTOS` con margen. Por defecto: 3 × 1 × 300s = 15 min contra 20 min. Si se rompe, el barredor (`scripts/examenes-liberar-generaciones-atascadas.ts`) marcaría FALLIDO trabajos que siguen vivos, soltando el cerrojo del curso para que otra corrida pise la escritura de la primera. `configuracionGemini()` lo comprueba y se niega a generar si no cuadra.
