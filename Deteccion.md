# Detección de curso completado y emisión automática de certificado

Estado: En curso
Fase: Fase 5 — Certificados y correos transaccionales (https://app.notion.com/p/Fase-5-Certificados-y-correos-transaccionales-3b4ba9d6712e81d78544d5d5de7ce459?pvs=21)
Prioridad: Media
Responsable: Andres Felipe Escobar Duque
Semana estimada: 5–9 sep

## Qué hay que entregar

Detección automática de curso completado y emisión del certificado correspondiente.

## Requisitos de calidad (nivel senior)

- [x] La emisión se dispara desde la base de datos (trigger o función) al registrarse el progreso, **no** desde el frontend. Si depende del navegador, un cierre de pestaña deja al estudiante sin certificado. — Trigger `progreso_emite_certificado` (`supabase/sql/047_emision_automatica_certificados.sql`), `SECURITY DEFINER`, sobre `AFTER INSERT OR UPDATE OF completado ON progreso`.
- [x] Idempotencia estricta: `UNIQUE(user_id, course_id)` en `certificates`. Un curso completado dos veces no emite dos certificados. — `@@unique([id_usuario, id_curso])` en `prisma/schema.prisma` (constraint `certificados_id_usuario_id_curso_key`), verificado en `scripts/rls-test.ts`.
- [x] "Completado" = todas las lecciones publicadas del curso marcadas como completadas. Definir explícitamente qué pasa si luego se agrega una lección (recomendación: el certificado ya emitido se conserva). — Mismo criterio de "lección LISTO" que la vista `progreso_cursos_estudiante`; no hay trigger sobre `lecciones` que reevalúe certificados ya emitidos, así que se conservan (documentado en `docs/functional-spec.md`, Flujo 07, Revf3).
- [x] Guardar en el certificado los datos **congelados** al momento de la emisión: nombre del estudiante, nombre del curso, fecha. Si el curso se renombra después, el certificado no debe cambiar. — Columnas `nombre_estudiante`/`nombre_curso` (`prisma/migrations/20260831010000_certificados_datos_congelados_y_notificacion`), escritas por el trigger de emisión; `verificar_certificado()` (`supabase/sql/020`) y la generación del PDF (`descargarCertificadoPdf`) leen esas columnas, no `perfiles`/`cursos` en vivo.
- [x] Código de verificación único, aleatorio y no adivinable (no secuencial). — `private.generar_codigo_certificado()`, CSPRNG vía `pgcrypto`/`gen_random_bytes`, alfabeto sin caracteres ambiguos.
- [x] La emisión no puede bloquear la interfaz: procesar de forma asíncrona y notificar cuando esté listo. — La emisión ya es asíncrona (trigger de BD, sin llamadas de red). Notificación por correo agregada vía `certificados.notificado_en` (outbox) + `scripts/certificados-enviar-notificaciones.ts` (`npm run certificados:notificar`), mismo patrón que `mux-limpiar-assets.ts`.

Migración de Prisma + `npm run db:rls` ya aplicadas al entorno de desarrollo (`aws-0-us-east-1.pooler.supabase.com`) y verificadas con `npm run test:rls` (113/113 OK), incluyendo el caso end-to-end: completar la única lección de un curso de prueba emitió el certificado automáticamente vía trigger, con `nombre_estudiante`/`nombre_curso` ya congelados y confirmables por `verificar_certificado()`.

**Pendiente de acción del equipo (no es código):**
- Repetir `npx prisma migrate deploy` + `npm run db:rls` en Staging/Production cuando corresponda (son proyectos de Supabase separados, `docs/technical-spec.md` §10).
- Decidir cómo se programa `certificados:notificar` en producción (cron de Railway o GitHub Actions — el proyecto todavía no tiene un Railway Cron Service desplegado, mismo caso que `010_fk_perfiles_cascade_y_limpieza.sql`). Hasta entonces, correr `npm run certificados:notificar` a mano tras completar cursos de prueba.
- Configurar un dominio propio verificado en Resend antes de producción — el remitente sigue siendo `onboarding@resend.dev` (mismo TODO ya pendiente en `src/lib/resend.ts` para el correo de bienvenida).
- Confirmar `NEXT_PUBLIC_SITE_URL` en cada entorno (dev/staging/producción) — lo usa el script de notificación para armar el link del correo.

## Definición de "terminado"

Un estudiante de prueba completa un curso corto y recibe su certificado automáticamente, sin intervención manual.

Validado a nivel de base de datos y backend (`npm run test:rls`, sesión "EMISIÓN DE CERTIFICADOS"): completar la lección emite el certificado sin ninguna llamada desde la aplicación. Queda pendiente un pase manual por la UI real (marcar un curso corto como completado desde el navegador y confirmar que aparece en `/dashboard/certificados` y llega el correo) — no se hizo en esta sesión porque requiere una cuenta de estudiante real y `npm run certificados:notificar` corriendo.
