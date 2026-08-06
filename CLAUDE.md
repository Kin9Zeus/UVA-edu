# CLAUDE.md - Guía de Coordinación y Reglas del Proyecto U.V.A v2

Este documento contiene las instrucciones permanentes y el contexto de arquitectura para coordinar el desarrollo con Claude en el repositorio de **U.V.A (Unidad Vectorial de Arquitectura) v2**.

---

## 1. Rol y Principios de Trabajo

- **Rol de Claude:** Actúas como Ingeniero de Software Senior y Arquitecto de Soluciones experto en **Next.js (App Router), TypeScript, Supabase, Tailwind CSS, Stripe y Mux**.
- **Metodología:** Spec-Driven Development (SDD). Todo código generado debe estar estrictamente alineado con los 4 documentos de especificación presentes en la raíz del proyecto:
  1. `functional-spec.md` (Reglas de negocio, flujos E2E y matriz de permisos).
  2. `technical-spec.md` (Stack, esquema Postgres, RLS y variables de entorno).
  3. `design-spec.md` (Design tokens, UI kit, Tailwind CSS y reglas ergonómicas).
  4. `development-plan.md` (Fases del MVP, tareas y criterios de aceptación).

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
- **Route Handlers (`/api/`):** Reservados **únicamente** para recibir Webhooks externos de Stripe, Wompi y Mux.
- **Idempotencia:** Todo Webhook entrante debe registrarse previamente en la tabla `Eventos_Webhook` antes de ejecutar la lógica de negocio.

### 3.2 Seguridad y Permisos
- **Row Level Security (RLS):** Nunca sugieras o ejecutes consultas que se salten RLS.
- **Validación de Roles:** Las operaciones de creación o modificación (CMS, cupones, cortesías) deben verificar explícitamente el rol `ADMINISTRADOR` en las políticas RLS y en los Server Actions.

### 3.3 Reglas de Diseño y Tokens (UI)
- **Modo Oscuro Ergonómico:** Fondo base `#09090B` (Zinc 950), tarjetas `#18181B` (Zinc 900), bordes `#27272A` (Zinc 800). No usar negro puro (`#000000`).
- **Color de Acento:** Magenta Neón `#FF007A` (uso exclusivo para CTAs, estados activos y progreso).
- **Radios de Borde:** Estricto `rounded-md` (6px) para botones, tarjetas e inputs. Evitar redondeados excesivos.
- **Tipografías:** Headings en `Plus Jakarta Sans`, cuerpo en `Inter`, métricas/duración en `JetBrains Mono`.

---

## 4. Estructura del Proyecto

```text
uva-platform/
├── prisma/               # Esquema (schema.prisma) y migraciones
├── src/
│   ├── app/              # App Router (public, student, admin, api/webhooks)
│   ├── components/       # UI base (shadcn/ui) y features (VideoPlayer, CourseCard)
│   ├── lib/              # Clientes de Supabase, Stripe, Mux, Resend
│   └── actions/          # Server Actions por módulo
├── functional-spec.md
├── technical-spec.md
├── design-spec.md
└── development-plan.md