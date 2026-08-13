# Server Actions

Todas las mutaciones internas (crear curso, editar perfil, guardar progreso,
otorgar cortesía, aplicar cupón, etc.) viven acá, agrupadas por módulo
funcional: `auth/`, `cursos/`, `suscripciones/`, `progreso/`, `certificados/`,
`cupones/`, `admin/`.

- `src/app/api/` se reserva **exclusivamente** para webhooks externos
  (Stripe, Wompi, Mux). Ninguna mutación interna debe pasar por ahí.
- Toda Server Action valida su input con Zod antes de tocar la base de datos.
- Toda Server Action devuelve `{ success: boolean; data?: T; error?: string }`.
