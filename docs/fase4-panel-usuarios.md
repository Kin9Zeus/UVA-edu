# Fase 4 — Panel de usuarios: modelo de datos y métricas

Especificación del modelo para `RevUsuariof4.md`. Ni `functional-spec.md` ni
`technical-spec.md` cubren esta funcionalidad, así que este documento es la
fuente de verdad hasta que se integren.

**Decisión de fondo: no se agregan tablas ni columnas.** Todas las métricas se
derivan de lo que ya existe (`codigos_invitacion`, `suscripciones`, `progreso`,
`inscripciones`). El costo de esa decisión está documentado abajo en cada
métrica, con la mitigación adoptada.

---

## 0. Trazabilidad contra `RevUsuariof4.md`

Cada requisito del documento original y dónde queda especificado aquí.

### Métricas mínimas del MVP

| Requisito | Métrica | Dónde |
|---|---|---|
| Cupos totales, canjeados y disponibles (UI: "invitaciones") | `cupos_totales`, `cupos_canjeados`, `cupos_disponibles`, `cupos_caducados` | §1.3 |
| | `accesos_otorgados_admin` | §1.4 |
| Usuarios registrados | `usuarios_registrados` = `COUNT(perfiles WHERE rol = 'ESTUDIANTE')` | §2.2 |
| …con acceso vigente | `usuarios_acceso_vigente` | §2 |
| …con acceso vencido | `usuarios_acceso_vencido` + `usuarios_sin_acceso` | §2 |
| Usuarios activos (últimos 7 días) | `usuarios_activos_7d` | §3 |
| Cursos con más avance | ranking por `avance_promedio` | §4.2 |
| Lecciones donde la gente abandona | ranking por `abandonos` (corte de 14 días) | §5 |

### Requisitos de calidad

| Requisito | Cómo se cumple | Dónde |
|---|---|---|
| Agregaciones en Postgres, no en el cliente | Vista de métricas + RPC; se reescriben `getUsuarios()` y `cursosPopulares`, que hoy traen todo a JS | §6.1, §6.2, §8 ítems 2-4 y 7 |
| Filtro por rango de fechas | `p_desde`/`p_hasta` sobre `perfiles.creado_en`; solo afecta a la tabla | §6.0, §6.2 |
| Búsqueda por correo | `p_query` + índice GIN de trigramas | §6.2, §9.3 |
| Paginación desde el inicio | `p_limite`/`p_offset` con `count(*) over()` | §6.2, §9.6 |
| Exportación a CSV | Server Action con `requireAdmin()` y bitácora | §7, §9.7, §9.15 |
| Sin datos personales innecesarios en la lista | `celular` fuera; detalle solo al abrir el usuario | §6.3 |

### Definición de "terminado"

| Pregunta que UVA debe poder responder sola | Métrica |
|---|---|
| ¿Cuántos cupos quedan? | `cupos_disponibles` |
| ¿Cuántos invitados entraron? | `cupos_canjeados` + `accesos_otorgados_admin` |
| ¿Cuántos avanzan de verdad? | `usuarios_activos_7d` y el ranking de avance |

**Estado:** los nueve requisitos están especificados **e implementados**
(2026-08-27). El plan de construcción es §8; lo que se construyó y cómo se
verificó, §10.

---

## 1. Cupos gratuitos

Un "cupo" es un uso disponible de un código de invitación. No existe una tabla
de cupos: se derivan de `codigos_invitacion`.

### 1.1 Los canjes se cuentan por la llave foránea, no por `veces_usado`

`codigos_invitacion.veces_usado` es un contador suelto que mantiene
`canjear_codigo_invitacion` (`017_canjear_codigo_invitacion.sql`). Si un canje
falla a medias, el contador miente y nada lo detecta.

Todas las cifras de cupos se calculan contando filas de `suscripciones` por
`id_codigo_invitacion`, que es la relación real. `veces_usado` se sigue
manteniendo para la lógica de canje (validar el tope), pero **no alimenta
ninguna métrica del panel**.

Esto es seguro porque `eliminarCodigoInvitacion` prohíbe borrar un código ya
canjeado (`src/actions/admin/codigosInvitacion.ts`): ninguna suscripción puede
quedar huérfana por el `ON DELETE SET NULL` de la FK.

### 1.2 `limite_usos` obligatorio — YA RESUELTO fuera de esta fase

> **Actualizado tras el commit `43a6fdf` ("Los códigos de invitación otorgan
> días, no planes").** Este apartado describía trabajo pendiente; ya está hecho,
> y mejor de lo que se había planeado.

`limite_usos` es ahora `Int` **NOT NULL** con un `CHECK >= 1` en la base
(`codigos_invitacion_limite_usos_positivo`, migración `20260827000000`). La regla
de negocio quedó fijada como "uso único o con tope, nunca ilimitado", con el
argumento correcto: un código sin tope que se filtra no se puede contener salvo
desactivándolo a mano.

Es más fuerte que lo que este documento proponía —validación en el Server Action
más `NOT NULL`—, porque el `CHECK` también descarta el 0 y los negativos.

**Consecuencias para el resto del documento:** desaparece el ítem 1 del plan
(§8), y la aritmética de 1.3 ya no necesita ninguna cifra de "códigos sin
límite": no pueden existir.

### 1.3 Aritmética

Un código desactivado o vencido con usos sin gastar no es un cupo disponible
(ya nadie puede canjearlo) pero tampoco fue canjeado. Se expone como cuarta
cifra para que la suma cierre:

```
cupos_totales = cupos_canjeados + cupos_disponibles + cupos_caducados
```

| Métrica | Definición |
|---|---|
| `cupos_totales` | `SUM(limite_usos)` sobre todos los códigos emitidos |
| `cupos_canjeados` | `COUNT(suscripciones WHERE id_codigo_invitacion IS NOT NULL)` |
| `cupos_disponibles` | `SUM(limite_usos - usados)` sobre códigos con `activo = true AND fecha_vencimiento > now()` |
| `cupos_caducados` | `SUM(limite_usos - usados)` sobre códigos desactivados o vencidos |

Donde `usados` por código es `COUNT(suscripciones s WHERE s.id_codigo_invitacion = c.id)`.

**Verificado (2026-08-27, tras el seed nuevo de `43a6fdf`):** los 5 códigos
sembrados declaran `SUM(veces_usado) = 21`, pero solo existe **1** suscripción
con `id_codigo_invitacion`. La decisión de contar por FK deja de ser preventiva y
pasa a ser la que evita inflar la cifra veinte veces. Detalle en §9.10.

### 1.4 Accesos otorgados a mano — KPI separado

`otorgarMembresia` (`src/actions/admin/usuarios.ts`) crea suscripciones con
`acceso_manual = true` sin pasar por ningún código. Esos invitados no consumen
cupo, pero sí entraron.

```
accesos_otorgados_admin = COUNT(suscripciones
                                WHERE acceso_manual = true
                                  AND id_codigo_invitacion IS NULL)
```

Va como tarjeta propia, fuera del bloque de cupos. Si se sumara a
`cupos_canjeados` la aritmética de 1.3 dejaría de cerrar.

> **Corrección (commit `43a6fdf`).** Una versión anterior de este documento
> justificaba esta tarjeta diciendo que "6 de 7 accesos gratuitos son otorgados a
> mano". **Ese dato ya no vale**: la base se reseteó con el seed nuevo y hoy hay
> **0** suscripciones otorgadas a mano. El argumento era correcto sobre los datos
> de entonces, no sobre los de ahora.

La tarjeta se mantiene igual, por una razón distinta y más sólida:
`otorgarMembresia` **sigue existiendo** en `src/actions/admin/usuarios.ts:58`. El
camino está abierto aunque hoy nadie lo haya usado, y un acceso concedido por esa
vía sería invisible en el conteo de cupos. Que el seed no lo ejercite no es
garantía de que producción tampoco.

La distinción coincide con `tipoAccesoGratuito()` en `src/lib/estadoAcceso.ts`
(`INVITACION` vs `OTORGADO_ADMIN`), que ya es la fuente de verdad de esas dos
etiquetas en la UI del estudiante y del admin.

---

## 2. Acceso vigente

Vigente = suscripción `ACTIVA`, o `PAST_DUE` dentro del periodo de gracia. Es
exactamente la regla que hoy decide si el usuario entra al contenido, así que
el panel no puede contradecir a la aplicación.

```sql
estado = 'ACTIVA'
or (estado = 'PAST_DUE'
    and fecha_renovacion is not null
    and fecha_renovacion + interval '5 days' > now())
```

`fecha_renovacion` es nullable: `PAST_DUE` sin fecha no tiene gracia que
calcular y cuenta como vencido.

> **Constante duplicada.** Los 5 días son `DURACION_GRACIA_DIAS` en
> `src/lib/gracia.ts`. La vista SQL replica el valor porque no puede importarlo.
> Ambos lados llevan un comentario cruzado: si cambia uno, cambia el otro.

Los usuarios se reparten en tres cubos, no dos — "nunca tuvo acceso" y "se le
venció" son señales distintas para un MVP de invitaciones:

- **Vigente** — cumple la condición de arriba.
- **Vencido** — tuvo al menos una suscripción, ninguna vigente hoy.
- **Sin acceso** — se registró y nunca tuvo suscripción.

Las cortesías por curso (`inscripciones.tipo_acceso = 'CORTESIA'`) **no**
cuentan como acceso vigente: son acceso a un curso suelto, no a la plataforma.

### 2.2 Usuarios registrados

```
usuarios_registrados = COUNT(perfiles WHERE rol = 'ESTUDIANTE')
```

Es el universo sobre el que se calculan los tres cubos, de modo que
`registrados = vigentes + vencidos + sin_acceso`. Si esa suma no cierra, hay un
error en la consulta, no un caso de negocio.

### 2.1 Los administradores quedan fuera de las métricas

Todas las cifras de usuarios (registrados, vigentes, vencidos, sin acceso,
activos en 7 días) filtran `rol = 'ESTUDIANTE'`. El panel mide invitados, no al
equipo de UVA; con 2 administradores sobre 19 perfiles serían 10% de distorsión.

La **tabla** sí los sigue listando, porque es el único lugar desde donde se
administran y ya tiene columna de rol.

Esto obliga a corregir `usuariosRegistrados` en `dashboard.ts:28`, que hoy cuenta
todos los perfiles sin filtrar.

---

## 3. Actividad (últimos 7 días)

Sin campo nuevo. Se deriva de `MAX(progreso.actualizado_en)` por usuario.

```
usuarios_activos_7d = COUNT(DISTINCT id_usuario)
                      FROM progreso
                      WHERE actualizado_en > now() - interval '7 days'
```

Mide avance real de contenido, que es lo que el documento pide medir
("cuántos están avanzando de verdad"). **Limitación aceptada:** quien inicia
sesión, navega el catálogo y se va sin abrir un video figura como inactivo. La
columna se rotula "última actividad en contenido", no "último ingreso", para no
prometer lo que no mide.

`progreso.actualizado_en` es `@updatedAt`, así que se mueve solo con cada
guardado de posición del reproductor.

**Ya hay precedente y coincide.** `usuarioDetalle.ts:94-98` y `178-182` derivan
`ultimaActividad` de la misma fuente (el máximo `actualizado_en` de las filas de
progreso). La métrica agregada usa el mismo criterio que la ficha individual, así
que un usuario que la ficha muestra activo no puede salir inactivo en el KPI.

---

## 4. Cursos con más avance

### 4.1 El denominador NO es `inscripciones`

Corrección al borrador de este documento. Un estudiante con membresía **no
tiene fila en `inscripciones`**: el acceso por suscripción se valida en caliente
contra `suscripciones` y nunca se materializa una inscripción por curso (ver
`tieneAccesoAlCurso` en `src/lib/leccion.ts`, y el bloque que lo compensa en
`usuarioDetalle.ts:111-116`). Solo las cortesías dejan fila.

Los datos lo confirman: **4 inscripciones contra 23 filas de progreso**. Promediar
"sobre los inscritos" habría medido únicamente a los de cortesía e ignorado a
todos los de membresía — es decir, a la mayoría.

**Participantes de un curso = quienes tienen fila en `inscripciones` ∪ quienes
tienen alguna fila de `progreso` en lecciones de ese curso.**

### 4.2 Fórmula

```
lecciones_total   = COUNT(lecciones) del curso (vía modulos)
completadas(u)    = COUNT(progreso WHERE completado = true) del usuario en ese curso
avance_promedio   = AVG(completadas(u) / lecciones_total) sobre los participantes
```

Cursos sin lecciones se excluyen (división por cero).

El punto clave es que `lecciones_total` son **todas** las lecciones del curso, no
solo las que tienen fila en `progreso`.

### 4.3 Esto no es una fórmula nueva: es la que el repo ya usa

`usuarioDetalle.ts:76-93` calcula exactamente así, y su comentario documenta que
corrige un bug que `lib/admin/cursoDetalle.ts` también tenía: contar sobre las
lecciones tocadas hace que quien completó 3 de 4 clases y nunca abrió la cuarta
aparezca al 100%.

`dashboard.ts:96-114` (`cursosPopulares.porcentajeFinalizacion`) es **el último
sitio del panel que conserva ese bug**. No se está eligiendo entre dos criterios
igual de válidos: se está terminando una corrección ya aplicada dos veces.

La lógica es prima de `progreso_cursos_estudiante`
(`033_vista_progreso_cursos.sql`), pero esa vista es `security_invoker` y da una
fila por curso del usuario que consulta, así que no se reutiliza tal cual.

---

## 5. Lecciones donde la gente abandona

```
abandonos(leccion) = COUNT(progreso
                           WHERE completado = false
                             AND actualizado_en < now() - interval '14 days')
```

Ordenado descendente, con el título del curso y del módulo para dar contexto.

**El corte de 14 días es obligatorio, no un adorno.** Sin él la cifra incluye a
quien está viendo esa lección en este momento (§9.8): "abandonado" y "en curso"
quedarían sumados en el mismo número. Dos semanas dejan fuera el falso positivo
más común —alguien que tuvo una semana ocupada— sin tardar tanto en avisar que la
métrica deje de servir para un MVP que está midiendo si los invitados avanzan.

Es una ventana distinta de los 7 días de §3, y a propósito: "sigue activo" y
"abandonó esta lección" no son la misma pregunta.

Es una sola agregación y ya responde "dónde se traban". **Se descartó** el
embudo por orden de lección (más caro y frágil si se reordena el temario) y el
punto de caída dentro del video vía `segundo_actual / duracion` (depende de que
`lecciones.duracion` esté poblada en todas las filas). Ambos quedan como mejora
posterior sin cambio de esquema.

---

## 6. La pantalla: `/admin/usuarios`

Las tarjetas de KPI van **arriba de la tabla existente**, no en una ruta nueva.
Así una sola pantalla responde "quién está usando la plataforma": KPIs, filtros,
tabla paginada y exportación, con el filtro de fechas al lado de lo que filtra.

No se crea `/admin/metricas`: eso dejaría tres sitios (`/admin`,
`/admin/metricas`, `/admin/usuarios`) mostrando cifras de usuarios, que es
exactamente cómo aparecieron las contradicciones que este documento corrige.

`/admin` sigue siendo el resumen de contenido, con su `usuariosRegistrados`
corregido según 2.1 y su `cursosPopulares` según 4.3.

### 6.0 Alcance del filtro de fechas

El rango aplica **solo a la tabla**, sobre `perfiles.creado_en` (fecha de
registro). Los KPIs siempre muestran el acumulado.

Motivo: "cupos disponibles" es un saldo, no un flujo — acotarlo a un rango no
significa nada. Y la "Definición de terminado" pide cifras absolutas ("cuántos
cupos quedan"), no por periodo.

### 6.1 El problema actual

`getUsuarios()` (`src/lib/admin/usuarios.ts`) trae **todas** las filas de
`perfiles`, `suscripciones` e `inscripciones` y las cruza con `Map` en
JavaScript. Tres escaneos completos por carga de página, sin paginación ni
filtros. Es justo lo que el requisito "las agregaciones se calculan en Postgres"
prohíbe.

### 6.2 Reemplazo

Un RPC que replica el patrón ya establecido por `buscar_catalogo`
(`034_busqueda_catalogo.sql`), que es el mismo problema ya resuelto para el
catálogo público:

```
admin_listar_usuarios(
  p_query   text  default null,   -- búsqueda por correo
  p_desde   date  default null,   -- rango sobre perfiles.creado_en
  p_hasta   date  default null,
  p_limite  int   default 25,
  p_offset  int   default 0
)
```

Puntos que se heredan de `buscar_catalogo` y no se reinventan:

- `count(*) over() as total_resultados` en cada fila, para armar la paginación
  sin segunda consulta.
- `security invoker` (sin `SECURITY DEFINER`): RLS sigue aplicando por debajo.
- Desempate estable en el `ORDER BY` (`creado_en desc, id`): sin él, dos
  llamadas con distinto `offset` pueden repetir o saltarse filas.
- Búsqueda con `normalizar_busqueda()` + índice GIN de trigramas, ahora sobre
  `perfiles.correo`.

La app consume `?q=&desde=&hasta=&page=` por `searchParams`, igual que
`/catalogo`.

### 6.3 Datos personales

La lista devuelve: nombre, correo, estado, tipo de acceso, fecha de registro,
cursos inscritos y última actividad.

**Verificado (2026-08-27):** `celular` no aparece en **ningún** archivo bajo
`src/**/admin/`. Solo lo tocan `actions/perfil/actualizar.ts`,
`dashboard/perfil/page.tsx` y `PerfilForm.tsx` — el propio estudiante editando su
perfil. El requisito ya se cumple hoy; queda escrito para que no se agregue por
conveniencia al ampliar el RPC.

La separación lista/detalle también existe ya a nivel de arquitectura:
`getUsuarios()` (lista) y `getUsuarioDetalle()` (`src/lib/admin/usuarioDetalle.ts`)
son consultas distintas, y el detalle solo se ejecuta al abrir `/admin/usuarios/[id]`.

---

## 7. Exportación a CSV

`CLAUDE.md` §3.1 reserva las rutas `/api/` exclusivamente para webhooks
externos, lo que descarta el Route Handler que sería lo natural para una
descarga.

**Resuelto:** un Server Action que devuelve el CSV como string y un componente
cliente que lo convierte en `Blob` y dispara la descarga. Respeta el guardrail
sin rutas nuevas. El único riesgo era el tamaño —y con 19 usuarios en base no
aplica—; si algún día el export se vuelve pesado, el Route Handler vuelve a la
mesa como excepción documentada.

El export usa los mismos filtros que la tabla (búsqueda + rango de fechas), sin
paginación, y **sin `celular`** por la regla de 6.3.

La acción **debe** empezar por `requireAdmin()` y registrar la exportación en
`BitacoraAdministrativa`. Ver §9.15: es un endpoint POST alcanzable por sí mismo
y devuelve el padrón completo de una sola vez.

---

## 8. Trabajo derivado

| # | Cambio | Archivo |
|---|---|---|
| ~~1~~ | ~~`limite_usos` a `NOT NULL`~~ — **ya hecho** en `43a6fdf`, ver §1.2 | — |
| 2 | Vista de métricas del panel | `supabase/sql/036_*.sql` (nuevo) |
| 3 | RPC `admin_listar_usuarios` + índice trigrama en `correo` | `supabase/sql/037_*.sql` (nuevo) |
| 4 | Reescribir `getUsuarios()` sobre el RPC | `src/lib/admin/usuarios.ts` |
| 5 | KPIs + filtros + paginación por `searchParams` | `src/app/(admin)/admin/usuarios/page.tsx` |
| 6 | Export CSV | Server Action nuevo |
| 7 | **Corregir `cursosPopulares`** a la fórmula de 4.2 y eliminar su N+1 | `src/lib/admin/dashboard.ts:89-118` |
| 8 | **Filtrar administradores** de `usuariosRegistrados` | `src/lib/admin/dashboard.ts:28` |
| 9 | Tests | ver abajo |
| 10 | Índices en `perfiles.creado_en` y `progreso.actualizado_en` (§9.3) | `supabase/sql/037_*.sql` |
| 16 | Mostrar "Acceso por invitación" donde `id_plan` es null (§8.bis) | RPC y `usuarios.ts` |
| 11 | Bajar los filtros de rol/estado/suscripción al RPC (§9.4) | `UsuariosTable.tsx`, RPC |
| 12 | Llevar el buscador del header a la URL, con debounce (§9.5) | `SearchContext.tsx` |
| 13 | Componente de paginación reutilizable (§9.6) | extraer de `CatalogoContent` |
| 14 | Quitar el estado local de la tabla (§9.12) | `UsuariosTable.tsx:66,96` |
| 15 | Sesión de administrador + prueba negativa en el arnés RLS (§9.13) | `scripts/rls-test.ts` |

Los ítems 7 y 8 salieron de auditar `dashboard.ts`: sin ellos el panel se
contradice consigo mismo en dos cifras. Los ítems 10-13 salieron de la revisión
del §9. Nada de esto estaba en el borrador inicial.

### Tests

El repo tiene vitest (`npm test`, 12 archivos) y Playwright (`npm run test:e2e`).
Lo mínimo que hay que cubrir:

- **Los 5 días de gracia duplicados** (§2) — el riesgo más alto del diseño, porque
  nada obliga hoy a que `DURACION_GRACIA_DIAS` y el `interval '5 days'` del SQL
  se muevan juntos. `src/lib/gracia.test.ts` ya existe como lugar natural.
- **Aritmética de cupos** (§1.3) — que `totales = canjeados + disponibles +
  caducados` con códigos activos, vencidos y desactivados mezclados.
- **Avance por curso** (§4) — el caso del comentario de `usuarioDetalle.ts`:
  3 de 4 lecciones completadas debe dar 75%, no 100%. Y un participante con
  progreso pero **sin** fila en `inscripciones` debe contar.
- **Coherencia tabla ↔ KPI** (§9.2) — un usuario con `ACTIVA` antigua y `VENCIDA`
  posterior debe salir vigente en ambos sitios, no en uno solo.
- **Escapado del CSV** (§9.7) — un nombre que empiece por `=` no puede salir como
  fórmula.

Ojo con las expectativas contra el seed: por §9.10, `cupos_canjeados` sobre una
base sembrada vale **1**, no los 10 que declara `veces_usado`.

### Aplicación del SQL

Los archivos nuevos de `supabase/sql/` no son migraciones de Prisma: los aplica
`scripts/apply-rls.ts` (`npm run db:rls`), que lee el directorio en orden y corre
**todo dentro de una sola transacción**. Dos consecuencias:

- Nada de sentencias no transaccionables. El índice GIN de trigramas sobre
  `correo` va sin `CONCURRENTLY` — igual que los de `034`, que sientan precedente.
- Los scripts deben ser idempotentes (`drop … if exists` antes de crear,
  `create or replace`). `npm run db:rls:check` los aplica y hace ROLLBACK, así que
  la idempotencia se verifica antes de escribir nada.

> El punto 1 cambia de alcance respecto al borrador: al no haber filas con
> `limite_usos IS NULL` (ver 1.2), incluye migración de Prisma a `NOT NULL`,
> no solo validación.

### Verificación previa — hecha (2026-08-27)

**RLS: sin bloqueos.** Las siete tablas que tocan las métricas tienen política
`SELECT` que contempla `private.es_administrador()`, así que `security invoker`
funciona y no hace falta ningún `SECURITY DEFINER`:

| Tabla | Política `SELECT` |
|---|---|
| `perfiles` | `perfiles_select_propio` — `auth.uid() = id OR es_administrador()` |
| `suscripciones` | `suscripciones_select_propio` — ídem por `id_usuario` |
| `inscripciones` | `inscripciones_select_propio` — ídem por `id_usuario` |
| `progreso` | `progreso_select_propio` — ídem (`028_…`) |
| `codigos_invitacion` | `codigos_invitacion_admin_select` — solo admin |
| `cursos` | `cursos_select_publicos` — `mostrado OR es_administrador() OR …` |
| `modulos` / `lecciones` | heredan la condición de `cursos` vía `EXISTS` |

Importa que `cursos`, `modulos` y `lecciones` incluyan `es_administrador()`: sin
eso, las métricas de avance y abandono habrían ignorado en silencio los cursos
todavía no publicados.

**Volumen actual:** 19 perfiles (2 administradores), 11 suscripciones, 4
inscripciones, 23 filas de progreso, 6 cursos, 29 lecciones. A esta escala el
`getUsuarios()` actual no duele todavía — se cambia por el requisito y porque el
costo crece con cada invitado, no porque hoy se note.

Ese mismo volumen resuelve la decisión pendiente del §7: con 19 usuarios, el CSV
por Server Action es holgadamente suficiente y no hay que forzar la excepción al
guardrail de `/api/`.

---

## 8.bis Impacto del commit `43a6fdf` (revisión posterior)

"Los códigos de invitación otorgan días, no planes", traído por `git pull`
después de escribir todo lo anterior. Toca directamente el modelo de esta fase.

### Qué cambió

| Cambio | Efecto aquí |
|---|---|
| `codigos_invitacion`: **+`duracion_dias`, −`id_plan`** | Neutro para las métricas: los cupos nunca dependieron del plan. |
| `limite_usos` → `NOT NULL` + `CHECK >= 1` | **Elimina el ítem 1 del plan** (§1.2). |
| `suscripciones.id_plan` → **nullable** | La lista y el detalle deben decir "Acceso por invitación" donde no hay plan, no dejarlo vacío. |
| Nuevo `supabase/sql/035_canje_codigo_por_dias.sql` | **La numeración 035 está ocupada.** Los archivos de esta fase son `036` y `037`. |
| Seed reescrito, base reseteada | Invalida las cifras verificadas de este documento (ver abajo). |

### El contexto cambió más que el esquema

El mensaje del commit dice que **el MVP se adelantó al 12 de septiembre** y que
**el acceso pasa a darse solo por códigos de invitación, sin pasarela de pago**.

Dos consecuencias para esta fase:

- **Confirma la decisión de dejar los pagos fuera** (§9.9), y ya no como una
  preferencia sino como el estado real del producto.
- **Sube el peso de los cupos.** Si el único camino de entrada es el código, la
  aritmética de §1.3 deja de ser una tarjeta más y pasa a ser *la* métrica de la
  pantalla. Es exactamente lo que decía `RevUsuariof4.md`.

Con el MVP a dos semanas, conviene que el orden de §8 empiece por lo que responde
la "Definición de terminado" —cupos, acceso, actividad— y deje lo demás después.

### Inconsistencia nueva que conviene no heredar

Los códigos ya razonan en **días** (`duracion_dias`), pero
`otorgarMembresia(usuarioId, planId)` (`actions/admin/usuarios.ts:58`) sigue
razonando en **planes**. Son los dos caminos de acceso gratuito y usan modelos
distintos: el admin que quiera dar 45 días por la vía directa sigue teniendo que
traducirlo a un plan, que es justo la fricción que el commit eliminó del otro lado.

No entra en el alcance de esta fase —el panel solo lee—, pero queda anotado
porque afecta a cómo se rotula esa tarjeta: "otorgados por admin" son accesos con
plan, mientras los cupos son accesos con días.

### Cifras reverificadas (base ya reseteada)

| | Antes (documentado) | Ahora |
|---|---|---|
| perfiles | 19 | **6** |
| suscripciones | 11 | **5** |
| otorgadas a mano | 6 | **0** |
| con código | 1 | 1 |
| códigos | 1 | **6** |
| `SUM(veces_usado)` | 1 | **21** |

**`veces_usado` y el conteo por FK ahora divergen mucho más** (21 contra 1). El
seed nuevo corrigió el primer código —su comentario dice literalmente "1, no 10:
`veces_usado` debe cuadrar con las suscripciones realmente creadas"— pero los
otros cinco declaran usos que no tienen suscripción detrás. Refuerza §1.1: contar
por la llave foránea es lo correcto, y §9.10 sigue vigente con números peores.

**Lo que NO cambió:** `codigos_invitacion.fecha_vencimiento`,
`suscripciones.fecha_renovacion` y `fecha_inicio` siguen siendo `timestamp`
**sin** zona horaria. La migración nueva no los tocó, así que **§9.1 sigue
íntegramente vigente**. Y `scripts/rls-test.ts` sigue sin sesión de administrador
(§9.13), pese a haber pasado de 51 pruebas.

---

## 9. Revisión del plan (2026-08-27)

Hallazgos de auditar el plan contra el código y la base antes de implementar.
Ninguno estaba en las secciones anteriores.

### 9.1 Tres columnas de fecha son `timestamp` sin zona horaria

El resto del esquema usa `timestamptz`, pero **no** estas tres, que son
justamente de las que dependen las métricas:

| Columna | Se usa en |
|---|---|
| `codigos_invitacion.fecha_vencimiento` | cupos disponibles (§1.3) |
| `suscripciones.fecha_renovacion` | ventana de gracia (§2) |
| `suscripciones.fecha_inicio` | suscripción vigente |

Compararlas contra `now()` (que sí es `timestamptz`) provoca un **cast implícito
usando la zona horaria de la sesión**. Hoy funciona por coincidencia: servidor y
sesión están en UTC y la app escribe con `.toISOString()`. Pero es una
coincidencia que nadie declaró y que una sesión con otra `TimeZone` rompe en
silencio, desplazando los cortes de vigencia hasta un día.

**Decisión:** el SQL escribe la conversión explícita
(`fecha_renovacion AT TIME ZONE 'UTC'`) en vez de confiar en el default. No se
migran las columnas: eso toca el flujo de pagos, que está fuera de esta fase.

### 9.2 Ya existe una garantía de "una sola suscripción vigente"

`suscripcion_activa_unica_por_usuario` es un índice UNIQUE parcial sobre
`id_usuario WHERE estado IN ('ACTIVA','PAST_DUE')`. Un usuario no puede tener dos
suscripciones vigentes a la vez.

Eso hace que "la suscripción vigente" esté bien definida, y corrige cómo la tabla
debe elegirla. Hoy `getUsuarios()` toma **la más reciente por `fecha_inicio`**
(`usuarios.ts:25,32`). Si alguien tiene una `ACTIVA` antigua y una `VENCIDA`
posterior, la columna diría "vencido" mientras el KPI (que pregunta por
existencia) lo cuenta como vigente: **el panel contradiciéndose otra vez**.

**Regla:** la fila mostrada es la `ACTIVA`/`PAST_DUE` si existe; si no, la más
reciente. Así columna y KPI no pueden discrepar.

### 9.3 Faltan índices (y uno existente no sirve)

- `perfiles.creado_en` — sin índice, y es el `ORDER BY` y el filtro de rango.
- `progreso.actualizado_en` — sin índice, y es la métrica de activos en 7 días.
- `perfiles_correo_key` es un btree UNIQUE: sirve para igualdad y prefijo, **no
  para `ILIKE '%texto%'`**. El GIN de trigramas de §6.2 no es opcional.

### 9.4 La tabla ya tiene tres filtros que el plan ignoraba

`UsuariosTable` es un client component y filtra en memoria por **rol, estado y
suscripción** (`useState`, líneas 69-86), además del texto.

Con paginación en servidor esos filtros pasan a operar **solo sobre la página
visible**, lo que da resultados simplemente falsos: filtrar por "suspendido"
mostraría los suspendidos de los 25 usuarios cargados, no de todos.

**Los tres tienen que bajar al RPC.** La firma de §6.2 queda:

```
admin_listar_usuarios(
  p_query text, p_desde date, p_hasta date,
  p_rol text, p_estado text, p_suscripcion text,   -- nuevos
  p_limite int, p_offset int
)
```

### 9.5 El buscador no vive en la pantalla, sino en el header

`UsuariosTable` no tiene input propio: recibe el texto de `useAdminSearch()`
(`src/components/admin/SearchContext.tsx`), un contexto de **estado React** que
alimenta el buscador global del header y que **también consume `CursosTable`**.
El mockup lo pide así.

Para buscar en el servidor, ese texto tiene que llegar a la URL. Implica tocar un
componente compartido y añadir debounce (si no, cada tecla es un viaje al
servidor).

**Decidido: se sincroniza el contexto con la URL, de forma aditiva.**
`AdminSearchContext` conserva su estado y además escribe `?q=` con debounce.
`/admin/usuarios` lo lee en el servidor; `CursosTable` ignora la URL y sigue
filtrando en cliente, así que no entra en el alcance de esta fase.

Se conserva el buscador en el header que pide el mockup, y el cambio es
retrocompatible con el único otro consumidor del contexto.

### 9.6 No hay componente de paginación reutilizable

La única paginación del proyecto está incrustada en `CatalogoContent`. Hay que
extraerla a un componente compartido o escribir una nueva.

### 9.7 El CSV necesita tres cosas que no estaban

- **Inyección de fórmulas.** Un `nombre` que empiece por `=`, `+`, `-` o `@` se
  ejecuta como fórmula al abrir el archivo en Excel. Los nombres los escribe el
  usuario, así que es entrada no confiable: hay que prefijar esas celdas.
- **Excel en español** espera `;` como separador y BOM UTF-8; sin ellos las
  tildes se rompen y todo cae en una sola columna.
- **Bitácora.** Exportar datos personales de todos los usuarios debería registrar
  una fila en `BitacoraAdministrativa`. El repo ya usa `registrarBitacora()` para
  acciones bastante menores, como editar un código.

### 9.8 Detalles que darían un fallo silencioso

- La vista de métricas debe declarar **`security_invoker = true`** explícitamente,
  como hace `033`. Una vista normal corre con los permisos de su dueño y se
  saltaría la RLS que §8 da por aplicada.
- "Lecciones donde abandonan" (§5) cuenta `completado = false`, lo que **incluye a
  quien está viendo esa lección ahora mismo**. Sin un corte de antigüedad,
  "abandono" y "en curso" se mezclan en la misma cifra.
- `searchParams` es una `Promise` en esta versión de Next y hay que hacerle
  `await` (precedente en `catalogo/page.tsx:14`).

### 9.9 `development-plan.md` y `RevUsuariof4.md` describen Fases 4 distintas

Segunda pasada de la revisión: no había leído `docs/development-plan.md`, que
CLAUDE.md lista como fuente primaria. Las dos especificaciones no coinciden.

| | Fase 4 según… |
|---|---|
| `development-plan.md:65-73` | "Monetización y Control de Acceso". Panel de suscriptores con **activos, vencidos y pagos fallidos**, más **historial de pagos**. |
| `RevUsuariof4.md` | "Acceso por cupos gratuitos y control de acceso". Cupos, actividad y avance. **Ni una palabra sobre pagos.** |

El Rev reencuadra la fase de monetización a acceso gratuito, coherente con su
propio texto ("la métrica que decide si el producto funciona no es el dinero").
Pero `development-plan.md` no se actualizó.

**No es una fase muerta:** los webhooks de Stripe y Wompi existen
(`src/app/api/webhooks/stripe`, `.../wompi`, `src/lib/stripe/client.ts`). Y **no
existe ninguna ruta `/admin/pagos`**: hoy `PAST_DUE` solo se ve como estado de
suscripción en la tabla de usuarios.

**Decidido: no se implementan pagos por ahora**, ni en el panel ni fuera de él.
El proyecto no aborda esa parte en su estado actual, así que el panel no lleva
KPI de pagos fallidos ni ruta de historial.

Dos consecuencias que conviene tener presentes:

- `development-plan.md` §Fase 4 queda **aplazado, no descartado**. No se edita
  desde aquí: sigue describiendo un objetivo válido para cuando se retomen los
  pagos. Este documento cubre solo la parte de acceso gratuito.
- La lógica de `PAST_DUE` y periodo de gracia de §2 **se mantiene**. El estado
  existe en el enum, en los datos y en `gracia.ts`, y el panel no puede fingir que
  no. Simplemente no se expone como métrica propia.

### 9.10 El seed hará que las cifras "no cuadren" en desarrollo

Consecuencia directa de contar por FK (§1.1), y conviene saberla de antemano:

> **Actualizado con el seed nuevo de `43a6fdf`.** La divergencia no desapareció:
> creció.

- Los 6 códigos sembrados declaran **`SUM(veces_usado) = 21`**.
- Existe **una sola** suscripción con `id_codigo_invitacion`.

En una base sembrada el panel dirá `cupos_canjeados = 1` mientras la pantalla de
códigos suma 21 usos. **No es un bug**: es exactamente la divergencia que §1.1
decidió no heredar. Pero parece roto si no está escrito, y sobre todo: **los tests
contra el seed deben esperar 1, no 21.**

El seed nuevo sí arregló el primer código —su comentario dice "1, no 10:
`veces_usado` debe cuadrar con las suscripciones realmente creadas"—, lo que
confirma que el criterio de §1.1 es el que el propio repo considera correcto. Los
otros cinco códigos siguen declarando usos sin suscripción detrás.

### 9.11 El mockup no cubre tres elementos, no uno

Verificado sobre `design-spec/project/Uva - Panel Admin.dc.html`: no aparece
**ninguna** coincidencia de paginación, exportación ni tarjetas de métricas.

Sin diseño quedan: **las tarjetas de KPI, los controles de paginación y el botón
de exportar**. Antes solo se había anotado el primero.

### 9.12 La tabla guarda estado local que la paginación rompe

`UsuariosTable` hace `useState(usuariosIniciales)` (línea 66) y tras suspender o
activar muta ese estado con `setUsuarios` (líneas 96-98) — aunque
`suspenderActivarUsuario` **ya llama a `revalidatePath("/admin/usuarios")`**
(`actions/admin/usuarios.ts:47`).

Un `useState` inicializado con props no se reinicializa cuando llegan props
nuevas. Hoy eso ya permite que el estado local y el revalidado diverjan; con
filtros y paginación en servidor se rompe de verdad: suspender a alguien con el
filtro "ACTIVO" puesto dejaría su fila visible cuando el servidor ya la excluyó.

**Hay que eliminar `setUsuarios` y apoyarse en la revalidación que ya existe.**

### 9.13 `rls-test.ts` no tiene sesión de administrador

El arnés cubre cuatro sesiones —anónimo, estudiante sin acceso, estudiante con
acceso, y acceso a curso despublicado— y **ninguna de administrador**. Todas las
superficies nuevas de esta fase son admin-only, así que nacerían sin cobertura.

Falta además la prueba **negativa**: que un estudiante autenticado llamando al
RPC no obtenga el padrón completo.

Con `security invoker` no la obtiene (RLS le devuelve solo su fila), y por eso el
SQL debe llevar escrito que **no se convierta a `SECURITY DEFINER`**: sería
convertir una consulta inofensiva en una fuga de todos los usuarios. El grant va
a `authenticated`, siguiendo a `buscar_catalogo`, no a `service_role`.

### 9.14 Convenciones del applier que hay que respetar

De `supabase/sql/README.md`:

- El nombre **debe** ser `NNN_descripcion.sql`. El applier **aborta** si algún
  archivo no lo cumple, porque ordena por el prefijo numérico, no alfabéticamente.
- Hay que correr `npm run db:rls:check` **dos veces** — aplica y hace ROLLBACK.
  Es la forma de demostrar la idempotencia en vez de suponerla; así se cazó el
  fallo de `001`.
- Secuencia completa: `npx prisma migrate deploy` → `npm run db:rls` →
  `npm run test:rls`. Importa para el orden de §8: el `NOT NULL` de `limite_usos`
  es Prisma y va **antes** que la vista que lee esa columna.

**Corroboración de §9.1:** existe `020_actualiza_verificar_certificado_timestamptz.sql`.
El proyecto ya tuvo que emitir una migración para arreglar exactamente esta clase
de bug de zona horaria. No es un riesgo teórico.

### 9.15 El export CSV es la superficie más riesgosa del plan

`AGENTS.md` obliga a consultar `node_modules/next/dist/docs/` antes de escribir
código con APIs de Next. Hecho, y hay dos puntos que cambian cómo hay que tratar
el Server Action del §7:

> "when a Server Action is created and exported, it is reachable via a direct
> POST request, not just through your application's UI (…) you should still treat
> Server Actions as reachable via direct POST requests and verify authentication
> and authorization inside each one."
> — `01-app/02-guides/data-security.md:281,291`

> "A page-level authentication check does not extend to the Server Actions
> defined within it. Always re-verify inside the action."
> — ídem, línea 339

El export devuelve **el padrón completo: nombre y correo de todos los usuarios,
en una sola llamada**, y es un endpoint POST alcanzable por sí mismo. Que
`/admin/usuarios` esté protegida no lo protege a él.

`requireAdmin()` dentro de la acción no es una formalidad heredada del resto del
repo: es lo único que separa esa acción de una fuga del padrón. Mismo criterio
para el `p_limite` del RPC — sin tope, un POST directo pide medio millón de filas.

La misma guía (línea 441) añade: *"Only return what the UI needs, not raw
database records"*, que es la regla de §6.3 dicha por Next.

**Confirmado además:** `cacheComponents` **no** está activado en `next.config.ts`,
así que leer `searchParams` vuelve la página dinámica por sí solo. No hace falta
`export const dynamic` ni interactúa con `use cache`. Un riesgo menos.

**Sentry está integrado** (`withSentryConfig`), así que los errores de la acción y
del RPC salen del proyecto. Los mensajes de error no pueden llevar dentro correos
ni nombres.

### 9.16 La matriz de permisos no contempla esta pantalla

`functional-spec.md` §2.2 lista "Panel Backoffice CMS / CRUD de Cursos" y
"Consulta de Bitácora y Eventos Webhook" como exclusivos de `ADMINISTRADOR`, lo
que cubre esta pantalla por extensión. Pero **no hay ninguna fila sobre consultar
los datos personales de otros usuarios**, que es literalmente lo que hacen la
tabla y el export.

No bloquea nada —el control efectivo son las políticas RLS, ya verificadas—, pero
la matriz debería ganar una fila cuando se actualice la especificación, para que
el permiso quede declarado y no solo implementado.

De paso: el §2.2 y el Módulo 3 siguen describiendo pasarelas de pago y muro de
pago como el camino de acceso. Es la misma desactualización de §9.9, ahora
confirmada por el commit `43a6fdf`.

### Sigue pendiente

- **Tres elementos sin diseño** (§9.11): tarjetas de KPI, controles de paginación
  y botón de exportar. `Uva - Panel Admin.dc.html` no dibuja ninguno. La salida
  razonable es reutilizar el estilo de tarjeta que ese mismo mockup ya define para
  la ficha de usuario, y los tokens de CLAUDE.md §3.3 para el resto. **Es lo único
  que sigue abierto**, y solo afecta a la fase de UI, no a la capa de datos.

### Decidido (2026-08-27)

| Pregunta | Decisión |
|---|---|
| ¿Pagos en el panel? (§9.9) | **No.** El proyecto no implementa pagos por ahora. `development-plan.md` queda aplazado, no descartado. |
| Buscador del header (§9.5) | **Sincronizar el contexto con la URL**, de forma aditiva. Cursos no cambia. |
| Corte de abandono (§9.8) | **14 días** sin tocar la lección. |

---

## 10. Estado de implementación (2026-08-27)

Implementado y verificado. Los cambios **no están subidos a GitHub**.

### Archivos nuevos

| Archivo | Qué es |
|---|---|
| `supabase/sql/036_vistas_metricas_panel.sql` | Vistas `metricas_panel_usuarios`, `avance_cursos`, `abandono_lecciones` |
| `supabase/sql/037_admin_listar_usuarios.sql` | RPC paginado + 3 índices (trigrama en `correo`, `perfiles.creado_en`, `progreso.actualizado_en`) |
| `src/lib/admin/metricas.ts` | Lectura de las tres vistas |
| `src/lib/csv.ts` + `src/lib/csv.test.ts` | Escapado CSV y neutralización de fórmulas |
| `src/actions/admin/exportarUsuarios.ts` | Server Action de exportación |
| `src/components/admin/MetricaCard.tsx` | Tarjeta de KPI |
| `src/components/Paginacion.tsx` | Paginación compartida |

### Archivos modificados

| Archivo | Cambio |
|---|---|
| `src/lib/admin/usuarios.ts` | Reescrito sobre el RPC; devuelve `ResultadoUsuarios` con total y páginas |
| `src/lib/admin/dashboard.ts` | `cursosPopulares` usa `avance_cursos` (fin del N+1 y de la fórmula que inflaba); `usuariosRegistrados` filtra `ESTUDIANTE` |
| `src/components/admin/usuarios/UsuariosTable.tsx` | Filtros a la URL, sin estado local, paginación, export, columna de actividad |
| `src/components/admin/SearchContext.tsx` | Sincroniza `?q=` con debounce, solo en las rutas que filtran en servidor |
| `src/app/(admin)/admin/usuarios/page.tsx` | `searchParams`, 4 KPIs y los dos rankings |
| `src/app/(admin)/admin/page.tsx` | Usa `MetricaCard` |
| `src/components/catalogo/CatalogoContent.tsx` | Usa `Paginacion` |
| `src/lib/gracia.ts` | Exporta `DURACION_GRACIA_DIAS` y documenta la duplicación en SQL |
| `src/lib/gracia.test.ts` | Test que falla si el `interval` del SQL se separa de la constante |
| `scripts/rls-test.ts` | Sesión de administrador + pruebas negativas del panel |

### Verificación

| Comprobación | Resultado |
|---|---|
| `npm run db:rls:check` ×2 | 38 scripts, idempotentes |
| `npx tsc --noEmit` | Sin errores |
| `npm run lint` | Limpio |
| `npm run build` | Compila |
| `npm test` | 118/118 (antes 103) |
| `npm run test:canje` | 12/12 |
| `npm run test:rls` | 57/57 (antes 51) |

Las dos pruebas que más importan, ambas en verde contra la base real:

- Un estudiante autenticado que invoca `admin_listar_usuarios` recibe **1 fila —la suya—**, no el padrón. Es lo que confirma que `security_invoker` hace su trabajo y lo que fallaría si alguien convirtiera el RPC a `SECURITY DEFINER`.
- Las dos invariantes aritméticas cierran: `cupos_totales = canjeados + disponibles + caducados` (111 = 1 + 40 + 70) y `registrados = vigentes + vencidos + sin acceso` (7 = 4 + 1 + 2).

### Sin verificar

El render de la pantalla en el navegador. Requiere iniciar sesión y no escribo
contraseñas en formularios, ni siquiera las de prueba del seed. Todo lo demás
—tipos, build, consultas contra la base real y RLS con sesiones reales— sí está
comprobado.

### Revisión de la UI de KPIs (2026-08-27)

La primera versión de las tarjetas no se entendía. Tres problemas y su arreglo:

1. **"Cupos" es jerga.** Viene de `RevUsuariof4.md`, pero nadie piensa en cupos:
   piensa en invitaciones y en personas. **La interfaz dice ahora
   "invitaciones"**; los nombres internos (`cupos_*` en el SQL y en
   `metricas.ts`) se conservan para no separarse de la especificación ni de la
   base.
2. **La tarjeta de canjeados llevaba "70 caducados sin usar" como subtítulo**,
   una cifra sin relación con la de arriba. Se mezclaba un número de decisión
   con uno de cuadre contable.
3. **"Caducados" no ayudaba a decidir nada.** Existe para que la resta cierre.

Las cuatro tarjetas ahora responden, en ese orden, las tres preguntas de la
"Definición de terminado": *invitaciones sin usar*, *personas que entraron*
(las dos vías sumadas, con el desglose en el subtítulo), *con acceso hoy*,
*avanzando esta semana*.

El cuadre (`emitidas = usadas + sin usar + caducadas`) baja a una línea de
apoyo, para que la resta siga siendo auditable sin competir por la atención.

Y cuando las caducadas superan a las disponibles aparece un aviso con enlace a
`/admin/codigos`: una invitación caducada es una persona a la que se quiso
invitar y no entró, así que por encima de cierto punto deja de ser contabilidad
y pasa a ser algo que corregir.

### Corrección: la búsqueda también por nombre (2026-08-27)

Al mover el filtrado al servidor, el RPC buscaba **solo por correo** —que es lo
único que exige `RevUsuariof4.md`—, pero la tabla en cliente buscaba por nombre
**o** correo, y el placeholder del header sigue diciendo "Buscar por nombre o
correo". Era una regresión silenciosa con la interfaz prometiendo lo contrario.

`admin_listar_usuarios` busca ahora sobre ambos campos, con un segundo índice
GIN de trigramas sobre `nombre`. Verificado contra la base: "mejia" encuentra a
*Laura Mejía* y "SIMON" a *Simón Uribe* — insensible a tildes y mayúsculas por
`normalizar_busqueda()`.
