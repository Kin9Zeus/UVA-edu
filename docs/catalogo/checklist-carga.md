# Checklist de carga del catálogo real

**Fase 7. Carga del catálogo real**
**Fecha:** 13 de noviembre de 2026
**Mi papel:** solo apoyo. La carga se hace desde el panel admin con credenciales de producción y es mía.

## Antes de empezar

☐ Confirmar si esta tarea sigue abierta de verdad o si solo falta marcarla en Notion.
☐ Decidir con cuántos cursos se lanza: **2 o 3 completos y bien producidos** valen más que 10 a medias.

## Un curso de punta a punta, primero en staging

Cargar **un** curso completo en el entorno de pruebas antes de tocar producción. Si algo falla ahí, se arregla ahí.

☐ El curso se creó con su título, descripción, nivel y escuela.
☐ Las clases tienen su video subido y procesado.
☐ Se publicó y se ve en el catálogo como estudiante.

## Qué revisar de cada curso

### Textos

☐ **Título y descripción** sin errores de ortografía, con el mismo tono que el resto del catálogo. Ver las reglas de `docs/textos/04-titulos.md`.
☐ **Títulos de módulos y clases** sin errores y con un solo formato de numeración por curso.
☐ **Resumen de cada clase** escrito, o decidido que no lo lleva.
☐ **Nada que prometa lo que el curso no cubre.**

### Imágenes

☐ **Portadas** con la misma relación de aspecto y calidad en todos los cursos.
☐ Cada portada tiene un texto alternativo con sentido (lo pide el piso de calidad en `CLAUDE.md`, sección 3.4).

### Estructura

☐ **Orden de módulos y clases** revisado por alguien que conozca el contenido pedagógico.
☐ **Instructor asignado** a cada curso, con su nombre y especialidad (hoy la web actual no los muestra).
☐ La **primera clase** está en el lugar correcto: es la clase gratis del catálogo.

### Video

☐ **Duración de cada clase** verificada **después** del procesamiento de Mux. La plataforma calcula el avance solo con clases que tengan video listo.
☐ Ninguna clase quedó en «video en preparación» ni con error.
☐ Subtítulos o transcripción disponibles, si el curso los usa.

### Como estudiante

☐ Abrir el curso con el **modo vista previa** del panel admin y recorrerlo como lo haría un estudiante.
☐ Probar con un **código de invitación de prueba**: entrar, empezar la primera clase, salir y volver.
☐ Si el curso exige examen, presentarlo una vez y comprobar que el certificado sale.

## Antes de publicar

☐ Los cursos que van a verse tienen **todo lo anterior marcado**.
☐ Los cursos a medias quedan **sin publicar** (en la plataforma, «mostrado» desactivado).
☐ Hay un curso destacado elegido a propósito.

## Aviso de inmediato

Si el **video pregrabado no está listo**, avisar apenas se sepa: sin video no hay clases con avance ni certificado.

## Qué me toca a mí

1. Confirmar si la tarea sigue abierta.
2. Cargar el catálogo y marcar esta lista curso por curso.
3. Exportar el listado de títulos y descripciones para revisarlo (ver `docs/textos/04-titulos.md`).
