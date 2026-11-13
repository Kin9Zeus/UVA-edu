# Etapa 3. Glosario de UVA

**Fase 8. Revisión de textos y reglas de voz de UVA**
**Fecha:** 13 de noviembre de 2026

Cada fila dice qué palabra usamos, cuáles no, y dónde hoy se mezclan. Los conteos salen del inventario ([`00-inventario.csv`](00-inventario.csv)) y cuentan solo texto visible para el estudiante, sin el panel admin, salvo que diga otra cosa.

## Lo que decidimos usar

| Concepto | Palabra recomendada | Evitar | Cómo se usa hoy |
| --- | --- | --- | --- |
| Lo que se estudia | **curso** | diplomado, programa, formación (como nombre de producto) | «Curso» 155 veces. «Diplomado» y «programa» no aparecen en la interfaz. Está unificado. |
| Un grupo de clases dentro de un curso | **módulo** | unidad, tema, capítulo, sesión | «Módulo» aparece 6 veces y no hay mezcla. Ojo: `Proximamente.tsx:16` dice «Este módulo todavía no está disponible» para hablar de una sección de la aplicación. Hay que evitarlo, aunque ese componente no se usa hoy en ninguna pantalla. |
| Cada video con su contenido | **clase** | lección, sesión, tutorial, capítulo | **Mezclado.** El estudiante ve «clase» 100 veces y «lección» 4 (`ContenidoVistaPrevia.tsx:114`, `not-found.tsx:23`). El panel admin dice «lección» 59 veces y «clase» 47. El administrador crea «lecciones» y el estudiante ve «clases». Ver la sección «Qué le toca al equipo». |
| Agrupación de cursos | **escuela** | categoría, área, línea | **Mezclado.** El catálogo y el pie dicen «escuela» (11). La portada y el inicio del panel dicen «categoría» (10). El panel admin dice «categoría» 64 veces y «escuela» ninguna. Excepción: en la comunidad «categoría» es otra cosa (tipo de publicación) y se queda. |
| Lista completa de módulos y clases | **temario** | contenido, índice, programa | «Temario» 12 veces. Está unificado. |
| Primera clase abierta | **clase gratis** | vista previa, demo, muestra | **Mezclado.** `CursoFicha.tsx:87` dice «Vista previa gratis»; la lección y el temario dicen «Clase gratis». «Vista previa» queda solo para la herramienta del panel admin que comparte un curso sin publicar. |
| Lo que se entrega al terminar | **certificado** | constancia, diploma, título | «Certificado» 78 veces. «Constancia» y «diploma» no aparecen. Está unificado. |
| Valoración escrita por un estudiante | **reseña** | opinión, comentario (para la reseña), review, valoración | **Mezclado.** «Reseña» 16, «opinión» 2 (`ResenasCurso.tsx:124,130`). |
| Puntaje de 1 a 5 estrellas | **calificación** | rating, puntuación, nota (nota es lo que el estudiante escribe en la clase) | «Calificación» 11. Está unificado. |
| Lo que el estudiante escribe en una clase | **nota** | apunte, anotación | Se usa «nota» y «apunte» (`MisNotasContent.tsx:117-118`). Prefiero «nota». |
| La clave para entrar al catálogo | **código de invitación** la primera vez y **código** después | cupón, voucher, clave, token, pase | «Código» 103 veces, «invitación» 39. «Cupón» (11) es otra cosa: descuento, y hoy está oculto con los precios. |
| La oferta de entrar | **invitación** | acceso gratuito, promoción | Se usa bien: «Entra con una invitación». |
| La situación de la persona frente al catálogo | **acceso** | suscripción, plan, membresía, licencia | **Mezclado.** «Acceso» 89 veces. «Suscripción» aparece 29 veces, y la mayoría está protegida por la bandera de precios. No lo está en el menú (`BottomTabBar.tsx:19`, `Sidebar.tsx:61`), en `EstadoAccesoCard.tsx:63`, en `canjear.ts:43` ni en `crear.ts:123,215`. Ver H02, H03 y H15. «Plan» solo cuando los precios estén activos. |
| La identidad con la que se entra | **cuenta** | usuario, login, perfil (para esto) | «Cuenta» 75 veces. |
| La página con tus datos y tu foto | **perfil** | ficha, datos personales (como nombre de página) | «Perfil» 8 veces. Está unificado. Cuando falta el nombre de una persona se muestra «Usuario» (`src/lib/comunidad.ts:546`, `src/lib/comentarios.ts:106`) o «Estudiante U.V.A.» (`src/lib/comunidad.ts:445`, `src/lib/curso-calificaciones.ts:119`): elegir uno. |
| Quien dicta un curso | **instructor** | profesor, docente, maestro, tutor | «Instructor» 14, «profesor» 2 (`acceso-denegado/page.tsx:13`), «docente» 1 (lista interna del examen). El rol interno de la base se llama `PROFESOR`: eso no se muestra. El panel admin dice «profesor» 18 veces e «instructor» 11. |
| El espacio donde los estudiantes publican | **comunidad** | foro, muro, red social, canal | «Comunidad» 27. «Muro» aparece 1 vez (`ComunidadComposer.tsx:36`). |
| Entrar con la cuenta (acción) | **Inicia sesión** (frase) y **Entrar** (botón corto del encabezado) | ingresar, acceder, loguearse, log in | **Mezclado.** «Inicia sesión» 65, «entra/entrar» 54, «ingresa» 15, «acceder» 2. Ver H12. |
| Pedir un dato en un campo | **Escribe** | ingresa, completa, introduce, digita | «Escribe» 32, «Ingresa» 15, «Completa» 4. Ver H07. |
| Pantalla de inicio de quien ya entró | **panel** | plataforma (para esto), dashboard, home | «Panel» en el menú y los errores. «Ir a mi plataforma» en el correo de bienvenida (`welcome.tsx:27`). «Plataforma» se queda para hablar de UVA en general. |
| Los intentos del examen | **uvas** | vidas | **Mezclado.** `ExamenIntro.tsx` dice «uvas». `ExamenRendir.tsx:366-367` y `ExamenCta.tsx:66` dicen «vidas». Ver H27. |
| Empezar el examen | **Presentar examen** | hacer, iniciar, rendir, tomar el examen | Tres verbos en cuatro botones. Ver H33. |
| Al fallar una acción | **No pudimos…** | no se pudo, ha ocurrido un error, error al… | Casi siempre bien. Excepción: `BuscadorHeaderInput.tsx:129` (H13). |
| La empresa | **la marca**: `[NOMBRE OFICIAL POR DEFINIR]` | cualquier otra forma | Cuatro formas hoy (231 apariciones). Ver H18. |

## Dos conceptos que se confunden y conviene separar

1. **«Vista previa»** son dos cosas: la clase gratis que ve cualquier visitante, y la herramienta del administrador para compartir un curso sin publicar (`/vista-previa/[token]`). Propongo llamar «clase gratis» a la primera y dejar «vista previa» para la segunda.
2. **«Módulo»** designa un grupo de clases dentro de un curso, y a la vez se usa como «sección de la aplicación» en `Proximamente.tsx`. Propongo «sección» para lo segundo. Ese componente no se usa hoy en ninguna pantalla.

## Palabras de la marca que sí son intencionales

No se tocan: **uvas** (la mecánica del examen), **tanda** (el grupo de intentos), **carné** (la tarjeta del estudiante), **torre y pisos** (el progreso). Dan carácter y son consistentes.

## Qué le toca al equipo

El panel admin habla con otro vocabulario que el del estudiante («lección», «categoría», «profesor»). Son 30 archivos del panel con «lección», «categoría» o «profesor» en texto visible. Cambiarlos es trabajo de textos y no cambia nada de la lógica. Lo dejo propuesto en `docs/pendientes-equipo.md`.
