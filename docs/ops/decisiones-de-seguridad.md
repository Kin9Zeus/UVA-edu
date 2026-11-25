# Decisiones de seguridad que se apartan del plan de blindaje

Plan de blindaje de Aleck (2026-10-23). Aquí queda escrito lo que el equipo
decidió **no hacer ahora** y por qué, para que una revisión futura no lo
cuente como olvido. Cada decisión lleva una condición para volver a mirarla.

## 1. Separar la llave maestra del servidor público (fase 7)

**Estado:** aplazado hasta después del lanzamiento (decisión del equipo,
2026-11-10).

**Qué pide el plan.** La `SUPABASE_SERVICE_ROLE_KEY` se salta toda la RLS.
Hoy vive en el mismo servidor de Railway que atiende internet. El plan pide
moverla a un servicio interno aparte, sin dominio público, y que la web
pública solo use la llave normal. También pide roles de base distintos para
migraciones y para scripts de mantenimiento, y evaluar un gestor de
secretos (Infisical o Doppler).

**Riesgo que se acepta.** Una ejecución remota de código en la web pública
entregaría la llave maestra y, con ella, toda la base.

**Por qué se aplaza.**
- Es una reestructura grande: hay 31 usos de la llave maestra en el código.
- Producción solo tiene datos de prueba, así que el daño real hoy es bajo.
- Ya hay capas que lo reducen: Cloudflare delante, origen cerrado
  (`ORIGEN_SECRETO`), `server-only` en los clientes sensibles, los 31 usos
  justificados con prueba, y alertas en Better Stack y Sentry.

**Cuándo se vuelve a mirar.** Antes de abrir el registro público o el cobro
(lo mismo que la prueba de penetración externa del plan). Con usuarios
reales el riesgo deja de ser bajo.

**Mejora barata mientras tanto (opcional).** Pasar a las llaves nuevas de
Supabase (`sb_secret_`), que se revocan una por una sin rotar el secreto
JWT y se pueden limitar a un servicio. No resuelve el problema de fondo,
pero hace la próxima rotación más rápida.

## 2. Aprobaciones obligatorias en master (fase 9, punto 9.7)

**Estado:** no se exigen (decisión del equipo).

**Qué pide el plan.** `CODEOWNERS` con revisión de los dos para
`supabase/sql/`, `src/proxy.ts`, `src/lib/csp.ts`, `src/lib/supabase/` y
`.github/`.

**Qué hay hoy.** El ruleset «Proteger master» exige PR y los 4 checks del CI,
con 0 aprobaciones y sin «Require review from Code Owners». `CODEOWNERS`
existe (`.github/CODEOWNERS`) y sirve de aviso en el PR, pero **no bloquea**.

**Riesgo que se acepta.** Un cambio en esas rutas puede mezclarse sin que lo
vea una segunda persona. Lo cubren el CI (tipos, pruebas, RLS, gitleaks,
CodeQL) y que master pasa siempre por un PR.

**Cuándo se vuelve a mirar.** Si el equipo crece o antes del lanzamiento. Se
activa en Settings → Rules → «Proteger master»: «Require review from Code
Owners» y «Required approvals».

## 3. Environment `supabase-test` sin revisores y sin límite a master (fase 9, punto 9.4)

**Estado:** a propósito (decisión del equipo, 2026-11-06).

Los revisores frenaban cada PR, y limitarlo a master hace que GitHub rechace
el job en cada PR (las pruebas de RLS dejarían de correr antes de mezclar).
El riesgo que ese límite cubría ya está cubierto: sus secretos son de
**staging**, no de producción. Detalle en `.github/workflows/ci.yml`.

## 4. Tareas aplazadas porque la plataforma aún no tiene usuarios reales

**Estado:** decisión del equipo, 2026-11-10. Hoy producción solo tiene datos
de prueba y un curso de demostración. El curso se puede volver a cargar, el
esquema y la RLS se reconstruyen desde el repo (migraciones de Prisma y
`supabase/sql/`) y los videos viven en Mux, no en Supabase. Perder la base
hoy cuesta unas horas, no datos de nadie.

**Regla:** nada de esta tabla bloquea cerrar la fase de blindaje en lo
técnico. **Todo se hace antes de abrir el registro público o el cobro**, y el
primero que llegue manda.

| Tarea | Por qué puede esperar | Qué hay que hacer antes del lanzamiento |
| --- | --- | --- |
| Respaldo propio fuera de Supabase (fase 11.3) | Sin datos irrecuperables. Supabase Free no tiene respaldos, pero no hay nada que perder | Crear el environment `respaldo-produccion` (solo master) con sus secretos, crear `respaldo_lector` en producción, correr el primer respaldo y comprobar el archivo en R2. Procedimiento en `respaldos-y-restauracion.md`, Parte D |
| Restauración probada en staging | Depende del anterior | Restaurar el primer respaldo en staging y anotar el resultado. **Un respaldo que nunca se restauró no cuenta** |
| Plan B de despliegue probado (fase 11.2) | Sin usuarios no hay servicio que mantener vivo | Levantar la plataforma desde staging en otro proveedor, en menos de 2 horas, y llenar la tabla de `plan-b-despliegue.md` |
| Copia de los buckets de Storage al respaldo (avatares, adjuntos, portadas, materiales) | Hoy solo hay archivos de prueba | Copiarlos a `uva-respaldos` en R2. Se pospuso por decisión del equipo; no es un olvido |
| Prueba de penetración externa | El plan la pide antes del registro o del cobro | Contratarla y corregir lo crítico que salga |
| Alertas por IP y de administrador de madrugada (fase 10.3) | Con tráfico de prueba no se puede fijar un umbral útil | Dejar correr las alertas actuales unas semanas con usuarios reales, ver el ruido y crear estas dos |
| Contraseñas filtradas (8.4) | Es una función del plan Pro de Supabase | Activarla si se contrata Pro. Mientras tanto rige el mínimo de 10 caracteres con complejidad |
| Separar la llave maestra del servidor público | Ver sección 1 | Ver sección 1 |

## 5. Riesgos aceptados por Miguel (2026-11-09)

Registrados en `operacion.md` y repetidos aquí para que no vuelvan como
hallazgo:
- **No rotar `ORIGEN_SECRETO`** aunque una captura mostró su comienzo (unos 30
  de 64 caracteres; el resto sigue siendo inadivinable). Rotarlo si se vuelve
  a compartir una captura con valores (`cloudflare.md`, sección 7).
- **No cambiar `TRUSTED_PROXY_HOPS`.** Los eventos `origen_rechazado` registran
  la IP de la entrada de Railway, no la del atacante. Para esa alerta solo
  importa contar, no quién. El tráfico normal usa `CF-Connecting-IP`.
- **Sin restricción por IP en Postgres**, porque la IP de quien administra es
  dinámica. No está en el criterio de terminado de la fase 5.

## 6. Llave de Gemini compartida y sin topes de gasto (P2-8, AUDIT-2026-11-23)

**Estado:** riesgo aceptado y cerrado (decisión del equipo, 2026-11-25).
**Una auditoría no lo vuelve a reportar como hallazgo.**

**Qué se aceptó.**
- La misma `GEMINI_API_KEY` sirve en staging y en producción.
- Ningún proveedor con cobro por uso (Gemini, Mux, Resend, Railway,
  Supabase) tiene un tope o una alerta de gasto configurada. El checklist
  de `limites-de-gasto.md` queda como guía, no como pendiente.

**Por qué.** No hay usuarios reales, y el gasto lo puede disparar solo un
administrador o un bug. La app ya pone un tope de 15 generaciones de examen
por hora a cada administrador (`supabase/sql/107`), y el equipo revisa la
facturación de cada proveedor.

**Si cambia algo.** Si una factura sale fuera de lo normal, se separa la
llave por entorno y se activan las alertas del proveedor afectado. Es
decisión del equipo, no un pendiente de auditoría.
