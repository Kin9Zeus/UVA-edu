# Porcentaje de avance por curso y sección 'Mis cursos / Continuar viendo'

Estado: Resuelto (1-5); punto 6 deliberadamente sin implementar, ver nota
Fase: Fase 3 — Experiencia del estudiante (https://app.notion.com/p/Fase-3-Experiencia-del-estudiante-3b4ba9d6712e8101a01fcda5eda9ab42?pvs=21)
Prioridad: Media
Responsable: Andres Felipe Escobar Duque
Semana estimada: 29 ago – 4 sep

## Qué hay que entregar

Cálculo del porcentaje de avance por curso y la sección personal del estudiante ("Mis cursos" / "Continuar viendo").

## Requisitos de calidad (nivel senior)

- [x] El porcentaje se calcula como lecciones completadas sobre total de lecciones **publicadas** del curso. Las lecciones en borrador no cuentan.
- [x] Calcularlo con una vista de Postgres o una consulta agregada, **no** trayendo todo el progreso al cliente y sumando ahí.
- [x] Si se agrega una lección nueva a un curso, el porcentaje de quienes ya lo terminaron bajará. Decidir y documentar si eso revoca el certificado (recomendación: no, el certificado ya emitido se conserva).
- [x] "Continuar viendo" ordena por última actividad y lleva directo a la lección exacta, no al inicio del curso.
- [x] Estado vacío con propuesta clara: si el estudiante no tiene cursos, mostrar el catálogo.
- [ ] Cachear el cálculo si la consulta pesa; invalidar al registrar progreso nuevo. **Decisión:** sin implementar a propósito. `unstable_cache` de Next.js no permite leer `cookies()` dentro de la función cacheada, y la vista de Postgres (`progreso_cursos_estudiante`) depende de RLS, que a su vez depende de la sesión leída por cookies. Cachearlo de verdad exigiría un cliente Supabase autenticado por bearer token en vez de por cookies — un patrón nuevo, más superficie de riesgo. Con el volumen real de datos (4-11 lecciones por curso, un puñado de cursos) la consulta no pesa: la condición que este mismo punto pone para justificar el cache no se cumple todavía. Revisitar si el catálogo crece.

## Definición de "terminado"

El estudiante entra a su panel, ve sus cursos con porcentaje correcto, y con un clic vuelve exactamente donde se quedó.
