# Pruebas en equipo real (las rellena el usuario)

Complementa `compatibilidad.md`. Marca cada celda: **OK**, **FALLA** (y anota qué viste, con captura si puedes) o **N/A**. Todo FALLA se registra en `bugs-e2e.md` como BUG-0xx y se corrige.

**Dónde:** el recorrido crítico (paso 1) se hace en **producción** (la URL desplegada), a mano, porque es el único lugar con videos reales de Mux. La suite automática no se apunta a producción: crea usuarios y códigos con la Service Role Key.

**Antes de empezar:** usa la URL desplegada (no localhost). Ten a mano un código de invitación y una cuenta de estudiante. Si no tienes el equipo, BrowserStack o LambdaTest sirven (prueba gratuita).

## Qué mirar en cada equipo (el mismo guion en todos)

1. **Recorrido:** registro -> canje del código -> catálogo -> curso -> lección con video -> progreso -> certificado.
2. **Video:** reproduce, pausa, salta y pasa a **pantalla completa** y vuelve.
3. **Teclado abierto:** en login, registro, canje y un campo del examen. El campo activo y el botón de enviar siguen visibles.
4. **Barra inferior de Safari / barra de direcciones:** en el panel, la barra de pestañas de abajo no queda tapada ni cortada. Scroll arriba y abajo.
5. **Zonas seguras (iPhone con notch):** gira el celular de lado; nada queda bajo el notch ni el indicador de inicio.
6. **Tema:** repite 1 y 3 en claro y oscuro (menú de tema).
7. **WhatsApp (solo portada):** el botón flotante no tapa nada importante. Roce con "Tengo un código" en iPhone SE ya está aceptado (BUG-004).

## Cuidado al probar en producción

- Usa una cuenta y un código de invitación **de prueba** (con 1 uso y vencimiento corto), nunca los de un estudiante real.
- El canje gasta el código y el registro crea un usuario real. Al terminar, bórralos desde el admin (Usuarios y Códigos).
- Completar el curso emite un certificado real a esa cuenta de prueba: bórrala con ella.
- No toques datos de otros usuarios ni de cursos que no sean los de prueba.

## Matriz

**Resultado (2026-11-03):** el usuario probó los 11 equipos en producción y reportó que pasan todas las pruebas. Sin FALLA, no se abrió ningún BUG nuevo. Las celdas están marcadas según ese reporte; no hay capturas de estas pruebas.

| # | Equipo y navegador | Recorrido | Video y pantalla completa | Teclado | Barra inferior / zonas seguras | Tema claro y oscuro | WhatsApp | Notas |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | iPhone pequeño (tipo SE), Safari | OK | OK | OK | OK | OK | OK | |
| 2 | iPhone grande, Safari | OK | OK | OK | OK | OK | OK | |
| 3 | Android gama media, Chrome | OK | OK | OK | OK | OK | OK | |
| 4 | Android gama media, **Samsung Internet** | OK | OK | OK | OK | OK | OK | |
| 5 | Android gama baja o antiguo, Chrome | OK | OK | OK | OK | OK | OK | |
| 6 | Tableta (iPad o Android), vertical | OK | OK | OK | OK | OK | OK | |
| 7 | Tableta, horizontal | OK | OK | OK | OK | OK | OK | |
| 8 | Windows, Chrome | OK | OK | OK | OK | OK | OK | |
| 9 | Windows, Edge | OK | OK | OK | OK | OK | OK | |
| 10 | Windows, Firefox | OK | OK | OK | OK | OK | OK | |
| 11 | Mac, Safari | OK | OK | OK | OK | OK | OK | |

## Qué confirma cada uno de los arreglos

- **BUG-002 (`viewport-fit`)**: en 1, 2, 6 y 7, la barra de pestañas y los avisos quedan **por encima** del indicador de inicio.
- **BUG-003 (`dvh`)**: en 1 a 5, la barra de pestañas del panel se ve completa con la barra de direcciones visible y al esconderse.
- **Rendimiento (solo 5):** anota si el video o el scroll se traban.
