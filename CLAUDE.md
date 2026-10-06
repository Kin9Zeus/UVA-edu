# CLAUDE.md - Guía de Coordinación y Reglas del Proyecto U.V.A v2

Este documento contiene las instrucciones permanentes y el contexto de arquitectura para coordinar el desarrollo con Claude en el repositorio de **U.V.A (Unidad Vectorial de Arquitectura) v2**.

---

## 1. Rol y Principios de Trabajo

- **Rol de Claude:** Actúas como Ingeniero de Software Senior y Arquitecto de Soluciones experto en **Next.js (App Router), TypeScript, Supabase, Tailwind CSS, Mux y pasarelas de pago (Wompi / Stripe)**.
- **Metodología:** Spec-Driven Development (SDD). Todo código generado debe estar estrictamente alineado con las especificaciones presentes en `docs/` y `design-spec/` en la raíz del proyecto:
  1. `docs/functional-spec.md` (Reglas de negocio, flujos E2E y matriz de permisos).
  2. `docs/technical-spec.md` (Stack, esquema Postgres, RLS y variables de entorno).
  3. `design-spec/` (carpeta, no archivo — handoff exportado directamente desde Claude Design): `design-spec/README.md`, `design-spec/project/Uva - Mockups.dc.html` (con sus imports `_ds/`, `image-slot.js`, `support.js`) y `design-spec/NOTA.md`. Fue la referencia de partida de las 12 pantallas, pero **la UI en producción ya se aparta del mockup a propósito**: son mejoras del equipo. Por eso:
     - Al revisar o modificar una pantalla existente, la referencia es la **UI actual** y el sistema de diseño (3.3 y 3.4), no el mockup. Una diferencia con `design-spec/` no es un hallazgo.
     - Para una pantalla **nueva** sin precedente en la app, pregunta si `design-spec/` sigue aplicando antes de construirla.
  3.1. `design-spec-errores/` (carpeta separada, handoff independiente también de Claude Design — solo las pantallas de error: 404, 403 rol incorrecto, 403 cuenta suspendida, 500). Lee `design-spec-errores/README.md` primero: ya documenta el patrón `.error-shell` / `.error-shell--standalone` para que funcione tanto dentro del layout con sidebar (dashboard/admin) como en rutas públicas, y la variante única del 403 parametrizada por `Motivo: 'ROL' | 'SUSPENDIDA'`.
  4. `docs/development-plan.md` (Fases del MVP, tareas y criterios de aceptación).

### 1.1 Ciclo de trabajo (diseño y código)
Aplica siempre, tanto en tareas de diseño como de código:

1. **Contexto:** la tarea parte de Notion; el usuario pega el objetivo y la definición de terminado.
2. **Plan antes de código:** primero un plan, sin escribir código, para que el usuario lo revise. Si el plan suena genérico, se rechaza y se rehace.
3. **Pasos pequeños:** una pantalla o componente a la vez, en una rama propia.
4. **Verificar con capturas:** en **375 px, 768 px y 1440 px**, en tema claro y oscuro, más los extremos del piso de calidad (**320 px** y **2560 px**, ver 3.4).
5. **Criticar:** contrastar el resultado contra el sistema de diseño (3.3) y el **piso de calidad** (3.4, lista de verificación) y reportar las diferencias antes de dar la tarea por terminada.
6. **Revisión humana:** el usuario prueba en celular real y se abre el pull request para que el compañero lo revise. Antes del pull request: `npx tsc --noEmit`, `npm run lint`, `npx vitest run` y `npm run build` en verde.

---

## 2. Stack Tecnológico Estricto

- **Framework:** Next.js 16 (App Router, TypeScript estricto). Ver sección 4.
- **Estilos / UI:** Tailwind CSS + `shadcn/ui` + Lucide/Radix Icons.
- **Base de Datos & Auth:** Supabase (PostgreSQL) + Supabase Auth (Email + Google OAuth).
- **ORM / Migraciones:** Prisma (**exclusivamente** para definir `schema.prisma` y ejecutar migraciones; el CRUD de la app se ejecuta con `@supabase/supabase-js` para aprovechar RLS).
- **Streaming de Video:** Mux (usando `@mux/mux-player-react` y *Direct Uploads*).
- **Pasarelas de Pago:** el MVP es **gratuito y por invitación** (códigos de invitación, sin cobro). La sección de precios, el enlace "Precios" y `/planes` están ocultos tras `NEXT_PUBLIC_PRICING_ENABLED` (`src/lib/features.ts`). El código de pagos existe como base para cuando entre el cobro: Wompi (Colombia) y Stripe (internacional, diferido). La pasarela definitiva sigue en evaluación (Notion, "Decisiones pendientes"); no trates hallazgos de pagos como riesgo de producción mientras no haya una pasarela real conectada.
- **Correos Transaccionales:** Resend + React Email.
- **Generación PDF:** `pdf-lib` (Backend).
- **Hosting:** Railway.

---

## 3. Reglas de Código y Arquitectura (Guardrails)

### 3.1 Mutaciones y Endpoints
- **Server Actions:** Utiliza Next.js Server Actions para todas las mutaciones internas (crear curso, editar perfil, guardar progreso). Evita crear rutas `/api/` para uso interno.
- **Route Handlers (`/api/`):** Reservados **únicamente** para recibir Webhooks externos de Stripe, Wompi, Mux y el hook de envío de correos de Supabase Auth (`/api/webhooks/supabase-auth`), salvo `/api/health` (chequeo de disponibilidad de solo lectura para monitoreo externo — un monitor de uptime solo puede hacer GET a una URL, no invocar una Server Action).
- **Idempotencia:** Todo Webhook entrante debe registrarse previamente en la tabla `Eventos_Webhook` antes de ejecutar la lógica de negocio.

### 3.2 Seguridad y Permisos
- **Row Level Security (RLS):** Nunca sugieras o ejecutes consultas que se salten RLS.
- **Validación de Roles:** Las operaciones de creación o modificación (CMS, cupones, cortesías) deben verificar explícitamente el rol `ADMINISTRADOR` en las políticas RLS y en los Server Actions.
- **Errores de consulta (nunca un vacío por un fallo):** toda consulta a Supabase toma `{ data, error }` y maneja el `error`. Nunca mostrar un estado vacío ("no tienes certificados", "sin cursos", "sin acceso", una lista en 0) cuando hubo un error: el usuario cree que perdió su trabajo.
  - Si el dato **es el contenido de la pantalla** (lista, acceso, estado de un curso, rol, exportación), usa `lanzarSiFalla` (`src/lib/supabase/errores.ts`): `error.tsx` muestra el mensaje con Reintentar y Sentry lo agrupa.
  - Si es un dato **secundario** que solo deja la pantalla menos rica (nombre de un autor, un contador, una miniatura), degrada a un valor de reemplazo explícito **y registra** con `registrarSiFalla` (`src/lib/supabase/registrar.ts`). Nunca en silencio.
  - En una Server Action devuelve `{ error }` con un mensaje que no afirme algo falso (un fallo al comprobar el acceso no es "necesitas una suscripción"). En un webhook, responde 500 para que el proveedor reintente. En una comprobación de seguridad o antes de una operación irreversible, falla cerrado.
  - `PGRST116` (cero filas en `.single()`) no es un fallo: es "no existe".

### 3.3 Sistema de diseño y tokens (UI)
- **Temas claro y oscuro:** la plataforma soporta ambos. Por defecto sigue `prefers-color-scheme` del sistema operativo, con un selector manual que se recuerda en `localStorage` (`src/lib/tema.ts`). El tema oscuro se activa con la clase `.dark` en `<html>`. Toda pantalla se revisa en los dos.
- **Tokens:** viven en `src/app/globals.css` como variables `--uva-*`, expuestas a Tailwind como `uva-*` (`bg-uva-bg`, `bg-uva-surface`, `border-uva-divider`, `text-uva-text`…). Valores de referencia:

  | Token | Claro | Oscuro |
  | --- | --- | --- |
  | Fondo (`uva-bg`) | `#FAFAFA` | `#09090B` (Zinc 950) |
  | Tarjetas (`uva-surface`) | `#FFFFFF` | `#18181B` (Zinc 900) |
  | Bordes (`uva-divider`) | `#E4E4E7` | `#27272A` (Zinc 800) |
  | Texto (`uva-text`) | `#18181B` | `#FAFAFA` |

  No usar negro puro (`#000000`).
- **Color de acento:** Magenta Neón `#FF007A` (`uva-accent`), uso exclusivo para CTAs, estados activos y progreso. Para **texto o íconos** de acento usa `uva-accent-ink` / `uva-accent-text`: en tema claro bajan a `#C2005B` para cumplir contraste AA sobre fondo blanco.
- **Radios de borde:** solo los tokens `rounded-uva-*` (`xs` 4px, `sm` 8px, `md` 10px, `lg` 16px). Botones, tarjetas e inputs usan `rounded-uva-md`; `rounded-full` solo para píldoras, avatares e insignias. Evitar redondeados excesivos.
- **Tipografías:** Headings en `Plus Jakarta Sans`, cuerpo en `Inter`, métricas/duración en `JetBrains Mono`.

### 3.4 Piso de calidad ("terminado")
Fuente: Notion, "Qué significa terminado (el piso de calidad)". Ninguna pantalla se da por lista si no cumple **todo** esto. En el paso 5 del ciclo (sección 1.1) se reporta punto por punto, y lo que no se pudo medir se dice explícitamente: no se da por cumplido.

**Criterios del piso (Notion)**
- [ ] **Responsive real:** sin scroll horizontal desde **320 px** (celulares pequeños) hasta **2560 px** (monitores grandes). Se prueba también girando el celular. Herramientas: `npm run audit:overflow` y `npm run audit:screenshots` (320, 375, 768, 1024, 1440 y 2560 px).
- [ ] **Navegadores:** Chrome, Safari (iPhone y Mac), Firefox, Edge y **Samsung Internet** (muy usado en Android de gama media).
- [ ] **Accesibilidad WCAG 2.2 AA:** todo se puede usar solo con teclado, con lector de pantalla y con la letra del sistema agrandada.
- [ ] **Rendimiento (Core Web Vitals en móvil):** LCP ≤ 2,5 s, INP ≤ 200 ms, CLS ≤ 0,1.
- [ ] **Lighthouse en móvil:** 90 o más en Rendimiento, Accesibilidad, Buenas prácticas y SEO (`npm run audit:lighthouse`).
- [ ] **Estados completos:** cargando, vacío, error y con datos. Nunca una pantalla en blanco, un número vacío ni un "—" donde debería haber un dato.
- [ ] **Contenido veraz:** ninguna cifra, función o precio que la plataforma no cumpla hoy. Las cifras y funciones públicas se editan **solo** en `src/content/marketing.ts`; las que se pueden contar salen de la base (`src/lib/cifrasPublicas.ts`) y se muestran desde su mínimo. Una función sin fecha no se anuncia; con fecha, se marca "Próximamente".

**Reglas de UI del proyecto (cómo se cumple el piso aquí)**
- [ ] **Solo tokens:** colores, tipografía, espaciado y radios del sistema de diseño (3.3). Prohibido escribir colores o tamaños sueltos.
- [ ] **Móvil primero:** diseñar primero para 375 px y luego ampliar.
- [ ] **Ambos temas:** se ve y se lee bien en claro y en oscuro, con contraste AA en los dos.
- [ ] **Táctil y formularios:** áreas táctiles de mínimo 44×44 px. Campos de formulario con letra de 16 px o más (si es menor, el iPhone hace zoom al tocar).
- [ ] **Foco y movimiento:** foco de teclado siempre visible. Respetar `prefers-reduced-motion`.
- [ ] **Imágenes:** todas con `alt` significativo (o vacío si son decorativas) y con `sizes` correcto en `next/image`.
- [ ] **Controles accesibles:** enlaces y botones con solo ícono llevan `aria-label` en español; los íconos decorativos, `aria-hidden`. Ningún `href="#"` ni enlace a páginas que no existen.
- [ ] **Sin rasgos genéricos de IA:** no usar los rasgos que describe la skill `frontend-design`: etiquetas en MAYÚSCULAS sobre cada título, separadores con punto medio, tarjetas idénticas con la misma sombra, animaciones de entrada en cada sección.
- [ ] **Textos:** en español claro, en voz activa, sin errores de ortografía, y botones que dicen exactamente lo que hacen.
- [ ] **Coherencia de datos:** el mismo dato dice lo mismo en todas las pantallas. Por ejemplo, el avance cuenta solo clases con video listo, igual que el certificado, y solo se listan escuelas con al menos un curso publicado.

---

## 4. Notas para Agentes de IA sobre Next.js (AGENTS.md)

El proyecto usa **Next.js 16.3.8** (ver `package.json`), una versión que puede incluir cambios posteriores al conocimiento de entrenamiento del modelo. El propio framework genera y mantiene el archivo `AGENTS.md` en la raíz (`node_modules/next/dist/server/lib/generate-agent-files.js` es quien lo regenera en cada `next dev`).

@AGENTS.md

- **No lo edites manualmente ni lo borres del control de versiones** — Next.js lo regenera automáticamente; quitarlo de un diff solo recrea el cambio sin confirmar.
- Antes de escribir código que use APIs de Next.js, consulta `node_modules/next/dist/docs/` (resuelto desde la raíz del proyecto) por si existen cambios o convenciones nuevas respecto a versiones anteriores.

## 5. Estructura del Proyecto

```text
UVA_EDU/
├── prisma/               # Esquema (schema.prisma) y migraciones
├── supabase/sql/         # RLS, triggers y funciones (SQL numerado, ver README)
├── src/
│   ├── app/              # App Router (public, student, admin, api/webhooks)
│   ├── components/       # UI base (shadcn/ui) y features (VideoPlayer, CourseCard)
│   ├── content/          # Textos públicos: cifras, funciones y beneficios anunciados
│   ├── lib/              # Clientes de Supabase, Mux, Resend, pagos y lógica compartida
│   ├── emails/           # Plantillas de React Email
│   └── actions/          # Server Actions por módulo
├── docs/
│   ├── functional-spec.md
│   ├── technical-spec.md
│   └── development-plan.md
├── design-spec/          # Handoff de diseño original (ver sección 1, punto 3)
└── design-spec-errores/  # Handoff de las pantallas de error (404, 403, 500)
```

## 6. Memoria Persistente (Obsidian — Segundo Cerebro)

Este repo se abre como vault de Obsidian. La carpeta `Cerebro/` (ignorada por git, es estado local) guarda decisiones, bugs, sesiones y conceptos del proyecto, enlazados entre sí, vía el servidor MCP `obsidian`.

**Al empezar y al terminar sesiones de trabajo relevantes, sigue el protocolo en `.claude/skills/uva-cerebro/SKILL.md`** — no repitas como hallazgo nuevo algo ya registrado ahí, y deja registrado lo que valga la pena recordar.