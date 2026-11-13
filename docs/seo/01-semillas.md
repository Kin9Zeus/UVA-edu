# Etapa 2 (parte 1). Temas semilla

**Fase 14, SEO y GEO, 13 de noviembre de 2026, Aleck Martínez**

## De dónde salen

Los 40 temas salen de lo que UVA enseña hoy, no de lo que me gustaría posicionar:

- **Los 11 cursos y diplomados** de la web actual (`https://www.uvarq.com/cursos`, consultada el 13 de noviembre de 2026), con su temario tomado del repositorio de esa web (`src/lib/data/courses.ts`). Inventario en [`datos/inventario-cursos-web-actual.csv`](datos/inventario-cursos-web-actual.csv).
- **La promesa de la portada de la plataforma:** «diseño, modelado, presupuesto, contratación y gestión de obra».
- **Los cuatro cargos del público:** arquitecto, residente de obra, presupuestador y coordinador BIM.

**Lo que no sé todavía (SIN DATO):** qué cursos están publicados hoy en la plataforma y cuáles son sus escuelas (en la plataforma se llaman «escuelas» y salen de la tabla `categorias`; la web actual usa cuatro categorías: gestión, visualización, diseño y software). Cuando tenga la exportación de `/admin/cursos` ajusto la columna «Curso relacionado».

**Sobre los regionalismos.** Marco como variante de Colombia lo que los resultados de búsqueda que consulté usan de forma consistente (por ejemplo «interventoría» en una universidad colombiana frente a «supervisión de obra» en ofertas de Perú, o «AIU» como forma colombiana de agrupar costos indirectos según una guía del sector). No son reglas, son tendencias observadas; se confirman con datos reales de Keyword Planner (ver `02-datos-palabras-clave.md`).

## Los 40 temas

Columnas: tema semilla; variantes de Colombia y Latinoamérica; pregunta típica de quien lo busca; curso relacionado.

### A. Presupuestos y costos (presupuestador, arquitecto independiente)

| # | Tema | Variantes | Pregunta típica | Curso relacionado |
| ---: | --- | --- | --- | --- |
| 1 | Presupuesto de obra | presupuesto de construcción, presupuesto de obra civil, presupuesto de obra paso a paso | «¿Cómo hago un presupuesto de obra desde cero?» | Gerencia de Proyectos, Costos y Presupuestos; Claude IA para Presupuestos |
| 2 | Análisis de precios unitarios (APU) | APU construcción, precios unitarios, matriz de precios unitarios | «¿Cómo se calcula un APU?» | Gerencia de Proyectos, Costos y Presupuestos |
| 3 | Costos directos e indirectos | costos de construcción, costos de obra | «¿Cuál es la diferencia entre costos directos e indirectos?» | Gerencia de Proyectos, Costos y Presupuestos |
| 4 | AIU | administración imprevistos y utilidad, AIU en construcción Colombia | «¿Qué porcentaje de AIU se cobra en una obra?» | Gerencia de Proyectos, Costos y Presupuestos |
| 5 | Cantidades de obra | cubicación, mediciones, cuantificación de obra | «¿Cómo cubico una obra?» | Revit Arquitectura (día de cuantificación); Gerencia de Proyectos |
| 6 | Presupuestos con inteligencia artificial | IA para presupuestos de obra, Claude para construcción, ChatGPT para presupuestos | «¿Puedo hacer un presupuesto de obra con IA?» | Claude IA para Presupuestos y Administración de Obra |
| 7 | Control de costos de obra | control presupuestal, seguimiento de costos | «¿Cómo llevo el control de costos de una obra?» | Claude IA (sesión de control presupuestal); Gerencia de Proyectos |
| 8 | Honorarios de arquitecto | cuánto cobrar por un diseño, tarifas de arquitectura, honorarios profesionales | «¿Cuánto debo cobrar por un proyecto arquitectónico?» | Gerencia de Proyectos (sesión de honorarios); Abriendo tu oficina |
| 9 | Cotizar proyectos de arquitectura | propuesta de servicios, propuesta de valor, estructura de precios | «¿Cómo armo una cotización para un cliente?» | Abriendo tu oficina (propuesta de valor y precios) |

### B. Gerencia y administración de obra (residente, gerente de proyecto)

| # | Tema | Variantes | Pregunta típica | Curso relacionado |
| ---: | --- | --- | --- | --- |
| 10 | Gerencia de proyectos de construcción | dirección de proyectos de obra, project management construcción | «¿Cómo se gerencia un proyecto de construcción?» | Gerencia de Proyectos, Costos y Presupuestos |
| 11 | Administración de obra | administrar una obra, administración de construcción | «¿Qué hace el administrador de obra?» | Claude IA para Administración de Obra |
| 12 | Residente de obra | funciones del residente, residencia de obra | «¿Cuáles son las funciones de un residente de obra?» | Sin curso específico hoy (adyacente a Gerencia de Proyectos) |
| 13 | Programación de obra | cronograma de obra, ruta crítica, curva S | «¿Cómo hago el cronograma de una obra?» | Gerencia de Proyectos (planificación) |
| 14 | Contratos de obra | tipos de contrato de construcción, precio global, precios unitarios, administración delegada | «¿Qué tipo de contrato me conviene para una obra?» | Gerencia de Proyectos (contratación); Gestión y Desarrollo de Vivienda |
| 15 | Seguimiento y cierre de proyecto | entrega de obra, acta de cierre, lecciones aprendidas | «¿Cómo cierro un proyecto de obra?» | Gerencia de Proyectos (sesión 8); Gestión de Vivienda (módulo 5) |
| 16 | Gerencia de proyectos de vivienda | gerencia inmobiliaria, proyectos inmobiliarios | «¿Cómo se estructura un proyecto de vivienda?» | Gestión y Desarrollo de Vivienda |
| 17 | Desarrollo de vivienda | promotor inmobiliario, rentabilidad de un proyecto de vivienda | «¿Cómo hago rentable un proyecto de vivienda?» | Gestión y Desarrollo de Vivienda |

### C. BIM, software y visualización (coordinador BIM, arquitecto, modelador)

| # | Tema | Variantes | Pregunta típica | Curso relacionado |
| ---: | --- | --- | --- | --- |
| 18 | Revit Arquitectura | curso de Revit, Revit desde cero, Revit para arquitectos | «¿Cómo aprendo Revit desde cero?» | Revit Arquitectura |
| 19 | Familias paramétricas de Revit | crear familias Revit, componentes personalizados | «¿Cómo creo una familia en Revit?» | Revit Arquitectura (días 3 y 4) |
| 20 | BIM | qué es BIM, metodología BIM, BIM en Colombia | «¿Qué es BIM y cómo se aplica en una obra?» | Revit Arquitectura (adyacente) |
| 21 | Coordinador BIM | roles BIM, BIM manager, funciones del coordinador BIM | «¿Qué hace un coordinador BIM?» | Sin curso específico hoy |
| 22 | SketchUp | curso de SketchUp, SketchUp desde cero, modelar con SketchUp | «¿Cómo modelo una vivienda en SketchUp?» | Curso de SketchUp |
| 23 | D5 Render | curso de D5, render en tiempo real | «¿Cómo hago un render realista con D5?» | Diplomado en D5 Render |
| 24 | Render con inteligencia artificial | visualización con IA, render IA arquitectura | «¿Cómo hago un render con IA a partir de un boceto?» | Render y Visualización con IA |
| 25 | Renderizado de interiores y exteriores | render de interiores, render exterior | «¿Cómo configuro la luz en un render de interior?» | Diplomado en D5 Render (módulos 3 y 4) |
| 26 | IA para arquitectos | ChatGPT para arquitectos, IA en arquitectura, Claude para arquitectos | «¿Cómo uso la IA en mi estudio de arquitectura?» | Render y Visualización con IA; Claude IA |

### D. Diseño interior y habilitación

| # | Tema | Variantes | Pregunta típica | Curso relacionado |
| ---: | --- | --- | --- | --- |
| 27 | Diseño de interiores | curso de diseño interior, interiorismo | «¿Cómo desarrollo un proyecto de diseño interior?» | Diseño Interior e Iluminación |
| 28 | Iluminación arquitectónica | diseño de iluminación, iluminación de interiores | «¿Cómo planeo la iluminación de un espacio?» | Diseño Interior e Iluminación |
| 29 | Diseño de clínicas odontológicas | consultorio odontológico, diseño de consultorios | «¿Cómo se diseña un consultorio odontológico?» | Diseño Interior y Habilitación de Clínicas Odontológicas |
| 30 | Habilitación de clínicas y consultorios | Resolución 3100 de 2019, habilitación en salud, REPS | «¿Qué exige la habilitación para un consultorio?» | Clínicas Odontológicas (módulo 1) |

### E. Práctica profesional y negocio (arquitecto independiente)

| # | Tema | Variantes | Pregunta típica | Curso relacionado |
| ---: | --- | --- | --- | --- |
| 31 | Abrir una oficina de arquitectura | montar un estudio de arquitectura, crear mi estudio | «¿Cómo abro mi propio estudio de arquitectura?» | Abriendo tu oficina de Arquitectura |
| 32 | Portafolio de arquitectura | portafolio para arquitectos, portafolio estratégico | «¿Cómo armo un portafolio que consiga clientes?» | Abriendo tu oficina (módulo 5) |
| 33 | Marca personal para arquitectos | posicionamiento de un estudio, identidad de marca | «¿Cómo posiciono mi marca como arquitecto?» | Abriendo tu oficina (módulo 3) |
| 34 | Marketing para arquitectos | Instagram para arquitectos, Facebook Ads para arquitectos, captación de clientes | «¿Cómo consigo clientes con Instagram?» | Instagram + Facebook Ads para Arquitectos |
| 35 | Cómo conseguir clientes de arquitectura | vender servicios de arquitectura, venta de proyectos | «¿Cómo vendo mis servicios de arquitectura?» | Instagram + Facebook Ads; Abriendo tu oficina |

### F. Formación en línea y certificado

| # | Tema | Variantes | Pregunta típica | Curso relacionado |
| ---: | --- | --- | --- | --- |
| 36 | Cursos de arquitectura online | cursos de arquitectura en línea, formación para arquitectos | «¿Qué cursos de arquitectura online me sirven?» | Catálogo completo |
| 37 | Diplomados de construcción | diplomado de arquitectura, diplomado en gerencia de obra | «¿Qué diplomados hay para el sector de la construcción?» | Diplomados del catálogo |
| 38 | Certificado verificable | verificar certificado, certificado de curso con código | «¿Cómo compruebo que un certificado es auténtico?» | Verificación de certificados (`/verificar-certificado`) |
| 39 | Plantillas de presupuesto en Excel | plantilla de presupuesto de obra, formato de APU | «¿Dónde descargo una plantilla de presupuesto de obra?» | Plantillas descargables de la plataforma |
| 40 | Escuela de construcción en Colombia | formación para el sector de la construcción, capacitación para residentes | «¿Dónde me capacito para el sector de la construcción?» | Catálogo completo |

## Observaciones

- **Cómo se reparten los 40 temas:** 14 coinciden con el título de un curso (6, 10, 16, 17, 18, 22, 23, 24, 27, 28, 29, 30, 31, 34); 18 están cubiertos solo como módulo o sesión dentro de un curso (1-5, 7-9, 11, 13-15, 19, 25, 26, 32, 33, 35); 3 no tienen curso hoy (12, 20, 21); y 5 son del catálogo o de recursos de la plataforma (36-40). Lo que solo existe como módulo, o no existe, solo puede atenderse con una guía o un glosario, no con una ficha de curso. Se resuelve en `03-mapa-contenidos.md`.
- **El bloque con más temas por curso:** presupuestos y costos concentran nueve temas (grupo A) y dos cursos los cubren (Gerencia de Proyectos, Costos y Presupuestos, y Claude IA para Presupuestos), con el curso de oficina como apoyo para honorarios y cotización.
- **BIM y coordinación BIM aparecen en el público declarado** (coordinadores BIM) pero la oferta actual es Revit. Si el público BIM importa, hace falta contenido o curso propio.
