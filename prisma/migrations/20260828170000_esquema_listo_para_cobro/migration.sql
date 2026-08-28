-- ============================================================
-- Deja el esquema listo para enchufar una pasarela de pago, sin
-- implementar el cobro
--
-- Nada de esta migracion ejecuta logica de negocio: son tipos,
-- columnas, restricciones y una tabla nueva. Los webhooks de Stripe y
-- Wompi siguen verificando firma, registrando el evento y parando ahi.
--
-- Escrita a mano y aplicada con `prisma migrate deploy` (no
-- `migrate dev`) por el motivo documentado en `estandariza_timestamps`
-- y en supabase/sql/README.md: la shadow database de Prisma no tiene el
-- schema `auth` de Supabase y `migrate dev` falla al introspectar.
--
-- ORDEN DE DESPLIEGUE (supabase/sql/README.md, ya documentado):
--   1. npx prisma migrate deploy   <- esta migracion
--   2. npm run db:rls              <- recrea metricas_panel_usuarios
--   3. npm run test:rls
-- El paso 2 no es opcional: el bloque 0 de abajo borra esa vista porque
-- Postgres no deja cambiar el tipo de una columna de la que depende una
-- vista. 036_vistas_metricas_panel.sql la vuelve a crear tal cual.
-- ============================================================


-- ------------------------------------------------------------
-- 0. Dependencias de vista
--
-- `metricas_panel_usuarios` (036) lee suscripciones.fecha_renovacion y
-- codigos_invitacion.fecha_vencimiento, las dos columnas que el bloque 1
-- convierte. Sin este DROP, el ALTER falla con
-- "cannot alter type of a column used by a view or rule".
--
-- Las otras dos vistas del proyecto no tocan estas columnas:
-- avance_cursos y abandono_lecciones (036) trabajan sobre progreso y
-- lecciones, y progreso_cursos_estudiante (033) no menciona
-- suscripciones.
-- ------------------------------------------------------------
DROP VIEW IF EXISTS public.metricas_panel_usuarios;


-- ------------------------------------------------------------
-- 1. Las fechas con semantica de negocio pasan a timestamptz
--
-- Eran las unicas cuatro columnas de fecha del esquema que seguian
-- siendo `timestamp` SIN zona: la migracion `estandariza_timestamps`
-- convirtio solo las de auditoria (creado_en / actualizado_en) y dejo
-- estas fuera a proposito. La cabecera de 036 ya documentaba el riesgo
-- ("hoy funciona porque servidor y sesion estan en UTC (...) pero es una
-- coincidencia no declarada").
--
-- Por que ahora: dejo de ser teorico. 038_vigencia_por_fecha.sql escribe
--
--     (s.fecha_renovacion at time zone 'America/Bogota')::date
--
-- dando por hecho que la columna tiene zona. En Postgres `AT TIME ZONE`
-- hace cosas OPUESTAS segun el tipo del operando:
--
--   timestamptz AT TIME ZONE z  ->  timestamp  (instante -> hora de pared)
--   timestamp   AT TIME ZONE z  ->  timestamptz (hora de pared -> instante)
--
-- Como la columna es `timestamp` desnudo y la app guarda UTC
-- (toISOString()), esa expresion INTERPRETA la hora UTC como si fuera
-- hora de Bogota: suma cinco horas en vez de restarlas. El efecto real es
-- que toda membresia otorgada despues de las 2:00 p.m. hora de Colombia
-- vence un dia mas tarde de lo que la plataforma le anuncio al
-- estudiante, y que la capa SQL y la de TypeScript (que si calcula bien
-- el dia civil) se contradicen: el token de Mux se corta un dia antes de
-- que la RLS de recursos_descargables deje de permitir la descarga.
--
-- El USING es `AT TIME ZONE 'UTC'` justamente porque los valores
-- guardados son hora UTC: la app siempre escribio .toISOString(), y las
-- funciones SQL que insertan (017/027/035/038/041) usan now() sobre una
-- sesion en UTC. Interpretarlos como Bogota corromperia los datos que ya
-- existen.
--
-- Ademas, Stripe envia current_period_end como epoch Unix: un instante
-- absoluto, que en una columna sin zona pierde su significado sin vuelta
-- atras. Convertir con datos de cobro encima seria justo la migracion
-- cara que esta tarea existe para evitar.
-- ------------------------------------------------------------
ALTER TABLE "suscripciones"
  ALTER COLUMN "fecha_inicio" TYPE timestamptz
    USING "fecha_inicio" AT TIME ZONE 'UTC';

ALTER TABLE "suscripciones"
  ALTER COLUMN "fecha_renovacion" TYPE timestamptz
    USING "fecha_renovacion" AT TIME ZONE 'UTC';

ALTER TABLE "codigos_invitacion"
  ALTER COLUMN "fecha_vencimiento" TYPE timestamptz
    USING "fecha_vencimiento" AT TIME ZONE 'UTC';

ALTER TABLE "cupones"
  ALTER COLUMN "fecha_vencimiento" TYPE timestamptz
    USING "fecha_vencimiento" AT TIME ZONE 'UTC';


-- ------------------------------------------------------------
-- 2. El dinero pasa a BIGINT
--
-- No habia ningun float, que es lo que el requisito prohibe, y guardar
-- centavos como entero es incluso preferible a `numeric`. El problema es
-- el ancho: INTEGER llega a 2.147.483.647 centavos, o sea $21.474.836
-- COP. Guardar pesos colombianos en centavos multiplica todo por cien
-- sobre una moneda que en la practica no usa subdivision, y se come dos
-- ordenes de magnitud de margen.
--
-- Un paquete corporativo o una matricula de varias licencias pasa ese
-- techo, y Postgres no trunca: lanza 22003 integer out of range. El
-- INSERT del webhook falla, el pago no queda registrado y la pasarela
-- reintenta contra un error permanente durante dias.
--
-- Aqui es un ALTER instantaneo porque las tablas estan practicamente
-- vacias (`pagos` no tiene una sola fila: nada en el codigo escribe en
-- ella). Con cincuenta mil pagos encima es reescritura de tabla con
-- bloqueo exclusivo.
--
-- BIGINT no complica el lado TypeScript: Prisma se usa solo para
-- migraciones (CLAUDE.md seccion 2) y la app lee por PostgREST, que
-- serializa int8 como numero JSON mientras quepa en MAX_SAFE_INTEGER
-- (9.007.199.254.740.991 centavos son noventa billones de pesos).
-- formatMoneda(centavos: number) no se toca.
-- ------------------------------------------------------------
ALTER TABLE "planes"        ALTER COLUMN "precio_centavos" TYPE BIGINT;
ALTER TABLE "suscripciones" ALTER COLUMN "monto_centavos"  TYPE BIGINT;
ALTER TABLE "pagos"         ALTER COLUMN "monto_centavos"  TYPE BIGINT;

-- cupones.valor es centavos cuando tipo_descuento = 'MONTO_FIJO' y un
-- porcentaje entero cuando es 'PORCENTAJE'. Misma columna, dos unidades:
-- ver el comentario del modelo en schema.prisma. Se ensancha igual
-- porque la mitad de sus valores son dinero.
ALTER TABLE "cupones"       ALTER COLUMN "valor"           TYPE BIGINT;


-- ------------------------------------------------------------
-- 3. `pagos` gana proveedor y la fecha real del cobro
--
-- proveedor: la tabla no registraba que pasarela proceso el cobro, habia
-- que deducirlo por join contra suscripciones. Conectar Stripe obligaba a
-- alterar esta tabla, que es justo lo que la definicion de terminado de
-- la tarea prohibe. Se agrega NOT NULL sin DEFAULT a proposito: la tabla
-- esta vacia, asi que Postgres lo acepta, y si algun dia no lo estuviera
-- preferimos que la migracion falle ruidosamente a inventar un valor.
--
-- fecha_pago: `creado_en` dejo de significar "cuando se cobro" cuando
-- `estandariza_timestamps` renombro la columna `fecha` original. Hoy
-- significa "cuando insertamos la fila". Stripe reintenta la entrega de
-- un webhook hasta tres dias, asi que el estudiante veria la fecha del
-- reintento como la fecha de su pago
-- (components/dashboard/SuscripcionContent.tsx la imprime). Nullable
-- porque no toda pasarela la reporta; quien la lea cae a creado_en.
-- ------------------------------------------------------------
ALTER TABLE "pagos" ADD COLUMN "proveedor"  TEXT NOT NULL;
ALTER TABLE "pagos" ADD COLUMN "fecha_pago" timestamptz;


-- ------------------------------------------------------------
-- 4. La idempotencia se compone con el proveedor
--
-- La clave de idempotencia de un pago siempre es (proveedor,
-- referencia): dos pasarelas distintas pueden emitir la misma cadena y
-- nada las distinguia bajo un unico indice global. Lo mismo en
-- eventos_webhook, donde hoy conviven identificadores de Stripe
-- (evt_...), UUIDs de Mux y un checksum SHA-256 de Wompi.
--
-- El diseno de dos niveles ya era correcto y se conserva: transaccion en
-- `pagos` (impide una segunda fila para el mismo cobro) y evento en
-- `eventos_webhook` (impide reprocesar la misma entrega). Solo le
-- faltaba el proveedor a cada clave.
-- ------------------------------------------------------------
DROP INDEX IF EXISTS "pagos_ref_transaccion_externa_key";
CREATE UNIQUE INDEX "pagos_proveedor_ref_transaccion_externa_key"
  ON "pagos" ("proveedor", "ref_transaccion_externa");

DROP INDEX IF EXISTS "eventos_webhook_id_evento_externo_key";
CREATE UNIQUE INDEX "eventos_webhook_proveedor_id_evento_externo_key"
  ON "eventos_webhook" ("proveedor", "id_evento_externo");


-- ------------------------------------------------------------
-- 5. Un pago se puede devolver
--
-- EstadoPago solo tenia EXITOSO / FALLIDO / PENDIENTE, asi que registrar
-- una devolucion obligaba a mutar la fila del pago original y destruir el
-- rastro contable.
--
-- No es hipotetico: el Estatuto del Consumidor colombiano da derecho de
-- retracto en ventas a distancia, la tabla ya tiene ref_factura_dian y
-- url_pdf_factura (la contraparte de una devolucion es la nota credito) y
-- el comentario de src/lib/webhooks/eventos.ts menciona charge.refunded
-- explicitamente.
--
-- REEMBOLSADO: se devolvio el dinero al estudiante.
-- REVERSADO:   la pasarela o el banco anularon la transaccion (contracargo),
--              sin que mediara una devolucion nuestra.
--
-- ADD VALUE IF NOT EXISTS para que la migracion sea reaplicable. Desde
-- Postgres 12 esto corre dentro de una transaccion; lo unico prohibido es
-- USAR el valor nuevo en la misma, y aqui no se usa.
-- ------------------------------------------------------------
ALTER TYPE "EstadoPago" ADD VALUE IF NOT EXISTS 'REEMBOLSADO';
ALTER TYPE "EstadoPago" ADD VALUE IF NOT EXISTS 'REVERSADO';


-- ------------------------------------------------------------
-- 6. planes_precios: el mapeo plan -> precio de la pasarela
--
-- Dos huecos que se cierran con la misma tabla, y sin tocar `planes`:
--
--   a) No habia donde guardar el identificador de precio del proveedor.
--      El propio TODO del webhook de Stripe lo dice: la logica esta
--      pendiente porque no existe "ni el mapeo plan -> price de Stripe,
--      asi que no hay contra que conciliar el evento". La alternativa era
--      agregar una columna a `planes` (otra tabla existente modificada) o
--      codificar el mapeo a mano en el repositorio, que es peor.
--
--   b) `planes` tiene UNA sola pareja precio/moneda, pero
--      docs/technical-spec.md define Stripe para facturacion
--      internacional y Wompi para Colombia. El mismo plan necesita precio
--      en USD y en COP, y hoy eso obligaba a duplicar la fila del plan,
--      partiendo un producto en dos.
--
-- `planes.precio_centavos` y `planes.moneda` se quedan como estan: son el
-- precio de referencia que muestra el catalogo publico. Esta tabla es lo
-- que se le cobra a traves de cada pasarela.
--
-- La tabla nace VACIA. Llenarla es parte de la integracion, no de esta
-- tarea.
-- ------------------------------------------------------------
CREATE TABLE "planes_precios" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "id_plan" UUID NOT NULL,
    -- Generico, nunca una columna por pasarela ("id_precio_stripe").
    "proveedor" TEXT NOT NULL,
    -- El identificador del lado del proveedor: price_... en Stripe. Es lo
    -- que llega en el webhook y contra lo que hay que conciliar.
    "id_precio_externo" TEXT NOT NULL,
    "monto_centavos" BIGINT NOT NULL,
    "moneda" TEXT NOT NULL,
    -- Permite retirar un precio sin borrar la fila: los pagos historicos
    -- tienen que seguir pudiendo explicarse.
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creado_en" timestamptz NOT NULL DEFAULT now(),
    "actualizado_en" timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT "planes_precios_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "planes_precios"
  ADD CONSTRAINT "planes_precios_id_plan_fkey"
  FOREIGN KEY ("id_plan") REFERENCES "planes"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Un plan tiene a lo sumo un precio por pasarela y moneda. Sin esto, dos
-- filas contradictorias para el mismo par dejarian el cobro sin una
-- respuesta unica.
CREATE UNIQUE INDEX "planes_precios_id_plan_proveedor_moneda_key"
  ON "planes_precios" ("id_plan", "proveedor", "moneda");

-- El camino de lectura del webhook: llega un price_... y hay que resolver
-- de que plan se trata.
CREATE UNIQUE INDEX "planes_precios_proveedor_id_precio_externo_key"
  ON "planes_precios" ("proveedor", "id_precio_externo");

CREATE INDEX "planes_precios_id_plan_idx" ON "planes_precios" ("id_plan");

-- Mismo trigger de auditoria que el resto del esquema
-- (024_fija_search_path_actualiza_actualizado_en.sql).
DROP TRIGGER IF EXISTS set_actualizado_en ON public.planes_precios;
CREATE TRIGGER set_actualizado_en
  BEFORE UPDATE ON public.planes_precios
  FOR EACH ROW EXECUTE FUNCTION private.actualiza_actualizado_en();


-- ------------------------------------------------------------
-- 7. Indice que faltaba para conciliar
--
-- Ya existia el compuesto (proveedor, id_suscripcion_externa), pero los
-- eventos de cliente de Stripe (customer.*) llegan identificados por el
-- cliente, no por la suscripcion, y ese camino no tenia indice.
-- ------------------------------------------------------------
CREATE INDEX "suscripciones_id_cliente_externo_idx"
  ON "suscripciones" ("id_cliente_externo");
