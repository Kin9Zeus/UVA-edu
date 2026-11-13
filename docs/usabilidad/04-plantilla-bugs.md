# Plantilla para registrar hallazgos en la base Bugs de Notion

**Fase 13. Pruebas de usabilidad**

Cada hallazgo de una sesión es **una fila** en la base Bugs. Aquí está cómo llenar cada columna.

## Columnas

| Columna | Qué se escribe |
| --- | --- |
| **Título** | Una frase corta que diga qué pasó y dónde. Formato: «[Pantalla] qué ocurre». Ejemplo: «[Registro] La casilla de términos lleva a una página en preparación». Máximo 90 caracteres. |
| **Estado** | `Sin empezar` al crearlo. |
| **Severidad** | `Crítica`, `Alta`, `Media` o `Baja`, con la escala de abajo. |
| **Descripción** | Qué esperaba la persona, qué pasó realmente y qué dijo. Incluir la cita textual entre comillas. Anotar cuántos participantes lo vivieron (por ejemplo, «3 de 5»). |
| **Pasos para reproducir** | Lista numerada, empezando desde un punto fijo (por ejemplo, «desde el inicio, sin sesión»). Dispositivo y navegador. |
| **Reportado por** | Tu nombre. |
| **Fase relacionada** | `Fase 13` (pruebas de usabilidad). Si el hallazgo es de texto, agregar la `Fase 8`. |

## Escala de severidad

| Severidad | Cuándo |
| --- | --- |
| **Crítica** | Impide completar el recorrido. |
| **Alta** | Lo completa, pero con ayuda o con mucha frustración. |
| **Media** | Hay confusión, pero se recupera sola. |
| **Baja** | Es cosmético. |

Si dos participantes viven el mismo problema con severidades distintas, se registra **la más alta**.

## Reglas para registrar

1. **Un hallazgo por fila.** Si una pantalla tiene tres problemas, son tres filas.
2. **Primero buscar si ya existe.** Si ya está, no se duplica: se agrega una línea a la descripción («también P4») y se sube la severidad si hace falta.
3. **Lo que ya se conocía** (por ejemplo, las correcciones de texto de `docs/textos/01-hallazgos.md`) se registra igual, con una nota «ya conocido: H##», para saber si un participante tropezó con él.
4. **Sin datos personales.** Se usa el código del participante (P1 a P5). Nunca nombre, correo ni teléfono.
5. **Describir lo observable, no la causa.** «No encontró el botón» y no «el botón es feo». La causa la propone quien analiza después.

## Ejemplo

> **Este es un ejemplo para mostrar el formato. No es un hallazgo real.**

| Columna | Ejemplo |
| --- | --- |
| Título | [Ficha de curso] No encuentra cómo empezar la primera clase |
| Estado | Sin empezar |
| Severidad | Alta |
| Descripción | P2 buscó el botón para empezar durante dos minutos. Dijo: «¿Dónde le doy?». Terminó usando el botón del temario. Lo vivieron 2 de 5. |
| Pasos para reproducir | 1. Entrar al catálogo desde el celular. 2. Abrir un curso. 3. Intentar empezar la primera clase sin ayuda. Dispositivo: `[modelo]`, navegador: `[navegador]`. |
| Reportado por | Aleck |
| Fase relacionada | Fase 13 |

## Resumen semanal para la Bitácora

Al terminar las cinco sesiones, escribo cinco líneas: cuántos participantes completaron cada tarea, los tres problemas más repetidos, el hallazgo más grave, qué ya está en Bugs y la próxima acción.
