# Uva — Especificación Spec-Driven de Plataforma Educativa

### Modelo funcional para una plataforma de educación por suscripción aplicada al gremio de arquitectura, construcción y presupuestos

**Autor:** Claude (Anthropic) — especificación de producto
**Fecha:** 5 de agosto de 2026
**Versión:** 2.0 (revisión legal y de contenido)
**Método:** análisis de patrones de la industria de e-learning por suscripción (modelo general usado por plataformas como Platzi, Coursera, Udemy y similares), sin captura, scraping ni reproducción de contenido, marca, textos o datos propios de ninguna plataforma específica.
**Enfoque:** paridad funcional — replicar la *lógica de producto* y los *patrones de UX* que ya son estándar de facto en el sector del e-learning por suscripción, no la marca, el diseño visual ni los contenidos de ningún competidor.

---

## 0. Cómo leer este documento (y por qué está hecho así)

Este es un documento **spec-driven**: cada módulo se describe en un formato que un equipo de producto/ingeniería puede tomar y construir sin tener que volver a interpretar. Cada módulo contiene:

- **Propósito** — qué problema resuelve ese módulo en el negocio.
- **Anatomía / layout** — qué hay en pantalla y cómo se organiza.
- **Componentes** — piezas reutilizables de UI.
- **Estados** — vacío, cargando, error, bloqueado, lleno.
- **Reglas de negocio** — la lógica que hace funcionar el módulo.
- **User stories** — en formato "Como [rol] quiero [acción] para [beneficio]".
- **Requisitos funcionales (RF)** — numerados, verificables.
- **Criterios de aceptación** — condiciones binarias de "hecho".
- **Detalle específico de Uva** — cómo se traduce al gremio de arquitectura/construcción.

Al final hay un modelo de datos, un roadmap por fases, requisitos no funcionales, y una lista honesta de **vacíos y decisiones pendientes** que hay que resolver antes de construir.

### Nota importante (te hablo directo)
Los patrones descritos aquí (catálogo jerárquico, reproductor con progreso, exámenes que habilitan certificados, gamificación con puntos/racha/ranking, comunidad condicionada a actividad, suscripción escalonada) son **estándares funcionales del sector del e-learning**, presentes —con variaciones— en múltiples plataformas del mercado. No son propiedad exclusiva de ninguna de ellas; son la forma en que la industria resolvió el problema de "cómo mantener a alguien aprendiendo y pagando". Este documento describe **esa lógica genérica**, adaptada al gremio de arquitectura, construcción y presupuestos, sin replicar marca, textos de marketing, diseño visual, nombres de producto ni contenido de ningún competidor específico.

Uva, además, es un producto **vertical y de nicho** (arquitectura, construcción, presupuestos), mientras que las plataformas horizontales masivas atienden mercados como tecnología, inglés o marketing. Varias decisiones del modelo genérico no aplican directamente y otras hay que llevarlas más lejos; donde esto ocurre, se marca explícitamente en la sección "Detalle específico de Uva" y en el capítulo 11.

---

## 1. Resumen ejecutivo

El modelo dominante de las plataformas de educación online por **suscripción** se apoya en cuatro pilares:

1. **Catálogo estructurado en jerarquía de 3 niveles**: Categoría/Escuela → Ruta de aprendizaje → Curso → Clase.
2. **Experiencia de aprendizaje con video + refuerzo**: reproductor de clases con recursos descargables, resumen/transcripción, comentarios/discusión por clase, asistente de IA contextual, y exámenes que habilitan certificados.
3. **Motor de engagement/gamificación**: puntos, racha de actividad, ranking, comunidad con acceso condicionado a actividad reciente, y certificados compartibles.
4. **Monetización por suscripción escalonada**: planes individuales y de empresa, anuales/mensuales, con opción de pago en cuotas y precios localizados por país.

La lógica central que hace que este modelo funcione: **una ruta de aprendizaje personalizada** como unidad de compromiso del usuario, y **el certificado + el ranking** como recompensa que cierra el ciclo motivacional. Todo lo demás (home, catálogo, reproductor) sirve a ese ciclo.

Para Uva, la tesis es adoptar este esqueleto funcional —ya validado por el mercado— y llenarlo con contenido especializado del gremio (arquitectura, construcción, presupuestos, normativa, análisis de precios unitarios), además de herramientas propias como un generador de presupuestos de obra que ninguna plataforma horizontal ofrece hoy.

---

## 2. Nota legal y de alcance

- Este documento describe **patrones estructurales y funcionales genéricos del sector del e-learning**, deducidos del conocimiento general del mercado, no de la observación de una cuenta o sesión autenticada de ningún competidor.
- No se reproduce ni se referencia marca, logotipo, textos de marketing, diseño gráfico, código, contenido de cursos, fotografías de instructores ni datos de cuenta de ninguna plataforma existente.
- Toda la nomenclatura usada para Uva (nombres de módulos, secciones, rutas de URL) es **propia y original**, pensada para el producto de Uva y su gremio, no una copia de un competidor.
- No se incluyen datos personales ni financieros de terceros.
- Recomendación adicional: antes de lanzar, validar con asesoría legal que el naming, la identidad visual y los textos definitivos de Uva sean claramente distintivos frente a cualquier competidor del sector.

---

## 3. Modelo conceptual (arquitectura de información)

### 3.1 Entidades principales del modelo

| Entidad | Descripción |
|---|---|
| **Usuario/Alumno** | Cuenta con perfil, puntos, racha, suscripción activa |
| **Categoría / Escuela** | Agrupador temático macro del catálogo |
| **Ruta de aprendizaje** | Secuencia curada de cursos dentro de una categoría |
| **Ruta personal** | Ruta creada o adoptada individualmente por el usuario |
| **Curso** | Unidad de contenido: N clases + examen + certificado |
| **Clase / Lección** | Video + recursos + resumen + comentarios |
| **Módulo/Sección** | Agrupador de clases dentro de un curso |
| **Examen** | Evaluación que habilita el certificado |
| **Certificado** | Acreditación de aprobación, compartible/descargable |
| **Comentario / Discusión** | Aportación por clase, con hilos y "me gusta" |
| **Comunidad** | Espacio social con acceso condicionado a actividad reciente |
| **Suscripción / Plan** | Relación comercial usuario–plataforma |
| **Puntos / Racha / Ranking** | Sistema de gamificación |
| **Asistente de IA** | Tutor conversacional contextual a curso/clase |
| **Notificaciones** | Avisos al usuario |
| **Búsqueda** | Descubrimiento de contenido por texto |

### 3.2 Relaciones (cardinalidad)

```
Categoría 1───N Ruta 1───N Curso 1───N Módulo 1───N Clase
                              │                        │
                              │ 1                      │ 1
                              │                        │
                              N                        N
                          Examen                  Comentario/Discusión
                              │
                              │ produce
                              ▼
                          Certificado ──N───1 Usuario

Usuario N───N Ruta personal (adopta rutas curadas o crea propias)
Usuario 1───1 Suscripción
Usuario 1───N Puntos/Eventos ──> Ranking (agregación periódica)
```

Punto clave de diseño: **un Curso puede pertenecer a varias Rutas** (relación N:N). Es un patrón estándar del sector: el contenido se produce una vez y se reutiliza en múltiples rutas curadas (p. ej. un curso de "Lectura de planos" puede aparecer tanto en la ruta de Residente de Obra como en la de Presupuestador). Uva debe modelar esto desde el día 1.

---

## 4. Mapa de navegación global (sitemap propuesto para Uva)

### 4.1 Navegación lateral autenticada (sidebar izquierdo)

Propuesta, en orden:

1. **Inicio** → `/home` (dashboard)
2. **Academia** → `/academia` (catálogo)
3. **Comunidad** → `/comunidad` (con acceso condicionado a actividad)
4. **Comentarios** → `/comentarios` (feed de mis aportes/discusiones)
5. **Notificaciones** → `/notificaciones`
6. *(divisor)* **TU PROGRESO**
7. **Mis rutas** → `/mis-rutas`
8. **Progreso** → `/mi-progreso`
9. **Certificados** → `/mis-certificados`
10. *(pie)* CTA Empresas → `/empresas`
11. *(pie)* Ayuda y soporte

El sidebar es **colapsable**.

### 4.2 Header superior (autenticado)
- Buscador global ("¿Qué quieres aprender hoy?") → `/buscar`
- Botón **Preguntar** (asistente de IA)
- **Racha** (icono + contador de días activos)
- **Puntos** (contador) + **avatar** con menú desplegable:
  - Ver mi perfil → `/p/{handle}`
  - Días restantes del plan (indicador)
  - Buscar → `/buscar`
  - Programa de referidos → `/mi-suscripcion/referidos`
  - Mi suscripción → `/mi-suscripcion`
  - Contáctanos → `/contacto`
  - Cerrar sesión → `/logout`
- Selector de **idioma**

### 4.3 Rutas públicas / de conversión
- `/precios` — planes y precios (público, localizado por país)
- `/empresas` — oferta B2B
- Landing de curso `/cursos/{slug}` accesible con y sin sesión (con CTA distinto)

### 4.4 Sitemap propuesto para Uva

```
/                         Landing pública (marketing)
/precios                  Planes
/empresas                 B2B (constructoras, estudios de arquitectura, universidades)
/registro  /login         Auth
/home                     Dashboard autenticado
/academia                 Catálogo (categorías > rutas > cursos)
/categoria/{slug}         Categoría / escuela temática
/ruta/{slug}              Ruta de aprendizaje curada
/cursos/{slug}            Landing de curso
/cursos/{slug}/{clase}    Reproductor de clase
/cursos/{slug}/examen     Examen
/comunidad                Comunidad (acceso condicionado)
/discusiones/...          Hilos de discusión
/mis-rutas                Mis rutas de aprendizaje
/mi-progreso              Progreso + ranking
/mis-certificados         Certificados
/p/{handle}               Perfil público
/mi-suscripcion           Suscripción
/notificaciones           Notificaciones
/buscar                   Búsqueda
```

---

## 5. Especificación por módulos

> Cada módulo sigue el formato definido en la sección 0.

---

### M1 — Onboarding, Registro y Autenticación

**Propósito.** Convertir un visitante en usuario con una ruta activa, minimizando fricción y capturando intención de aprendizaje temprano para personalizar el home.

**Anatomía propuesta.** El usuario aterriza en `/home` con **rutas ya asignadas** según sus respuestas de onboarding, lo que implica un **flujo previo que pregunta objetivos/intereses** y precarga rutas recomendadas.

**Reglas de negocio.**
- Al registrarse, el usuario elige uno o más **objetivos** → el sistema asigna rutas recomendadas.
- El acceso a contenido premium está condicionado a una **suscripción activa** (hay clases marcadas "gratis" que sirven de gancho).

**User stories.**
- US-M1.1 — Como visitante quiero registrarme con email/redes para empezar rápido.
- US-M1.2 — Como nuevo usuario quiero indicar mi objetivo de aprendizaje para recibir una ruta personalizada desde el primer día.
- US-M1.3 — Como usuario quiero cerrar sesión de forma segura.

**Requisitos funcionales.**
- RF-M1.1 — Registro con email + contraseña y con proveedores OAuth (Google, etc.).
- RF-M1.2 — Wizard de onboarding de ≤3 pasos que capture objetivo, nivel y área de interés.
- RF-M1.3 — Al terminar onboarding, generar ≥1 ruta recomendada y redirigir a `/home`.
- RF-M1.4 — Recuperación de contraseña y verificación de email.

**Criterios de aceptación.**
- Un usuario nuevo llega a `/home` con al menos una ruta visible en <2 minutos desde el registro.
- Cerrar sesión invalida la sesión y redirige a la landing pública.

**Detalle específico de Uva.** El onboarding debe preguntar **rol profesional** (arquitecto, ingeniero, maestro de obra, estudiante, contratista, promotor) y **objetivo** (aprender a presupuestar, dominar un software, normativa, gestión de obra). Esto define no solo la ruta sino el **vocabulario** de la interfaz.

---

### M2 — Home / Dashboard del alumno

**Propósito.** Ser el "centro de comando" que reengancha al usuario: le recuerda sus metas, le muestra dónde se quedó y le ofrece el siguiente paso.

**Anatomía propuesta (de arriba a abajo).**
1. **Saludo personalizado** — "Hola [nombre], tienes metas que alcanzar."
2. **Carrusel de rutas activas** — tarjetas grandes por ruta con: pila de cursos, tipo de ruta (curada / personalizada), nivel, título, progreso `X/N cursos`, tiempo restante estimado.
3. **Selector de objetivo activo** — cambia el foco de aprendizaje mostrado.
4. **"Sigue aprendiendo"** — fila de continuación: miniaturas de clases con marca de tiempo donde se quedó + enlace a mis cursos.
5. **Banner de evento** — promoción temporal (webinar, lanzamiento) con **countdown**.
6. **"Recomendado para ti"** — cursos sugeridos según objetivo/actividad.
7. **"Novedades"** — nuevos cursos/lanzamientos, tarjetas con opción de "Añadir a mi ruta".
8. **"Explora por categoría"** — grid de categorías con nº de rutas disponibles.
9. **Sidebar** y **header** globales (ver §4).

**Componentes.**
- `RutaCard` (progreso, tiempo restante, pila de portadas).
- `ContinueWatchingRow` (reanudar clase con marca de tiempo).
- `CourseCard` (portada, título, instructor, nivel, botón "Añadir a ruta").
- `EventBanner` con countdown.
- `CategoryGrid`.

**Estados.**
- Sin rutas → CTA a explorar catálogo / onboarding.
- Con progreso → prioriza "Sigue aprendiendo".
- Suscripción por vencer → aviso con días restantes.

**Reglas de negocio.**
- El home prioriza **reanudar** por encima de descubrir: el primer bloque accionable es "dónde te quedaste".
- El "tiempo restante" se calcula sumando la duración de las clases no vistas de la ruta.

**User stories.**
- US-M2.1 — Como alumno quiero ver de inmediato dónde me quedé para retomar sin buscar.
- US-M2.2 — Como alumno quiero ver mi progreso por ruta para saber cuánto me falta.
- US-M2.3 — Como alumno quiero descubrir cursos nuevos relevantes para mi objetivo.

**Requisitos funcionales.**
- RF-M2.1 — Mostrar rutas activas con progreso `X/N` y tiempo restante calculado.
- RF-M2.2 — Fila "Sigue aprendiendo" con deep-link al segundo exacto de la última clase.
- RF-M2.3 — Bloque de recomendaciones basado en objetivo/actividad.
- RF-M2.4 — Grid de categorías con conteo de rutas.
- RF-M2.5 — Banner de evento configurable con fecha/countdown.

**Criterios de aceptación.**
- Al hacer clic en "Sigue aprendiendo", el reproductor abre la clase correcta en el minuto guardado.
- El progreso mostrado coincide con el registrado en `/mi-progreso`.

**Detalle específico de Uva.** Usar las categorías del gremio (ver §9). El bloque "Recomendado" debe poder recomendar **no solo cursos sino herramientas** (p. ej. "Genera tu primer presupuesto de obra"). El banner de evento sirve para webinars, ferias de construcción, lanzamientos normativos.

---

### M3 — Catálogo / Academia

**Propósito.** Permitir descubrir y navegar todo el contenido, tanto por exploración jerárquica como por filtro.

**Anatomía propuesta.**
- **Cabecera** con claim + **filtros**: combobox "Todas las categorías" y combobox "Todas las rutas".
- **Lista jerárquica**: por cada Categoría (encabezado + enlace), se listan sus Rutas (encabezado + enlace + botón **"Añadir ruta"**), y bajo cada ruta un carrusel/lista de **CourseCards** (portada, título, instructor, nivel).
- El catálogo completo se sirve como una única página larga con toda la taxonomía, con filtros que actualizan la vista sin recargar.

**Componentes.**
- `CategorySection`, `TrackRow` (con "Añadir ruta"), `CourseCard`, `CatalogFilters`.

**Estados.**
- Filtro sin resultados → estado vacío con sugerencia de ajustar filtros.
- Carga progresiva (lazy load) por categoría.

**Reglas de negocio.**
- Un curso puede aparecer en varias rutas simultáneamente (N:N, ver §3.2).
- El orden de categorías y rutas es configurable editorialmente.

**User stories.**
- US-M3.1 — Como usuario quiero explorar por categoría para entender toda la oferta.
- US-M3.2 — Como usuario quiero filtrar por ruta específica para ir directo a lo que busco.
- US-M3.3 — Como usuario quiero añadir una ruta completa a mi plan con un clic.

**Requisitos funcionales.**
- RF-M3.1 — Listado jerárquico Categoría → Ruta → Curso, navegable y filtrable.
- RF-M3.2 — Botón "Añadir ruta" que la incorpora a "Mis rutas" del usuario autenticado.
- RF-M3.3 — Cada `CourseCard` enlaza a la landing del curso (M4).

**Criterios de aceptación.**
- Aplicar un filtro de categoría reduce la lista a esa categoría sin recargar la página completa.
- "Añadir ruta" agrega la ruta a `/mis-rutas` del usuario.

**Detalle específico de Uva.** El filtro debe incluir, además de categoría y nivel, **software/herramienta** (Revit, AutoCAD, Excel de presupuestos) y **normativa/país**, criterios de búsqueda propios del gremio.

---

### M4 — Landing de curso

**Propósito.** Convencer al usuario de iniciar el curso mostrando temario, duración y prueba social antes del compromiso.

**Anatomía propuesta.**
- Header con título, rating, nº de opiniones, fecha de publicación/actualización, nivel, nº de clases, horas de contenido y horas de práctica.
- Temario por secciones, con clases numeradas y su duración.
- Acciones: Iniciar/Continuar, Añadir a ruta, Hacer examen (si aplica).
- Panel de asistente de IA con preguntas sugeridas contextuales al curso.
- Sección de opiniones/reseñas.

**Reglas de negocio.**
- Duración de "contenido" (video) y "práctica" son métricas separadas.

**User stories.**
- US-M4.1 — Como usuario quiero ver el temario completo y la duración antes de comprometerme.
- US-M4.2 — Como usuario quiero conocer la reputación del curso (rating/opiniones).
- US-M4.3 — Como usuario quiero añadir el curso a una ruta o iniciarlo directamente.

**Requisitos funcionales.**
- RF-M4.1 — Header con título, rating, opiniones, fecha, nivel, nº clases, horas de contenido y de práctica.
- RF-M4.2 — Temario por secciones con clases numeradas y duración.
- RF-M4.3 — Acciones: Iniciar/Continuar, Añadir a ruta, Hacer examen.
- RF-M4.4 — Panel de asistente de IA con preguntas sugeridas contextuales al curso.
- RF-M4.5 — Sección de opiniones/reseñas accesible.

**Criterios de aceptación.**
- "Iniciar Curso" abre la primera clase en el reproductor.
- El nº de clases del header coincide con el conteo del temario.

**Detalle específico de Uva.** Añadir en el header metadatos del gremio: **software/herramientas requeridas** (Revit, AutoCAD, Excel), **entregables del curso** (p. ej. "sales con una plantilla de presupuesto funcional"), y **aplicabilidad normativa/país** (NSR-10, RETIE, etc.). El panel de IA debe poder responder con contexto técnico del oficio.

---

### M5 — Reproductor de clase (núcleo de la experiencia de aprendizaje)

**Propósito.** Es el corazón del producto: donde ocurre el aprendizaje. Todo lo demás existe para traer al usuario aquí y mantenerlo.

**Anatomía propuesta.**
- **Barra superior contextual:** icono/título del curso, indicador de posición ("Clase X/N"), atajo de teclado, botón **"Siguiente clase"**, acciones "Reportar clase" y **"Compartir esta lección gratuita"**.
- **Reproductor de video** (área principal) con subtítulos y marca de la plataforma.
- **RECURSOS:** enlaces a material externo/descargable de la clase.
- **RESUMEN:** transcripción/resumen enriquecido de la clase, con conceptos clave resaltados.
- **Panel derecho — Comentarios/Discusiones:**
  - Encabezado "¿Dudas?" con acceso al asistente de IA.
  - Contador de comentarios + control de orden.
  - Caja para escribir un comentario o aportación.
  - **Hilos** con: autor + rol, antigüedad, texto, acciones **"Me gusta"** con contador y **Responder**, y opción de ver más respuestas.
- **Panel de temario (toggle):** overlay con **"Progreso del curso — X% completado"** y la lista de clases agrupada por secciones, cada una con miniatura, título, duración y estado (vista/no vista).

**Componentes.**
- `VideoPlayer` (subtítulos, velocidad, calidad, marcador de progreso).
- `ClassTopBar` (posición X/N, siguiente, reportar, compartir).
- `ResourcesList`, `ClassSummary`.
- `DiscussionPanel` (hilos, "me gusta", respuestas, orden).
- `CourseProgressDrawer` (temario navegable con % y estados).
- `AITutorLauncher`.

**Estados.**
- Clase gratuita vs. premium.
- Clase vista / en progreso / no vista.
- Sin comentarios → estado vacío.

**Reglas de negocio.**
- Marcar clase como completada **suma progreso** al curso y a la ruta, y **otorga puntos** (ver M10).
- Navegación por teclado (flechas) entre clases.
- Cada clase tiene su **hilo de discusión** independiente.
- Los comentarios se pueden marcar con "me gusta" y responder (hilos anidados).

**User stories.**
- US-M5.1 — Como alumno quiero ver el video con subtítulos y controlar velocidad/calidad.
- US-M5.2 — Como alumno quiero navegar al temario sin salir de la clase.
- US-M5.3 — Como alumno quiero preguntar mis dudas y ver las de otros en la misma clase.
- US-M5.4 — Como alumno quiero descargar los recursos de la clase.
- US-M5.5 — Como alumno quiero que mi progreso se guarde automáticamente.

**Requisitos funcionales.**
- RF-M5.1 — Reproductor con subtítulos, control de velocidad y calidad, y guardado de posición.
- RF-M5.2 — Barra con posición X/N, "siguiente clase", reportar y compartir.
- RF-M5.3 — Sección de recursos descargables por clase.
- RF-M5.4 — Resumen/transcripción de la clase.
- RF-M5.5 — Panel de discusiones por clase: crear, ordenar, dar "me gusta", responder en hilo.
- RF-M5.6 — Drawer de progreso del curso con temario y estados.
- RF-M5.7 — Marcar clase como completada (manual y/o automático al terminar el video) que actualiza progreso y puntos.
- RF-M5.8 — Navegación por teclado entre clases.

**Criterios de aceptación.**
- Al terminar una clase, el progreso del curso aumenta y la siguiente clase queda accesible.
- Un comentario nuevo aparece en el hilo y es enlazable por URL propia.
- Al reabrir la clase, el video reanuda en el segundo guardado.

**Detalle específico de Uva.** Los **recursos** son un diferenciador crítico: plantillas de análisis de precios unitarios (APU), hojas de cálculo de cantidades, planos de ejemplo, checklists normativos. El "Resumen" debe soportar **fórmulas, tablas y unidades** (no solo prosa). Considerar un tipo de clase **"práctica guiada"** donde el alumno usa una herramienta (p. ej. arma un presupuesto) en vez de solo ver video.

---

### M6 — Exámenes y evaluación

**Propósito.** Validar aprendizaje y **desbloquear el certificado**, cerrando el ciclo de logro.

**Anatomía propuesta.** Botón **"Hacer examen"** en la landing del curso, disponible tras avanzar suficiente contenido. Modelo: examen de opción múltiple, con nota mínima de aprobación, reintentos, y emisión de certificado al aprobar.

**Reglas de negocio.**
- El examen existe a nivel de **curso** (y hay certificados también a nivel de **ruta**, ver M11).
- Aprobar → emite certificado + suma puntos.
- Debe haber **umbral de aprobación** y **reintentos** con posible límite/tiempo de espera.

**User stories.**
- US-M6.1 — Como alumno quiero presentar el examen para obtener mi certificado.
- US-M6.2 — Como alumno quiero saber mi nota y qué fallé para mejorar.
- US-M6.3 — Como alumno quiero reintentar si no aprobé.

**Requisitos funcionales.**
- RF-M6.1 — Motor de exámenes con banco de preguntas (opción múltiple mínimo) y aleatorización.
- RF-M6.2 — Umbral de aprobación configurable por curso.
- RF-M6.3 — Registro de intentos, nota y retroalimentación.
- RF-M6.4 — Emisión automática de certificado al aprobar.
- RF-M6.5 — Examen a nivel de ruta (evaluación integradora) además de por curso.

**Criterios de aceptación.**
- Al aprobar, el certificado aparece en `/mis-certificados` y en el perfil público.
- Un intento reprobado permite reintento según política definida.

**Detalle específico de Uva.** Además de opción múltiple, Uva necesita **evaluación por entregable/proyecto** (subir un presupuesto, un plano, un cálculo) y, potencialmente, **rúbrica** revisada por IA o por instructor. Esto es más valioso en un oficio técnico que un test de memoria.

---

### M7 — Comentarios y Discusiones

**Propósito.** Convertir el consumo pasivo de video en aprendizaje social y generar contenido (dudas/aportes) que retiene y mejora los cursos.

**Anatomía propuesta.**
- Por clase (en el reproductor, M5) y agregados en un feed personal de comentarios propios.
- Cada discusión y cada comentario tienen URL propia (enlazable/compartible).
- Acciones: **"me gusta"** (con contador), **responder** (hilos), **ordenar**, **opciones** (editar/reportar).
- Autores etiquetados por rol (Alumno, Instructor, Equipo).

**User stories.**
- US-M7.1 — Como alumno quiero publicar dudas/aportes en la clase exacta.
- US-M7.2 — Como alumno quiero ver y responder a otros para aprender en comunidad.
- US-M7.3 — Como alumno quiero ver en un solo lugar todas mis participaciones.

**Requisitos funcionales.**
- RF-M7.1 — CRUD de comentarios por clase con hilos anidados.
- RF-M7.2 — "Me gusta" y ordenamiento (recientes / más votados).
- RF-M7.3 — URL individual por discusión y por comentario (enlazable/compartible).
- RF-M7.4 — Feed personal agregando todas las participaciones del usuario.
- RF-M7.5 — Moderación: reportar, roles de autor, opciones de edición.

**Criterios de aceptación.**
- Un comentario es accesible por su URL directa.
- El feed de comentarios lista todas las participaciones del usuario.

**Detalle específico de Uva.** Habilitar **adjuntos** en comentarios (una foto de obra, un detalle constructivo, un fragmento de presupuesto). En el gremio, la duda suele ser visual/técnica y el texto plano no basta.

---

### M8 — Comunidad (acceso condicionado)

**Propósito.** Espacio social de mayor nivel que las discusiones por clase, usado como **mecanismo de retención**.

**Anatomía propuesta.** `/comunidad` muestra un estado **bloqueado** con un mensaje del tipo: *"Completa un curso en los últimos 30 días para mantener tu acceso a la comunidad."*

**Regla de negocio (clave y muy replicable en el sector).**
- El acceso a la comunidad es un **privilegio condicionado a actividad**: exige **haber completado ≥1 curso en los últimos 30 días**. Esto crea un bucle: para socializar, hay que aprender; para no perder el acceso, hay que seguir aprendiendo.

**User stories.**
- US-M8.1 — Como alumno activo quiero acceder a la comunidad para conectar con pares.
- US-M8.2 — Como plataforma quiero condicionar la comunidad a la actividad para incentivar la finalización de cursos.

**Requisitos funcionales.**
- RF-M8.1 — Gate de acceso: verificar "≥1 curso completado en los últimos 30 días".
- RF-M8.2 — Estado bloqueado con explicación y CTA a un curso.
- RF-M8.3 — (Cuando desbloqueada) feed social: publicaciones, temas, interacción.

**Criterios de aceptación.**
- Un usuario sin curso completado en 30 días ve el estado bloqueado.
- Al completar un curso, la comunidad se desbloquea.

**Detalle específico de Uva.** Excelente palanca a conservar. En Uva la comunidad puede segmentarse por **oficio/región** (normativa y precios varían por país) y ser el lugar donde se comparten precios de mercado, proveedores, y casos de obra. Ojo: en fase MVP con poca masa de usuarios, una comunidad vacía es peor que no tenerla — activarla cuando haya densidad.

---

### M9 — Rutas de aprendizaje ("Mis rutas")

**Propósito.** Es la **unidad de compromiso** del usuario: convierte cursos sueltos en un plan de aprendizaje con meta y progreso.

**Anatomía propuesta (`/mis-rutas`).**
- Título "Mis rutas" + botón **"Crear ruta"**.
- Lista de rutas, cada una con: icono, título, **tipo** (curada por Uva vs. **personalizada**), nº de cursos, **% de progreso**, y acción **"Eliminar"**.

**Componentes.** `RutaListItem`, `CreateRutaButton`, `ProgressBar`.

**Reglas de negocio.**
- Dos tipos: **rutas curadas por la plataforma** y **rutas personalizadas** creadas por el usuario.
- El usuario puede **crear, adoptar y eliminar** rutas.
- El progreso de la ruta agrega el progreso de sus cursos.

**User stories.**
- US-M9.1 — Como alumno quiero adoptar una ruta curada para seguir un plan probado.
- US-M9.2 — Como alumno quiero crear mi propia ruta combinando cursos.
- US-M9.3 — Como alumno quiero ver y gestionar todas mis rutas.

**Requisitos funcionales.**
- RF-M9.1 — Listar rutas con tipo, nº de cursos y % de progreso.
- RF-M9.2 — Crear ruta personalizada (añadir/ordenar cursos).
- RF-M9.3 — Adoptar ruta curada; eliminar ruta.
- RF-M9.4 — Cálculo de progreso agregado por ruta.

**Criterios de aceptación.**
- "Crear ruta" permite componer una ruta y guardarla; aparece en la lista.
- Eliminar una ruta la quita sin afectar el progreso individual de cursos.

**Detalle específico de Uva.** Las rutas curadas son oro para un nicho: p. ej. "De cero a presupuestador de obra", "Arquitecto BIM", "Residente de obra". El **generador de rutas personalizadas** puede apoyarse en IA para armar el plan según el objetivo del usuario.

---

### M10 — Progreso y Gamificación

**Propósito.** Motor de motivación y retención mediante métricas, competencia y hábitos.

**Anatomía propuesta.**
- **Header global:** contador de **racha** (icono + nº de días) y **puntos** acumulados.
- **`/mi-progreso`:**
  - Gráfico de actividad reciente (clases realizadas por día, últimos 7 días).
  - **Ranking del periodo** (semanal): top posiciones con nombre + puntos, y **la posición del propio usuario**, con indicadores de subida/bajada.

**Reglas de negocio.**
- Se ganan **puntos** por actividad (completar clases, aprobar exámenes, participar).
- La **racha** cuenta días consecutivos de actividad.
- El **ranking** se calcula **periódicamente** (p. ej. semanal, con reinicio).
- Ver clases suma a la métrica de "asistencia".

**User stories.**
- US-M10.1 — Como alumno quiero ver mis puntos y mi racha para sentir progreso.
- US-M10.2 — Como alumno quiero ver mi posición en el ranking para competir/motivarme.
- US-M10.3 — Como alumno quiero visualizar mi actividad reciente.

**Requisitos funcionales.**
- RF-M10.1 — Sistema de puntos con eventos configurables (clase completada, examen aprobado, comentario, etc.).
- RF-M10.2 — Racha de días consecutivos con lógica de ruptura y recuperación.
- RF-M10.3 — Leaderboard periódico con posición propia y variación.
- RF-M10.4 — Gráfico de actividad (asistencia por día).
- RF-M10.5 — Exposición de puntos/racha en el header en todo momento.

**Criterios de aceptación.**
- Completar una clase incrementa puntos y actualiza el gráfico de actividad.
- El leaderboard refleja el periodo actual y ubica al usuario con su posición exacta.

**Detalle específico de Uva.** Mantener puntos + racha + ranking (funcionan en cualquier nicho). Añadir **logros por hito profesional** ("Primer presupuesto completado", "Ruta BIM terminada"). Considerar ranking **por categoría/oficio** además de global, porque un ranking global muy amplio puede desmotivar más que motivar — segmentar mejora la percepción de logro.

---

### M11 — Certificados

**Propósito.** Recompensa tangible y **prueba social/profesional** que el usuario comparte, generando marketing orgánico.

**Anatomía propuesta.**
- **`/mis-certificados`** con pestañas **"Cursos"** y **"Rutas"** (certificado también a nivel de ruta).
- En el **perfil público**: sección "Mis certificados" con tarjetas de certificado (nombre del alumno, curso, fecha de aprobación) y opción de **compartir** en redes + copiar enlace + descargar.
- Beneficio de plan superior: **certificado físico** para rutas completas, no solo digital.

**Reglas de negocio.**
- Certificado digital por **curso aprobado** y por **ruta completada**.
- Cada certificado tiene un **código de verificación** y URL pública.
- Compartible en redes y descargable; físico en ciertos planes.

**User stories.**
- US-M11.1 — Como alumno quiero obtener un certificado verificable al aprobar.
- US-M11.2 — Como alumno quiero compartirlo en LinkedIn para mi perfil profesional.
- US-M11.3 — Como reclutador quiero verificar la autenticidad de un certificado.

**Requisitos funcionales.**
- RF-M11.1 — Emisión de certificado por curso y por ruta.
- RF-M11.2 — Código único + página pública de verificación.
- RF-M11.3 — Compartir en redes y descargar (PDF/imagen).
- RF-M11.4 — Listado en `/mis-certificados` (pestañas Cursos/Rutas) y en perfil público.
- RF-M11.5 — (Plan superior) generación de certificado físico.

**Criterios de aceptación.**
- Un certificado emitido es verificable por su código en una URL pública.
- Compartir en LinkedIn precarga los datos del certificado.

**Detalle específico de Uva.** Enorme oportunidad: los certificados de Uva pueden alinearse con **necesidades reales del gremio** (constancias para licitaciones, formación continua, avales de colegios profesionales). Explorar **acreditación con entidades del sector** para que el certificado tenga peso, no solo estético.

---

### M12 — Perfil público

**Propósito.** Identidad del usuario en la plataforma; vitrina de logros.

**Anatomía propuesta (`/p/{handle}`).**
- Avatar, nombre, **@handle**, país (bandera), opción "Editar perfil".
- Panel de estadísticas: **Puntos**, **Respuestas**, **Preguntas**.
- **"Mis certificados"** (pestañas Cursos/Rutas) con tarjetas compartibles/descargables.

**User stories.**
- US-M12.1 — Como alumno quiero un perfil público que muestre mis logros.
- US-M12.2 — Como visitante quiero ver el perfil de otro alumno/instructor.

**Requisitos funcionales.**
- RF-M12.1 — Perfil público con avatar, handle, país, estadísticas y certificados.
- RF-M12.2 — Edición de datos propios (avatar, nombre, país).

**Criterios de aceptación.**
- El perfil es accesible por su URL pública sin necesidad de sesión.

**Detalle específico de Uva.** El perfil puede funcionar como **portafolio profesional**: mostrar especialidades, software dominado y proyectos/entregables realizados durante los cursos.

---

### M13 — Suscripción, Precios y Checkout (Monetización)

**Propósito.** Capturar y retener ingresos recurrentes.

**Anatomía propuesta.**

**Página de precios (`/precios`, pública, localizada):**
- Toggle **Personas / Empresas**.
- Estructura de planes sugerida:
  - **Plan Básico** — Mensual, 1 estudiante, precio/mes, cobro recurrente. Beneficios limitados (sin certificados físicos, sin categorías premium, sin app offline, sin eventos).
  - **Plan Pro** — Anual, 1 estudiante, **destacado** (ahorro frente al mensual), todos los beneficios.
  - **Plan Pro Dúo** — Anual, 2 estudiantes.
  - **Plan Pro Equipos** — Anual, 4–50 estudiantes, con **selector de cantidad**.
- **Pago en cuotas sin interés** indicado por plan.
- Nota fiscal (impuestos) al pie.

**Panel de suscripción (`/mi-suscripcion`):**
- Datos del usuario + **nombre del plan** + **días restantes**.
- **Beneficios del plan** (lista).
- **Método de pago** (tarjeta enmascarada) + cambiar tarjeta.
- **Próximos cobros** (calendario de cuotas con estado Pendiente).
- Acciones: **Pausar**, **Cambiar plan**, **Cancelar suscripción**.
- **Mis pagos / Mis recibos**.
- **Referidos**: programa de "1 mes gratis" por invitación.

**Reglas de negocio.**
- Modelo **suscripción**, no compra de cursos sueltos. El plan anual es el foco (mejor precio, más beneficios).
- **Precios localizados por país** y moneda.
- **Cuotas sin interés** para reducir fricción del anual.
- **Referidos** como canal de crecimiento (mes gratis).
- Gestión de ciclo de vida: pausar, cambiar, cancelar; historial de pagos/recibos.

**User stories.**
- US-M13.1 — Como visitante quiero comparar planes para elegir el adecuado.
- US-M13.2 — Como usuario quiero pagar en cuotas sin interés.
- US-M13.3 — Como usuario quiero gestionar mi plan (pausar/cambiar/cancelar) y ver mis pagos.
- US-M13.4 — Como usuario quiero referir amigos y ganar tiempo gratis.

**Requisitos funcionales.**
- RF-M13.1 — Página de precios con toggle Personas/Empresas y comparativa de beneficios.
- RF-M13.2 — Planes: individual mensual, individual anual, dúo, grupos (con selector de cantidad).
- RF-M13.3 — Localización de precios y moneda por país.
- RF-M13.4 — Checkout con pago recurrente y opción de cuotas.
- RF-M13.5 — Panel de gestión: plan, días restantes, método de pago, cuotas, pausar/cambiar/cancelar.
- RF-M13.6 — Historial de pagos/recibos.
- RF-M13.7 — Programa de referidos.

**Criterios de aceptación.**
- Un usuario puede suscribirse a un plan y ver el cargo reflejado en "Mis pagos".
- Cambiar/cancelar plan actualiza el estado en `/mi-suscripcion`.

**Detalle específico de Uva.** El plan **Empresas/Equipos** es probablemente **más estratégico para Uva** que en un producto horizontal: constructoras, estudios de arquitectura y universidades pueden formar equipos completos. Considerar además **planes por proyecto/obra** o **licencias institucionales**. La localización de precios es obligatoria si Uva apunta a varios países de LATAM (los precios de construcción y el poder adquisitivo varían mucho).

---

### M14 — Asistente de IA (tutor contextual)

**Propósito.** Asistente contextual que resuelve dudas al instante, aumentando la finalización y reduciendo la fricción.

**Anatomía propuesta.**
- Botón **"Preguntar"** en header, en la landing de curso y en el reproductor.
- En la landing, ofrece **preguntas sugeridas** contextuales al curso.

**User stories.**
- US-M14.1 — Como alumno quiero preguntar dudas sobre la clase y obtener respuesta inmediata.
- US-M14.2 — Como alumno quiero sugerencias de preguntas para explorar el tema.

**Requisitos funcionales.**
- RF-M14.1 — Chat IA contextual a curso/clase (usa el temario/transcripción como contexto).
- RF-M14.2 — Preguntas sugeridas dinámicas.
- RF-M14.3 — Accesible desde header, landing y reproductor.

**Criterios de aceptación.**
- El asistente responde con contexto de la clase actual.

**Detalle específico de Uva.** Aquí Uva puede diferenciarse claramente: un asistente de IA especializado en el gremio que no solo explique el video, sino que **ayude a construir un presupuesto, verifique un APU, o consulte normativa**. Conectar el asistente con las herramientas propias (generador de presupuestos) sería un diferenciador fuerte frente a cualquier plataforma horizontal.

---

### M15 — Notificaciones

**Propósito.** Reenganchar (respuestas a comentarios, recordatorios de racha, novedades, cuotas).

**Anatomía propuesta.** Ítem "Notificaciones" en el nav con indicador de no leídas, y centro de notificaciones accesible desde el ícono.

**Requisitos funcionales.**
- RF-M15.1 — Centro de notificaciones con estados leído/no leído.
- RF-M15.2 — Tipos: social (respuestas/likes), progreso (racha en riesgo, curso nuevo en tu ruta), transaccional (cuota/recibo).
- RF-M15.3 — Notificaciones por email/push además de in-app.

**Detalle específico de Uva.** Recordatorios de racha y de "tu comunidad se bloquea en X días" son de alto impacto en retención.

---

### M16 — Búsqueda

**Propósito.** Descubrimiento por intención directa.

**Anatomía propuesta.** Buscador prominente en el header ("¿Qué quieres aprender?") → `/buscar`.

**Requisitos funcionales.**
- RF-M16.1 — Búsqueda full-text sobre cursos, rutas, categorías y clases.
- RF-M16.2 — Filtros por categoría, nivel, tipo, y (Uva) oficio.
- RF-M16.3 — Sugerencias/autocompletado.

---

### M17 — B2B / Empresas

**Propósito.** Vender formación a organizaciones (mayor ticket, menor CAC relativo).

**Anatomía propuesta.** CTA recurrente tipo "Lleva Uva a tu equipo" → `/empresas`; toggle "Empresas" en precios; plan de grupos (4–50).

**Detalle específico de Uva.** Segmento natural: constructoras, estudios, ferreterías/proveedores (formación a su red), universidades e institutos técnicos. Requiere: panel de administración de equipos, asignación de rutas, reportes de progreso por colaborador, y facturación empresarial.

---

## 6. Modelo de datos (propuesto para Uva)

Entidades y campos mínimos (no exhaustivo; base para el esquema):

- **User**(id, handle, name, email, avatar, country, role/oficio, points, streak_count, streak_last_active, created_at)
- **Category**(id, slug, name, description, order)
- **Track**(id, slug, name, category_id, description, curated:boolean, order)
- **Course**(id, slug, title, description, level[basico|intermedio|avanzado], type[curso|audiocurso|taller|herramienta|gratis], instructor_id, content_minutes, practice_minutes, rating_avg, ratings_count, published_at)
- **TrackCourse**(track_id, course_id, order) ← relación N:N
- **Section**(id, course_id, title, order)
- **Lesson**(id, course_id, section_id, slug, title, video_url, duration, summary, order, is_free:boolean)
- **Resource**(id, lesson_id, title, url/file, type)
- **Enrollment**(id, user_id, course_id, progress_pct, started_at, completed_at)
- **LessonProgress**(id, user_id, lesson_id, seconds_watched, completed:boolean, completed_at)
- **UserTrack**(id, user_id, track_id?, custom_name?, type[curada|personalizada], created_at)
- **Exam**(id, course_id or track_id, pass_threshold, attempts_allowed)
- **ExamAttempt**(id, user_id, exam_id, score, passed, taken_at)
- **Certificate**(id, user_id, course_id or track_id, code, issued_at, physical:boolean)
- **Discussion**(id, lesson_id, user_id, body, created_at)
- **DiscussionReply**(id, discussion_id, user_id, body, created_at)
- **Like**(user_id, discussion_id/reply_id)
- **PointsEvent**(id, user_id, type, points, created_at) ← alimenta ranking y racha
- **Subscription**(id, user_id, plan, status[active|paused|canceled], seats, renews_at, days_left)
- **Payment**(id, subscription_id, amount, currency, status, due_date, paid_at)
- **Referral**(id, referrer_id, referred_id, reward_granted)
- **Notification**(id, user_id, type, payload, read:boolean, created_at)

---

## 7. Reglas de gamificación (consolidado)

| Evento | Efecto |
|---|---|
| Ver/terminar una clase | +puntos, +asistencia del día, mantiene racha |
| Aprobar examen | +puntos, emite certificado |
| Completar curso | Desbloquea/renueva **comunidad por 30 días** |
| Actividad diaria | Incrementa **racha** (días consecutivos) |
| Puntos acumulados en la semana | Posición en **ranking semanal** |
| Referir a alguien | +1 mes gratis |

Bucle de retención central: **Aprender → ganar puntos/racha/certificado → competir en ranking → mantener comunidad activa → volver a aprender.**

---

## 8. Requisitos no funcionales (RNF)

- **RNF-1 Rendimiento:** el reproductor y el home deben cargar contenido crítico en <2.5s; streaming de video adaptativo (HLS).
- **RNF-2 Responsive/App:** web responsive + app móvil con **descarga offline**.
- **RNF-3 i18n/localización:** multi-idioma y **precios/moneda por país**.
- **RNF-4 Accesibilidad:** subtítulos en video, navegación por teclado, buen contraste.
- **RNF-5 Escalabilidad de catálogo:** el modelo N:N curso–ruta permite miles de cursos reutilizados en cientos de rutas.
- **RNF-6 Seguridad y pagos:** cumplimiento PCI vía pasarela; datos de tarjeta nunca en la plataforma.
- **RNF-7 Analítica:** tracking de progreso, finalización, retención y ranking; base para recomendaciones.
- **RNF-8 SEO:** landings de curso públicas e indexables.

---

## 9. Adaptación específica para Uva (arquitectura, construcción, presupuestos, educación)

### 9.1 Categorías propuestas
1. **Fundamentos de Arquitectura** (teoría, historia, representación).
2. **Diseño Arquitectónico** (proyecto, criterios, sostenibilidad).
3. **Software y BIM** (AutoCAD, Revit, ArchiCAD, SketchUp, Rhino).
4. **Construcción y Obra** (sistemas constructivos, materiales, procesos).
5. **Presupuestos y Costos** (APU, cantidades, AIU, cotización) ← núcleo diferenciador.
6. **Gestión y Dirección de Obra** (residencia, cronograma, gestión de proyectos aplicada).
7. **Normativa y Legal** (por país: NSR-10, RETIE, POT, licencias).
8. **Instalaciones** (hidrosanitarias, eléctricas, HVAC).
9. **Renderizado y Visualización** (Lumion, V-Ray, Twinmotion).
10. **Negocio para Arquitectos y Constructores** (freelance, estudio, licitaciones, marca personal).

### 9.2 Rutas curadas de ejemplo
- "De cero a presupuestador de obra"
- "Arquitecto BIM (Revit de básico a avanzado)"
- "Residente de obra: primeros 90 días"
- "Monta tu estudio de arquitectura y consíguelo rentable"
- "Domina las licitaciones públicas de construcción"

### 9.3 Tipos de contenido propios (más allá del video)
- **Herramientas/plantillas** como ítem de catálogo (plantillas de APU, cantidades, cronogramas).
- **Prácticas guiadas** donde el alumno produce un entregable real.
- **Recursos técnicos** en la clase: planos, hojas de cálculo, checklists normativos, detalles constructivos.

### 9.4 Integración con capacidades propias
- **Generador de presupuestos de obra** (APU, cantidades, base de precios) integrado como herramienta dentro de los cursos de Presupuestos y accesible desde el asistente de IA. Esto es un diferenciador que las plataformas horizontales genéricas no tienen, y convierte a Uva de "cursos de construcción" en "plataforma de trabajo + aprendizaje".
- **Asistente de IA especializado** que responde con criterio técnico del gremio y opera herramientas.

### 9.5 Dónde Uva debe tomar decisiones propias (no copiar el modelo genérico sin criterio)
- No lanzar **comunidad** hasta tener densidad de usuarios (una comunidad vacía perjudica).
- No usar **ranking global** de entrada: segmentar por oficio/categoría para que el logro se sienta.
- No limitarse a **video pasivo**: el gremio aprende haciendo; priorizar prácticas con entregable.
- Localización de precios y **normativa por país** desde el diseño, no como parche.

---

## 10. Roadmap de construcción por fases (spec-driven)

**Fase 0 — Núcleo de contenido (MVP mínimo vendible)**
- M1 Auth + onboarding básico, M3 Catálogo, M4 Landing de curso, M5 Reproductor (video + recursos + progreso), M13 Suscripción/checkout.
- Objetivo: se puede pagar y aprender. Sin esto no hay negocio.

**Fase 1 — Ciclo de logro**
- M6 Exámenes, M11 Certificados, M2 Home con "sigue aprendiendo", M9 Rutas (adoptar rutas curadas).
- Objetivo: cerrar el bucle aprender→certificar→volver.

**Fase 2 — Engagement**
- M10 Gamificación (puntos/racha/ranking), M7 Discusiones por clase, M14 Asistente de IA, M15 Notificaciones.
- Objetivo: retención y hábito.

**Fase 3 — Social y escala**
- M8 Comunidad (con acceso condicionado, cuando haya densidad), M9 crear rutas personalizadas, M12 Perfil como portafolio, M16 Búsqueda avanzada.

**Fase 4 — B2B y diferenciación**
- M17 Empresas (equipos, reportes), integración del **generador de presupuestos**, prácticas con entregable, acreditaciones del gremio.

---

## 11. Vacíos, supuestos y preguntas abiertas (para resolver antes de construir)

Decisiones que este documento no puede tomar por Uva y que quedan pendientes de definición:

1. **Flujo de examen:** modelo propuesto es opción múltiple + umbral + reintentos. → ¿Qué modelo de evaluación quiere Uva (test vs. entregable/rúbrica)?
2. **Reglas exactas de puntos y racha:** los valores por evento deben definirse propios de Uva, no copiados de ningún competidor.
3. **Contenido de la comunidad:** la regla de acceso propuesta (curso completado en 30 días) es un patrón de referencia; el contenido y moderación interna quedan por diseñar.
4. **Flujo de checkout paso a paso:** falta definir la pasarela de pago y el detalle de UX del proceso.
5. **App móvil y offline:** a validar como beneficio de plan o funcionalidad base.
6. **Datos y precios reales de mercado:** deben construirse con investigación propia del gremio, no inferidos de un competidor.

**Preguntas para definir con el equipo de Uva:**
- ¿Uva es **suscripción** o también contempla **venta de cursos/rutas sueltos** o **licencias por proyecto/obra**?
- ¿El **modelo de evaluación** prioriza test rápido o entregable profesional revisado (más valioso pero más costoso de operar)?
- ¿Arranca **mono-país** (Colombia) o **multi-país LATAM** desde el inicio? Esto define localización de precios y normativa desde la arquitectura.
- ¿El **generador de presupuestos** es parte del producto educativo o un producto conexo? De la respuesta depende cuánto peso se le da en el core.

---

*Fin del documento v2.0. Especificación funcional basada en patrones estándar de la industria del e-learning por suscripción, adaptada de forma original al gremio de arquitectura, construcción y presupuestos para el producto Uva.*
