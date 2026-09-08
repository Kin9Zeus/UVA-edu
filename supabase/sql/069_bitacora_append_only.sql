-- ============================================================
-- Bitácora administrativa: append-only de verdad, y firmada por
-- quien la escribe.
--
-- Orden de aplicación (npm run db:rls lo respeta): DESPUÉS de 000-068.
-- Redefine bitacora_admin_insert (014) y elimina bitacora_admin_update
-- y bitacora_admin_delete (014), sin tocar bitacora_admin_select.
--
-- Modelo de amenaza que cierra: "administrador malicioso"
-- -------------------------------------------------------
-- `bitacora_administrativa` es el único control frente a un admin que
-- abusa de sus permisos: no le impide actuar, deja constancia de lo que
-- hizo. Prisma ya la documenta como tal —"Log de solo-lectura
-- (append-only): una fila de bitácora nunca se edita después de creada"
-- (schema.prisma)— pero eso era una intención escrita en un comentario,
-- no una regla que la base aplicara: 014 le dio a `es_administrador()`
-- las cuatro operaciones, UPDATE y DELETE incluidas.
--
-- El resultado es que el control no servía contra el único actor del que
-- protege. Un admin podía borrar exactamente las filas que registraban lo
-- que acababa de hacer, con el mismo cliente de sesión y sin dejar rastro
-- de la limpieza. Con RLS no hay "borrar solo lo mío": la policy de DELETE
-- no distinguía autor, así que también alcanzaba a las filas de los demás.
--
-- Quitar las dos policies es suficiente: sin policy para un comando, RLS
-- lo deniega por defecto. No hace falta un trigger que lance excepción.
--
-- Por qué no rompe nada
-- ---------------------
-- El único camino de escritura del código es `registrarBitacora()`
-- (src/lib/admin/bitacora.ts), que hace `insert` y nada más. Las ~20
-- llamadas de src/actions/admin/* pasan todas por ahí; no hay un solo
-- `.update(` ni `.delete(` contra esta tabla en el repo. La pantalla
-- /admin/bitacora es de lectura y paginación.
--
-- Service Role sigue pudiendo corregir la tabla si algún día hace falta
-- (BYPASSRLS), lo cual es correcto: eso exige la llave del servidor, no
-- una sesión de navegador, y es justo la distinción que interesa acá.
-- ------------------------------------------------------------
drop policy if exists "bitacora_admin_update" on public.bitacora_administrativa;
drop policy if exists "bitacora_admin_delete" on public.bitacora_administrativa;

-- ------------------------------------------------------------
-- INSERT: además de ser admin, la fila tiene que ir firmada por quien
-- la está escribiendo.
--
-- La versión de 014 solo pedía `es_administrador()`, sin atar `id_admin`
-- a la sesión. Un admin podía insertar entradas atribuidas a OTRO admin
-- —ensuciar el log ajeno, o fabricar un rastro que apunte a un tercero—
-- y la pantalla de bitácora las mostraría con el nombre de ese otro,
-- porque resuelve el nombre por `id_admin` sin más.
--
-- Hoy hay un solo ADMINISTRADOR en la base, así que esto es preventivo;
-- pero un log de auditoría cuyo campo de autor lo elige libremente quien
-- escribe no es un log de auditoría, y el momento de cerrarlo es antes de
-- que haya un segundo admin, no después.
--
-- `(select auth.uid())` en vez de `auth.uid()` a secas: convención fijada
-- en 056 para que el planner lo evalúe una vez por sentencia y no por
-- fila (aviso auth_rls_initplan del Performance Advisor).
--
-- No cambia nada para el código: `registrarBitacora` recibe `idAdmin` de
-- `requireAdmin()`, que lo saca de `auth.getUser()` en el servidor — ya
-- es siempre el usuario de la sesión.
-- ------------------------------------------------------------
drop policy if exists "bitacora_admin_insert" on public.bitacora_administrativa;
create policy "bitacora_admin_insert" on public.bitacora_administrativa
  for insert with check (
    private.es_administrador() and id_admin = (select auth.uid())
  );
