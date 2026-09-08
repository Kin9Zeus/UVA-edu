-- ============================================================
-- intentos_examen: el examen resuelto deja de ser legible por su dueño.
--
-- Orden de aplicación (npm run db:rls lo respeta): DESPUÉS de 000-080.
-- No toca ninguna policy: 067 —y 077, que la recrea— siguen siendo las
-- únicas que deciden FILAS. Esto opera en la capa de PRIVILEGIOS, que es
-- una capa distinta y no se pisa con aquella.
--
-- Nació como 070 y se renumeró al fusionar la auditoría de base de datos,
-- que ocupó 070-080. El contenido no cambió. Va el último a propósito: el
-- REVOKE de aquí debe quedar aplicado después de cualquier script que
-- recree la tabla o reajuste privilegios, no antes.
--
-- P0-1 (AUDIT-2026-09-08.md) — qué estaba abierto
-- -----------------------------------------------
-- `preguntas_congeladas` guarda el examen resuelto: `respuestasAceptadas`
-- y, dentro de `opciones`, cuál es la correcta. Se congela así a propósito
-- (el servidor califica sin releer `preguntas_examen`, que pudo cambiar a
-- mitad del intento) y esa decisión sigue siendo la correcta.
--
-- Lo que faltaba es que RLS de Postgres autoriza FILAS, no COLUMNAS. La
-- policy `intentos_examen_select_propio_o_admin` (067) le entrega al
-- estudiante su propia fila ENTERA, y Supabase concede por defecto
-- `SELECT` sobre todas las columnas de las tablas de `public` a `anon` y
-- `authenticated`. El resultado: cualquier estudiante con un intento
-- abierto leía la solución con una sola petición, antes de responder.
--
--     curl ".../rest/v1/intentos_examen?select=preguntas_congeladas" \
--       -H "apikey: <NEXT_PUBLIC_SUPABASE_ANON_KEY>" \
--       -H "Authorization: Bearer <access_token de su cookie>"
--
-- Los dos valores son suyos: la `anon key` viaja en el bundle del
-- navegador (es `NEXT_PUBLIC_`) y el JWT está en su cookie de sesión.
--
-- El comentario final de 067 ya había identificado el riesgo —"esa columna
-- sería legible por su dueño"— pero lo dio por cerrado con la proyección
-- explícita de `getIntentoEnCurso()`. Esa proyección filtra lo que la APP
-- manda al navegador, y el atacante no pasa por la app: habla con
-- PostgREST directamente. La defensa tenía que estar en la base.
--
-- Por qué no se resuelve subiendo la protección a la policy
-- ---------------------------------------------------------
-- No se puede: una policy es una condición booleana sobre la fila, y
-- devuelve la fila o no la devuelve. No existe "devuelve la fila sin esta
-- columna". La granularidad por columna en Postgres vive únicamente en
-- GRANT/REVOKE, así que este archivo es el único sitio donde el arreglo
-- puede estar.
--
-- Por qué se enumeran las columnas permitidas en vez de revocar solo la mala
-- -------------------------------------------------------------------------
-- `revoke select (preguntas_congeladas)` cerraría el agujero de hoy y
-- dejaría abierto el de mañana: `grant select on tabla` concede TODAS las
-- columnas, presentes y FUTURAS, así que la próxima columna sensible
-- nacería legible y nadie se enteraría. La lista explícita falla al revés
-- —una columna nueva no se ve hasta que alguien la agregue aquí, y lo nota
-- de inmediato porque la pantalla queda vacía—, que es el error correcto.
--
-- Qué NO se toca
-- --------------
-- `service_role` conserva el SELECT completo, y tiene que conservarlo: es
-- el rol con el que el servidor lee la columna para renderizar el examen
-- (getIntentoEnCurso), para calificar (enviarIntento) y para la revisión
-- del panel (getRevisionIntento). Los privilegios de columna SÍ le aplican
-- —`bypassrls` se salta las policies, no los GRANT—, así que revocárselo
-- rompería el producto entero. Por eso el REVOKE nombra `authenticated` y
-- `anon` y nada más.
--
-- `anon` no recupera nada: la policy de 067 exige `auth.uid() = id_usuario`,
-- que sin sesión nunca se cumple, así que un GRANT para `anon` sería
-- privilegio concedido a un camino que ya está cerrado.
--
-- Idempotencia
-- ------------
-- REVOKE y GRANT son idempotentes, así que `npm run db:rls` puede
-- reaplicarlo sin efecto. Importa que se reaplique DESPUÉS de cualquier
-- migración de Prisma que recree la tabla: al recrearla vuelven a
-- concederse los privilegios amplios por defecto de Supabase y esto
-- quedaría deshecho en silencio.
-- ============================================================

-- Se quita el SELECT amplio heredado del default de Supabase.
revoke select on public.intentos_examen from authenticated, anon;

-- Y se devuelve acotado. Todo lo que el cliente de sesión necesita para las
-- tres pantallas que leen esta tabla sin Service Role:
--
--   · getSituacionExamen (src/lib/examen.ts) — la pantalla previa del
--     estudiante: id, estado, puntaje_pct, finalizado_en, expira_en.
--   · iniciarIntento (src/actions/examenes/intento.ts) — decide si retomar
--     o crear: id, estado, finalizado_en.
--   · getDetalleExamen (src/lib/admin/examenDetalle.ts) — el listado del
--     panel: id, id_usuario, estado, puntaje_pct, iniciado_en, finalizado_en.
--
-- `id_examen`, `id_usuario` e `iniciado_en` van incluidas también porque
-- filtrar y ordenar por una columna exige privilegio de SELECT sobre ella,
-- no solo proyectarla — un `.eq("id_usuario", ...)` sin el GRANT falla
-- igual que un `.select("id_usuario")`.
--
-- `respuestas` se concede: son las que escribió el propio estudiante, y las
-- necesita para recuperar su autoguardado al recargar la pestaña. No
-- contienen la solución.
--
-- `nota_requerida` se concede: es el umbral de aprobación, que ya se le
-- muestra en pantalla antes de empezar.
--
-- La ausente es `preguntas_congeladas`, y es el punto entero de este archivo.
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
