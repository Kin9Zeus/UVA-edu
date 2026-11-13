# Etapa 4. Reglas de voz de UVA

**Fase 8. Revisión de textos y reglas de voz de UVA**
**Fecha:** 13 de noviembre de 2026
**Estado:** propuesta para mi aprobación. Los ejemplos son textos reales de la plataforma; la columna «después» es una propuesta, no un cambio hecho.

Son cuatro reglas. Cada una se puede verificar leyendo un texto y respondiendo sí o no.

## Regla 1. Hablamos como colega del oficio: tú, voz activa y solo lo que es cierto

Le hablamos de tú a otro profesional. Frases cortas, el verbo en activa («Suspendimos tu cuenta», no «ha sido suspendida») y ninguna promesa que la plataforma no cumpla hoy.

**Cómo se verifica:** no hay voseo (sos, tenés, contanos, reportás), no hay voz pasiva con «ha sido» y cada afirmación tiene un respaldo en `src/content/marketing.ts` o en la base.

| Antes | Después |
| --- | --- |
| «Contanos por qué… Por qué reportás esta publicación» (`ReportarComunidadDialog.tsx:83,100`) | «Cuéntanos por qué. Un administrador la revisará.» y «Por qué reportas esta publicación» |
| «Clases cortas, plantillas listas para usar y casos reales.» (`Hero.tsx:44`) | «Clases en video, plantillas descargables y certificado verificable.» |

## Regla 2. Un botón dice lo que va a pasar, y la misma acción siempre lleva el mismo verbo

El botón empieza con un verbo en infinitivo y nombra lo que se obtiene («Descargar PDF», «Canjear código»). Para una acción que se repite en varias pantallas usamos siempre la misma palabra, la que dice el glosario.

**Cómo se verifica:** buscar el verbo del botón en el glosario. Si en otra pantalla la misma acción usa un verbo distinto, hay que unificar.

| Antes | Después |
| --- | --- |
| «Acceder» (`SoporteCentro.tsx:239`), «Ingresa a tu cuenta» (`AuthFlow.tsx:49`), «Entrar» | «Iniciar sesión» (frase) y «Entrar» (solo el botón corto del encabezado) |
| «Hacer examen» (`LeccionMaqueta.tsx:631`), «Iniciar examen» (`ExamenIntro.tsx:247`) | «Presentar examen» en los cuatro botones |

## Regla 3. Un error dice qué pasó y qué hacer, y no culpa a la persona

Dos frases, como máximo tres. La primera dice qué pasó, con «no pudimos…» cuando el fallo es nuestro. La segunda dice qué hacer ahora: reintentar, revisar un dato concreto o escribirnos al correo de soporte. Nada de «inválido» solo, ni de «error desconocido», ni de culpar («ingresaste mal»).

**Cómo se verifica:** el texto contiene un verbo de salida (intenta, revisa, escribe, canjea, espera) y no termina en la palabra «inválido».

| Antes | Después |
| --- | --- |
| «Título inválido.» (`crear.ts:86`) | «El título no es válido. Revisa que no esté vacío ni demasiado largo.» |
| «No pudimos publicar tu respuesta.» (`crear.ts:261`) | «No pudimos publicar lo que escribiste. Intenta de nuevo.» |

## Regla 4. Una pantalla vacía invita a hacer lo siguiente

Cuando no hay nada que mostrar, el texto dice por qué está vacío y qué hacer para llenarlo. Siempre hay una acción concreta: un botón o una frase que empieza con un verbo.

**Cómo se verifica:** el estado vacío termina con una acción («Termina un curso…», «Comparte un proyecto…»). Un estado vacío que solo dice «No hay nada» no cumple.

| Antes | Después |
| --- | --- |
| «Aún no tienes certificados.» (`PerfilForm.tsx:204`) | «Aún no tienes certificados. Termina un curso y aprueba su examen para recibir el tuyo.» |
| «No tienes notificaciones todavía.» (`NotificacionesPanel.tsx:165`) | «No tienes notificaciones todavía. Te avisamos aquí cuando alguien responda tus publicaciones.» |

## Qué no cambia

- Los **textos legales** (términos, privacidad, datos personales, cookies y normas de la comunidad) conservan su «usted». Las reglas de arriba no se aplican a ellos.
- Las **palabras de la marca** que dan carácter: uvas, tanda, carné, torre y pisos.
- Los **títulos y descripciones SEO**, que se trabajan en la Fase 14.

---

## Bloque listo para pegar en `CLAUDE.md`

Pegar como una subsección nueva de la sección 3 (por ejemplo, **3.5**).

```markdown
### 3.5 Voz y textos de la interfaz

Fuente: `docs/textos/` (revisión de textos, noviembre de 2026). Los textos legales conservan el «usted» y no se tocan.

1. **Hablamos como colega del oficio.** Tuteo siempre, sin voseo (nada de «sos», «tenés», «contanos»). Voz activa («Suspendimos tu cuenta», no «ha sido suspendida»). Ninguna cifra, función o promesa que no esté en `src/content/marketing.ts` o en la base.
2. **Un botón dice lo que va a pasar.** Verbo en infinitivo más lo que se obtiene. La misma acción lleva siempre el mismo verbo: iniciar sesión (frase) y «Entrar» (botón corto), presentar examen, canjear código.
3. **Un error dice qué pasó y qué hacer, sin culpar.** «No pudimos…» más una salida concreta (reintentar, revisar un dato, escribir a soporte). Nunca «inválido» solo ni «error desconocido».
4. **Una pantalla vacía invita a hacer algo.** Dice por qué está vacía y termina con una acción.

Vocabulario fijo: curso, módulo, clase (no «lección»), escuela (no «categoría», salvo en la comunidad), temario, certificado, reseña (no «opinión»), calificación, nota, código de invitación, acceso (no «suscripción» mientras no haya cobro), cuenta, perfil, instructor (no «profesor»), comunidad, panel, uvas. Glosario completo en `docs/textos/02-glosario.md`.

Formato es-CO: coma decimal (4,7), fechas «13 de noviembre de 2026», hora de Bogotá, números con punto de mil (1.200). Puntos suspensivos con el carácter «…», comillas angulares « ».

Antes de fusionar un cambio de texto: buscar el término en el glosario y revisar que ningún texto nuevo use una palabra de la lista de evitar.
```
