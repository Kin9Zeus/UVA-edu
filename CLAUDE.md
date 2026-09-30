# CLAUDE.md - Guía de Coordinación y Reglas del Proyecto U.V.A v2

Este documento contiene las instrucciones permanentes y el contexto de arquitectura para coordinar el desarrollo con Claude en el repositorio de **U.V.A (Unidad Vectorial de Arquitectura) v2**.

---

## 1. Rol y Principios de Trabajo

- **Rol de Claude:** Actúas como Ingeniero de Software Senior y Arquitecto de Soluciones experto en **Next.js (App Router), TypeScript, Supabase, Tailwind CSS, Stripe y Mux**.
- **Metodología:** Spec-Driven Development (SDD). Todo código generado debe estar estrictamente alineado con las especificaciones presentes en `docs/` y `design-spec/` en la raíz del proyecto:
  1. `docs/functional-spec.md` (Reglas de negocio, flujos E2E y matriz de permisos).
  2. `docs/technical-spec.md` (Stack, esquema Postgres, RLS y variables de entorno).
  3. `design-spec/` (carpeta, no archivo — handoff exportado directamente desde Claude Design). **Antes de construir cualquier UI, lee `design-spec/README.md` y luego `design-spec/project/Uva - Mockups.dc.html` completo**, siguiendo sus imports (`_ds/`, `image-slot.js`, `support.js`). Recrea cada una de las 12 pantallas pixel-perfecto en Next.js + TypeScript + Tailwind CSS — igualando el resultado visual, sin copiar la estructura interna del prototipo HTML. Ver también `design-spec/NOTA.md`.
  3.1. `design-spec-errores/` (carpeta separada, handoff independiente también de Claude Design — solo las pantallas de error: 404, 403 rol incorrecto, 403 cuenta suspendida, 500). Lee `design-spec-errores/README.md` primero: ya documenta el patrón `.error-shell` / `.error-shell--standalone` para que funcione tanto dentro del layout con sidebar (dashboard/admin) como en rutas públicas, y la variante única del 403 parametrizada por `Motivo: 'ROL' | 'SUSPENDIDA'`.
  4. `docs/development-plan.md` (Fases del MVP, tareas y criterios de aceptación).

### 1.1 Ciclo de trabajo (diseño y código)
Aplica siempre, tanto en tareas de diseño como de código:

1. **Contexto:** la tarea parte de Notion; el usuario pega el objetivo y la definición de terminado.
2. **Plan antes de código:** primero un plan, sin escribir código, para que el usuario lo revise. Si el plan suena genérico, se rechaza y se rehace.
3. **Pasos pequeños:** una pantalla o componente a la vez, en una rama propia.
4. **Verificar con capturas:** en **375 px, 768 px y 1440 px**, en tema claro y oscuro.
5. **Criticar:** contrastar el resultado contra el piso de calidad y el sistema de diseño (ver 3.3 y 3.4) y reportar las diferencias antes de dar la tarea por terminada.
6. **Revisión humana:** el usuario prueba en celular real y se abre el pull request para que el compañero lo revise.

---

## 2. Stack Tecnológico Estricto

- **Framework:** Next.js (App Router, TypeScript estricto).
- **Estilos / UI:** Tailwind CSS + `shadcn/ui` + Lucide/Radix Icons.
- **Base de Datos & Auth:** Supabase (PostgreSQL) + Supabase Auth (Email + Google OAuth).
- **ORM / Migraciones:** Prisma (**exclusivamente** para definir `schema.prisma` y ejecutar migraciones; el CRUD de la app se ejecuta con `@supabase/supabase-js` para aprovechar RLS).
- **Streaming de Video:** Mux (usando `@mux/mux-player-react` y *Direct Uploads*).
- **Pasarelas de Pago:** Stripe Billing (Internacional) y Wompi (Colombia).
- **Correos Transaccionales:** Resend + React Email.
- **Generación PDF:** `pdf-lib` (Backend).
- **Hosting:** Railway.

---

## 3. Reglas de Código y Arquitectura (Guardrails)

### 3.1 Mutaciones y Endpoints
- **Server Actions:** Utiliza Next.js Server Actions para todas las mutaciones internas (crear curso, editar perfil, guardar progreso). Evita crear rutas `/api/` para uso interno.
- **Route Handlers (`/api/`):** Reservados **únicamente** para recibir Webhooks externos de Stripe, Wompi y Mux, salvo `/api/health` (chequeo de disponibilidad de solo lectura para monitoreo externo — un monitor de uptime solo puede hacer GET a una URL, no invocar una Server Action).
- **Idempotencia:** Todo Webhook entrante debe registrarse previamente en la tabla `Eventos_Webhook` antes de ejecutar la lógica de negocio.

### 3.2 Seguridad y Permisos
- **Row Level Security (RLS):** Nunca sugieras o ejecutes consultas que se salten RLS.
- **Validación de Roles:** Las operaciones de creación o modificación (CMS, cupones, cortesías) deben verificar explícitamente el rol `ADMINISTRADOR` en las políticas RLS y en los Server Actions.

### 3.3 Reglas de Diseño y Tokens (UI)
- **Modo Oscuro Ergonómico:** Fondo base `#09090B` (Zinc 950), tarjetas `#18181B` (Zinc 900), bordes `#27272A` (Zinc 800). No usar negro puro (`#000000`).
- **Color de Acento:** Magenta Neón `#FF007A` (uso exclusivo para CTAs, estados activos y progreso).
- **Radios de Borde:** Estricto `rounded-md` (6px) para botones, tarjetas e inputs. Evitar redondeados excesivos.
- **Tipografías:** Headings en `Plus Jakarta Sans`, cuerpo en `Inter`, métricas/duración en `JetBrains Mono`.

### 3.4 Reglas de Diseño Adicionales (UI/UX)
- **Solo tokens:** Usar **únicamente** los tokens del sistema de diseño (colores, tipografía, espaciado, radios). Prohibido escribir colores o tamaños sueltos.
- **Móvil primero:** Diseñar primero para móvil (375 px) y luego ampliar.
- **Táctil y formularios:** Áreas táctiles de mínimo 44×44 px. Campos de formulario con letra de 16 px o más (si es menor, el iPhone hace zoom al tocar).
- **Accesibilidad de movimiento y foco:** Foco de teclado siempre visible. Respetar `prefers-reduced-motion`.
- **Imágenes:** Todas con `alt` significativo (o vacío si son decorativas) y con `sizes` correcto en `next/image`.
- **Sin rasgos genéricos de IA:** No usar los rasgos que describe la skill `frontend-design`: etiquetas en MAYÚSCULAS sobre cada título, separadores con punto medio, tarjetas idénticas con la misma sombra, animaciones de entrada en cada sección.
- **Textos:** En español claro, en voz activa, y botones que dicen exactamente lo que hacen.
- **Honestidad del contenido:** Nunca mostrar precios, cifras o funciones que no existen hoy.

---

## 4. Notas para Agentes de IA sobre Next.js (AGENTS.md)

El proyecto usa **Next.js 16.3.0**, una versión que puede incluir cambios posteriores al conocimiento de entrenamiento del modelo. El propio framework genera y mantiene el archivo `AGENTS.md` en la raíz (`node_modules/next/dist/server/lib/generate-agent-files.js` es quien lo regenera en cada `next dev`).

@AGENTS.md

- **No lo edites manualmente ni lo borres del control de versiones** — Next.js lo regenera automáticamente; quitarlo de un diff solo recrea el cambio sin confirmar.
- Antes de escribir código que use APIs de Next.js, consulta `node_modules/next/dist/docs/` (resuelto desde la raíz del proyecto) por si existen cambios o convenciones nuevas respecto a versiones anteriores.

## 5. Estructura del Proyecto

```text
UVA_EDU/
├── prisma/               # Esquema (schema.prisma) y migraciones
├── src/
│   ├── app/              # App Router (public, student, admin, api/webhooks)
│   ├── components/       # UI base (shadcn/ui) y features (VideoPlayer, CourseCard)
│   ├── lib/              # Clientes de Supabase, Stripe, Mux, Resend
│   └── actions/          # Server Actions por módulo
├── docs/
│   ├── functional-spec.md
│   ├── technical-spec.md
│   └── development-plan.md
└── design-spec/          # Handoff de diseño (carpeta, ver README.md y NOTA.md)
```

## 6. Memoria Persistente (Obsidian — Segundo Cerebro)

Este repo se abre como vault de Obsidian. La carpeta `Cerebro/` (ignorada por git, es estado local) guarda decisiones, bugs, sesiones y conceptos del proyecto, enlazados entre sí, vía el servidor MCP `obsidian`.

**Al empezar y al terminar sesiones de trabajo relevantes, sigue el protocolo en `.claude/skills/uva-cerebro/SKILL.md`** — no repitas como hallazgo nuevo algo ya registrado ahí, y deja registrado lo que valga la pena recordar.