# development-plan.md - U.V.A Plataforma de Cursos v2

## 1. Resumen de Ejecución y Metodología
* **Alcance del Desarrollo:** Construcción de un LMS transaccional nativo basado en membresías, conservando el frontend público actual en Next.js (marketing y SEO).
* **Tiempo Estimado:** 12 semanas calendario, asumiendo un (1) desarrollador a dedicación completa.
* **Metodología:** Desarrollo secuencial de código (Fases 1 a 7) ejecutado en paralelo con tareas operativas, legales y de producción de contenido (responsabilidad del equipo U.V.A).

## 2. Fases de Desarrollo (MVP)

### Fase 0: Definiciones y Trámites Externos (Semana 1)
*Esta fase corre en paralelo con el inicio del proyecto y no bloquea el código de la Fase 1, pero sí bloquea el lanzamiento si se retrasa.*
* **Objetivo:** Cerrar las decisiones clave (modelo comercial, precio, pasarelas) y arrancar los trámites de mayor plazo que no dependen del código.
* **Prerrequisitos:** Kick-off del proyecto y disponibilidad de los directivos para toma de decisiones.
* **Tareas:**
  * Firma del acta de decisiones: confirmación de modelo de negocio, precio final, moneda, pasarela (Stripe/Wompi) y estrategia de facturación.
  * Inicio de constitución de la LLC y solicitud de EIN.
  * Apertura de cuentas: Supabase, Mux, Stripe (modo prueba) y Resend.
  * Configuración de repositorio (GitHub), tablero de trabajo y entorno de Staging en Railway.
  * Inventario de contenido: definición de cursos pregrabados y horas faltantes de producción.
* **Criterios de Aceptación:**
  * Cuentas de servicios de terceros creadas y con credenciales (API Keys) documentadas.
  * Trámite legal de la LLC iniciado oficialmente.
  * Entorno de Staging desplegado y conectado al repositorio.

### Fase 1: Fundaciones, Datos e Identidad (Semana 2-3)
* **Objetivo:** Dejar en pie el esquema de base de datos completo y el sistema de cuentas.
* **Prerrequisitos:** Entorno de Supabase (Staging) creado.
* **Tareas:**
  * Implementación del esquema Postgres con las 10+ entidades base.
  * Configuración de Row Level Security (RLS) por tabla y rol (Estudiante, Administrador).
  * Integración de Supabase Auth: Registro/Login con correo y OAuth (Google), y flujo de recuperación de contraseña.
  * Asignación de roles y creación del primer usuario administrador.
  * Generación de migraciones versionadas (Prisma/SQL) e inyección de datos de prueba (*seed*).
* **Criterios de Aceptación:**
  * El usuario puede registrarse e iniciar sesión exitosamente (Google y Email).
  * Las políticas RLS bloquean efectivamente consultas no autorizadas a las tablas.

### Fase 2: Panel Administrativo y Contenido (Semana 4-6)
* **Objetivo:** Que el equipo de U.V.A pueda cargar todo el catálogo sin intervención del desarrollador.
* **Prerrequisitos:** Fase 1 terminada. Cuenta de Mux configurada.
* **Tareas:**
  * CRUD jerárquico de cursos, módulos y lecciones.
  * Interfaz de reordenamiento mediante arrastre (*drag & drop*).
  * Integración con Mux para carga directa de video (*Direct Uploads*) y monitoreo de estado mediante webhooks.
  * Lógica para reemplazo de video en lecciones sin alterar el historial de progreso.
  * Gestión de visibilidad (publicar/ocultar curso) y modo vista previa del catálogo.
* **Criterios de Aceptación:**
  * El administrador puede estructurar un curso completo.
  * El archivo de video sube directo a Mux y el webhook actualiza el estado de la lección a "listo" automáticamente en la base de datos.

### Fase 3: Experiencia del Estudiante (Semana 6-7)
* **Objetivo:** Habilitar el recorrido completo de aprendizaje y exploración, todavía sin cobro.
* **Prerrequisitos:** Fases 1 y 2 terminadas. Catálogo base cargado con datos de prueba.
* **Tareas:**
  * Construcción del catálogo público con búsqueda por palabra clave y filtros por categoría.
  * Vista de detalle de curso con árbol de módulos y lecciones.
  * Integración del reproductor Mux con URLs firmadas (seguridad) y control de reanudación.
  * Sincronización de progreso (guardado del segundo actual y marcado de completado al 90%).
  * Cálculo de porcentaje de avance por curso y dashboard "Mis Cursos / Continuar Viendo".
* **Criterios de Aceptación:**
  * El video solo se reproduce si el enlace firmado temporal es válido.
  * El progreso se persiste en la base de datos cada 10 segundos (*heartbeat*).
  * El control de concurrencia expulsa dispositivos simultáneos reproduciendo video bajo la misma cuenta.

### Fase 4: Monetización y Control de Acceso (Semana 8-10)
* **Objetivo:** Convertir la plataforma en un negocio recurrente. *(Fase de mayor riesgo técnico).*
* **Prerrequisitos:** Fase 3 terminada. Cuenta de Stripe y/o Wompi (Modo Prueba) configurada.
* **Tareas:**
  * Integración de Stripe Checkout para alta de suscripciones y Customer Portal para autogestión.
  * Recepción de Webhooks de pago con registro de idempotencia estricta en base de datos.
  * Implementación del Muro de Acceso dinámico (valida estado de suscripción antes de mostrar contenido).
  * Sistema de cupones de descuento y asignación de accesos manuales (cortesías).
  * Panel de administración de suscriptores (activos, vencidos, pagos fallidos) e historial de pagos.
* **Criterios de Aceptación:**
  * Un pago exitoso actualiza el estado a `activa` y desbloquea el reproductor.
  * Un pago fallido actualiza a `past_due` y muestra el banner de periodo de gracia.
  * Los webhooks reenviados (duplicados) no generan errores ni dobles suscripciones.

### Fase 5: Certificados y Correos Transaccionales (Semana 10-11)
* **Objetivo:** Cerrar el ciclo de valor percibido por el estudiante y automatizar las comunicaciones.
* **Prerrequisitos:** Progreso de estudiante funcional (Fase 3). Cuenta de Resend activa.
* **Tareas:**
  * Detección de curso al 100% y emisión automática del registro de certificado.
  * Generación *server-side* de PDF descargable con código de verificación único.
  * Página pública de validación de diplomas.
  * Envío de correos transaccionales vía Resend (bienvenida, recuperación, recibos, fallos de cobro).
  * Configuración de registros DNS (SPF, DKIM, DMARC) para entregabilidad de correos.
* **Criterios de Aceptación:**
  * El PDF se genera en tiempo real con el nombre correcto del estudiante y el diseño de U.V.A.
  * Los correos llegan a la bandeja de entrada (no a Spam) con el remitente oficial.

### Fase 6: Facturación Electrónica (Semana 10-11.5)
* **Objetivo:** Emitir el comprobante fiscal y legal de cada pago realizado.
* **Prerrequisitos:** Decisión legal de facturación tomada y sellada en la Fase 0.
* **Tareas:**
  * *Ruta A (LLC/Stripe):* Habilitar generación y envío de recibos automáticos directamente desde Stripe.
  * *Ruta B (Entidad Colombiana):* Integración con API de proveedor DIAN (ej. Alegra/Siigo), generación de factura electrónica, almacenamiento de PDF y envío al usuario.
* **Criterios de Aceptación:**
  * El estudiante tiene acceso a un soporte legal oficial (Invoice o Factura Electrónica) por cada cobro ejecutado en la plataforma.

### Fase 7: Endurecimiento, Carga de Contenido y Lanzamiento (Semana 11-12)
* **Objetivo:** Pasar de entorno de pruebas a producción real, asegurando estabilidad y seguridad.
* **Prerrequisitos:** Todas las fases anteriores culminadas. Entorno de Producción configurado. Cuenta Stripe verificada en modo Live.
* **Tareas:**
  * Pruebas de extremo a extremo (E2E) con tarjetas reales (montos de prueba de 1 USD).
  * Auditoría final de seguridad RLS y control de posibles fugas de contenido.
  * Carga del catálogo oficial y real por parte del equipo administrativo de U.V.A.
  * Ejecución de plan de acceso para compradores históricos (migración de usuarios, si aplica).
  * Inclusión de textos legales (Términos y Condiciones, Privacidad, Políticas de cancelación).
  * Configuración de monitoreo (Sentry/PostHog), alertas y respaldos de base de datos.
* **Criterios de Aceptación:**
  * Ausencia total de bugs bloqueantes o errores críticos en consola.
  * Catálogo real de lanzamiento 100% subido y verificado.
  * Primer pago real en el entorno de producción procesado exitosamente, concediendo acceso total.

### Fase 8: Exámenes Finales de Curso — v1 (entregada)
* **Objetivo:** Que un curso pueda exigir aprobar un examen final para considerarse completo y emitir certificado, sin cambiarle el comportamiento a los cursos que no lo necesiten.
* **Prerrequisitos:** Fase 5 (certificados) culminada — el gate se monta sobre el trigger de emisión existente.
* **Especificación:** `docs/functional-spec.md` Módulo 9 y Flujo 14; regla de certificación en Flujo 07 (Revf5). Esquema en `docs/technical-spec.md`, "Módulo de Evaluación".
* **Tareas entregadas:**
  * Esquema: `examenes`, `preguntas_examen`, `intentos_examen` (migración `20260907020000_examenes_finales`), con el piso de 75% y el índice parcial de intento único como restricciones de base, no de formulario.
  * RLS (`supabase/sql/067_examenes.sql`): `preguntas_examen` solo para administradores; `intentos_examen` sin ninguna política de escritura.
  * Gate de certificación (`supabase/sql/068_certificado_requiere_examen.sql`): `private.curso_esta_completo` como fuente de verdad única, con dos triggers (progreso y aprobación de examen) que delegan en la misma función de emisión.
  * CMS: pestaña **Examen** en el detalle de curso — configuración, preguntas con arrastre, publicación bloqueada por reglas, y tabla de intentos.
  * Estudiante: `/cursos/<slug>/examen` con pantalla previa, rendición con autoguardado y temporizador, y resultado.
  * Tercer estado "Examen pendiente" en el dashboard del estudiante y en los dos paneles de admin que decían "Completado" solo con el 100% de clases.
* **Criterios de Aceptación (verificados):**
  * Un estudiante con el 100% de clases y examen sin aprobar NO recibe certificado ni ve el curso como completo (`npm run test:rls`).
  * Un estudiante no puede leer `preguntas_examen` ni escribir su propia nota vía API (`npm run test:rls`).
  * Un curso sin examen publicado certifica exactamente como antes.

### Exámenes — Fase 2 (pendiente, NO entregada)
* **Objetivo:** Ampliar los tipos de pregunta más allá de los cerrados, para evaluar criterio y no solo reconocimiento.
* **Por qué se pospuso:** cada tipo nuevo cuesta tres cosas, no una — UI de captura en el CMS, UI de respuesta para el estudiante y validación/calificación server-side. Los cuatro tipos cerrados de la v1 ya cubren el requisito de "que no sea solo un formulario" (enunciados enriquecidos con código e imágenes, respuesta corta escrita, opción múltiple todo-o-nada) y son los únicos autocalificables sin intervención humana.
* **Preparado desde la v1 para que esta fase NO requiera migración de esquema:**
  * El enum `TipoPregunta` ya declara `ORDENAR_PASOS`, `EMPAREJAR` y `RESPUESTA_ABIERTA` (agregar un valor a un enum de Postgres en caliente obliga a un `ALTER TYPE ... ADD VALUE`, que no corre en la misma transacción que lo usa).
  * El enum `EstadoIntentoExamen` ya declara `EN_REVISION`, para intentos con preguntas abiertas pendientes de calificación manual.
  * `src/lib/examenes/tipos.ts` centraliza qué tipos acepta la app hoy: `TIPOS_IMPLEMENTADOS` y `TIPOS_FASE_2`. Habilitar un tipo es moverlo de una lista a la otra y escribir su caso en `calificarPregunta`.
  * `getExamenDeCurso` y `congelarPreguntas` ya filtran por `esTipoImplementado()`, así que una pregunta de Fase 2 guardada por error no rompe la pantalla ni cuenta como fallada.
* **Tareas:**
  * **Ordenar pasos:** el estudiante reordena una secuencia. Reusar el drag & drop de módulos/lecciones (`@dnd-kit`) que ya está en el proyecto. Calificación: comparación de la secuencia completa.
  * **Emparejar columnas:** conectar término ↔ definición. Es el tipo con más trabajo de UI (interacción de dos columnas en móvil).
  * **Respuesta abierta con revisión manual:** el intento va a `EN_REVISION` en vez de calificarse solo; el admin califica esas preguntas desde una bandeja de pendientes y el `puntaje_pct` se recalcula al completarlas. Requiere además notificar al estudiante cuando su resultado quede confirmado.
* **Criterios de Aceptación:**
  * Un examen puede mezclar tipos cerrados y abiertos; los cerrados se califican solos y el intento queda `EN_REVISION` hasta que se califiquen los abiertos.
  * El certificado se emite recién cuando el intento pasa a `APROBADO`, no al enviarlo.
