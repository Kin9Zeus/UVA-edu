# U.V.A. — Iniciar sesión / Crear cuenta

Pantalla de acceso con los dos modos:

1. **Inicio de sesión** — Google, o correo y contraseña.
2. **Crear cuenta** — paso 1 valida formato de correo, mínimo 8 caracteres y que
   ambas contraseñas coincidan; paso 2 pide nombre y rol y crea el usuario.

Abre `iniciarsesion-crearusuario.html` con doble clic. El logo vuelve a `home.html`.

```
iniciarsesion-crearusuario.html
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
