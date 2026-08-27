# Guardado de progreso por lección (segundo actual + completado)

Estado: Sin empezar
Fase: Fase 3 — Experiencia del estudiante (https://app.notion.com/p/Fase-3-Experiencia-del-estudiante-3b4ba9d6712e8101a01fcda5eda9ab42?pvs=21)
Prioridad: Media
Responsable: JuanMiguel
Semana estimada: 29 ago – 4 sep

## Qué hay que entregar

Persistencia del progreso: segundo actual de reproducción y marca de lección completada.

## Requisitos de calidad (nivel senior)

- [ ] Escritura con `UPSERT` sobre la restricción `UNIQUE(user_id, lesson_id)`. Nunca "consultar y luego decidir si insertar o actualizar" — genera condiciones de carrera.
- [ ] Guardar cada ~10 segundos con `throttle`, no en cada evento `timeupdate` (que dispara varias veces por segundo y saturaría la base).
- [ ] Guardar también al salir: `visibilitychange` y `pagehide`. En móvil, `beforeunload` no siempre se dispara.
- [ ] Usar `navigator.sendBeacon` para el guardado final — sobrevive al cierre de la pestaña.
- [ ] Escritura optimista: la interfaz no debe esperar la confirmación del servidor para seguir reproduciendo.
- [ ] Una lección marcada como completada **no** se desmarca si el usuario la vuelve a ver parcialmente.
- [ ] Tolerar el modo sin conexión: si falla el guardado, reintentar, no perder la posición silenciosamente.

## Definición de "terminado"

El estudiante ve 5 minutos, cierra el navegador de golpe, vuelve a entrar desde otro dispositivo y el video retoma en el punto correcto.
