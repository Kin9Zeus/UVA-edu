# Compatibilidad en navegadores y dispositivos

Tarea "Front: compatibilidad en navegadores y dispositivos reales" (2026-11-03). Evidencia para el informe de prácticas.

**Cómo se corre:** `npm run test:compat` (config `playwright.compat.config.ts`, spec `e2e/compat-navegadores.spec.ts`). Deja el resultado en `docs/qa/compatibilidad/resultado.json` y una captura por pantalla, dispositivo y tema en `docs/qa/compatibilidad/capturas/`.

**Alcance honesto:** Playwright usa los motores reales (WebKit es el de Safari, Gecko el de Firefox, Chromium en Edge), pero con perfiles de dispositivo **emulados**. No sustituye al hardware: el teclado virtual, la barra de Safari, el video en pantalla completa de iOS y Samsung Internet no se pueden medir así.

## Qué verifica cada prueba (9 por dispositivo)
Para `/`, `/login`, `/catalogo` y `/soporte`, en tema oscuro y claro: sin scroll horizontal, sin errores de consola, `viewport-fit=cover` presente y captura. Más una prueba del botón de WhatsApp: no cubre el centro de ningún enlace o botón en ninguna posición de scroll.

## Matriz

| Dispositivo / navegador (de la matriz de la tarea) | Perfil usado | 1.ª corrida | Tras correcciones | Pendiente en equipo real |
| --- | --- | --- | --- | --- |
| Mac, Safari | Desktop Safari (WebKit) | 2 de 9 OK | 9 de 9 OK | Probado por el usuario: OK |
| Windows, Chrome | Chromium (suite normal `test:e2e`) | no corrió aquí | n/a | Probado por el usuario: OK |
| Windows, Edge | Desktop Edge (`msedge`) | sin medir | 9 de 9 OK | Probado por el usuario: OK |
| Windows, Firefox | Desktop Firefox | sin medir | 9 de 9 OK | Probado por el usuario: OK |
| iPhone pequeño, Safari | iPhone SE | 0 de 9 OK | 9 de 9 OK | Probado por el usuario: OK |
| iPhone grande, Safari | iPhone 15 Pro Max | sin medir | 9 de 9 OK | Probado por el usuario: OK |
| iPad vertical | iPad (gen 7) | sin medir | 9 de 9 OK | Probado por el usuario: OK |
| iPad horizontal | iPad (gen 7) landscape | sin medir | 9 de 9 OK | Probado por el usuario: OK |
| Android gama media, Chrome | Pixel 7 | sin medir | 9 de 9 OK | Probado por el usuario: OK |
| Android gama media, Samsung Internet | no disponible en Playwright | **sin resultado** | **sin resultado** | Probado por el usuario: OK |
| Android gama baja, Chrome | Galaxy S9+ | sin medir | 9 de 9 OK | Probado por el usuario: OK |

La primera corrida solo se hizo en iPhone SE y Safari de escritorio: ahí fallaron 16 pruebas por `viewport-fit` (BUG-002). Después se corrió la matriz completa (81 de 81 OK).

## Hallazgos (detalle en `bugs-e2e.md`)
- **BUG-002 (Alta, corregido):** faltaba `viewportFit: "cover"`, las zonas seguras del iPhone valían 0.
- **BUG-003 (Media, corregido por código):** `100vh` bajo la barra de Safari y Chrome móvil. Pasó a `dvh` en el panel, el admin, la ficha del curso, los errores y la vista previa.
- **BUG-004 (Baja, aceptado):** el botón de WhatsApp roza el borde del CTA "Tengo un código" en iPhone SE; el usuario aceptó el roce.

Errores de mi propia prueba durante la tarea (no son de la app): el valor de `localStorage` del tema es `claro`/`oscuro`, y el selector del botón de WhatsApp tomaba el enlace del pie en vez del flotante.

## Pruebas en equipo real

El 2026-11-03 el usuario probó en producción los 11 equipos de la matriz de la tarea (incluidos Samsung Internet, iPhone, Android de gama baja, tableta, Windows y Mac) con el guion de `compatibilidad-equipo-real.md`, en distintas marcas y modelos de dispositivos, con todos los cambios de esta tarea, y reportó que **pasan todas**: recorrido, video y pantalla completa, teclado, barra inferior y zonas seguras, ambos temas y WhatsApp. Sin hallazgos nuevos. BUG-002 y BUG-003 quedan confirmados en equipo real según ese reporte.

## No probado
- **Recorrido crítico completo** (registro, canje, curso, lección con video, certificado): automatizado no corre, porque `e2e/recorrido-critico.spec.ts` falla antes de empezar (staging no tiene el curso semilla ni videos de Mux). Se hizo **a mano en producción** (ver arriba).
