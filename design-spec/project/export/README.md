# U.V.A. — Mockup de plataforma (export estático)

Prototipo navegable de la plataforma de formación U.V.A. Se abre con doble clic en
`index.html`; no necesita servidor ni conexión (solo las fuentes de Google se
descargan en línea; sin conexión caen a las fuentes del sistema).

## Estructura

```
index.html                 Documento y marcado de todas las pantallas (plantilla)
css/design-system.css      Tokens y componentes del sistema de diseño Organic
css/app.css                Tema oscuro U.V.A.: color, tipografía y overrides
js/mini-runtime.js         Motor de plantillas ({{ }}, sc-if, sc-for, eventos)
js/app.js                  Estado, navegación y lógica de las pantallas
js/image-slot.js           Componente <image-slot>: espacios de imagen arrastrables
```

## Lenguajes

- **HTML** — `index.html`. Todo el marcado vive dentro de `<template id="app-template">`
  y se renderiza en `<div id="app">`.
- **CSS** — dos hojas: la del sistema de diseño (Organic) y la del tema propio de U.V.A.
  (paleta zinc #09090B / #18181B, acento fucsia #FF007A y amarillo vial #F2C012,
  tipografías Plus Jakarta Sans, Inter y JetBrains Mono).
- **JavaScript** — sin dependencias ni build. `mini-runtime.js` interpreta la plantilla;
  `app.js` contiene el estado (`state`) y `renderVals()`, que expone los valores y
  manejadores usados por los `{{ huecos }}` del HTML.

## Sintaxis de plantilla

| Sintaxis | Qué hace |
| --- | --- |
| `{{ valor }}` | Inserta un valor de `renderVals()` en texto o atributo |
| `<sc-if value="{{ cond }}">` | Muestra el bloque si la condición es verdadera |
| `<sc-for list="{{ lista }}" as="l">` | Repite el bloque por cada elemento (`{{ l.campo }}`, `{{ $index }}`) |
| `onClick="{{ handler }}"` | Enlaza un manejador de `renderVals()` |
| `style-hover="…"` | Estilos aplicados al pasar el cursor |

## Pantallas incluidas

Home público (landing), inicio de sesión, registro en dos pasos, dashboard,
academia/catálogo, landing de curso, reproductor de clase (recursos, resumen,
comentarios y checklist de progreso), mis rutas, progreso y ranking, certificados
con vista previa, comunidad bloqueada, precios, mi suscripción y perfil editable.

## Imágenes

Los recuadros `<image-slot>` son espacios vacíos: arrastra una imagen encima y
queda guardada en el navegador (localStorage). Cada espacio tiene su propio `id`.
