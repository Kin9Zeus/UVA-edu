# **Functional Specification: U.V.A — Plataforma de Cursos v2**

## **1\. Visión General del Proyecto**

### **1.1 Descripción del Producto**

**U.V.A (Unidad Vectorial de Arquitectura)** es una plataforma de educación digital especializada en la formación de arquitectos y diseñadores. El proyecto v2 representa la transformación del sitio estático actual de marketing y ventas hacia un ecosistema LMS (*Learning Management System*) nativo sobre un modelo de suscripción mensual/recurrente.

### **1.2 Objetivos de Negocio y Producto**

> * **Centralización del Aprendizaje:** Migrar la entrega de contenido desde enlaces manuales y sesiones en vivo a un reproductor propio, protegido y adaptativo.  
> * **Ingresos Recurrentes Predictivos:** Implementar cobro automatizado por suscripción mediante pasarela de pagos internacional (Stripe) y local (Wompi).  
> * **Fricción Cero en Descubrimiento:** Habilitar un modelo de autenticación y pago progresivo donde el visitante navega libremente por la plataforma antes de ser interceptado por un muro de registro o pago.  
> * **Escalabilidad Operativa:** Automatizar el cálculo de progreso, la expedición de certificados verificables y el control de accesos sin intervención humana.

## **2\. Arquetipos de Usuario y Matriz de Permisos**

### **2.1 Definición de Roles**

> 1. **Visitante (Guest / No Autenticado):** Persona sin sesión activa. Navega de forma pública por el sitio, explora el catálogo y consulta fichas técnicas de cursos.  
> 2. **Estudiante Autenticado (Sin Suscripción):** Usuario registrado con cuenta activa en Perfiles pero sin plan vigente ni cortesía otorgada. Puede explorar el catálogo, gestionar su perfil y acceder al checkout.  
> 3. **Estudiante Suscrito (Membresía / Acceso Activo):** Usuario autenticado con registro en suscripciones (estado \= 'activa' o en período de gracia) o entrada vigente en inscripciones. Posee acceso total al reproductor de video HLS y generación de diplomas.  
> 4. **Administrador:** Usuario autenticado con rol administrador en la tabla Perfiles. Posee acceso completo al Backoffice de gestión de contenidos, finanzas, cupones y auditoría.

### **2.2 Matriz de Accesos por Rol**

| Módulo / Acción | Visitante | Estudiante Registrado | Estudiante Suscrito | Administrador   |
| :---- | :---: | :---: | :---: | ----- |
| Navegación por Home y Páginas Públicas | Permitido | Permitido | Permitido | Permitido |
| Exploración de Catálogo y Búsqueda | Permitido | Permitido | Permitido | Permitido |
| Ver Detalle de Curso y Temario | Permitido | Permitido | Permitido | Permitido |
| Reproducción de Video (Streaming HLS) | Req. Auth | Req. Checkout | Permitido | Modo Preview |
| Guardado de Progreso de Lección | No | No | Permitido | No |
| Presentación de Examen Final | No | No | Permitido | Vista previa |
| Emisión y Descarga de Certificado | No | No | Permitido | Vista previa |
| Creación y Publicación de Exámenes | No | No | No | Permitido |
| Validación Pública de Certificados | Permitido | Permitido | Permitido | Permitido |
| Gestión de Métodos de Pago y Suscripción | No | Permitido | Permitido | No |
| Panel Backoffice CMS / CRUD de Cursos | No | No | No | Permitido |
| Otorgamiento de Cortesías y Cupones | No | No | No | Permitido |
| Consulta de Bitácora y Eventos Webhook | No | No | No | Permitido |

## **3\. Módulos de Funcionalidad y Procesos**

### **Módulo 1: Descubrimiento, SEO y Catálogo Público (Guest Mode)**

> * **Navegación Abierta:** Acceso a landing pages, secciones informativas y catálogo completo sin exigir inicio de sesión previo.  
> * **Búsqueda y Filtros Reactivos:** Filtrado en tiempo real por categoría temática e insensible a mayúsculas/minúsculas sobre títulos e instructores.  
> * **Ficha de Curso Ampliada:** Muestra promesa de valor, temario ordenado por módulos/lecciones, duración calculada, biografía del instructor y llamados a la acción de suscripción.

### **Módulo 2: Autenticación, Gestión de Cuenta e Identidad**

> * **Autenticación Multicanal:** Inicio de sesión y registro vía email/contraseña y OAuth con Google gestionado a través de Supabase Auth.  
> * **Vincular Perfil:** Sincronización automática mediante triggers de base de datos desde auth.users hacia la tabla Perfiles.  
> * **Gestión de Identidad Académica:** Actualización del campo nombre en perfil. Este nombre alimenta certificados que se emitan *a partir de ese momento*; un certificado ya emitido conserva el nombre congelado al momento de su emisión (ver Flujo 07, paso 2 — Revf4).  
> * **Recuperación Transaccional:** Flujo de restablecimiento de contraseña mediante correos con tokens de expiración corta.

### **Módulo 3: Membresías, Cobros, Promociones y Checkout**

> * **Pasarelas de Pago:** Integración híbrida con Stripe Billing (cobro internacional) y Wompi (soporte local para Colombia).  
> * **Muro de Pago Dinámico:** Intercepción de solicitudes de contenido privado, redirigiendo al checkout cuando la suscripción no está activa.  
> * **Cupones de Descuento:** Motor de aplicación de códigos promocionales con reglas de vigencia, límite de uso y tipo de descuento (porcentaje o monto fijo).  
> * **Autogestión de Cliente:** Acceso al Portal de Cliente para actualización de tarjetas, consulta de recibos e historial de pagos.

### **Módulo 4: Experiencia de Aprendizaje, Reproductor y Progreso (LMS Core)**

> * **Streaming Seguro HLS:** Integración con Mux mediante transmisión de video adaptativo con URLs firmadas efímeras.  
> * **Sincronización de Progreso:** Persistencia del campo segundo\_actual y cálculo del porcentaje de avance por curso.  
> * **Marcado Automático:** Actualización del campo completado \= true al alcanzar el 90% de tiempo reproducido en una lección.  
> * **Control de Concurrencia:** Limitación estricta a un (1) solo flujo de reproducción activo por cuenta de estudiante en tiempo real.

### **Módulo 5: Sistema de Certificación y Validación Pública**

> * **Emisión Automática (Revf5):** Evaluación de DOS condiciones —completitud del 100% de lecciones del curso y, *si el curso tiene examen final publicado*, un intento aprobado— e inserción inmediata de registro en certificados. Un curso sin examen publicado certifica solo con las lecciones, igual que antes.  
> * **Examen Final Opcional por Curso:** Quien crea el curso decide si exige examen. Ver Módulo 9 y Flujo 14.  
> * **Generación Server-Side:** Construcción en tiempo real de archivos PDF descargables con firma digital y hash único.  
> * **Verificación Pública Permanente:** Página de validación de autenticidad accesible para empleadores o terceros mediante un código de verificación único, con validez permanente sin importar el estado futuro de la suscripción.

### **Módulo 6: Administración de Contenidos (CMS) y Media Streaming**

> * **Gestión Jerárquica:** CRUD de Cursos, Módulos y Lecciones con capacidad de reordenamiento mediante arrastre (*Drag & Drop*).  
> * **Carga Directa a Mux:** Carga de video directo desde el navegador del administrador hacia los servidores de Mux utilizando *Direct Uploads*.  
> * **Sustitución de Video:** Reemplazo de activos de video en lecciones publicadas sin alterar las métricas de progreso de los estudiantes ni los IDs de entidad.  
> * **Modo Vista Previa:** Capacidad del administrador para previsualizar el curso e interactuar con el reproductor exactamente como lo vería un estudiante, incluso en cursos ocultos.

### **Módulo 7: Gestión de Suscriptores, Accesos Manuales y Soporte**

> * **Monitor de Suscriptores:** Panel de control con listado de estudiantes, estados de cobro (activa, past\_due, vencida, cancelada) y filtros de soporte.  
> * **Otorgamiento de Cortesías:** Asignación manual de accesos especificando curso o membresía, asignando obligatoriamente una fecha de expiración.  
> * **Motor de Cupones Admin:** Formulario para parametrizar nuevos códigos promocionales, límites de aplicación y fechas de expiración.

### **Módulo 8: Auditoría, Eventos y Webhooks**

> * **Idempotencia de Webhooks:** Registro previo de cada evento recibido de Stripe/Wompi en eventos\_webhook para garantizar procesamiento único.  
> * **Bitácora Administrativa:** Registro inmutable en bitacora\_admin de cada acción administrativa ejecutada (publicar curso, otorgar cortesía, alterar cupón).

### **Módulo 9: Evaluación y Exámenes Finales**

> * **Examen Opcional por Curso:** Como máximo un examen final por curso, y solo si quien lo crea decide que su curso lo necesita. Sin examen publicado, el curso certifica con el 100% de lecciones, como siempre.
> * **Gate de Certificación:** Con examen publicado, aprobarlo es condición necesaria —junto al 100% de lecciones— para que el curso quede completo y se emita el certificado (Flujo 07, Revf5).
> * **Nota Mínima:** 75% por regla de negocio, con piso impuesto en la base de datos. El administrador puede exigir más, nunca menos.
> * **Tipos de Pregunta:** opción única, opción múltiple, verdadero/falso y respuesta corta. Enunciado con editor enriquecido (listas, citas, código), no solo texto plano.
> * **Intentos por Rondas:** `intentos_maximos` (default 3) no es un tope de por vida, es el tamaño de una RONDA. Reprobar dentro de la ronda espera 15 minutos; agotar la ronda completa espera 5 horas y al cumplirse habilita una ronda nueva, indefinidamente y sin que un admin tenga que intervenir (aunque puede saltarse la espera). Tiempo límite opcional por examen, validado en el servidor.
> * **Integridad del Intento:** las preguntas se congelan en el intento al iniciarlo, con su orden aleatorizado; editar el examen después no altera intentos en curso ni recalifica los ya rendidos.
> * **Calificación Server-Side:** ponderada por puntos. Las respuestas correctas nunca viajan al navegador.

## **4\. Flujos de Trabajo Detallados (End-to-End Workflows)**

### **Flujo 01: Navegación Abierta y Conversión Progresiva**

\[Visitante\] ──\> Navega Home / Catálogo ──\> Selecciona Curso ──\> Ve Detalle / Temario  
                                                                      │  
                                                           Clic en "Ver Lección"  
                                                                      │  
                                                           ¿Está Autenticado?  
                                                               ├── NO ──\> Redirige a Modal Login/Registro  
                                                               └── SÍ ──\> ¿Tiene Suscripción / Acceso?  
                                                                             ├── SÍ ──\> Carga Reproductor HLS  
                                                                             └── NO ──\> Redirige a Checkout Stripe

> 1. El visitante ingresa al sitio web y explora el catálogo sin restricciones.  
> 2. En la ficha técnica del curso hace clic en "Ver Lección" o "Suscribirse".  
> 3. Si no ha iniciado sesión, el sistema despliega el modal de Registro/Login.  
> 4. Tras autenticarse, si no posee membresía activa, es redirigido automáticamente al Checkout de la pasarela con el plan seleccionado.  
> 5. Una vez confirmado el pago vía webhook, la suscripción pasa a activa y el estudiante es llevado directamente a la lección seleccionada.

### **Flujo 02: Autenticación e Inserción de Perfil (Supabase Auth)**

> 1. El usuario envía sus credenciales (Email/Password) o selecciona "Continuar con Google".  
> 2. Supabase Auth procesa la solicitud, genera las llaves JWT y crea el registro en el esquema auth.users.  
> 3. Un Trigger en PostgreSQL detecta la creación e inserta un registro en la tabla Perfiles relacionando el id (UUID), correo, nombre y asignando rol \= 'estudiante'.  
> 4. Las cookies de sesión HTTP-Only se configuran en el navegador del cliente para mantener la persistencia.  
> 5. **Verificación de correo (solo registro por Email/Password):** Supabase Auth envía el correo "Confirm signup" con un token de un solo uso y validez de 15 minutos (mismo criterio que Flujo 03). El Trigger del paso 3 no depende de esta verificación: la fila en Perfiles se crea de inmediato, sin fricción.  
> 6. **Restricción mientras auth.users.email\_confirmed\_at es nulo:** el estudiante puede seguir navegando el catálogo público sin restricción, pero no puede iniciar checkout/suscripción, acceder al dashboard de estudiante ni reproducir video — bloqueado en el middleware y reforzado con políticas RLS.  
> 7. **Token vencido:** si pasan los 15 minutos sin confirmar, el token queda inválido pero la cuenta no se borra ni se bloquea. En el siguiente intento de acceso a una zona restringida, o de login, se muestra un estado "Cuenta pendiente de verificación" con un botón "Reenviar enlace de verificación", limitado a un reenvío cada 60 segundos.  
> 8. **Excepción OAuth:** las cuentas creadas vía "Continuar con Google" llegan con el correo pre-verificado por Google y quedan exentas de este flujo.  
> 9. **Housekeeping:** un job programado elimina de auth.users las cuentas con email\_confirmed\_at nulo y más de 7 días desde fecha\_registro, liberando esos correos para un nuevo registro. La eliminación es en cascada hacia Perfiles.

### **Flujo 03: Recuperación de Contraseña**

> 1. El estudiante ingresa a la vista de recuperación y proporciona su correo electrónico.  
> 2. El sistema valida la existencia de la cuenta y solicita a Supabase Auth el envío de un correo transaccional.  
> 3. El estudiante recibe un enlace que contiene un token de un solo uso con validez de 15 minutos.  
> 4. Al hacer clic, es redirigido a la pantalla de restablecimiento donde define su nueva contraseña, invalidando las sesiones activas anteriores.

### **Flujo 04: Reproducción HLS Segura, Heartbeat y Cálculo de Progreso**

\[Cliente / VideoPlayer\] ──\> Request URL Firmada ──\> \[API Server\] ──\> Valida RLS / Suscripción  
         │                                                                   │  
         │\<─── Retorna Mux Signed URL (Expira en 2 min) \<────────────────────┘  
         │  
         ├── Ping cada 10s (Heartbeat) ──\> Actualiza \`segundo\_actual\`  
         │  
         └── Reproducción \>= 90% ────────\> Actualiza \`completado \= true\`

> 1. El estudiante solicita reproducir una lección. El backend valida mediante Row Level Security (RLS) y middleware que el usuario tenga un registro de suscripción/acceso vigente.  
> 2. El backend consulta la API de Mux utilizando la llave privada y emite una URL firmada (*Signed URL*) con expiración de 2 minutos para el playback\_id.  
> 3. Durante la reproducción, el cliente envía solicitudes tipo *heartbeat* cada 10 segundos actualizando la tabla progreso con el segundo\_actual.  
> 4. Cuando el tiempo de reproducción alcanza el 90% de la duración total declarada de la lección, el backend marca completado \= true y actualiza la fecha de visualización.  
> 5. Se recalcula el porcentaje general de avance del curso para el Dashboard del estudiante.

### **Flujo 05: Control de Concurrencia de Reproducción (Sesión Única)**

> 1. El estudiante A inicia la reproducción de un video en su laptop.  
> 2. El estudiante A abre su cuenta en una tablet e intenta reproducir una lección.  
> 3. La API procesa la solicitud de la tablet, genera la nueva URL firmada y registra en memoria/base de datos la llave de sesión activa más reciente para el usuario.  
> 4. Al siguiente *heartbeat* del reproductor en la laptop, la API detecta un token de sesión caducado, interrumpe el streaming HLS y despliega un mensaje en pantalla: *"Tu cuenta se está reproduciendo en otro dispositivo"*.

### **Flujo 06: Ciclo de Vida de Suscripción, Reintentos y Periodo de Gracia**

\[Cobro Fallido\] ──\> Estado \`past\_due\` ──\> Banner de Alerta \+ Reintentos (Días 1, 3, 5\)  
                                                │  
                          ┌─────────────────────┴─────────────────────┐  
                          ▼                                           ▼  
                 \[Cobro Exitoso\]                            \[Agotados Reintentos\]  
                          │                                           │  
                Estado \`activa\` (OK)                        Estado \`vencida\` (Muro Bloqueado)

> 1. En la fecha de renovación, la pasarela de pagos intenta debitar el valor de la membresía.  
> 2. Si la transacción es rechazada, la pasarela envía un webhook cambiando el estado de la suscripción a past\_due.  
> 3. El sistema activa un período de gracia de 3 a 5 días, durante los cuales el estudiante mantiene acceso al contenido, pero se le muestra un banner de aviso prominente solicitando actualizar su tarjeta.  
> 4. La pasarela realiza reintentos automáticos programados (Días 1, 3 y 5).  
> 5. **Resultado A:** Si un reintento tiene éxito, el estado vuelve a activa y el banner desaparece.  
> 6. **Resultado B:** Si los reintentos se agotan sin éxito, el estado pasa a vencida, revocando inmediatamente la firma de URLs de Mux y cerrando el Muro de Pago.  
> 7. **Cancelación Voluntaria:** Si el usuario cancela su membresía desde el portal, el estado pasa a cancelada, pero conserva acceso hasta la fecha registrada en fecha\_renovación.

### **Flujo 07: Emisión, Impresión PDF y Verificación de Certificados**

> 1. El trigger de la base de datos detecta que se cumplen las dos condiciones de certificación: (a) todas las lecciones asociadas a un curso poseen un registro de progreso con completado \= true para el usuario, y (b) si el curso tiene un examen final publicado, el usuario tiene un intento en estado `APROBADO` (Revf5, ver abajo).  
> 2. Se inserta una entrada en la tabla certificados asignando la fecha de emisión, generando un codigo\_verificacion único e inmutable, y **congelando** en la misma fila el nombre del estudiante (Perfiles) y el título del curso (Cursos) tal como están en ese instante.  
> 3. Cuando el estudiante hace clic en "Descargar Certificado", una función *serverless* genera el archivo PDF imprimiendo el nombre y el título del curso **congelados en el certificado** (no el valor vigente en Perfiles/Cursos) y el código de verificación.  
> 4. Cualquier persona puede acceder a la página de verificación para consultar la validez oficial del diploma; los datos del estudiante y el curso que muestra son los mismos congelados del paso 2, no una consulta en vivo.  
> 5. **Regla de integridad (Revf3):** Si después de emitido un certificado se agrega una lección nueva al curso, el % de avance de ese estudiante puede bajar de 100% — el certificado ya emitido **no se revoca**. La emisión es un evento puntual (una fila en `certificados` con su propio `codigo_verificacion`), no una condición que se re-evalúe en cada lectura; revocarlo retroactivamente invalidaría un diploma que el estudiante ya pudo haber presentado a un tercero por un cambio de contenido posterior a su esfuerzo real.  
> 6. **Regla de integridad (Revf4):** Si el estudiante corrige su nombre en Perfiles o un administrador renombra el curso *después* de emitido un certificado, ese certificado ya emitido **no cambia** — es un documento oficial ya expedido. Solo un certificado emitido *después* del cambio refleja el nombre/título nuevo.  
> 7. **Regla de integridad (Revf5):** Terminar el 100% de las lecciones ya no basta si el curso tiene examen final publicado. La condición se puede completar por cualquiera de sus dos lados y en cualquier orden, así que la detecta uno de DOS triggers: `progreso_emite_certificado` (al completar una lección) e `intento_examen_emite_certificado` (al aprobar el examen). Los dos delegan en la misma función `private.emitir_certificado`, y la regla vive en un solo sitio: `private.curso_esta_completo` (supabase/sql/068). Publicar un examen en un curso que ya tiene estudiantes NO revoca certificados ya emitidos —nunca se revocan, ver Revf3— pero sí pasa a exigirse a quien todavía no se ha certificado. Despublicarlo tampoco quita nada a quien ya lo aprobó.  
> 8. La emisión es asíncrona respecto a la navegación del estudiante (el trigger corre en el mismo INSERT/UPDATE de `progreso`, sin bloquear la interfaz) y dispara una notificación por correo ("tu certificado ya está listo") una vez procesada — ver `scripts/certificados-enviar-notificaciones.ts`.

### **Flujo 08: Backoffice — Creación y Estructuración de Cursos (CMS)**

> 1. El Administrador accede a la sección de creación de curso.  
> 2. Completa los campos básicos: Título, Descripción, Categoría, Nombre de Instructor e Imagen de Portada (almacenada en Supabase Storage).  
> 3. Crea la estructura modular añadiendo Módulos y Lecciones.  
> 4. Mediante una interfaz interactiva de arrastre (*Drag & Drop*), reorganiza la posición de módulos o lecciones. Al soltar, la aplicación envía un *batch update* que actualiza el campo orden en la base de datos.  
> 5. Define el estado de visibilidad del curso con el interruptor mostrado \= true / false.

### **Flujo 09: Backoffice — Carga Directa de Video a Mux (Direct Upload)**

\[Admin Browser\] ──\> Request Upload URL ──\> \[U.V.A API Server\] ──\> Request Mux Direct Upload  
       │                                                                   │  
       │\<── Returns Upload Endpoint URL \<──────────────────────────────────┘  
       │  
       └── Uploads Video Binary directly ──\> \[Mux Ingestion Server\]  
                                                    │  
                                         Processing Complete  
                                                    │  
                                                    ▼  
                                            Webhook Sent to U.V.A  
                                                    │  
                                        Updates \`id\_video\_mux\`

> 1. Dentro del editor de lección, el Administrador selecciona "Cargar Video".  
> 2. El servidor de U.V.A solicita a Mux un punto de carga directo (POST /video/v1/uploads).  
> 3. Mux responde con un *Upload Endpoint URL* temporal que es entregado al cliente web.  
> 4. El navegador del Administrador transmite el archivo de video pesado directamente a Mux con barra de progreso, sin pasar por el servidor web de Next.js.  
> 5. Al finalizar el procesamiento, Mux dispara el webhook video.asset.ready enviando el playback\_id y la duración.  
> 6. El backend actualiza la lección correspondiente, cambiando el campo estado\_procesamiento a listo.

### **Flujo 10: Backoffice — Sustitución/Reemplazo de Video en Lección**

> 1. El Administrador requiere actualizar el contenido de video de una lección ya existente.  
> 2. Ingresa a la lección y selecciona "Reemplazar Video".  
> 3. Se ejecuta el proceso de *Direct Upload* a Mux generando un nuevo playback\_id.  
> 4. El backend actualiza la columna id\_video\_mux de la lección con el nuevo identificador.  
> 5. **Regla de integridad:** Se conservan intactos el ID de la lección y las asociaciones en módulos. Sobre el progreso de cada estudiante: la marca de lección **completada** se conserva (el video sigue siendo, en esencia, el mismo contenido), pero el **segundo de reanudación se reinicia a 0**, porque el video cambió y el punto exacto donde iba el estudiante ya no corresponde a nada coherente en el archivo nuevo.

### **Flujo 11: Backoffice — Otorgamiento de Accesos Manuales y Cortesías**

> 1. El Administrador accede al panel de usuarios y localiza al estudiante por su correo electrónico.  
> 2. Selecciona "Otorgar Cortesía / Acceso Manual".  
> 3. Define el alcance (un curso específico o acceso global a la membresía) y especifica de forma **obligatoria una fecha de expiración**.  
> 4. El sistema inserta un registro en la tabla inscripciones asignando tipo\_acceso \= 'cortesía', el ID del administrador en otorgado\_por y la fecha límite.  
> 5. Se genera una entrada inmutable en bitacora\_admin registrando la acción, el usuario beneficiado, la fecha y el motivo administrativo.

### **Flujo 12: Backoffice — Creación y Aplicación de Cupones Promocionales**

> 1. En el panel de cupones, el Administrador define un nuevo código, elige el tipo de descuento (porcentaje o monto fijo en centavos), el valor, la fecha de vencimiento y el límite global de usos.  
> 2. Durante el proceso de Checkout, el estudiante ingresa el código promocional.  
> 3. El backend consulta la tabla cupones y valida existencia, fecha de vencimiento y número de usos.  
> 4. Si la validación es satisfactoria, se aplica el descuento al monto total, se incrementa en \+1 el campo veces\_usado y se envía la transacción ajustada a la pasarela de pago.

### **Flujo 13: Backoffice — Alta de Administradores y Registro de Bitácora**

> 1. Un Administrador activo ingresa al módulo de equipo y solicita la creación de un nuevo usuario administrativo.  
> 2. Se envía una invitación por correo. Tras completar su registro en Supabase Auth, se actualiza el campo rol \= 'administrador' en la tabla Perfiles.  
> 3. Cada vez que cualquier administrador realice una acción operativa (crear/editar/eliminar curso, otorgar acceso, modificar cupones), el sistema inserta inmutablemente la acción en bitacora\_admin.

### **Flujo 14: Examen Final de Curso — Creación, Presentación y Calificación**

\[Admin\] Crea examen (borrador) ── Agrega preguntas ── Publica
                                                            │
                                                            ▼
\[Estudiante\] Termina 100% de clases ──> Examen desbloqueado
                                                            │
                                            Inicia intento (preguntas congeladas)
                                                            │
                                              Autoguardado cada 10s
                                                            │
                                    Envía (o se agota el tiempo) ──> Calificación server-side
                                                            │
                                      ┌─────────────────────┴─────────────────────┐
                                      ▼                                           ▼
                              \[≥ nota requerida\]                        \[< nota requerida\]
                                      │                                           │
                        Certificado emitido por trigger              Espera 15 min y reintenta
                                                                     (dentro de la misma ronda)
                                                                                    │
                                                              ┌─────────────────────┴─────────────────────┐
                                                              ▼                                           ▼
                                                    [ronda sin agotar]                          [ronda de N agotada]
                                                              │                                           │
                                                     Reintenta con el                        Espera larga (5h) y
                                                     mismo cooldown corto                     recibe una ronda nueva
                                                                                              (o el admin se la salta)

**Lado administrador**

> 1. Desde el detalle de curso del panel (pestaña **Examen**), el Administrador crea el examen. Nace SIEMPRE en borrador: mientras `publicado = false` no existe para el estudiante ni bloquea ninguna certificación.
> 2. Configura título, instrucciones (editor enriquecido), nota para aprobar (**mínimo 75%**, puede exigir más — lo impone la restricción `examenes_nota_aprobatoria_minima` en la base, no solo el formulario), intentos permitidos (default 3, admite "sin límite"), tiempo límite en minutos (admite "sin límite") y si se barajan preguntas y opciones.
> 3. Agrega preguntas de cuatro tipos cerrados: **opción única**, **opción múltiple** (calificación todo-o-nada), **verdadero/falso** y **respuesta corta** (comparación normalizada: ignora mayúsculas, tildes y signos; admite varias respuestas aceptadas). El enunciado usa el mismo editor enriquecido que las lecciones, así que admite listas, citas y bloques de código. Las reordena por arrastre, igual que módulos y lecciones.
> 4. El interruptor de publicar está bloqueado mientras el examen no tenga título, al menos una pregunta, y un margen de error razonable (con 3 preguntas al 75%, el estudiante tendría que acertarlas todas: la UI lo advierte antes de publicar, no después de que alguien repruebe).
> 5. Publicar es lo que cambia la regla de certificación del curso; queda registrado en la bitácora administrativa. Un examen con intentos ya presentados no se puede eliminar — se despublica.
> 6. La pestaña "Estudiantes" agrupa por estudiante, no una fila por intento: cada uno se expande para ver su historial completo (número de intento — "2 de 3" —, estado, puntaje, fecha) y un botón **Ver revisión** por intento cerrado, con el detalle pregunta por pregunta — qué marcó/escribió el estudiante, cuál era la respuesta correcta, y si acertó (`getRevisionIntento`, a diferencia de lo que ve el propio estudiante, que nunca revela la respuesta correcta).
> 6.1. Si un estudiante agota una ronda completa de intentos sin aprobar, aparece con la etiqueta "Agotó su tanda" y, al expandirlo, un botón **Dar un intento extra** para saltarse la espera de 5 horas. No es la única forma de destrabarlo — la espera se resuelve sola — pero sí la única forma de que el estudiante no tenga que esperar. Queda registrado en la bitácora.

**Lado estudiante**

> 7. La ficha del curso muestra el examen desde el principio, con candado, para que sepa qué le falta para el certificado antes de llegar al final. En el reproductor, al llegar a la **última clase** del curso, el botón que en el resto del temario dice "Siguiente clase" cambia a **"Hacer examen"** y lleva directo a `/cursos/<slug>/examen` — no hace falta salir a la ficha del curso para encontrarlo.
> 8. Al completar el 100% de las clases se desbloquea `/cursos/<slug>/examen`: pantalla previa con instrucciones, nota requerida, tiempo e intentos restantes.
> 9. Al iniciar, el servidor **congela** en el intento las preguntas tal como se le presentan a ESE estudiante, ya aleatorizadas, junto con las respuestas correctas. Editar, reordenar o borrar una pregunta después no altera un intento en curso — mismo criterio que el snapshot de nombre/curso de un certificado (Revf4).
> 10. Las respuestas se autoguardan cada 10 segundos. Si hay tiempo límite, se muestra una cuenta regresiva y el examen se envía solo al agotarse; el corte se valida contra `intentos_examen.expira_en` en el servidor, nunca contra el reloj del cliente, y un envío que llega tarde se califica con lo último autoguardado antes del vencimiento.
> 11. La calificación es 100% server-side y ponderada por puntos, no por número de preguntas. El navegador nunca recibe las respuestas correctas (`prepararPreguntasParaEstudiante` las despoja), así que no podría calificar aunque quisiera.
> 12. Aprueba con un puntaje ≥ la nota congelada en el intento. El certificado se emite en el mismo UPDATE, por trigger.
> 13. Si reprueba ve su puntaje y **cuáles** preguntas falló, pero nunca cuál era la respuesta correcta: con intentos limitados, revelarla convertiría el reintento en un trámite.
> 14. `intentos_maximos` no es un tope de por vida, es el tamaño de una RONDA (`calcularDisponibilidad`, src/lib/examen.ts — única fuente de verdad del cooldown, la usan tanto la Server Action que inicia el intento como la pantalla). Reprobar dentro de la ronda espera **15 minutos**; agotar la ronda completa (todos sus intentos sin aprobar) espera **5 horas**, y al cumplirse se habilita una ronda nueva de la misma cantidad de intentos — así indefinidamente, sin que un admin tenga que intervenir. Un administrador puede saltarse esa espera con **Dar un intento extra** (ver punto 6.1), pero no es necesario para que el estudiante eventualmente pueda volver a intentarlo.
> 15. **Antifraude:** `preguntas_examen` no es legible por ningún estudiante (RLS solo la abre a administradores) e `intentos_examen` **no tiene ninguna política de escritura** — un `PATCH` directo contra la API con `{"estado":"APROBADO"}` no afecta ninguna fila. Iniciar, autoguardar y enviar pasan siempre por Server Actions que verifican identidad y acceso antes de escribir. Un índice parcial garantiza un único intento abierto por estudiante y examen, así que dos pestañas no consumen dos intentos.

## **5\. Especificación de Reglas de Negocio, Validaciones y Edge Cases**

### **5.1 Reglas de Estado de Suscripción**

> * activa: Pago confirmado. Acceso total a reproducir videos HLS.  
> * past\_due: Reintentos de cobro en marcha. Acceso concedido con banner de advertencia (Período de gracia de 3 a 5 días).  
> * vencida: Reintentos agotados sin éxito. Muro de Pago bloqueado.  
> * cancelada: Suscripción cancelada voluntariamente. El acceso se mantiene activo hasta la fecha\_renovación y luego pasa a vencida.

### **5.2 Manejo de Errores e Idempotencia de Webhooks**

> * **Registro Previo Obligatorio:** Todo webhook entrante desde Stripe o Wompi debe registrarse en la tabla eventos\_webhook guardando el id\_evento\_externo antes de procesar cualquier lógica de negocio.  
> * **Detección de Duplicados:** Si un evento con el mismo id\_evento\_externo ya existe con procesado \= true, el servidor responde inmediatamente con un estado HTTP 200 OK ignorando la ejecución para evitar duplicidad de cobros o accesos.

### **5.3 Seguridad y Políticas RLS (Row Level Security)**

> * **Aislamiento por Usuario:** La tabla progreso y certificados solo admiten lectura/escritura para el propietario del registro identificado por auth.uid() \= id\_usuario.  
> * **Protección del CMS:** Las operaciones de mutación (INSERT, UPDATE, DELETE) en cursos, modulos, lecciones y cupones exigen verificación estricta del rol administrador en el token JWT.