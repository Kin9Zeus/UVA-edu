# Revisión de RLS y fugas de contenido con cuentas de distintos roles

Estado: Terminado (2026-09-03) — único pendiente no bloqueante: desplegar el servicio de staging en Railway (F-1 en el documento de evidencia)
Fase: Fase 7 — Endurecimiento, carga de contenido y lanzamiento (https://app.notion.com/p/Fase-7-Endurecimiento-carga-de-contenido-y-lanzamiento-3b4ba9d6712e815489d0fdabe706c782?pvs=21)
Prioridad: Alta
Responsable: JuanMiguel
Semana estimada: 9–12 sep

## Qué hay que entregar

Una auditoría de seguridad enfocada en lo único que realmente puede hundir el negocio: **que el video se filtre**.

## Por qué sigue siendo la tarea más importante de la Fase 7

Sin cobro, el riesgo financiero del MVP es bajo. Pero el catálogo de UVA es su activo. Un video filtrado no se puede "des-filtrar".

## Auditoría de RLS

- [x] Recorrer **tabla por tabla** confirmando que RLS está habilitado. Una sola tabla sin RLS en Supabase es una fuga abierta.
- [x] Con tres tokens (anónimo, estudiante sin acceso, estudiante con acceso), llamar la API de Supabase **directamente** — no desde la interfaz — e intentar leer datos ajenos. Debe fallar en todos los casos.
- [x] Intentar que un estudiante modifique su propia columna `role` a `admin`. Debe fallar.
- [x] Intentar crear, editar o borrar contenido desde una cuenta de estudiante. Debe fallar. (hueco encontrado y cerrado: se agregaron 12 casos nuevos a `scripts/rls-test.ts`)
- [x] Reutilizar el script de pruebas escrito en la Fase 1 y ampliarlo.

## Auditoría de fuga de contenido

- [x] Confirmar que la política de reproducción en Mux es **`signed`** en **todos** los assets, incluidos los subidos durante el desarrollo. (5/5 assets reales verificados vía API de Mux)
- [x] Tomar un `playback_id` e intentar reproducirlo sin token. Debe fallar. (403 confirmado)
- [x] Capturar un token válido de la red y verificar que expira en la ventana esperada. (~14.9 min, HTTP 200 con token)
- [x] Revocar el acceso de un usuario y confirmar que deja de poder pedir tokens nuevos. (cubierto en `scripts/rls-test.ts`)

## Auditoría de secretos

- [x] Buscar en el bundle del navegador cualquier clave que no debería estar: `service_role` de Supabase, secreto de Mux, clave de Resend. Ninguna variable sensible puede llevar prefijo público. (0 coincidencias en `.next/static`)
- [x] Revisar el historial de git en busca de secretos comprometidos. Si aparece alguno, **rotarlo**, no solo borrarlo del código. (sin resultados)
- [x] Confirmar que staging y producción usan credenciales distintas. Staging creado (Supabase `tmvmthdwapegypveaosd` + Mux propio), esquema/RLS/seed aplicados, 124/124 pruebas OK. **Falta solo configurar Railway — ver F-1 en el documento de evidencia.**

## Definición de "terminado"

Existe un documento con cada prueba, su resultado y la evidencia:
[`docs/audit/rls-content-leak-2026-09.md`](docs/audit/rls-content-leak-2026-09.md).
Los hallazgos abiertos están registrados como bugs con severidad asignada.
**Ningún hallazgo de severidad crítica puede quedar abierto el 12 de
septiembre.** (Ninguno abierto — el único hallazgo, F-1, es P1, no P0.)
