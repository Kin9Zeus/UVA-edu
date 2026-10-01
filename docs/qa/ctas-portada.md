# Botones y enlaces principales y su destino

Tarea: *Front: reemplazar la sección de precios por el acceso por invitación y unificar llamados a la acción*.

Estado del código con la bandera `NEXT_PUBLIC_PRICING_ENABLED` apagada (valor por defecto). Se revisó el código; no se probó cada destino en el navegador. No incluye el panel de administración.

## 1. Portada (`/`)

| Zona | Texto | Destino | ¿El texto coincide? |
|---|---|---|---|
| Encabezado | U.V.A. (logo) | `/` | Sí |
| Encabezado | Buscador "¿Qué quieres aprender?" | `/catalogo` (con el texto buscado) | Sí |
| Encabezado | Cursos | `/catalogo` | Sí |
| Encabezado | Acceder | `/login` (entrar o crear cuenta) | Sí |
| Encabezado móvil | Menú (hamburguesa) → Cursos | `/catalogo` | Sí |
| Encabezado | Precios | Oculto con la bandera apagada | Quitado |
| Hero | Tengo un código (principal) | `/dashboard/suscripcion`; sin sesión redirige a `/login` | Sí |
| Hero | Ver catálogo | `/catalogo` | Sí |
| Curso destacado | Explorar curso | `/cursos/{slug}` | Sí |
| Bloque de invitación | Tengo un código | `/dashboard/suscripcion`; sin sesión redirige a `/login` | Sí |
| Bloque de invitación | Quiero una invitación | WhatsApp (canal provisional), otra pestaña | Sí |
| Flotante | Botón de WhatsApp | WhatsApp, otra pestaña | Sí |
| Sección de planes | "Suscribirme" (×3) | Oculta con la bandera apagada | Quitado |
| Bloque de empresas | "Iniciar sesión" | Retirado de la portada | Quitado |

## 2. Pie de página (todas las páginas públicas)

| Columna | Texto | Destino | ¿Coincide? |
|---|---|---|---|
| Escuelas | Nombre de cada escuela | `/catalogo/{slug-de-la-escuela}` | Sí |
| U.V.A. y comunidad | Sobre nosotros, Blog del gremio, Casos de éxito, Empleo | `#` (no llevan a ningún lado) | **No, pendiente** |
| Soporte | Centro de ayuda | `/soporte?tema=centro-de-ayuda` | Sí |
| Soporte | Contacto | `/soporte?tema=contacto` | Sí |
| Soporte | Términos y condiciones | `/soporte?tema=terminos y condiciones` | Sí |
| Soporte | Privacidad | `/soporte?tema=privacidad` | Sí |
| Verificar certificado | Verificar certificado (formulario con el código) | `/verificar-certificado/{código}` | Sí |
| Redes | YouTube, Instagram, WhatsApp, Spotify, TikTok | Enlaces externos, otra pestaña | Sí |

## 3. Ficha de curso (`/cursos/{slug}`)

| Situación del visitante | Texto del botón | Destino | ¿Coincide? |
|---|---|---|---|
| Sin sesión y sin acceso | Entra o crea tu cuenta para canjear tu código | `/login?redirect=/cursos/{slug}` | Sí (antes decía "Regístrate") |
| Con sesión y sin acceso | Canjea tu código | `/dashboard/suscripcion` | Sí |
| Acceso vencido | Renueva tu acceso | `/dashboard/suscripcion` | Sí |
| Con acceso | Comenzar curso / Seguir viendo / Repasar curso | Lección del curso | Sí |

## 4. Entrada y registro

| Pantalla | Texto | Destino | ¿Coincide? |
|---|---|---|---|
| `/login` | Continuar | Comprueba el correo y abre el paso de contraseña o de crear cuenta | Sí |
| `/login` | Crear cuenta | Cambia a crear cuenta en la misma pantalla | Sí |
| `/login` | Continuar con Google | Inicio de sesión con Google | Sí |
| `/registro` | (enlace antiguo) | Redirige a `/login` | Sí |
| `/planes` | (enlace antiguo) | Responde 404 con la bandera apagada | Quitado |

## 5. Panel del estudiante (con sesión)

| Zona | Texto | Destino | ¿Coincide? |
|---|---|---|---|
| Encabezado | Planes | Oculto con la bandera apagada | Quitado |
| Barra lateral | Inicio, Catálogo, Comunidad, Progreso, Certificados, Mis notas, Perfil, Suscripción, Soporte | `/dashboard`, `/dashboard/catalogo`, `/dashboard/comunidad`, `/dashboard/progreso`, `/dashboard/certificados`, `/dashboard/notas`, `/dashboard/perfil`, `/dashboard/suscripcion`, `/dashboard/soporte` | Sí |
| Tarjeta de gracia, Comunidad en pausa, Mis notas | Canjear un código | `/dashboard/suscripcion` | Sí (antes decía "Ver planes") |
| Suscripción | Formulario de canje | Canjea el código | Sí |
| `/dashboard/planes` y `/dashboard/checkout` | (enlaces antiguos) | Redirigen a `/dashboard/suscripcion` | Sí |

## Pendientes y notas

- **Enlaces muertos del pie:** los cuatro de "U.V.A. y comunidad" apuntan a `#`. Se revisan en otra tarea.
- **Canal de "Quiero una invitación":** hoy es WhatsApp; Aleck aún no lo define.
- **Bandera:** `NEXT_PUBLIC_PRICING_ENABLED` apagada por defecto. Para reactivar los planes, ponerla en `true` y redesplegar.
