# Plan — Notas con marca de tiempo ("Mis notas")

> Estado: **fases 1 y 2 implementadas y aplicadas en la base de producción** (2026-09-21): tabla, `supabase/sql/115`-`117`, pestaña Notas, "Todo el curso", `?t=`, "Mis notas" y aviso del CMS. Fase 3 (búsqueda) sin empezar. Este documento es la referencia única de la funcionalidad.
> Fecha: 2026-09-21.

## 1. Qué es y por qué

El estudiante escribe una nota privada anclada a un segundo exacto del video de una clase ("03:24 — el APU se divide por rendimiento, no por cantidad"). Al tocar la nota, el video salta a ese segundo. Es el mismo concepto que las notas de Udemy.

Por qué encaja en U.V.A.:

- Los cursos son técnicos (presupuestos, APU, Excel, V-Ray): el estudiante necesita guardar un dato, una fórmula o un paso y volver a ese punto exacto.
- Hoy la única superficie de escritura en la clase son los **comentarios**, que son públicos. No hay un lugar privado.
- Casi toda la infraestructura ya existe (ver §2), así que el costo es bajo.

**Fuera de alcance de este documento:** notas compartidas o públicas, notas del instructor, resaltado sobre la transcripción, notas sin conexión (ver §11).

## 2. Diagnóstico (lo que ya existe)

| Pieza | Dónde | Cómo se reutiliza |
|---|---|---|
| Posición actual del video | `VideoPlayer.tsx` (`posicionRef`, `mediaRef`) | Fuente del segundo al crear la nota. Hoy es interna al componente. |
| Salto a un segundo | `VideoPlayer.tsx` (`startTime`, solo al montar) | Hay que añadir un salto imperativo (§6.2). |
| Pestañas de la clase | `PlayerTabs.tsx` (`TabsHeader`: Recursos, Resumen, Comentarios) | Se añade la pestaña **Notas**. |
| Editor con formato | `NuevoComentarioForm` + `lib/formato-texto.tsx` (`serializarEditor` / `renderizarTextoFormateado`, sin `dangerouslySetInnerHTML`) | Mismo formato y mismo renderizador; no se introduce HTML crudo. |
| Patrón de Server Action | `actions/comentarios/crear.ts` (zod, `getUsuarioActual`, error claro antes de RLS) | Mismo patrón para crear/editar/eliminar. |
| Reglas de escritura en RLS | `private.correo_verificado()`, `private.cuenta_activa()` (019), `private.tiene_acceso_vigente_curso()` (038), `lecciones.es_introductoria` (076) | Misma policy de INSERT que `progreso` (076). |
| Datos privados por usuario y lección | `progreso` (único por `id_usuario, id_leccion`) | Modelo de referencia para la tabla y los índices. |
| Supresión de cuenta | `private.anonimizar_usuario()` (111) | Hay que añadir el borrado de notas (§8). |
| Exportación Habeas Data | `actions/perfil/exportar-datos.ts` | Hay que añadir las notas (§8). |
| Carga de la página de la clase | `app/(public)/cursos/[cursoSlug]/[leccionSlug]/page.tsx` | Las notas se cargan en paralelo a los comentarios. |

Lo genuinamente nuevo: la tabla, sus policies, un control imperativo del reproductor y la UI de la pestaña.

## 3. Decisiones

### 3.1 Cerradas (recomendadas por este análisis)

| Tema | Decisión | Por qué |
|---|---|---|
| Alcance de una nota | Pertenece a **una lección** | El segundo solo tiene sentido dentro de un video. La vista "todo el curso" es una consulta, no otro modelo. |
| Visibilidad | **Privada**: solo su autor | Sin moderación, sin exposición pública, sin datos de terceros. |
| Administradores | **No** pueden leer notas ajenas | Mínimo privilegio. Rompe a propósito el patrón habitual "propio **o** admin": no hay ninguna operación de negocio que lo necesite, y son apuntes personales. Soporte no las requiere. |
| Crear una nota | Exige lo mismo que guardar progreso: correo verificado, cuenta activa y (acceso vigente al curso **o** lección introductoria) | Coherente con `progreso_insert_propio` (076). |
| Leer, editar, eliminar | El autor, **sin** exigir acceso vigente | Si la suscripción vence, el estudiante conserva y puede borrar sus apuntes. Borrar datos propios nunca se debe bloquear. |
| Dónde ve sus notas quien **ya no tiene acceso** | En la página **"Mis notas"** del dashboard (§6.6), no en la clase | Sin acceso vigente, `page.tsx` de la clase redirige a la ficha del curso (líneas 54-74): el reproductor, y con él la pestaña Notas, no se puede abrir. "Mis notas" vive fuera del muro de pago, así que es el único lugar desde donde esas notas son alcanzables. |
| Formato | El mismo de los comentarios (negrita, cursiva, subrayado, listas) | Reutiliza editor y renderizador ya revisados. |
| Largo máximo | 2.000 caracteres (igual que comentarios), con `CHECK` en la base | Validación en el borde **y** en la base. |
| Tope por lección | 200 notas por usuario y lección, con trigger | Evita agotar almacenamiento. No hace falta rate limit por tiempo: es contenido privado, no genera costo externo ni notificaciones. |
| Borrado | **Físico** (`DELETE`) | A diferencia de comentarios, no hay hilo que conservar. |
| Formato del tiempo | `mm:ss`, o `h:mm:ss` si pasa de una hora, en `font-mono` | CLAUDE.md §3.3: duraciones en JetBrains Mono. |

### 3.2 Decididas por producto (2026-09-21)

| # | Pregunta | Decisión |
|---|---|---|
| D1 | Si un admin **elimina una lección**, ¿qué pasa con las notas de los estudiantes? | **Se borran** (`ON DELETE CASCADE`, igual que `progreso`). El CMS muestra antes de confirmar: "N estudiantes tienen notas en esta clase; se eliminarán". |
| D2 | ¿Página global "Mis notas" en el dashboard? | **Sí, en la fase 2**, sin búsqueda. Pasa de "opcional" a necesaria porque es la única forma de que un estudiante sin acceso vigente vea sus notas (ver §3.1). La búsqueda queda para la fase 3. |
| D3 | ¿Pausar el video al empezar a escribir una nota? | **Sí**, como Udemy. Se reanuda al guardar o cancelar si estaba reproduciéndose. |

## 4. Modelo de datos

### 4.1 Prisma (`prisma/schema.prisma`)

```prisma
model NotasLeccion {
  id               String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  id_usuario       String   @db.Uuid
  id_leccion       String   @db.Uuid
  /// Segundo del video al que apunta la nota. Entero: la UI no ofrece
  /// precisión menor y el progreso ya se guarda en segundos enteros.
  segundo          Int
  contenido        String
  /// `id_video_mux` de la lección al momento de crear la nota. Si el admin
  /// reemplaza el video, deja de coincidir y la UI avisa que el minuto
  /// puede no corresponder (§6.5). Mismo problema que resuelve el reinicio
  /// del punto de reanudación en VideoUploader.
  id_video_mux     String?
  creado_en        DateTime @default(now()) @db.Timestamptz
  actualizado_en   DateTime @updatedAt @db.Timestamptz

  usuario Perfiles  @relation(fields: [id_usuario], references: [id])
  leccion Lecciones @relation(fields: [id_leccion], references: [id], onDelete: Cascade)

  /// Cubre las dos lecturas: notas de una clase ordenadas por segundo, y
  /// notas de un curso (id_leccion IN (...)) del mismo usuario.
  @@index([id_usuario, id_leccion, segundo])
  /// FK y borrado en cascada al eliminar una lección.
  @@index([id_leccion])
  @@map("notas_leccion")
}
```

Relaciones inversas a añadir: `notas NotasLeccion[]` en `Perfiles` y en `Lecciones`.

Migración: `prisma/migrations/2026092xxxxxxx_notas_leccion/`. Solo `CREATE TABLE`, índices y FKs: no toca tablas existentes, así que es aditiva y reversible con `DROP TABLE notas_leccion`.

### 4.2 SQL de Supabase (`supabase/sql/115_notas_leccion.sql`)

Se aplica con `npm run db:rls`, **después** de la migración de Prisma y de 000-114.

- `CHECK (segundo between 0 and 86400)`.
- `CHECK (char_length(contenido) between 1 and 2000)`.
- `actualizado_en` con `DEFAULT now()` y el trigger `private.actualiza_actualizado_en()` (mismo patrón que `curso_calificaciones`, 102: `@updatedAt` de Prisma no llega a la base cuando se escribe con supabase-js).
- Trigger `BEFORE INSERT` que rechaza la nota 201 de un mismo `(id_usuario, id_leccion)` con un `errcode` propio, que la Server Action traduce a un mensaje claro.
- Trigger `BEFORE INSERT` que fija `id_video_mux` desde `lecciones`, para que el cliente no pueda mandarlo.
- Privilegio por columna: el `UPDATE` solo permite `contenido` y `segundo`. `id_usuario`, `id_leccion` e `id_video_mux` son inmutables.

## 5. Seguridad (RLS)

```text
notas_leccion
  SELECT  (select auth.uid()) = id_usuario
  INSERT  (select auth.uid()) = id_usuario
          and private.correo_verificado() and private.cuenta_activa()
          and (tiene_acceso_vigente_curso(curso de la lección) or lección es_introductoria)
  UPDATE  USING y WITH CHECK: (select auth.uid()) = id_usuario and private.cuenta_activa()
  DELETE  (select auth.uid()) = id_usuario
  anon    sin ninguna policy (ni lectura ni escritura)
```

- `auth.uid()` envuelto en `(select ...)` para que Postgres lo evalúe una vez por consulta (patrón de 056).
- `id_usuario` sale siempre de la sesión en la Server Action, nunca del cliente.
- Las Server Actions validan con zod antes de llegar a la base (UUIDs, `segundo` entero y en rango, contenido de 1 a 2.000 caracteres) y devuelven errores claros en vez del error crudo de RLS.
- No hay `SECURITY DEFINER` nuevo, salvo los triggers, que no reciben datos del cliente más allá de la fila.

## 6. Experiencia de usuario

### 6.1 Dónde vive

| Lugar | Qué muestra | Fase |
|---|---|---|
| **Escritorio:** panel de la derecha (debajo de Progreso), con píldoras **Comentarios / Notas** (`PanelLateralHeader`). **Celular:** pestaña **Notas** bajo el video, después de Comentarios | Formulario de nueva nota y lista de notas de la clase, ordenadas por segundo | 1 |
| Selector **"Esta clase / Todo el curso"** dentro de la pestaña | Notas del curso agrupadas por clase, en orden del temario | 2 |
| Página **"Mis notas"** en el menú del dashboard (`Sidebar.tsx`) | Todas las notas del estudiante agrupadas por curso y clase (§6.6) | 2 (D2) |
| Búsqueda dentro de "Mis notas" | Filtrar por texto | 3 |

En escritorio, notas y comentarios comparten la tarjeta de la derecha y se alterna entre ellos como entre Recursos y Resumen bajo el video (decisión de producto, 2026-09-21). Así la nota se escribe viendo el video al lado. Comentarios es la opción por defecto.

La pestaña no se muestra en la vista previa sin sesión (`LeccionVistaPreviaContent`), igual que Comentarios.

### 6.2 Control del reproductor

`VideoPlayer` hoy no expone la posición ni permite saltar. Se añade un control mínimo, provisto por `PlayerContent` a través de un contexto de React:

```ts
type ControlReproductor = {
  segundoActual(): number;      // lee posicionRef, sin re-render
  irA(segundo: number): void;   // mediaRef.currentTime = segundo
  pausar(): void;
  reanudar(): void;
  estaReproduciendo(): boolean;
};
```

- Leer la posición no debe provocar re-renders en cada `timeupdate` (varias veces por segundo). El texto "Agregar nota en 03:24" se actualiza con un intervalo de 1 s, solo mientras la pestaña Notas está visible.
- Si el video aún no está listo (sin token o `videoListo = false`), el botón de nueva nota se deshabilita con un texto que lo explica.

### 6.3 Crear, editar, eliminar

1. "Agregar nota en **03:24**": al enfocar el editor se congela ese segundo y se pausa el video (D3).
2. Guardar: nota nueva en la lista, en su posición por segundo. El video se reanuda si estaba reproduciéndose.
3. Editar: se cambia el texto. El segundo puede ajustarse con "Usar el minuto actual".
4. Eliminar: con confirmación en línea ("¿Eliminar nota? Sí / No"), no un `confirm()` del navegador.
5. Actualización optimista con reversión si la Server Action falla, igual que los likes de comentarios.

### 6.4 Saltar al minuto

- Nota de **esta clase**: `irA(segundo)` y se lleva el foco al reproductor.
- Nota de **otra clase** (fase 2): navegar a `/cursos/<curso>/<leccion>?t=<segundo>`. `page.tsx` lee `t`, lo valida (entero, `0 ≤ t ≤ duración`) y lo pasa a `VideoPlayer`, donde tiene prioridad sobre `segundo_actual` del progreso **solo para esa carga**.
- Si `segundo` es mayor que la duración actual del video, se salta al final y se muestra el aviso de §6.5.

### 6.5 El video cambió

Si `nota.id_video_mux` no coincide con el `id_video_mux` actual de la lección, la nota muestra: "El video de esta clase se actualizó después de que escribiste esta nota; el minuto puede no coincidir." La nota no se borra ni se mueve.

### 6.6 Página "Mis notas" (`/dashboard/notas`)

Vive en el dashboard, fuera del muro de pago, y funciona igual con o sin acceso vigente.

- Notas agrupadas por curso y, dentro de cada curso, por clase en orden del temario, cada una con su minuto.
- Se pueden **leer, editar y eliminar** siempre.
- El minuto de cada nota se comporta según el acceso al curso:
  - **Con acceso:** enlace a `/cursos/<curso>/<clase>?t=<segundo>` (§6.4).
  - **Sin acceso:** el minuto se muestra como texto, sin enlace, y el grupo del curso lleva un aviso "Tu acceso a este curso terminó. Renueva para volver a ver las clases" con enlace a `/dashboard/planes`. No se ofrece un enlace que solo terminaría redirigiendo a la ficha.
- El acceso por curso se resuelve una vez por curso (no por nota) con `obtenerAccesoAlCurso`, el único punto que decide el muro (`src/lib/accesoCurso.ts`).
- Estado vacío: "Aún no tienes notas. Mientras ves una clase, abre la pestaña Notas para guardar un apunte en el minuto exacto."
- Consulta: una sola lectura de `notas_leccion` del usuario con `leccion:lecciones(titulo, slug, orden, modulo:modulos(orden, curso:cursos(id, titulo, slug)))`, que RLS ya limita a sus filas. Paginada por curso si el volumen lo exige; con los topes de §3.1 no se espera al inicio.

Ficha del curso (opcional, fase 2): a quien tiene notas en un curso sin acceso vigente, junto al botón de renovar, "Tienes N notas en este curso" con enlace a "Mis notas". Es a la vez un recordatorio útil y un incentivo honesto para renovar.

### 6.7 Accesibilidad (WCAG 2.2 AA)

- El salto es un `<button>` con `aria-label="Ir al minuto 03:24"`. El tiempo va en `<time datetime="PT3M24S">`.
- Todo se opera con teclado. Al guardar, el foco vuelve al botón "Agregar nota". Al eliminar, vuelve al botón "Agregar nota" (la nota ya no existe, y el botón es un punto fijo y predecible).
- "Nota guardada" y los errores se anuncian por una región `aria-live="polite"`.
- Contraste con los tokens existentes. No se introducen colores nuevos.
- Áreas táctiles de al menos 24×24 px (2.5.8), idealmente 44 px en celular.

## 7. Servidor

### 7.1 Server Actions (`src/actions/notas/`)

| Acción | Entrada | Valida | Revalida |
|---|---|---|---|
| `crearNota` | `leccionId`, `segundo`, `contenido` | sesión, zod, tope (error del trigger) | nada: estado optimista en cliente |
| `editarNota` | `notaId`, `contenido`, `segundo?` | sesión, zod, propiedad (RLS) | nada |
| `eliminarNota` | `notaId` | sesión, propiedad (RLS) | nada |

- Sin rutas `/api/` (CLAUDE.md §3.1).
- No hace falta `revalidatePath`: las notas son privadas, no forman parte del HTML cacheado de la clase, y el estado vive en el cliente tras la carga inicial.
- Errores inesperados con `logError` y `area`, **sin** registrar el contenido de la nota (dato personal).

### 7.2 Lectura (`src/lib/notas.ts`)

- `getNotasDeLeccion(leccionId, usuarioId)`: se llama en `page.tsx` **en paralelo** con `getComentariosDeLeccion` (`Promise.all`). Hoy los comentarios se piden después de `getLeccionPlayer`, así que las notas no añaden un viaje extra a Supabase en serie. Esto es importante por el trabajo reciente de "menos viajes a Supabase por petición".
- `getNotasDelCurso(leccionIds, usuarioId)` (fase 2): una sola consulta `id_leccion IN (...)` con los ids que ya trae `getLeccionPlayer`, sin volver a consultar `modulos`. Se carga solo al elegir "Todo el curso".
- Sin sesión: no se consulta nada.

## 8. Privacidad y datos personales

Las notas son datos personales escritos libremente por el estudiante: pueden contener cualquier cosa.

| Obligación | Cambio | Verificación |
|---|---|---|
| Supresión de cuenta | Añadir `delete from public.notas_leccion where id_usuario = p_id_usuario;` en el bloque "1. Lo que se borra" de `private.anonimizar_usuario()`, en un archivo SQL nuevo con `create or replace` que parta del **cuerpo completo vigente de 111** (no de una versión anterior). | `test:rls`: tras anonimizar, la cuenta no tiene filas en `notas_leccion`. |
| FK a `perfiles` | No sirve `ON DELETE CASCADE` desde `perfiles`: la cuenta se **anonimiza**, no se borra, así que la cascada nunca se dispararía. El borrado explícito del punto anterior es obligatorio. | Igual que arriba. |
| Exportación (Ley 1581) | Añadir `notas_leccion` a `exportar-datos.ts`: `segundo, contenido, creado_en, actualizado_en, leccion:lecciones(titulo, modulo:modulos(curso:cursos(titulo)))`. | Test de la acción de exportación con una nota de prueba. |
| Inventario y política de privacidad | Añadir "notas personales de clase" al inventario de datos y a la política, cuando se publique. | Revisión manual. |
| Logs y Sentry | Nunca incluir `contenido` en logs ni en el contexto de errores. | Revisión de código. |
| Acceso de admin | Ninguno (§3.1). | `test:rls`: un admin no lee notas ajenas. |

## 9. Pruebas

**`scripts/rls-test.ts`** (con las cuentas de prueba existentes):

1. El usuario A no ve, no edita y no borra notas del usuario B.
2. `anon` no lee ni escribe.
3. Un administrador no lee notas de otro usuario.
4. Sin acceso vigente: no puede crear en una lección de pago, pero sí en la introductoria.
5. Con acceso vencido: lee, edita y borra sus notas previas, pero no crea nuevas en lecciones de pago.
10. Eliminar una lección borra las notas de esa lección de todos los estudiantes (D1).
6. No se puede cambiar `id_usuario`, `id_leccion` ni `id_video_mux` por `UPDATE`.
7. La nota 201 en la misma lección se rechaza.
8. `CHECK`: `segundo` negativo y contenido vacío o de 2.001 caracteres se rechazan.
9. Anonimizar la cuenta borra sus notas.

**Unitarias**: schemas zod, formateo `mm:ss` / `h:mm:ss`, validación de `?t=`.

**Manual (celular y escritorio)**: crear una nota mientras se reproduce, saltar, editar, eliminar, teclado solo, lector de pantalla con el anuncio de "Nota guardada". Con una cuenta de acceso vencido: "Mis notas" muestra sus notas, el minuto no es un enlace y aparece el aviso de renovación.

## 10. Plan por fases

| Fase | Entrega | Criterio de aceptación |
|---|---|---|
| **1** | Tabla, SQL 115 (RLS, checks, triggers), anonimización y exportación, Server Actions, control del reproductor, pestaña Notas de la clase | Todas las pruebas de §9 en verde; crear, saltar, editar y eliminar funcionan en celular y escritorio. |
| **2** | Selector "Todo el curso", salto entre clases con `?t=`, aviso de video cambiado, aviso en el CMS al borrar una lección con notas (D1), **página "Mis notas"** (§6.6) | Tocar una nota de otra clase abre esa clase en el segundo correcto. Un estudiante con acceso vencido ve, edita y borra sus notas desde "Mis notas", sin enlaces al video. |
| **3** | Búsqueda en "Mis notas" (`ILIKE` al principio; búsqueda de texto completo en español solo si hace falta), exportar notas de un curso | Buscar una palabra devuelve notas de varios cursos. |

Esfuerzo estimado: fase 1, 2–3 días; fase 2, 2–3 días; fase 3, 1 día. **Estimación sin medir**, basada en el tamaño de piezas parecidas (comentarios, calificaciones).

## 11. Riesgos y temas futuros

- **App móvil (Capacitor)**: funciona sin cambios, porque es la misma web.
- **Modo sin conexión** (si se hacen las descargas): las notas necesitarían una cola local y sincronización, con "el último en editar gana". El diseño actual no lo impide: los `id` son UUID y podrían generarse en el cliente.
- **Volumen**: con el tope de 200 notas por lección y los índices de §4.1, la consulta de una clase lee como mucho 200 filas por índice. No se espera un cuello de botella.
- **Qué medir** para saber si la función funciona: porcentaje de estudiantes activos con al menos una nota, y notas por estudiante por curso. Se obtiene con una consulta agregada a la base, sin añadir analítica nueva.
