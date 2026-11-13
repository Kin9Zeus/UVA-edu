# Informe de avance de Aleck Martínez

## 1. Fecha efectiva

**Viernes 13 de noviembre de 2026** (la que devolvió `date`). Coincide con la fecha de corte del archivo de tareas, así que el calendario no se recalculó.

Dónde quedó el trabajo: en la rama local `docs/tareas-aleck-2026-11-13`, creada a partir de la rama del PR 45. **No hice commit, push ni merge de nada nuevo.** Todo lo de esta sesión son archivos nuevos o modificados dentro de `docs/`. No toqué `src/`, configuración, dependencias, migraciones ni pruebas.

## 2. Tareas activas

### Tarea 1. Fase 14: palabras clave, preguntas a la IA, competencia y mapa de contenidos

- **Estado propuesto:** En curso. Vence hoy.
- **Qué se entregó:** `docs/seo/` completo.
  - `01-semillas.md` (40 temas), `02-datos-palabras-clave.md`, `03-mapa-contenidos.md` (44 búsquedas), `04-prompts-control.md` y `.csv` (25 preguntas), `05-competencia.md` (20 búsquedas), más `00-diagnostico.md`, `06-identidad-marca.md`, `07-webmasters.md` y `08-informe.md`.
  - En esta sesión: alineé el documento de preguntas con las columnas y los valores de la base Monitoreo GEO, y limpié el estilo de todos los documentos (sin guiones largos ni flechas).
- **Cumple el «terminado cuando»:** hay más de 40 búsquedas, los 25 prompts y el análisis de competencia. **Lo dejo en «En curso»** porque la priorización es provisional (sin volúmenes) y la línea base de los asistentes no está corrida.
- **SIN DATO:** volúmenes de búsqueda; posiciones reales en Google Colombia; qué cursos están publicados hoy.
- **Te toca (`ACCIÓN DE ALECK`):**
  - ☐ Exportar Keyword Planner y Google Trends a `docs/seo/datos/` (paso a paso en `02-datos-palabras-clave.md`).
  - ☐ Hacerle las 25 preguntas a los seis asistentes y registrar o pasarme las respuestas.
  - ☐ Pegar los documentos en la subpágina de Notion.
- **Bloqueos:** ninguno para lo que se pudo hacer.
- **Próximo paso:** recalcular la prioridad con los volúmenes cuando lleguen (fórmula ya definida).

### Tarea 2. Fase 8: revisión de textos y reglas de voz

- **Estado propuesto:** En curso. Vencida desde el 7 de octubre. Bloquea la tarea 3.
- **Qué se entregó (`docs/textos/`):**
  - `00-inventario.csv`: 4.325 textos.
  - `01-hallazgos.md`: **39 hallazgos** (7 altos, 15 medios, 17 bajos), con columna «Aprobado».
  - `02-glosario.md`, `03-reglas-de-voz.md` (4 reglas y el bloque para `CLAUDE.md`), `04-titulos.md`, `05-informe.md`.
- **Hecho con cuidado:** leí completo el texto de las pantallas de prioridad 1 y de las de prioridad 2 que más ve un participante. **El panel admin solo tuvo revisión automática.**
- **SIN DATO:** los títulos y descripciones de cursos y lecciones (viven en la base de datos). Dejé el paso a paso para exportarlos.
- **Te toca:**
  - ☐ Marcar «sí» o «no» en cada fila de `01-hallazgos.md`, empezando por las siete de severidad alta.
  - ☐ Aprobar el glosario y las reglas de voz.
  - ☐ Exportar los títulos (`04-titulos.md`) y, después, corregir las lecciones desde el panel admin.
  - ☐ Decidir si autorizas la etapa 7 (aplicar las correcciones aprobadas en la rama `textos/revision-voz-uva`).
- **Bloqueos:** la etapa 7 no se hizo porque necesita tu autorización explícita.
- **Próximo paso:** con tu aprobación de los siete hallazgos altos, pedirle al equipo que los aplique **antes del lunes 16**.

### Tarea 3. Fase 13: pruebas de usabilidad (solo la Parte A)

- **Estado propuesto:** En curso (preparación). Las sesiones son del 16 al 18 de noviembre.
- **Qué se entregó (`docs/usabilidad/`):** `00-guion-sesion.md`, `01-reclutamiento.md` (con el mensaje de invitación listo), `02-consentimiento.md` (marcado para revisión del abogado), `03-hoja-observacion.md` y `04-plantilla-bugs.md`.
- **SIN DATO:** si habrá un agradecimiento o incentivo para los participantes.
- **Te toca:**
  - ☐ Elegir y escribirles a las cinco personas **hoy o mañana**: quedan tres días.
  - ☐ Generar un código de invitación de prueba por persona desde el panel admin.
  - ☐ Pedirle a Andres o a Miguel que observe al menos 2 sesiones.
  - ☐ Hacer revisar el consentimiento por el abogado antes de usarlo.
- **Bloqueos:** la Parte B (análisis) empieza el 16 de noviembre y solo cuando subas tus notas a `docs/usabilidad/datos/`.
- **Próximo paso:** enviar las invitaciones.

### Tarea 4. Fase 14: identidad de marca

- **Estado propuesto:** En curso. Vence el 20 de noviembre.
- **Qué se entregó (`docs/marca/`):** `00-variantes-nombre.md` y `.csv` (231 variantes con archivo y línea, más cuatro opciones de nombre), `01-ficha-identidad.md`, `02-checklist-perfiles.md`, `03-sameas.md`, `04-instructores.md`, `05-google-business-profile.md`, `06-directorios.md`, `07-wikidata.md`.
- **BLOQUEADO:** la ficha definitiva, los cambios en los perfiles y el nodo completo de la organización, hasta que elijas el nombre oficial. Lo dejé armado con campos pendientes.
- **SIN DATO:** año de fundación, razón social, NIT, instructores, cifras con fuente, si la oficina de Pereira atiende público y si el podcast de Spotify es red oficial.
- **Te toca:**
  - ☐ Elegir el nombre oficial (A, B, C o D).
  - ☐ Responder las seis preguntas de Google Business Profile.
  - ☐ Pasarme los datos que faltan (arriba).
  - ☐ Recorrer los perfiles con el checklist.
  - ☐ Pedir a los instructores que actualicen su LinkedIn.
  - ☐ Entregar el logo cuadrado y el de 1200×630.
- **Próximo paso:** con el nombre decidido, completar la ficha y entregarle la lista `sameAs` a Miguel.
- **Wikidata:** decidí no crear el elemento todavía, porque no hay referencias independientes (`07-wikidata.md`).

### Tarea 5. Fase 7: textos legales

- **Estado propuesto:** En curso. Vencida desde el 12 de septiembre.
- **Qué se entregó (`docs/legal/`):** `00-texto-vs-codigo.md` (13 discrepancias), `01-checklist-implementacion.md`, `02-datos-por-completar.md` y `03-paquete-abogado.md` (resumen de una página y borrador del correo, **sin enviar**).
- **Límite importante:** el documento «UVA: marco legal de la plataforma y textos oficiales» **no está exportado** a `docs/legal/textos-legales.md`. Contrasté el código con el borrador que sí está en el repositorio (`contenido-soporte.md`) y con el inventario de datos. Cuando exportes el oficial, repito las tablas.
- **BLOQUEADO:** `02-datos-por-completar.md` en su versión completa, porque depende de los corchetes del documento oficial.
- **Te toca:**
  - ☐ Exportar el documento oficial a `docs/legal/textos-legales.md`.
  - ☐ Completar los datos de la empresa.
  - ☐ Enviar el paquete al abogado, y obtener su aprobación y la del CEO por escrito.
  - ☐ Pedir a Andres y Miguel que publiquen los textos y activen las casillas.
- **Próximo paso:** con el documento oficial, rehacer la comparación.

### Tarea 6. Fase 7: carga del catálogo (solo apoyo)

- **Estado propuesto:** Sin empezar para mí; el estado real lo confirmas tú.
- **Qué se entregó:** `docs/catalogo/checklist-carga.md`.
- **Te toca:** confirmar si la tarea sigue abierta, cargar el catálogo y avisar de inmediato si el video pregrabado no está listo.

## 3. Tareas futuras (no se tocaron)

| Tarea | Inicia |
| --- | --- |
| 7. Google Search Console | 26 de noviembre |
| 8. Bing Webmaster Tools e IndexNow | 27 de noviembre |
| 9. Optimizar fichas de curso y escuelas | 14 de diciembre |
| 10. Calendario editorial y 6 guías pilar | 4 de enero |
| 11. Autoridad y menciones | 7 de diciembre |
| 12. Canal de YouTube | 7 de diciembre |

**Una excepción que debo decirte.** `docs/seo/07-webmasters.md` (la guía de Search Console, Bing, IndexNow y analítica) **ya existía** antes de recibir tu archivo de tareas: la preparé cuando me lo pediste para la Fase 14. Está dentro del PR 45. No la amplié ni la usé en esta sesión. Si prefieres respetar las fechas de inicio, se puede sacar del PR.

## 4. Riesgos de fechas

| Tarea vencida | Qué la frena |
| --- | --- |
| Tarea 2 (vencía el 7 de octubre) | Mi aprobación de los hallazgos, la exportación de títulos y la autorización de la etapa 7. **Bloquea las pruebas de usabilidad del 16 de noviembre.** |
| Tarea 5 (vencía el 12 de septiembre) | Que exportes el documento legal oficial, los datos de la empresa y la aprobación del abogado y del CEO. |
| Tarea 6 (vencía el 10 de septiembre) | Confirmar si sigue abierta de verdad. |
| Tarea 1 (vence hoy) | Los datos de Keyword Planner y las 25 preguntas a los asistentes. |
| Tarea 4 (vence el 20 de noviembre) | La decisión del nombre oficial. |

**Decisiones abiertas que bloquean** (sección 2.1 del archivo de tareas):

- Nombre oficial: sigue abierta. La recomendación registrada (nombre completo «UVA, Unidad Vectorial de Arquitectura» y corto «UVA») es la opción A de `docs/marca/00-variantes-nombre.md`.
- Dominio definitivo: `uvarq.com`. Falta decidir con o sin `www`.
- Política con los rastreadores de IA: no se cambió nada en `robots.txt`. Hoy están permitidos.
- Quién escribe las guías: pendiente.
- Aprobación del abogado y del CEO: pendiente.

## 5. Pendientes para Andres y Miguel

Copia completa en [`pendientes-equipo.md`](pendientes-equipo.md). Lo más urgente:

1. **Antes del lunes 16:** aplicar las correcciones de texto de severidad alta cuando las apruebe (H01, H02, H03, H11, H14, H15, H39).
2. Observar al menos 2 de las 5 sesiones de usabilidad.
3. **Legal:** tabla de consentimientos, casillas separadas, aceptación para quien entra con Google y, si el abogado lo pide, banner de cookies.
4. **SEO:** cuando la plataforma pase a `uvarq.com`, las redirecciones de las 22 URLs actuales. No antes.
5. Alinear el vocabulario del panel admin con el de los estudiantes (30 archivos).

## 6. Resumen de cinco líneas para la Bitácora semanal

1. Quedaron revisados 4.325 textos de la plataforma: 39 hallazgos, 7 de ellos de severidad alta, con glosario y cuatro reglas de voz para aprobar.
2. Se preparó el guion, el reclutamiento, el consentimiento y las plantillas de las pruebas de usabilidad del 16 al 18 de noviembre.
3. La identidad de marca quedó lista a falta del nombre oficial; la auditoría legal mostró 13 diferencias entre los textos y el código.
4. Quedan pendientes mi aprobación de los hallazgos, el nombre oficial, el documento legal oficial y los datos de Keyword Planner.
5. Lo más urgente es aprobar los siete hallazgos altos y reclutar a las cinco personas antes del lunes 16.
