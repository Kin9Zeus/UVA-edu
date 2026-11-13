# Etapa 2. Hallazgos de textos

**Fase 8. Revisión de textos y reglas de voz de UVA**
**Fecha de la revisión:** 13 de noviembre de 2026
**Código revisado:** rama `master`, commit `11693df`. No se modificó ningún archivo de `src/`.

## Cómo se hizo esta revisión

Leí el texto completo de las pantallas de prioridad 1 (portada, catálogo, curso, lección, acceso, perfil, comunidad y correos) y de las de prioridad 2 que más ve un participante (examen, soporte, panel del estudiante, páginas de error, certificado y verificación). Sobre el resto, incluido el panel de administración, corrí revisiones automáticas de tildes, plurales, signos, tuteo, anglicismos y formato de números, y revisé a mano cada coincidencia. **El panel admin no lo leí línea por línea.** Eso queda dicho en el informe.

El inventario completo está en [`00-inventario.csv`](00-inventario.csv): 4.325 textos. Algunas filas son textos internos que el usuario no ve (nombres de columnas, etiquetas de registro), porque el extractor lee el código y no la pantalla. Los textos de SEO van marcados `SEO` y no propongo cambios definitivos sobre ellos (los trabaja la Fase 14).

## Severidad

- **Alta:** lo ve un participante en el recorrido de las pruebas y rompe la voz, promete algo que hoy no existe, lleva a un destino distinto del que dice o no coincide con los textos legales.
- **Media:** inconsistencia de términos o texto sin salida en una pantalla del recorrido.
- **Baja:** detalle de estilo, texto de una función oculta o del panel admin.

## Resumen

| Severidad | Cantidad | Identificadores |
| --- | ---: | --- |
| Alta | 7 | H01, H02, H03, H11, H14, H15, H39 |
| Media | 15 | H04, H05, H08, H09, H10, H12, H16, H17, H18, H19, H20, H21, H22, H27, H28 |
| Baja | 17 | H06, H07, H13, H23, H24, H25, H26, H29, H30, H31, H32, H33, H34, H35, H36, H37, H38 |
| **Total** | **39** | |

Cada fila trae la columna **Aprobado** vacía. Escribe `sí` o `no`.

## Lo que ya estaba corregido y sigue bien

Comprobé cada punto que me pediste verificar:

| Punto | Estado | Dónde lo verifiqué |
| --- | --- | --- |
| Precios y planes ocultos | **Bien**, con tres excepciones (H02, H03, H14) | `PRECIOS_HABILITADOS` protege el enlace «Precios» (`Header.tsx:62`), el bloque de planes de la portada (`(public)/page.tsx:69`), el enlace «Planes» del panel y la ruta `/dashboard/planes`, que redirige. Los textos de «suscripción» de ficha, clase, video y soporte cambian con la misma bandera. |
| Cifras y funciones que no existían | **Bien**, con una duda (H04) | El bloque «Más de 400 empresas» ya no está en la portada. `CIFRAS_VERIFICABLES` está vacío. |
| Enlaces muertos del pie | **Bien en pantalla**, con un resto en el código (H25) | La columna con «Sobre nosotros», «Blog del gremio», «Casos de éxito» y «Empleo» está oculta (`MOSTRAR_COLUMNA_COMUNIDAD = false`). |
| «oficiode la construcción» | **Bien** | No hay ninguna ocurrencia sin espacio. |
| «4.73 opiniones» | **Bien en el formato** | Ahora sale «4,7 de 5 con N opiniones», formateado con `es-CO`. Queda una duda de término (H09). |
| «Regístrate para canjear tu código» y el bloque de empresas con «Iniciar sesión» | **Bien** | No existen. El botón «Tengo un código» lleva a `/canjear`. |

También está bien, y no genera hallazgos:

- **Plurales.** Cada texto con número maneja el singular con una condición (`1 comentario`, `1 respuesta`, `Te queda 1 intento`, `Falta 1 día`). Revisé uno por uno los 71 casos que la búsqueda automática marcó como posible plural fijo y todos están resueltos.
- **Fechas y horas.** Usan `es-CO` y la zona `America/Bogota`.
- **Decimales.** La calificación sale con coma.
- **Correos.** Todos tienen versión en texto plano (`src/emails/marco/texto-plano.ts`).
- **Ortografía.** No encontré una sola falta de tilde en los textos visibles de las pantallas revisadas.
- **«clic».** Está escrito con la forma que recoge la RAE, no «click».

## Hallazgos por pantalla

### Acceso

| ID | Sev. | Archivo y línea | Texto actual | Problema | Categoría | Propuesta | Aprobado |
| --- | --- | --- | --- | --- | --- | --- | --- |
| H01 | Alta | `src/components/auth/RegistroForm.tsx:193-207` y `:232` | «Acepto los **Términos** y la **Política de privacidad**» (los enlaces van a `/soporte?tema=terminos` y `/soporte?tema=privacidad`) | Los enlaces llevan al centro de soporte, que muestra «Contenido en preparación» (`src/lib/soporte.tsx:177-185`), y no a los textos legales, cuyas rutas existen (`/legal/terminos`, `/legal/privacidad`) y se publican cuando la bandera `LEGAL_HABILITADO` está activa. Además los nombres no coinciden con los de los textos: «Términos y condiciones», «Aviso de privacidad» y «Tratamiento de datos personales» (`src/lib/legal/slugs.ts:23-25`). **Es decisión tuya y del abogado.** No toco los textos legales. | Nombre de texto legal, enlace que no lleva a donde dice | «Acepto los Términos y condiciones y el Aviso de privacidad», con enlaces a `/legal/terminos` y `/legal/privacidad`. La casilla separada de autorización de datos la define la tarea de textos legales. | |
| H02 | Alta | `src/actions/codigos-invitacion/canjear.ts:43` | «Ya tienes una suscripción activa. Podrás canjear este código cuando termine, si sigue vigente.» | Hoy no existe ninguna suscripción: el acceso es por código. Lo ve quien ya tiene un acceso activo e intenta canjear otro. | Función que no existe hoy, término inconsistente | «Ya tienes un acceso activo. Podrás canjear este código cuando termine, si sigue vigente.» | |
| H12 | Media | `src/components/auth/AuthFlow.tsx:45,49,61,267`; `LoginForm.tsx:85`; `Header.tsx:95`; `SoporteCentro.tsx:239`; `CursoFicha.tsx:661` | «Inicia sesión», «Ingresa a tu cuenta», «Entrar», «Entra o crea tu cuenta», «Acceder» | Cinco verbos distintos para la misma acción. | Términos inconsistentes | Acción: «Inicia sesión». Botón corto del encabezado: «Entrar». Prohibido: «Ingresa a tu cuenta» y «Acceder». Ver glosario. | |
| H16 | Media | `src/actions/auth/login.ts:96` | «Tu cuenta ha sido suspendida. Contacta al soporte para más información.» | Voz pasiva y salida vaga: no dice cómo contactar. | Error sin salida concreta | «Suspendimos tu cuenta. Escríbenos a soporte@uvarq.com y te explicamos qué pasó.» (el correo sale de `CORREO_SOPORTE`) | |
| H19 | Media | `src/app/acceso-denegado/page.tsx:13` | «Tu cuenta de profesor» | En el resto de la interfaz se dice «instructor». | Términos inconsistentes | «Tu cuenta de instructor» | |
| H06 | Baja | `src/actions/auth/registro.ts:74` | «Ya existe una cuenta con ese correo.» | El mismo error, en la línea 46, sí dice qué hacer: «Inicia sesión en su lugar.» | Error sin salida | Igualarlo con la línea 46. | |
| H07 | Baja | `check-email.ts:30`, `login.ts:29`, `registro.ts:29,32`, `canjear.ts:71` y otros | «Ingresa un correo…», «Completa tu correo.», «Ingresa un código.» | Tres verbos para pedir un dato de un campo: «Ingresa» (15), «Escribe» (32) y «Completa» (4). | Términos inconsistentes | Siempre «Escribe»: «Escribe tu correo.», «Escribe tu código de invitación.» | |

### Portada y pie

| ID | Sev. | Archivo y línea | Texto actual | Problema | Categoría | Propuesta | Aprobado |
| --- | --- | --- | --- | --- | --- | --- | --- |
| H04 | Media | `src/components/home/Hero.tsx:44` | «Clases cortas, plantillas listas para usar y casos reales.» | «Clases cortas» y «casos reales» no están respaldados en `src/content/marketing.ts`, que solo anuncia cursos en video, avance guardado, certificado verificable y plantillas descargables. **Decisión tuya: ¿es cierto?** | Cifra o función que no existe hoy | Si no puedes confirmarlo: «Clases en video, plantillas descargables y certificado verificable.» | |
| H05 | Media | `src/components/home/CategoriasPortada.tsx:29,67`; `src/components/dashboard/InicioContent.tsx:307` | «Explora por categoría», «Ver todas las categorías» | El catálogo, el filtro y el pie dicen «Escuela» (`FiltrosCatalogo.tsx:172`, `Footer.tsx:113`). Un estudiante ve dos palabras para lo mismo. | Términos inconsistentes | «Explora por escuela», «Ver todas las escuelas» | |
| H23 | Baja | `src/components/home/Footer.tsx:106` y `:182` | «Formación en línea para el gremio de la construcción en LATAM.» y «Hecho en obra, para LATAM.» | Es una sigla informal. Es criterio de estilo, no regla del idioma. | Anglicismos evitables | «en Latinoamérica» | |
| H24 | Baja | `src/components/home/Footer.tsx:182` | «© 2026 U.V.A.» | El año está escrito a mano y quedará viejo en enero. | Cifra o dato que se desactualiza | Que lo calcule el código (recomendación para el equipo, ver `docs/pendientes-equipo.md`). | |
| H25 | Baja | `src/components/home/Footer.tsx:134` | `<a href="#">` | Está dentro de la columna oculta, así que hoy nadie lo ve. `CLAUDE.md` (3.4) prohíbe los `href="#"`. | Enlace muerto en el código | Quitarlo o ponerle destino antes de reactivar la columna. | |

### Catálogo

| ID | Sev. | Archivo y línea | Texto actual | Problema | Categoría | Propuesta | Aprobado |
| --- | --- | --- | --- | --- | --- | --- | --- |
| H13 | Baja | `src/components/catalogo/BuscadorHeaderInput.tsx:129` | «No se pudieron cargar las sugerencias.» | Es la única frase de error impersonal. Todas las demás dicen «No pudimos…». | Voz inconsistente | «No pudimos cargar las sugerencias.» | |

### Curso

| ID | Sev. | Archivo y línea | Texto actual | Problema | Categoría | Propuesta | Aprobado |
| --- | --- | --- | --- | --- | --- | --- | --- |
| H09 | Media | `src/components/curso/ResenasCurso.tsx:123-130` | «4,7 de 5 con 12 opiniones» | En la misma ficha, el título dice «Reseñas» y el contador dice «opiniones». | Términos inconsistentes | «4,7 de 5 con 12 reseñas» (singular «1 reseña») | |
| H10 | Media | `src/components/curso/CursoFicha.tsx:87` | «Vista previa gratis» | «Vista previa» es también el nombre de la herramienta del panel admin para compartir un curso sin publicar. En la ficha, el resto del texto dice «Clase gratis» y «Ver la primera clase gratis». | Términos inconsistentes | «Clase gratis» | |

### Lección

| ID | Sev. | Archivo y línea | Texto actual | Problema | Categoría | Propuesta | Aprobado |
| --- | --- | --- | --- | --- | --- | --- | --- |
| H08 | Media | `src/components/player/ListaTemario.tsx:113-121` y `TemarioDrawer.tsx:91` | «0:12 · clase gratis», «· en curso», «· entra para verla», «· clase completada», «45% completado · 3 de 8 clases» | El separador con punto medio va contra la regla del proyecto: `CLAUDE.md` (3.4) lo cuenta entre los «rasgos genéricos». | Estilo del proyecto | Quitar el punto medio y separar con una etiqueta propia («Clase gratis», «En curso») o con una coma. | |

### Perfil

| ID | Sev. | Archivo y línea | Texto actual | Problema | Categoría | Propuesta | Aprobado |
| --- | --- | --- | --- | --- | --- | --- | --- |
| H11 | Alta | `src/components/dashboard/EliminarCuentaCard.tsx:80` | «Esta acción es irreversible. Confirma que **sos vos**.» | Voseo en una interfaz de tuteo, en una pantalla de confirmación. | Tuteo inconsistente | «Esta acción es irreversible. Confirma que eres tú.» | |
| H17 | Media | `src/components/dashboard/EliminarCuentaCard.tsx:58` | «nuestra política de datos» | Los textos legales se llaman «Tratamiento de datos personales» (`slugs.ts:24`). | Nombre de texto legal | «Tratamiento de datos personales», con el mismo enlace que use el pie. **Lo confirmas con el abogado.** | |
| H26 | Baja | `src/components/dashboard/ProgresoContent.tsx:414` | «dale play a la primera clase» | Anglicismo. | Anglicismos evitables | «reproduce la primera clase» | |

### Panel del estudiante

| ID | Sev. | Archivo y línea | Texto actual | Problema | Categoría | Propuesta | Aprobado |
| --- | --- | --- | --- | --- | --- | --- | --- |
| H03 | Alta | `src/components/dashboard/BottomTabBar.tsx:19`; `src/components/dashboard/Sidebar.tsx:61`; `src/components/dashboard/EstadoAccesoCard.tsx:63`; `src/lib/soporte.tsx:66` | «Suscripción», «Mi suscripción» | Es una opción del menú que ve todo estudiante, y hoy no hay suscripciones: es el estado del acceso por código. Los textos dentro de la página sí están protegidos por la bandera, pero la etiqueta del menú no. | Función que no existe hoy | «Mi acceso» (la ruta `/dashboard/suscripcion` no cambia; eso lo ve el equipo) | |
| H27 | Media | `src/components/examen/ExamenRendir.tsx:366-367` y `ExamenCta.tsx:66` | «Te quedaste sin **vidas**», «Pierdes una **vida**; te quedan…» | El examen se juega con «uvas» (`ExamenIntro.tsx:118,137,231`, `ExamenRendir.tsx:513`). Dos palabras para lo mismo dentro del mismo examen. | Términos inconsistentes | «Incorrecto. Te quedaste sin uvas.» y «Incorrecto. Pierdes una uva; te quedan {n}.» | |
| H39 | Alta | `src/components/examen/ExamenCta.tsx:37` | «Ya aprobaste el examen. Termina las clases que te falten para recibir tu certificado.» | Dice que faltan clases, pero desde la migración `supabase/sql/114_certificado_no_exige_lecciones.sql` aprobar el examen basta cuando el curso lo exige (lo explica `src/lib/progreso.ts:130-142`). El mismo examen lo dice bien en `ExamenIntro.tsx:153`: «aunque no hayas terminado las clases». Un participante que ya aprobó leería un requisito que no existe. | Cifra o función que no existe hoy | «Ya aprobaste el examen. Tu certificado se está preparando.» (es el mismo texto de `ExamenIntro.tsx:284`) | |
| H33 | Baja | `ExamenCta.tsx:67`, `ExamenIntro.tsx:247`, `LeccionMaqueta.tsx:631`, `ProgresoContent.tsx:258` | «Presentar examen», «Iniciar examen», «Hacer examen» | Tres verbos para el mismo botón. | Botón inconsistente | Un solo verbo: «Presentar examen» (es el que más se repite). | |
| H34 | Baja | `src/components/dashboard/GraciaCard.tsx`, `NotificacionesBell.tsx:30`, `PlanesContent.tsx`, `CheckoutContent.tsx` y `EstadoAccesoCard.tsx:61`, `SuscripcionContent.tsx:214` | «período de gracia» y «periodo de acceso» | Las dos formas son válidas; la RAE pide escribir la que corresponde a cómo se pronuncia. Aquí conviven ambas. Es una duda de coherencia, no un error. Fuente: [RAE, Diccionario panhispánico de dudas, «periodo»](https://www.rae.es/dpd/periodo), consultada a través de una búsqueda el 13 de noviembre de 2026. | Ortografía (duda) | Elegir una: «periodo» (la forma llana, que ya usan las pantallas del acceso). | |
| H35 | Baja | `src/components/dashboard/InicioContent.tsx:253` | «Recomendados para ti» | Promete personalización. No pude comprobar con qué criterio se eligen esos cursos. | Función que no existe hoy (por verificar) | Si no hay criterio real: «Para empezar» o «Cursos del catálogo». | |

### Comunidad

| ID | Sev. | Archivo y línea | Texto actual | Problema | Categoría | Propuesta | Aprobado |
| --- | --- | --- | --- | --- | --- | --- | --- |
| H14 | Alta | `src/components/dashboard/comunidad/ReportarComunidadDialog.tsx:83` y `:100` | «**Contanos** por qué…», «Por qué **reportás** esta…» | Voseo en una interfaz de tuteo. Es el cuadro que se abre al reportar una publicación. | Tuteo inconsistente | «Cuéntanos por qué. Un administrador la revisará.» y «Por qué reportas esta…» | |
| H15 | Alta | `src/actions/comunidad/crear.ts:123` y `:215` | «Todavía no tienes acceso a la comunidad. Necesitas una **suscripción activa**.» | No hay suscripciones. Lo ve quien intenta publicar o responder sin acceso vigente. | Función que no existe hoy | «Todavía no tienes acceso a la comunidad. Canjea un código de invitación para entrar.» | |
| H20 | Media | `src/actions/comunidad/crear.ts:83-105,196` y `editar.ts:74-93` | «Título inválido.», «Contenido inválido.», «Empresa inválida.», «Enlace inválido.» | Dicen que algo falló pero no qué corregir. Casi siempre los frena el formulario antes, pero cuando llegan al servidor, la persona no sabe qué cambiar. | Error sin explicación ni salida | «El título no es válido. Revisa que no esté vacío ni demasiado largo.» (una frase por campo) | |
| H21 | Media | `crear.ts:169,261`, `editar.ts:141`, `eliminar.ts:103,179` | «No pudimos publicar tu mensaje.», «No pudimos publicar tu respuesta.» | Faltan los «Intenta de nuevo.» que sí tienen otros errores del mismo archivo (`crear.ts:204`). Además dicen «mensaje» donde la interfaz dice «publicación». | Error sin salida, término inconsistente | «No pudimos publicar lo que escribiste. Intenta de nuevo.» | |
| H29 | Baja | `ModerarComunidadDialog.tsx:67` y `ComunidadEmptyState.tsx:26` | «el motivo que escribas **acá**», «coincide con «…» **acá**» | El resto de la interfaz dice «aquí». «Acá» es de uso corriente en Colombia, así que es coherencia de estilo, no error. | Términos inconsistentes | «aquí» | |
| H30 | Baja | `ComunidadPostEditor.tsx:79`, `ComunidadRespuestaComposer.tsx:75`, `admin/Header.tsx:27-28` | «Cuéntale a la comunidad...» | Tres puntos escritos como tres caracteres. El resto de la interfaz usa el carácter «…» (`ComunidadComposer.tsx:235`, `RichTextEditor.tsx:53`). | Puntuación | «Cuéntale a la comunidad…» | |
| H31 | Baja | `ComunidadFiltros.tsx:13-14` y `ComunidadRespuestasList.tsx:12-14` | «Más recientes», «Más relevantes» y «Más antiguo», «Más reciente», «Relevancia» | Las mismas tres ordenaciones con nombres distintos según la lista. | Términos inconsistentes | «Más recientes», «Más antiguos», «Más relevantes» en las dos | |

### Correos

| ID | Sev. | Archivo y línea | Texto actual | Problema | Categoría | Propuesta | Aprobado |
| --- | --- | --- | --- | --- | --- | --- | --- |
| H36 | Baja | `src/emails/welcome.tsx:27` | «Ir a mi plataforma» | En el resto de la interfaz se dice «panel» (`CanjearFlujo.tsx:79`, `error.tsx:15`). | Términos inconsistentes | «Ir a mi panel» | |
| H37 | Baja | `src/emails/vencimiento-proximo.tsx` y `recibo-pago.tsx` | «Renovar mi acceso», «Ver mi suscripción», «Plan», «Monto» | **Hoy ninguno se envía** (nada en el código los llama). Hablan de planes y pagos. Cuando se activen hay que revisarlos con el modelo de invitación. | Texto de función oculta | Revisar antes de activarlos. Si se usan con invitación: «Canjear otro código». | |

### Compartido y otros

| ID | Sev. | Archivo y línea | Texto actual | Problema | Categoría | Propuesta | Aprobado |
| --- | --- | --- | --- | --- | --- | --- | --- |
| H22 | Media | `src/components/admin/codigos/CodigoFormDialog.tsx:40` | «Te invito a U.V.A, la plataforma de cursos de arquitectura.» | Es el mensaje que el administrador copia y envía a la persona invitada, o sea, texto de cara al público. La sigla perdió el punto en mitad de la frase. En `SuscripcionContent.tsx:185` la omisión es intencional (evita el doble punto al final), pero aquí no. | Nombre de marca | Se resuelve con el nombre oficial: «Te invito a UVA, la plataforma…» | |
| H28 | Media | `src/lib/resend.ts:41,87,120,158,201` | `error.message` | Si el envío falla, se devuelve el texto de error del proveedor, que viene en inglés. No comprobé si llega a una pantalla. | Error técnico o en inglés que llega al usuario | Devolver siempre un texto propio: «No pudimos enviar el correo. Intenta de nuevo.» | |
| H18 | Media | Todo `src/` (231 apariciones; ver `docs/seo/00-anexo-variantes-marca.csv`) | «U.V.A.», «U.V.A», «UVA», «Unidad Vectorial de Arquitectura» | Cuatro formas de la marca. Depende de tu decisión del nombre oficial. | Nombre de marca | No se corrige hasta decidirlo. Con «UVA» sin puntos desaparecen también los problemas de puntuación (H22). | |
| H32 | Baja | `src/lib/soporte.tsx:113,123,128` y `SoporteCentro.tsx:316` | “Contraseña”, "Verificar certificado", «Reportar un problema» | Tres tipos de comillas en la misma pantalla. La RAE recomienda las angulares primero y reservar las inglesas para un texto ya entrecomillado. Fuente: [RAE, Ortografía, «Las comillas»](https://www.rae.es/ortografía/las-comillas), consultada a través de una búsqueda el 13 de noviembre de 2026. | Puntuación (duda) | «Contraseña», «Verificar certificado», «Reportar un problema» | |
| H38 | Baja | `src/lib/certificados/duracion.ts:9` | «{horas} horas de teoría y práctica» | El certificado afirma teoría y práctica. Si la cifra sale solo de la duración del video, es más preciso decir otra cosa. Es una duda de veracidad. | Cifra o dato por verificar | Confirmar con el equipo pedagógico. Si solo es video: «{horas} horas de clases». | |

## Lo que queda por revisar

- **Panel de administración** (2.067 textos): solo con revisión automática. Los hallazgos que salieron (anglicismos de funciones ocultas como «checkout» en `CuponFormDialog.tsx:223,330`, la ayuda «Admite centavos: 69.99, 89900» en `PlanFormDialog.tsx:235` y el botón genérico «Listo» en `CodigoFormDialog.tsx:173,203`) son de prioridad baja y no los incluí en la tabla.
- **Títulos y descripciones de cursos y lecciones:** viven en la base de datos. Ver `04-titulos.md`.
- **Textos legales:** no se tocan. Solo revisé los enlaces y nombres que los mencionan (H01, H17).
- **Textos que genera la IA** (descripciones de cursos, preguntas del examen): salen de los mensajes de `src/lib/descripciones-ia/prompt.ts` y de `src/lib/examenes/generacion/`. El mensaje de instrucciones dice «una escuela online de arquitectura» y «U.V.A». Para el texto en español, «en línea» es la alternativa que recomienda Fundéu a «online» ([Fundéu BBVA, alternativas a «online»](https://www.bbva.com/es/fundeu-bbva-ofrece-alternativas-online/), consultada a través de una búsqueda el 13 de noviembre de 2026). Lo anoto en `docs/pendientes-equipo.md`.
