# Fase de blindaje: resumen único

Última actualización: 2026-11-10. Origen: plan de blindaje de Aleck tras el
incidente de Railway del 2026-10-21. Este documento condensa el estado, las
decisiones, lo aplazado y los destinos de las alertas. El procedimiento
detallado de cada tema sigue en su propio documento (sección 8).

**Estado en una línea:** la fase está terminada en lo técnico (código, CI,
Cloudflare, registros, alertas y correo). Abrir al público (registro abierto
o cobro) queda condicionado a las tareas de las secciones 4 y 7.

## 1. Contexto

Hoy producción solo tiene datos de prueba y un curso de demostración. Por eso
varias tareas se aplazaron a propósito: perder la base hoy cuesta unas horas,
no datos de nadie. Con el primer estudiante real eso cambia.

## 2. Lo que ya está hecho

| Área | Qué quedó |
| --- | --- |
| Dependencias | `next` 16.4.5, `@sentry/nextjs` 10.78 y `prisma` 7.10.1. Sin vulnerabilidades altas ni críticas en producción; el CI falla si aparece una |
| Administradores | 2FA obligatorio en la app y en la base, sesiones cortas, contraseña de 10 caracteres con complejidad |
| Borde y origen | Cloudflare delante, la URL directa de Railway da 403, regla contra el optimizador de imágenes, límite de intentos de acceso |
| Abuso | Límites de uso en la base, Turnstile en producción, funciones y buckets con permisos cerrados |
| Llaves | Rotadas y guardadas en el gestor de contraseñas. No hay llaves de Stripe ni Wompi porque no hay pasarela conectada. `DATABASE_URL` salió de Railway |
| CI | Acciones fijadas por SHA, búsqueda de llaves en todo el historial, CodeQL, pruebas de autorización contra staging |
| Registros y alertas | Registros en Better Stack y 90 días en R2, alertas probadas, monitor externo de caída |
| Llaves señuelo | Creadas y **probadas** (el aviso llegó, 2026-11-10) |
| Correo | Envío autenticado por `mail.uvarq.com` y recepción de `soporte@` y `seguridad@` (sección 6) |
| Continuidad | Imagen de Docker que se construye en cada PR y lista de secretos en el gestor |

## 3. Decisiones y riesgos aceptados

Se apartan del plan y el equipo las asumió. No son olvidos.

| Decisión | Riesgo que se acepta | Quién y cuándo | Se revisa |
| --- | --- | --- | --- |
| Aplazar respaldo, plan B y copia de archivos hasta el lanzamiento | Perder la base de prueba y el curso demo | Equipo, 2026-11-10 | Antes del registro público o el cobro |
| Aplazar la separación de la llave maestra | Una falla en la web pública entregaría la base completa; hoy solo hay datos de prueba | Equipo, 2026-11-10 | Antes del registro público o el cobro |
| No exigir aprobaciones en `master` | Un cambio en rutas críticas puede mezclarse sin segunda revisión; lo cubren el CI y que todo pase por PR | Equipo | Si el equipo crece o antes del lanzamiento |
| `supabase-test` sin revisores ni límite a `master` | Ninguno relevante: sus secretos son de staging | Equipo, 2026-11-06 | Si alguna vez apunta a producción |
| No rotar el secreto de origen | Una captura mostró su comienzo (unos 30 de 64 caracteres); el resto sigue siendo inadivinable | Miguel, 2026-11-09 | Si se vuelve a compartir una captura con valores |
| No cambiar `TRUSTED_PROXY_HOPS` | La alerta de puerta trasera registra la IP de Railway, no la del atacante; solo importa contar | Miguel, 2026-11-09 | Si hace falta saber quién ataca |
| Sin restricción por IP en Postgres | La IP de quien administra es dinámica | Miguel, 2026-11-04 | Si se consigue IP fija o VPN |
| Sin llaves de Stripe ni Wompi | Ninguno: no hay pasarela | Equipo | Cuando entre una pasarela real |

Detalle: `decisiones-de-seguridad.md`.

## 4. Aplazado hasta antes del lanzamiento

Nada de esta tabla bloquea cerrar la fase en lo técnico. Todo se hace antes de
abrir el registro público o el cobro, y el primero que llegue manda.

| Tarea | Por qué puede esperar | Responsable | Qué hacer |
| --- | --- | --- | --- |
| Respaldo propio fuera de Supabase (11.3) | Sin datos irrecuperables | Aleck (environment y secretos en GitHub) y Miguel (usuario de solo lectura y ejecución) | Crear el environment `respaldo-produccion`, el usuario `respaldo_lector`, correr el primer respaldo y comprobar el archivo en R2 |
| Restaurar el respaldo en staging | Depende del anterior | Miguel | Un respaldo que nunca se restauró no cuenta |
| Plan B de despliegue (11.2) | Sin usuarios no hay servicio que mantener | Miguel, con Andrés | Levantar la plataforma desde staging en otro proveedor en menos de 2 h y llenar la tabla de `plan-b-despliegue.md` |
| Copia de los buckets de Storage | Solo hay archivos de prueba | Miguel | Copiarlos a `uva-respaldos` en R2 |
| Prueba de penetración externa | El plan la pide antes del registro o el cobro | Aleck | Contratarla y corregir lo crítico |
| Alertas por IP y de administrador de madrugada (10.3) | Con tráfico de prueba no se puede fijar un umbral útil | Miguel | Dejar correr las actuales unas semanas con usuarios reales |
| Contraseñas filtradas (8.4) | Es una función del plan Pro de Supabase | Aleck decide el plan | Activarla si se contrata Pro |
| Separar la llave maestra del servidor público | Reestructura grande (31 usos); riesgo bajo sin datos reales | Andrés y Miguel | Ver `decisiones-de-seguridad.md`, sección 1 |

## 5. Dónde llega cada alerta

Dos buzones de Gmail compartidos a los que tienen acceso Aleck, Andrés y
Miguel. Las direcciones están en el gestor de contraseñas; no se escriben aquí
porque el repositorio es público.

| Buzón | Qué llega |
| --- | --- |
| General de la plataforma | Better Stack (alertas y monitor de caída), Sentry, Cloudflare y los mensajes de `soporte@` y `seguridad@` |
| De seguridad | **Solo** el aviso de las llaves señuelo: si suena, es un intruso, no ruido |

Reglas: los tres tienen el buzón en el celular con notificación, un filtro de
Gmail evita que lo importante caiga en spam, y quien ve una alerta primero la
responde en el grupo para que nadie asuma que ya la atendió otro.
Detalle: `registros-externos.md` (10.3.1) y `revision-mensual.md`.

## 6. Correo (estado final)

Dos dominios con trabajos separados, a propósito: si la reputación de envío se
daña, no arrastra al correo que recibe UVA.

| Dominio | Para qué |
| --- | --- |
| `mail.uvarq.com` | **Enviar** los correos de la plataforma (Resend). Remitente: `UVA <soporte@mail.uvarq.com>`; las respuestas van a `soporte@uvarq.com` |
| `uvarq.com` | **Recibir** `soporte@` y `seguridad@` con Cloudflare Email Routing; el catch-all descarta lo demás |

- Un solo SPF por nombre, DKIM propio del subdominio y DMARC `p=quarantine`
  con reportes a Cloudflare (`_dmarc.mail` creado a mano).
- Los logos de los correos cargan desde `beta.uvarq.com/correo/*`, que tiene
  su propia aplicación de Cloudflare Access con política Bypass.
- Pruebas del 2026-11-10: Gmail y Outlook en bandeja de entrada con SPF, DKIM
  y DMARC en `pass`; mail-tester 10/10.
- Direcciones `soporte@` y `seguridad@`: provisionales hasta que Aleck las
  confirme.

Tabla completa de registros DNS: `correos.md`, sección «Estado final».

## 7. Pendientes de cierre

| Tarea | Responsable |
| --- | --- |
| Probar un correo corporativo (dominio propio) | Aleck o Andrés prestan un buzón; Miguel prueba |
| Confirmar las direcciones públicas de soporte y seguridad | Aleck |
| Limpiar los registros viejos del dominio raíz (`send`, SPF duplicado, `dc-fd741b8612._spfm.send`, DKIM viejo) y quitar `uvarq.com` de Resend, una semana sin envíos desde `noreply@uvarq.com` | Miguel |
| Cambiar la llave de Resend por una limitada a `mail.uvarq.com` | Miguel |
| CSP obligatoria: revisar reportes en Sentry y cambiar la política | Miguel (revisa) y Andrés (cambia `src/proxy.ts`) |
| Constancia de la fase E: fecha de la rotación, revisión de registros desde el 1 de octubre e informe de una página para el CEO | Miguel redacta, Andrés confirma, Aleck aprueba |
| Informe del incidente de Railway (sin buscar culpables) y revisión de `respuesta-a-incidentes.md` | Miguel redacta, Andrés revisa, Aleck aprueba |
| Quitar el dominio `*.up.railway.app` de Railway (a partir del 13 de noviembre) | Miguel |
| Pasar `www.uvarq.com` a la plataforma (etapa 3) | Aleck decide |
| Primer simulacro trimestral | Los tres |

## 8. Dónde está el detalle

| Tema | Documento |
| --- | --- |
| Decisiones que se apartan del plan | `decisiones-de-seguridad.md` |
| Correo: registros, pruebas y limpieza | `correos.md` |
| Alertas, registros externos y destinos | `registros-externos.md`, `canal-alertas.md`, `uptime-monitoring.md` |
| Llaves señuelo y revisión mensual | `revision-mensual.md` |
| Cloudflare y dominio | `cloudflare.md`, `migracion-dns-cloudflare.md`, `etapas-dominio-uvarq.md` |
| Respaldos y restauración | `respaldos-y-restauracion.md` |
| Plan B de despliegue | `plan-b-despliegue.md` |
| Respuesta a incidentes | `respuesta-a-incidentes.md` |
| Protección de `master` | `proteger-master.md` |
