-- ============================================================
-- intentos_examen: reconcilia el GRANT base con el privilegio por columna.
--
-- Orden de aplicación (npm run db:rls lo respeta): DESPUÉS de 000-081.
-- Tiene que ser el ÚLTIMO que toque privilegios de esta tabla: su trabajo es
-- justamente dejar el estado final determinista.
--
-- Historia de este archivo
-- ------------------------
-- Nació en la rama audit_BD como `081_grant_select_intentos_examen.sql`
-- (commit e5e9858, "Corrige D-17"). Chocaba de dos maneras con
-- `081_intentos_examen_grants_por_columna.sql` (P0-1, AUDIT-2026-09-08.md):
-- compartía prefijo —así que cuál de los dos ganaba dependía del orden de
-- `readdir`— y, peor, hacía lo contrario. Se renumeró a 082 y se corrigió la
-- única sentencia que reabría el hallazgo. El diagnóstico del síntoma, que
-- era correcto y está reproducido en vivo, se conserva entero abajo.
--
-- El síntoma, tal como se observó (texto original de D-17)
-- --------------------------------------------------------
-- El examen final de cualquier curso con un intento EN_CURSO se quedaba en
-- pantalla negra, con Network mostrando decenas de GET repetidos a la misma
-- URL /cursos/[slug]/examen (uno incluso devolviendo 503 por saturar el
-- servidor). La consulta de getIntentoEnCurso (src/lib/examen.ts) fallaba con
--
--   permission denied for table intentos_examen (42501)
--   hint: Grant the required privileges to the current role with:
--         GRANT SELECT ON public.intentos_examen TO authenticated;
--
-- La causa real, y por qué el hint de Postgres lleva a la trampa
-- --------------------------------------------------------------
-- D-17 concluyó que 067 nunca había creado el GRANT SELECT base. No es así:
-- Supabase concede por defecto SELECT sobre todas las columnas de las tablas
-- de `public` a `anon` y `authenticated`, y por eso rendir exámenes funcionó
-- desde el primer día. Lo que quitó ese privilegio fue el 081 del P0-1, a
-- propósito: `preguntas_congeladas` guarda `respuestasAceptadas` y cuál
-- opción es la correcta, y cualquier estudiante la leía por PostgREST con la
-- anon key —que viaja en el bundle— más su propia cookie de sesión.
--
-- El 42501 no era una regresión: era el arreglo funcionando. Lo que estaba
-- de verdad roto es que el código LEÍA esa columna con el cliente de sesión.
-- El hint de Postgres sugiere `GRANT SELECT ON ... TO authenticated` porque
-- no puede saber que la columna es sensible; seguirlo al pie de la letra
-- devuelve las 13 columnas y reabre el P0-1 por completo (verificado: tras
-- aplicarlo, `select preguntas_congeladas` como `authenticated` volvió a
-- responder filas en vez de 42501).
--
-- El arreglo correcto es del lado del código, y ya está hecho:
-- getIntentoEnCurso y getResultadoIntento (src/lib/examen.ts) y
-- getRevisionIntento (src/actions/admin/examenes.ts) leen con
-- createAdminClient() — rol `service_role`, que conserva el SELECT completo
-- porque es el que necesita renderizar y calificar. getSituacionExamen se
-- queda con el cliente de sesión a propósito: su proyección no incluye la
-- columna sensible y todas las que sí pide están en la lista del 081.
--
-- Y el bucle de redirección, que era el síntoma visible, no lo cierra ningún
-- GRANT: lo cerró dejar de descartar el `error` de PostgREST (lanzarSiFalla
-- en src/lib/examen.ts). Sin eso, un fallo de la consulta seguiría siendo
-- indistinguible de "el intento ya no existe".
--
-- Qué hace este archivo entonces
-- -------------------------------
-- Reafirmar el estado correcto, de forma idempotente, para que cualquier base
-- donde ya se haya aplicado el `grant select` amplio quede saneada sin tener
-- que reconstruirla. Es una repetición deliberada del 081: si alguien vuelve
-- a conceder la tabla entera, este script —al ser el último— lo deshace.
-- ============================================================

-- Deshace cualquier `grant select on public.intentos_examen` a nivel de tabla,
-- venga del default de Supabase o de una aplicación posterior.
revoke select on public.intentos_examen from authenticated, anon;

-- Y repone exactamente la lista del 081. `preguntas_congeladas` es la única
-- columna de la tabla que queda fuera, y ese es el punto entero.
grant select (
  id,
  id_examen,
  id_usuario,
  estado,
  puntaje_pct,
  nota_requerida,
  respuestas,
  iniciado_en,
  finalizado_en,
  expira_en,
  creado_en,
  actualizado_en
) on public.intentos_examen to authenticated;
