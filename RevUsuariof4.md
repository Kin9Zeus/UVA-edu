# Panel de usuarios: cupos usados/disponibles, activos e inactivos

Estado: Sin empezar
Fase: Fase 4 — Acceso por cupos gratuitos y control de acceso (https://app.notion.com/p/Fase-4-Acceso-por-cupos-gratuitos-y-control-de-acceso-3b4ba9d6712e81d78223c1e597eef033?pvs=21)
Prioridad: Media
Responsable: JuanMiguel
Semana estimada: 1–6 sep

## Qué hay que entregar

Pantalla de administración con la foto real de quién está usando la plataforma.

## Métricas mínimas del MVP

- Cupos totales, canjeados y disponibles.
- Usuarios registrados, con acceso vigente, con acceso vencido.
- Usuarios activos (con actividad en los últimos 7 días).
- Cursos con más avance y lecciones donde la gente abandona.

## Requisitos de calidad (nivel senior)

- [ ] Las agregaciones se calculan en Postgres (vistas o funciones), no trayendo todas las filas al cliente.
- [ ] Filtro por rango de fechas y búsqueda por correo.
- [ ] Paginación en la tabla de usuarios desde el inicio.
- [ ] Exportación a CSV para análisis fuera de la plataforma.
- [ ] No mostrar datos personales innecesarios en la vista de lista; el detalle solo al abrir un usuario.

## Por qué importa en este MVP

Con cupos regalados, la métrica que decide si el producto funciona no es el dinero: es **cuántos de los invitados realmente entran y avanzan**. Esta pantalla es la que va a responder eso.

## Definición de "terminado"

El equipo de UVA puede responder, sin pedirle nada al equipo técnico: cuántos cupos quedan, cuántos invitados entraron, y cuántos están avanzando de verdad.
