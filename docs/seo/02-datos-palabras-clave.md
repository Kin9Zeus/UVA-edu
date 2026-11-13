# Etapa 2 (parte 2). Datos de palabras clave

**Fase 14 · SEO y GEO · 13 de noviembre de 2026 · Aleck Martínez**

## Estado

**SIN DATO.** La carpeta `docs/seo/datos/` no trae exportaciones de Keyword Planner, Trends ni Search Console. No hay volúmenes de búsqueda, así que no los escribo ni los estimo. Lo que sí dejo listo:

1. El paso a paso para sacar los datos.
2. La lista exacta de términos para consultar.
3. Las reglas de normalización.
4. La fórmula de priorización, para aplicar apenas lleguen los datos.

## 1. Cómo conseguir los datos

### Keyword Planner (volumen mensual de búsquedas)

Pasos según la ayuda oficial de Google Ads ([fuente](https://support.google.com/google-ads/answer/7337243), consultada el 13 de noviembre de 2026):

1. Entrar a la cuenta de Google Ads. La ayuda indica que hay que completar la configuración de la cuenta e ingresar datos de facturación para acceder a las ideas de palabras clave. No hace falta lanzar una campaña, pero sí tener la cuenta configurada.
2. En el menú **Tools** (Herramientas) abrir **Keyword planner**.
3. Elegir **Discover new keywords** (Descubrir nuevas palabras clave).
4. Elegir **Start with keywords** y pegar los términos de la sección 2, separados por comas.
5. Antes de pulsar **Get results**, ajustar la ubicación a **Colombia** y el idioma a **español**. Esa configuración está en la barra superior de la herramienta; **la página de ayuda que consulté no detalla este paso**, así que confírmalo en la pantalla.
6. Pulsar **Get results**. Para reducir la lista, usar **Add filter** o las categorías del panel **Refine keywords**.
7. Descargar los resultados. **La documentación que consulté no describe la exportación de las ideas a CSV ni a Hojas de cálculo** (solo habla del botón de descarga del pronóstico), así que busca el icono de descarga de la tabla de resultados en la interfaz y deja el archivo en `docs/seo/datos/`.

**Dos advertencias que sí recoge la fuente:** las palabras con volúmenes muy bajos o consideradas sensibles no se pueden descubrir ni pronosticar. La fuente tampoco dice si los volúmenes aparecen como rangos cuando la cuenta no tiene campañas activas; lo verás tú al abrir la herramienta, y si salen rangos, el archivo sirve igual para comparar términos entre sí.

Repetir la consulta con las variantes de México y España solo si hace falta comparar regionalismos.

### Google Trends (interés relativo y estacionalidad)

**No pude verificar los pasos contra la documentación oficial.** La página de ayuda de Trends que consulté ([fuente](https://support.google.com/trends/answer/4365533)) trata de la interpretación de los datos y no de los pasos de uso, y la guía de inicio que intenté abrir respondió 404. Lo que sí confirma esa página:

- Los datos se escalan de 0 a 100 según la proporción de un tema frente a todas las búsquedas, así que sirven para comparar popularidad relativa.
- Los términos con poco volumen aparecen como «0».
- No es una encuesta científica: hay que usarlo como un dato entre otros.

El flujo en la interfaz (`trends.google.com`) normalmente es: elegir **Colombia** como país, un periodo de **últimos 5 años** para ver estacionalidad, **comparar hasta cinco términos** y descargar el CSV con el icono de descarga de la gráfica. Verifica cada paso en pantalla antes de dárselo a alguien.

**Qué comparar primero** (cinco por gráfica, siempre con un término común de referencia):
- Presupuestos: «presupuesto de obra», «APU construcción», «AIU», «cantidades de obra».
- Software: «Revit», «SketchUp», «D5 Render», «render con IA».
- Negocio: «abrir oficina de arquitectura», «honorarios arquitecto», «marketing para arquitectos».

### Search Console (lo que de verdad buscan para llegar a UVA)

Cuando la propiedad esté verificada (ver `07-webmasters.md`), el informe de **Rendimiento** reemplaza a Keyword Planner como fuente principal: muestra consultas reales, clics, impresiones y posición. Tarda semanas en acumular datos útiles.

## 2. Términos para consultar

Cópialos tal cual en Keyword Planner (una sola línea, separados por comas). Cubren los 40 temas de `01-semillas.md`:

```text
presupuesto de obra, cómo hacer un presupuesto de obra, presupuesto de construcción, análisis de precios unitarios, APU construcción, costos directos e indirectos, AIU construcción, cantidades de obra, cubicación de obra, presupuesto de obra con inteligencia artificial, control de costos de obra, honorarios de arquitecto, cuánto cobrar por un diseño arquitectónico, cotización de proyectos de arquitectura, gerencia de proyectos de construcción, diplomado gerencia de proyectos de construcción, administración de obra, residente de obra, funciones del residente de obra, programación de obra, cronograma de obra, ruta crítica construcción, contratos de obra, tipos de contrato de construcción, cierre de proyecto de obra, gerencia de proyectos inmobiliarios, desarrollo de proyectos de vivienda, curso de Revit, curso de Revit arquitectura, familias paramétricas Revit, qué es BIM, BIM Colombia, coordinador BIM, curso de SketchUp, curso de D5 Render, render con inteligencia artificial, render con IA arquitectura, render de interiores, IA para arquitectos, diseño de interiores, curso de diseño de interiores, iluminación arquitectónica, diseño de clínicas odontológicas, habilitación de consultorios odontológicos, resolución 3100 de 2019, abrir una oficina de arquitectura, portafolio de arquitectura, marca personal arquitecto, marketing para arquitectos, Instagram para arquitectos, Facebook Ads para arquitectos, cómo conseguir clientes de arquitectura, cursos de arquitectura online, diplomado de construcción, verificar certificado de curso, plantilla de presupuesto de obra excel
```

## 3. Reglas de normalización

Al recibir las exportaciones:

1. **Pasar todo a minúsculas** y quitar espacios dobles.
2. **Agrupar las variantes con y sin tilde** («diseño de interiores» y «diseno de interiores», «análisis de precios unitarios» y «analisis de precios unitarios») como una sola búsqueda. Sumar sus volúmenes. Conservar la forma con tilde como nombre.
3. **Quitar duplicados exactos.** Si el mismo término sale en dos exportaciones, quedarse con la más reciente.
4. **Unificar singular y plural** cuando el significado no cambia («curso de revit» / «cursos de revit»). Si el volumen está separado, sumarlo, y anotarlo en una columna aparte.
5. **Marcar las búsquedas de marca ajenas** (nombres de universidades, plataformas o competidores) en una columna aparte. No se descartan, pero no entran en la priorización: no hay contenido propio con el que competir por ellas.
6. **Quitar las búsquedas sin relación con la oferta** (por ejemplo «uvas» como fruta que aparezca por «uva») y anotar cuántas se quitaron.
7. **Etiquetar la intención** de cada término:
   - **Informativa:** quiere entender o aprender («qué es BIM», «cómo hacer un presupuesto de obra»).
   - **Comparativa:** compara opciones («mejores cursos de Revit», «curso de Revit o SketchUp»).
   - **Transaccional:** quiere inscribirse o comprar («curso de Revit online», «diplomado de presupuestos»).

## 4. Fórmula de priorización

Cada término recibe cuatro puntajes de 0 a 5 y se combina así:

```text
Puntaje = 0,30 × V  +  0,30 × C  +  0,20 × I  +  0,20 × F
```

| Factor | Qué mide | Cómo se asigna |
| --- | --- | --- |
| **V** · Volumen | Cuánta gente lo busca | Se divide la lista en cinco tramos iguales (quintiles) por volumen mensual. El tramo más alto vale 5. Sin dato, no se puntúa: el término queda marcado «provisional». |
| **C** · Cercanía a la oferta | Qué tan directo es el curso que lo atiende | 5 si el título de un curso publicado es ese tema; 3 si es un módulo o sesión de un curso; 1 si no hay curso. |
| **I** · Intención | Cuánto se acerca a una decisión | Transaccional 5, comparativa 4, informativa 3. |
| **F** · Facilidad | Qué tan alcanzable parece | 5 si en la búsqueda dominan páginas débiles para ese tema (PDF sueltos, listados genéricos, blogs de proveedores de software); 3 si hay mezcla; 1 si dominan universidades y plataformas grandes. Se asigna con la observación de `05-competencia.md`, no con la columna «Competition» de Keyword Planner, porque esa columna mide competencia de anuncios pagados y no dificultad para posicionarse sin pagar. |

**Por qué estos pesos:** el volumen y la cercanía a la oferta valen lo mismo (30 % cada uno), porque de nada sirve un término muy buscado sin curso que lo atienda, ni un curso muy cercano que nadie busca. La intención y la facilidad pesan menos (20 %) porque son estimaciones más subjetivas.

**Hasta que lleguen los datos:** `03-mapa-contenidos.md` ordena con una prioridad provisional que usa solo C, I y F (sin V), marcada como tal. Cuando entre el volumen se recalcula con la fórmula completa.

## 5. Qué me toca a mí

- Abrir Keyword Planner y Trends y dejar los archivos en `docs/seo/datos/`.
- Decirme si el volumen sale en rangos (para ajustar el método).
