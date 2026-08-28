-- ============================================================
-- Restricciones sobre las columnas de dinero y de procedencia
--
-- Orden de aplicación (npm run db:rls lo respeta): DESPUÉS de 000-041.
-- No redefine nada anterior: solo agrega CHECKs.
--
-- Requiere la migración de Prisma `esquema_listo_para_cobro`, que crea
-- `pagos.proveedor` y la tabla `planes_precios`. La secuencia está en
-- README.md: `npx prisma migrate deploy` y luego `npm run db:rls`.
--
-- Por qué CHECK y no un enum de Postgres
-- --------------------------------------
-- Porque `proveedor` no es UN conjunto, son tres distintos:
--
--   eventos_webhook  ->  stripe | wompi | mux      (mux no cobra nada)
--   suscripciones    ->  stripe | wompi | manual | invitacion
--   pagos            ->  stripe | wompi           (un acceso manual no paga)
--   planes_precios   ->  stripe | wompi
--
-- Un enum compartido volvería legal `pagos.proveedor = 'mux'` y
-- `eventos_webhook.proveedor = 'invitacion'`: sería PEOR validación que la
-- que se quiere agregar, porque el tipo diría "cualquiera de los cinco"
-- cuando cada tabla admite un subconjunto propio. Tres tipos enum separados
-- lo evitarían, pero son tres objetos en pg_type con su grafo de
-- dependencias para lo que es una etiqueta de procedencia.
--
-- Y un valor de enum no se puede ELIMINAR nunca (existe RENAME VALUE, no
-- existe DROP VALUE). 'manual' e 'invitacion' son etiquetas de la etapa sin
-- cobro; es plausible que el modelo las reacomode cuando entre la pasarela.
-- Un CHECK se reemplaza sin drama.
--
-- El contraste con los enums que SÍ tiene el esquema es deliberado:
-- `EstadoSuscripcion` y `EstadoPago` son máquinas de estados cerradas sobre
-- las que el código ramifica de forma exhaustiva, y ahí un enum se gana el
-- sueldo. Sobre `proveedor` no ramifica nadie: se escribe y se muestra.
--
-- La contraparte en TypeScript es src/lib/pagos/proveedores.ts, con un test
-- que falla si las dos listas se separan.
--
-- Todo va con DROP ... IF EXISTS delante porque este archivo se reaplica
-- entero en cada `npm run db:rls`.
-- ============================================================


-- ------------------------------------------------------------
-- MONEDA: ISO-4217 en mayúsculas
--
-- Era TEXT libre. `formatMoneda` (src/lib/admin/format.ts) se lo pasa
-- directo a Intl.NumberFormat, que lanza RangeError ante cualquier cosa que
-- no sea un código de tres letras mayúsculas — y eso tumba
-- /dashboard/suscripcion entera para ese estudiante.
--
-- Hoy no explota porque el único valor escrito es el literal 'COP'. El
-- primer webhook traerá la moneda tal como la reporte el proveedor, y
-- Stripe la envía en minúsculas ("usd"). El CHECK obliga a normalizarla al
-- escribir, que es donde corresponde.
-- ------------------------------------------------------------
alter table public.planes
  drop constraint if exists planes_moneda_iso4217;
alter table public.planes
  add constraint planes_moneda_iso4217 check (moneda ~ '^[A-Z]{3}$');

alter table public.suscripciones
  drop constraint if exists suscripciones_moneda_iso4217;
alter table public.suscripciones
  add constraint suscripciones_moneda_iso4217 check (moneda ~ '^[A-Z]{3}$');

alter table public.pagos
  drop constraint if exists pagos_moneda_iso4217;
alter table public.pagos
  add constraint pagos_moneda_iso4217 check (moneda ~ '^[A-Z]{3}$');

alter table public.planes_precios
  drop constraint if exists planes_precios_moneda_iso4217;
alter table public.planes_precios
  add constraint planes_precios_moneda_iso4217 check (moneda ~ '^[A-Z]{3}$');


-- ------------------------------------------------------------
-- MONTOS: nunca negativos
--
-- Un reembolso NO se modela como un monto negativo: se modela con
-- `EstadoPago = 'REEMBOLSADO'` sobre su propia fila, para que el rastro
-- contable quede completo. Sin este CHECK, la primera integración que
-- traduzca un `amount_refunded` de Stripe a la ligera puede meter un
-- negativo aquí y descuadrar cualquier suma posterior.
-- ------------------------------------------------------------
alter table public.planes
  drop constraint if exists planes_precio_no_negativo;
alter table public.planes
  add constraint planes_precio_no_negativo check (precio_centavos >= 0);

alter table public.suscripciones
  drop constraint if exists suscripciones_monto_no_negativo;
alter table public.suscripciones
  add constraint suscripciones_monto_no_negativo check (monto_centavos >= 0);

alter table public.pagos
  drop constraint if exists pagos_monto_no_negativo;
alter table public.pagos
  add constraint pagos_monto_no_negativo check (monto_centavos >= 0);

alter table public.planes_precios
  drop constraint if exists planes_precios_monto_no_negativo;
alter table public.planes_precios
  add constraint planes_precios_monto_no_negativo check (monto_centavos >= 0);


-- ------------------------------------------------------------
-- PROVEEDOR: lista cerrada, distinta por tabla
--
-- 'stripe' y 'wompi' ya son valores válidos aunque hoy no exista el cobro:
-- ese es justamente el requisito ("soporta el origen de pago como valor
-- válido, aunque hoy no se use"). `prisma/seed.ts` ya siembra suscripciones
-- con proveedor 'stripe' y 'wompi' para poblar el historial del panel.
-- ------------------------------------------------------------
alter table public.suscripciones
  drop constraint if exists suscripciones_proveedor_valido;
alter table public.suscripciones
  add constraint suscripciones_proveedor_valido
  check (proveedor in ('stripe', 'wompi', 'manual', 'invitacion'));

-- Solo pasarelas reales: una membresía otorgada a mano o canjeada con un
-- código nunca genera una fila de pago — es gratis por definición.
alter table public.pagos
  drop constraint if exists pagos_proveedor_valido;
alter table public.pagos
  add constraint pagos_proveedor_valido
  check (proveedor in ('stripe', 'wompi'));

alter table public.planes_precios
  drop constraint if exists planes_precios_proveedor_valido;
alter table public.planes_precios
  add constraint planes_precios_proveedor_valido
  check (proveedor in ('stripe', 'wompi'));

-- Incluye 'mux', que no cobra nada: esta tabla es la bitácora de
-- idempotencia de TODO webhook entrante (CLAUDE.md §3.1), no solo de pagos.
-- Es el ejemplo más claro de por qué un enum compartido no serviría.
alter table public.eventos_webhook
  drop constraint if exists eventos_webhook_proveedor_valido;
alter table public.eventos_webhook
  add constraint eventos_webhook_proveedor_valido
  check (proveedor in ('stripe', 'wompi', 'mux'));


-- ------------------------------------------------------------
-- acceso_manual deja de poder contradecir a proveedor
--
-- `acceso_manual` es exactamente `proveedor in ('manual','invitacion')`:
-- dos fuentes de verdad para el mismo hecho, y nada impedía que se
-- separaran. Basta un INSERT futuro que llene una y olvide la otra para que
-- el panel diga "acceso otorgado" sobre una suscripción de pago, o para que
-- `revocarMembresia` acepte revocar algo que cobró Stripe.
--
-- No se elimina la columna: la leen seis módulos (lib/suscripcion.ts,
-- lib/estadoAcceso.ts, lib/admin/usuarioDetalle.ts, lib/admin/usuarios.ts,
-- lib/admin/membresiaManual.ts y la vista metricas_panel_usuarios) y el
-- riesgo no compensa. El CHECK convierte la redundancia en un
-- desnormalizado GARANTIZADO, que es una situación distinta y sana.
--
-- Las cuatro suscripciones de `prisma/seed.ts` con proveedor 'stripe' /
-- 'wompi' dejan `acceso_manual` en su default `false`, así que cumplen.
-- ------------------------------------------------------------
alter table public.suscripciones
  drop constraint if exists suscripciones_acceso_manual_coincide_proveedor;
alter table public.suscripciones
  add constraint suscripciones_acceso_manual_coincide_proveedor
  check (acceso_manual = (proveedor in ('manual', 'invitacion')));


-- ------------------------------------------------------------
-- RLS de planes_precios
--
-- Mismo criterio que `planes` (003/014): lectura pública de lo activo
-- —el catálogo de precios tiene que poder mostrarse sin login— y escritura
-- solo de administrador, con las cuatro políticas separadas por operación
-- en vez de un FOR ALL (014_separa_politicas_for_all.sql explica por qué).
--
-- Sin esto la tabla quedaría con RLS deshabilitado y legible por cualquiera
-- con la anon key, incluidos los identificadores de precio del proveedor.
-- ------------------------------------------------------------
alter table public.planes_precios enable row level security;

drop policy if exists "planes_precios_select_publico" on public.planes_precios;
create policy "planes_precios_select_publico" on public.planes_precios
  for select using (activo = true or private.es_administrador());

drop policy if exists "planes_precios_admin_insert" on public.planes_precios;
create policy "planes_precios_admin_insert" on public.planes_precios
  for insert with check (private.es_administrador());

drop policy if exists "planes_precios_admin_update" on public.planes_precios;
create policy "planes_precios_admin_update" on public.planes_precios
  for update using (private.es_administrador())
  with check (private.es_administrador());

drop policy if exists "planes_precios_admin_delete" on public.planes_precios;
create policy "planes_precios_admin_delete" on public.planes_precios
  for delete using (private.es_administrador());
