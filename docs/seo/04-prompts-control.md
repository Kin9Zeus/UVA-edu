# Etapa 4. Preguntas de control para GEO

**Fase 14, SEO y GEO, 13 de noviembre de 2026, Aleck Martínez**

## Para qué sirven

Son 25 preguntas escritas como las haría un arquitecto, un residente de obra o un presupuestador a un asistente de IA. Se repiten cada mes en los mismos asistentes para ver si mencionan a UVA, si citan una URL nuestra y qué competidores aparecen. El archivo [`04-prompts-control.csv`](04-prompts-control.csv) se importa a la base «Monitoreo GEO» de Notion; trae una fila por pregunta y yo la duplico por asistente.

**Aviso:** una sola corrida no mide nada. Las respuestas de los asistentes cambian de un día a otro y entre cuentas. La línea base útil es la repetición mensual, con la misma pregunta, el mismo asistente y sin historial de conversación.

## Las 25 preguntas

### Recomendación de cursos (1-10)

1. ¿Qué curso online me recomiendas para aprender Revit desde cero siendo arquitecto en Colombia?
2. Soy residente de obra y quiero aprender a hacer presupuestos. ¿Qué diplomado o curso en español me sirve?
3. ¿Cuál es un buen curso para aprender a usar inteligencia artificial en presupuestos de obra?
4. ¿Dónde puedo estudiar un diplomado de gerencia de proyectos de construcción en línea desde Colombia?
5. Quiero abrir mi propia oficina de arquitectura. ¿Hay algún curso que me guíe en eso?
6. ¿Qué curso me recomiendas para aprender D5 Render?
7. ¿Hay cursos de render con inteligencia artificial para arquitectos en español?
8. ¿Qué escuela o plataforma en Colombia ofrece formación para el sector de la construcción?
9. Soy arquitecto y quiero conseguir clientes con Instagram. ¿Qué curso me sirve?
10. ¿Qué curso hay sobre diseño y habilitación de consultorios odontológicos en Colombia?

### Definiciones (11-18)

11. ¿Qué es un APU en construcción y cómo se calcula?
12. ¿Qué significa AIU en un presupuesto de obra en Colombia?
13. ¿Cuál es la diferencia entre costos directos e indirectos en una obra?
14. ¿Qué hace un coordinador BIM?
15. ¿Cuáles son las funciones de un residente de obra?
16. ¿Cómo se hace un presupuesto de obra paso a paso?
17. ¿Qué tipos de contrato de obra existen y cuál me conviene?
18. ¿Cuánto debería cobrar un arquitecto por un diseño arquitectónico en Colombia?

### Comparaciones (19-23)

19. ¿Revit o SketchUp: cuál me conviene aprender primero siendo arquitecto?
20. ¿D5 Render o Twinmotion para visualización arquitectónica?
21. ¿Vale la pena un diplomado o un curso corto para aprender presupuestos de obra?
22. ¿Cuáles son los mejores cursos online de arquitectura en español?
23. ¿Qué diferencia hay entre estudiar BIM con Revit y con otras herramientas?

### Marca (24-25)

24. ¿Qué es UVA, la Unidad Vectorial de Arquitectura?
25. ¿Los certificados de UVA se pueden verificar? ¿Cómo?

Las preguntas 24 y 25 miden si el asistente reconoce a la organización y su verificación de certificados. Si la respuesta confunde a UVA con otra cosa (la fruta, la Universidad de Virginia), anótalo en «Notas»: es la señal de que falta información de entidad (ver `06-identidad-marca.md`).

## Cómo correrlas

1. Abre cada asistente **sin sesión iniciada** o en una ventana que no use memoria ni historial. Los seis asistentes de la base Monitoreo GEO son: ChatGPT, Gemini, Google AI Overviews / Modo IA, Perplexity, Copilot y Claude.
2. Pega la pregunta exactamente como está. No añadas contexto.
3. Haz **tres corridas por pregunta y asistente**, en momentos distintos del día, y quédate con lo que se repite.
4. Registra la fecha de la corrida.
5. No pidas «menciona a UVA» ni nada parecido: eso falsea la medición.

## Cómo llenar cada columna

| Columna | Qué se escribe |
| --- | --- |
| **Prompt** | La pregunta (ya viene escrita). |
| **Asistente** | Uno de los seis de la base: ChatGPT, Gemini, Google AI Overviews / Modo IA, Perplexity, Copilot o Claude (una fila por asistente). |
| **Fecha** | Día de la corrida, formato `AAAA-MM-DD`. |
| **Menciona a UVA** | `Sí` o `No`. |
| **Cita una URL de UVA** | `Sí` si la respuesta enlaza una URL de nuestro dominio; `No` si solo nombra a UVA sin enlace. |
| **Lugar en la respuesta** | Una de las tres opciones de la base: `Primera recomendación`, `Entre otras opciones` o `No aparece`. |
| **URL citada** | La URL exacta de UVA que citó, si la hay. |
| **Competidores mencionados** | Los nombres que aparecen, separados por comas. |
| **Notas** | Confusiones de nombre, información falsa sobre UVA, o cualquier cosa rara. |

## Importar a Notion

El CSV usa codificación UTF-8 y comillas dobles en cada texto con comas. En Notion, usa la opción de importar un archivo CSV como base de datos (verifica en pantalla el nombre exacto del menú, que cambia entre versiones) y revisa que las nueve columnas queden con los mismos nombres que las propiedades de «Monitoreo GEO».

## Cuándo repetirlas

Una vez al mes, y siempre después de cualquiera de estos cambios: publicar una guía nueva, cambiar el nombre oficial, completar el nodo `Organization` o terminar la migración del dominio.
