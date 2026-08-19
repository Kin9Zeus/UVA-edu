# U.V.A. — Home, inicio de sesión y registro (export estático)

Tres pantallas del prototipo: **home público**, **inicio de sesión** y **creación de
cuenta** (paso 1: correo y contraseña con validación de coincidencia; paso 2: nombre
y rol → se crea el usuario). Abre `index.html` con doble clic; no necesita servidor.

## Estructura

```
index.html                 Marcado de las tres pantallas (plantilla)
css/design-system.css      Tokens y componentes del sistema de diseño Organic
css/app.css                Tema oscuro U.V.A.: color, tipografía y overrides
js/mini-runtime.js         Motor de plantillas ({{ }}, sc-if, sc-for, eventos)
js/app.js                  Estado del flujo de autenticación y validaciones
js/image-slot.js           Componente <image-slot>: espacios de imagen arrastrables
```

## Lenguajes

- **HTML** — `index.html`; el marcado vive en `<template id="app-template">` y se
  renderiza en `<div id="app">`.
- **CSS** — hoja del sistema de diseño Organic y hoja de tema propia (zinc #09090B /
  #18181B, fucsia #FF007A, amarillo vial #F2C012; Plus Jakarta Sans, Inter y
  JetBrains Mono).
- **JavaScript** — sin dependencias ni build. `mini-runtime.js` interpreta la
  plantilla; `app.js` guarda el estado (`state`) y expone valores y manejadores desde
  `renderVals()`.

## Flujo

1. **Home** — nav (Cursos, Precios, Acceder), hero con botón "Iniciar sesión",
   banda de empresas, planes Basic / Expert / Expert Duo, CTA y footer con redes.
   Cualquier acción lleva a la pantalla de acceso.
2. **Inicio de sesión** — Google o correo y contraseña.
3. **Crear cuenta** — paso 1 valida formato de correo, mínimo 8 caracteres y que
   ambas contraseñas coincidan; paso 2 pide nombre y rol y crea el usuario.

## Sintaxis de plantilla

| Sintaxis | Qué hace |
| --- | --- |
| `{{ valor }}` | Inserta un valor de `renderVals()` en texto o atributo |
| `<sc-if value="{{ cond }}">` | Muestra el bloque si la condición es verdadera |
| `onClick="{{ handler }}"` | Enlaza un manejador de `renderVals()` |
| `style-hover="…"` | Estilos aplicados al pasar el cursor |
