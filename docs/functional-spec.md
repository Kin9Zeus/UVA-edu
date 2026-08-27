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
| Emisión y Descarga de Certificado | No | No | Permitido | Vista previa |
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
> * **Gestión de Identidad Académica:** Actualización del campo nombre en perfil, el cual actúa como fuente de verdad para la rotulación de certificados PDF.  
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

> * **Emisión Automática:** Evaluación de completitud del 100% de lecciones de un curso e inserción inmediata de registro en certificados.  
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

> 1. El trigger de la base de datos detecta que todas las lecciones asociadas a un curso poseen un registro de progreso con completado \= true para el usuario.  
> 2. Se inserta una entrada en la tabla certificados asignando la fecha de emisión y generando un codigo\_verificacion único e inmutable.  
> 3. Cuando el estudiante hace clic en "Descargar Certificado", una función *serverless* genera el archivo PDF imprimiendo el campo nombre vigente en Perfiles, el nombre del curso y el código de verificación.  
> 4. Cualquier persona puede acceder a la página de verificación para consultar la validez oficial del diploma, los datos del estudiante y la fecha de emisión.

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