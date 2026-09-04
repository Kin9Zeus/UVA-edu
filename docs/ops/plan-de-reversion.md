# Plan de reversión

Cómo volver atrás si un despliegue sale mal, quién lo decide, y por qué las
migraciones de base de datos son la parte que de verdad puede salir mal.

## Cómo revertir en Railway

Railway guarda el historial de despliegues de cada servicio. Revertir es
**redesplegar un build anterior** desde la pestaña *Deployments* del
servicio (o `railway redeploy` desde el CLI si el equipo lo usa) — no es un
build nuevo, así que no vuelve a compilar: solo cambia a qué contenedor ya
construido apunta el tráfico.

- **Tiempo estimado:** segundos a ~1 minuto (el tiempo de arrancar el
  contenedor anterior y que pase el healthcheck de Railway — ver
  `GET /api/health`, Módulo 2 — no el tiempo de un build).
- **Importante:** esto revierte el **código**, nunca la base de datos. Si
  el despliegue que se revierte ya corrió una migración, esa migración
  sigue aplicada — el código viejo vuelve a correr contra un esquema que ya
  cambió. Por eso la sección de migraciones de más abajo no es una
  formalidad: es la diferencia entre que el rollback arregle el incidente o
  lo empeore.
- Ya existe un proyecto de Railway desplegado (confirmado vía Sentry:
  eventos reales en `environment: production` contra
  `uva-edu-production.up.railway.app`), aunque todavía no en el dominio
  final. Sigue sin haber archivo de configuración en este repo (sin
  `railway.json`, sin `Procfile`) — los pasos exactos de la pestaña
  *Deployments* hay que confirmarlos contra ese proyecto real la primera
  vez que se necesite un rollback de verdad, no se pueden verificar desde
  acá.

## Criterios que disparan una reversión (vs. arreglar en caliente)

**Revertir de inmediato, sin intentar diagnosticar en producción primero:**
- El recorrido crítico está roto para cualquier usuario: no se puede
  iniciar sesión, canjear un código, reproducir un video comprado, o pagar.
- Cualquier indicio de fuga de datos o de acceso saltándose RLS.
- El sitio no responde (`/api/health` en `503` o sin respuesta — Módulo 2)
  y la causa no se identifica en los primeros minutos.

**Arreglar en caliente, sin revertir:**
- Un bug aislado a una función secundaria (ej. un filtro del catálogo, un
  detalle visual) que no bloquea comprar, aprender ni certificarse.
- Algo que ya tiene un rodeo conocido y documentado (mismo criterio que
  `docs/qa/bugs-e2e.md` usa para clasificar severidad "Media"/"Baja").

La pregunta que decide no es "¿qué tan grave se ve el error en Sentry?"
sino **"¿alguien no puede completar el recorrido crítico ahora mismo?"**

## Migraciones: por qué no se revierten solas

Railway revierte el código, no la base de datos (ver arriba) — así que
toda migración que se despliegue durante la ventana de lanzamiento debe
ser compatible con el código **anterior** también, no solo con el nuevo:

- **Sí:** agregar una columna nueva (`nullable` o con `DEFAULT`), agregar
  una tabla nueva, agregar un índice.
- **No, durante la ventana de lanzamiento:** `RENAME COLUMN`, `RENAME
  TABLE`, `DROP COLUMN`, `DROP TABLE` — cualquiera de estos dejaría al
  código anterior (el que Railway serviría en un rollback) buscando algo
  que ya no existe con ese nombre.

Esto no queda solo en este párrafo: `npm run verificar:migraciones-reversibles`
compara las migraciones nuevas de la rama contra `origin/master` y falla
si encuentra un `DROP`/`RENAME` agregado — corre en el job `checks` de
`ci.yml` en cada PR, igual que `tsc`/`lint`/`test`. Si algún día hace falta
un DROP/RENAME real y consciente (asumiendo el riesgo), es una excepción
deliberada que debe coordinarse con quien decide reversiones (ver abajo)
antes de mergear — el chequeo está para que eso sea una decisión explícita,
no un descuido.

## Quién decide revertir

Con tres personas en el equipo, decide **Aleck**. Cualquiera puede levantar
la alerta (Sentry, el chequeo de disponibilidad, un reporte de usuario),
pero la decisión de revertir vs. arreglar en caliente la toma una sola
persona para no perder tiempo coordinando en medio de un incidente.
