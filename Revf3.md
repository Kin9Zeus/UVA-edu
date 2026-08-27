# Catálogo con búsqueda por palabra clave y filtro por categoría

Estado: Resuelto
Fase: Fase 3 — Experiencia del estudiante (https://app.notion.com/p/Fase-3-Experiencia-del-estudiante-3b4ba9d6712e8101a01fcda5eda9ab42?pvs=21)
Prioridad: Media
Responsable: Andres Felipe Escobar Duque
Semana estimada: 29 ago – 4 sep

## Qué hay que entregar

La página de catálogo con búsqueda por texto y filtro por categoría.

## Requisitos de calidad (nivel senior)

- [x] La búsqueda y el filtrado se hacen **en el servidor**, no cargando todos los cursos y filtrando en el navegador. Hoy son 10 cursos, pero el patrón correcto se define ahora.
- [x] Usar búsqueda de texto completo de Postgres (`tsvector` + índice GIN) o al menos `ILIKE` con índice. Normalizar tildes: buscar "diseno" debe encontrar "diseño". **Implementado con `ILIKE` + índice GIN de trigramas (`pg_trgm`)**, no `tsvector`: la búsqueda necesita coincidir con substrings a mitad de palabra, que `tsquery` no resuelve bien (opera por palabras completas). Verificado en vivo: `buscar_catalogo('diseno', ...)` encuentra "Diseño Estructural...".
- [x] `debounce` de ~300 ms en el campo de búsqueda para no disparar una consulta por tecla. Se mantuvo el dropdown de sugerencias (en memoria, sin red) y ADEMÁS cada tecla dispara, con debounce de 300ms, una búsqueda real contra el servidor que actualiza la grilla — así seleccionar una sugerencia sigue siendo instantáneo, y escribir sin seleccionar nada también termina filtrando.
- [x] Los filtros viven en la URL (`?categoria=x&q=y`), para que el estado sea compartible y el botón "atrás" funcione. `categoria` usa el slug, no el UUID, para que la URL sea legible.
- [x] Paginación o scroll infinito desde el principio, aunque hoy quepan todos en una página. Paginación con Anterior/Siguiente (`?page=`), 12 cursos por página.
- [x] Estado vacío con mensaje útil ("no encontramos cursos para «x»") y forma de limpiar los filtros. Botón "Limpiar filtros" visible en el estado vacío cuando hay búsqueda o categoría activa.
- [x] Renderizado en servidor de la primera carga para que el catálogo sea indexable por buscadores. Ahora también las cargas CON `?q=`/`?categoria=` se renderizan filtradas en el servidor (antes solo la carga sin parámetros era real SSR; una URL filtrada compartida devolvía el catálogo completo sin filtrar hasta hidratar).

## Definición de "terminado"

Buscar, filtrar, recargar la página y usar el botón atrás mantienen el estado correcto en todo momento.
