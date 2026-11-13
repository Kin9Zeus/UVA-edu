# Etapa 5. Títulos de cursos, módulos y lecciones

**Fase 8. Revisión de textos y reglas de voz de UVA**
**Fecha:** 13 de noviembre de 2026
**Estado:** no hay CSV en `docs/textos/datos/`. Los títulos y descripciones viven en la base de datos y yo no me conecto a producción. Dejo el paso a paso para exportarlos, las reglas con las que los voy a revisar y la tabla que voy a llenar.

## Qué hace falta de mi parte (`ACCIÓN DE ALECK`)

Exportar solo columnas de título y descripción, sin ningún dato de personas, y dejar los archivos en `docs/textos/datos/`.

### Paso a paso

1. Entrar al panel de Supabase del proyecto **de producción** con tu cuenta, abrir **SQL Editor** y crear una consulta nueva.
2. Pegar esta consulta y ejecutarla. Es solo de lectura (`select`) y trae únicamente títulos, enlaces y descripciones de cursos:

   ```sql
   select
     c.slug        as curso_slug,
     c.titulo      as curso_titulo,
     c.descripcion as curso_descripcion
   from cursos c
   order by c.titulo;
   ```

3. Descargar el resultado como CSV y guardarlo como `docs/textos/datos/cursos.csv`.
4. Crear otra consulta, pegar esta y repetir:

   ```sql
   select
     c.slug      as curso_slug,
     m.orden     as modulo_orden,
     m.titulo    as modulo_titulo,
     l.orden     as leccion_orden,
     l.titulo    as leccion_titulo,
     l.resumen   as leccion_resumen
   from lecciones l
   join modulos m on m.id = l.id_modulo
   join cursos  c on c.id = m.id_curso
   order by c.slug, m.orden, l.orden;
   ```

5. Guardar el resultado como `docs/textos/datos/lecciones.csv`.
6. Abrir los dos archivos y comprobar que **no haya columnas con nombres, correos ni identificadores de personas**. Si ves alguna, bórrala antes de guardar. Estas consultas no las incluyen.

**Sobre el botón de descarga.** No encontré documentación oficial de Supabase que describa la descarga a CSV desde el editor de SQL. Las guías de terceros dicen que, tras ejecutar la consulta, aparece un botón de descarga o exportación encima de la tabla de resultados, y que su nombre cambia entre versiones. Búscalo en tu pantalla. Si no aparece, otra salida es abrir el **Table Editor**, entrar a la tabla `cursos` (o `lecciones`), y usar allí la opción de exportar a CSV. En ese caso **borra las columnas que no sean título, enlace y descripción**.

**Si prefieres no usar la base de datos:** desde el panel de administración, entra a cada curso (`/admin/cursos/[curso]`) y copia los títulos y descripciones a una hoja de cálculo con las mismas columnas de arriba.

## Cómo voy a revisarlos cuando lleguen

Cada título y descripción se revisa con estas reglas. Las dos primeras salen de los errores que ya conocemos.

| Regla | Ejemplo de error | Corrección |
| --- | --- | --- |
| Falta una tilde | «intoduccion», «Taller practico» | «Introducción», «Taller práctico» |
| Letra equivocada o faltante | «intoduccion» | Se revisa contra el diccionario, no solo contra tildes. |
| Mayúscula inicial | «introducción a revit» | «Introducción a Revit». Solo la primera palabra y los nombres propios llevan mayúscula. |
| TODO EN MAYÚSCULAS | «INTRODUCCIÓN A REVIT» | «Introducción a Revit» |
| Doble espacio o espacios al borde | «Modelado  de muros » | «Modelado de muros» |
| Numeración mezclada | «Clase 1:», «1.», «01 -» en el mismo curso | Un solo formato por curso. El número ya lo muestra la plataforma por el orden. |
| Punto final en un título | «Introducción a Revit.» | «Introducción a Revit» |
| Palabra que se usa distinto al glosario | «Lección 3», «Sesión 2» | «Clase» o sin la palabra. Ver `02-glosario.md`. |
| Nombre de software mal escrito | «Autocad», «REVIT», «sketch up» | «AutoCAD», «Revit», «SketchUp» |
| Anglicismo evitable | «Workflow», «Tips» | Alternativa en español si existe y no cambia el sentido. Los nombres de programas no se traducen. |
| Título demasiado largo para celular | Más de unos 60 caracteres | Proponer una versión corta. |

Las dudas de ortografía las marco como duda y cito la fuente (Diccionario de la lengua española, Ortografía de la lengua española o Fundéu). No invento reglas.

## Tabla de correcciones (plantilla)

Esta tabla la llenaré con el CSV. Está pensada para ejecutarse desde el panel admin sin dudar: dice dónde está el texto, qué dice hoy y cómo debe quedar.

| # | Curso (enlace) | Módulo y clase | Campo | Texto actual | Texto corregido | Motivo | Hecho |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `[curso_slug]` | `[Módulo 1, clase 1]` | Título de la clase | `[texto actual]` | `[texto corregido]` | `[regla]` | ☐ |

**Dónde se edita cada campo en el panel admin:**

- **Título y descripción del curso:** `/admin/cursos/[curso]`.
- **Título del módulo:** en la pestaña de contenido del mismo curso, sobre la tarjeta del módulo.
- **Título y resumen de la clase:** en la pestaña de contenido, abriendo la clase en el panel lateral de edición.

## Una advertencia sobre las descripciones

Si una descripción de curso la generó el asistente de IA del panel (`src/lib/descripciones-ia/`), reviso que no afirme cosas que el curso no cubre. La regla de contenido veraz del proyecto (`CLAUDE.md`, sección 3.4) aplica también a esas descripciones.
