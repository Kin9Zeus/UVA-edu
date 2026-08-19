# U.V.A. — Home

Home público: nav, hero, banda de empresas, planes Basic / Expert / Expert Duo,
CTA final y footer con redes. Abre `home.html` con doble clic.

Los botones de acceso llevan a `iniciarsesion-crearusuario.html` (paquete aparte);
coloca ambas carpetas juntas si quieres que el enlace funcione.

```
home.html
css/design-system.css
css/app.css
js/mini-runtime.js
js/app.js
js/image-slot.js
```

## Lenguajes

- **HTML** — el marcado vive en `<template id="app-template">` y se renderiza en `<div id="app">`.
- **CSS** — `css/design-system.css` (sistema Organic) y `css/app.css` (tema U.V.A.: zinc #09090B / #18181B, fucsia #FF007A, amarillo vial #F2C012; Plus Jakarta Sans, Inter, JetBrains Mono).
- **JavaScript** — sin dependencias ni build: `js/mini-runtime.js` interpreta la plantilla ( `{{ }}`, `sc-if`, `sc-for`, eventos ) y `js/app.js` guarda el estado y los manejadores.
