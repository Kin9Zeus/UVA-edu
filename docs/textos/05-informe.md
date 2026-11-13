# Informe de la revisión de textos y reglas de voz

**Fase 8. Revisión de textos y reglas de voz de UVA**
**Fecha:** 13 de noviembre de 2026
**Estado propuesto en Notion:** En curso. Los textos están revisados y las reglas de voz propuestas. Falta que yo apruebe, que se corrijan los títulos de lecciones y que el equipo aplique los cambios.

## Resumen

| Qué | Cantidad |
| --- | ---: |
| Textos inventariados (`00-inventario.csv`) | 4.325 |
| Hallazgos | **39** |
| de severidad Alta | 7 |
| de severidad Media | 15 |
| de severidad Baja | 17 |
| Reglas de voz propuestas | 4 |
| Términos en el glosario | 24 |

## Lo que más importa

1. **Siete hallazgos de severidad alta**, todos de texto, todos corregibles en minutos. Los participantes de las pruebas de usabilidad los verían en el recorrido:
   - Los enlaces de «Acepto los Términos…» del registro llevan a una página «en preparación», y sus nombres no coinciden con los textos legales (H01).
   - La palabra «suscripción», que hoy no existe, aparece en el menú de todo estudiante, en un mensaje de canje y en dos de comunidad (H02, H03, H15).
   - Voseo en dos pantallas de tuteo (H11, H14).
   - Un mensaje del examen dice que faltan clases cuando ya no hace falta terminarlas (H39).
2. **El vocabulario del panel admin no es el del estudiante.** El administrador crea «lecciones» y «categorías» que el estudiante ve como «clases» y «escuelas». Afecta a 30 archivos y a quien corrige títulos.
3. **La base está cuidada.** Plurales, fechas, números y zona horaria están bien resueltos en toda la plataforma. No encontré una sola falta de tilde en los textos visibles que revisé. Lo que ya estaba corregido (precios ocultos, cifras, enlaces del pie, «4,7») sigue bien, con las tres excepciones de arriba.
4. **El nombre de la marca no está unificado** y eso genera varios problemas de puntuación. Depende de mi decisión (`docs/marca/00-variantes-nombre.md`).

## Decisiones mías

| # | Decisión | Documento |
| ---: | --- | --- |
| 1 | Aprobar o rechazar cada hallazgo (columna «Aprobado») | `01-hallazgos.md` |
| 2 | Aprobar el glosario | `02-glosario.md` |
| 3 | Aprobar las cuatro reglas de voz y pegarlas en `CLAUDE.md` | `03-reglas-de-voz.md` |
| 4 | Elegir el nombre oficial de la marca | `docs/marca/00-variantes-nombre.md` |
| 5 | Confirmar si «clases cortas» y «casos reales» son ciertos (H04) | `01-hallazgos.md` |
| 6 | Qué dice el texto legal en el registro (con el abogado) | `docs/legal/` |
| 7 | Autorizar o no la etapa 7 (aplicar las correcciones en una rama) | Este informe |

## Lo que puede corregir el equipo

Todo está en [`../pendientes-equipo.md`](../pendientes-equipo.md), sección 1. Son cambios de cadenas de texto. Lo que dependa de una decisión mía queda marcado.

## Lo que me toca a mí

1. Exportar los títulos de cursos y lecciones (`04-titulos.md`, paso a paso), para que los revise.
2. Corregir los títulos de lecciones desde el panel admin con la tabla que salga de esa revisión.
3. Marcar «sí» o «no» en cada fila de `01-hallazgos.md`.

## Riesgos

| Riesgo | Efecto | Qué lo reduce |
| --- | --- | --- |
| **Las pruebas de usabilidad empiezan el lunes 16** y esta tarea vencía el 7 de octubre | Los participantes tropiezan con errores que ya conocemos y contaminan lo que se mide | Aprobar hoy los siete hallazgos de severidad alta y pedirle al equipo que los aplique antes del lunes. Si no alcanza, registrarlos como «ya conocidos» en la hoja de observación. |
| **El panel admin no lo leí línea por línea** | Puede haber textos de severidad baja sin reportar | Es el último en prioridad. Se hace una pasada completa después de las pruebas. |
| **Los títulos de cursos y lecciones viven en la base de datos** | Los errores que ya conocemos («intoduccion», «Taller practico») siguen ahí hasta que se exporten y se corrijan | Exportarlos hoy con el paso a paso de `04-titulos.md` |
| **El inventario incluye algunos textos internos** | La cifra de 4.325 incluye líneas que el usuario no ve | La columna «tipo» y la «pantalla» permiten filtrarlas. Los hallazgos se basan en lo que sí se ve. |
| **No hay etapa 7** | Los cambios no están aplicados | Falta mi autorización explícita. Con ella, se crea la rama `textos/revision-voz-uva` y solo se aplican las filas aprobadas. |

## Etapa 7 (aplicar correcciones)

**No la hice.** Necesita tu autorización explícita y las filas aprobadas. Al aprobarla, se crea la rama `textos/revision-voz-uva` a partir de la rama principal actualizada, con un commit por pantalla, y se detiene después de cada una para que revises el cambio. Andres y Miguel revisan antes de fusionar.
