-- CreateEnum
CREATE TYPE "RolPerfil" AS ENUM ('ESTUDIANTE', 'ADMINISTRADOR');

-- CreateEnum
CREATE TYPE "EstadoPerfil" AS ENUM ('ACTIVO', 'SUSPENDIDO');

-- CreateEnum
CREATE TYPE "EstadoSuscripcion" AS ENUM ('ACTIVA', 'PAST_DUE', 'VENCIDA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "EstadoPago" AS ENUM ('EXITOSO', 'FALLIDO', 'PENDIENTE');

-- CreateEnum
CREATE TYPE "EstadoProcesamientoLeccion" AS ENUM ('SUBIENDO', 'PROCESANDO', 'LISTO');

-- CreateTable
CREATE TABLE "perfiles" (
    "id" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "correo" TEXT NOT NULL,
    "rol" "RolPerfil" NOT NULL DEFAULT 'ESTUDIANTE',
    "estado" "EstadoPerfil" NOT NULL DEFAULT 'ACTIVO',
    "fecha_registro" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "perfiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "planes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "precio_centavos" INTEGER NOT NULL,
    "moneda" TEXT NOT NULL,
    "duracion_dias" INTEGER NOT NULL,
    "nivel_acceso" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "orden" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "planes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suscripciones" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "id_usuario" UUID NOT NULL,
    "id_plan" UUID NOT NULL,
    "fecha_inicio" TIMESTAMP(3) NOT NULL,
    "fecha_renovacion" TIMESTAMP(3),
    "estado" "EstadoSuscripcion" NOT NULL,
    "proveedor" TEXT NOT NULL,
    "id_cliente_externo" TEXT,
    "id_suscripcion_externa" TEXT,
    "monto_centavos" INTEGER NOT NULL,
    "moneda" TEXT NOT NULL,
    "id_cupon" UUID,
    "acceso_manual" BOOLEAN NOT NULL DEFAULT false,
    "otorgado_por" UUID,

    CONSTRAINT "suscripciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pagos" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "id_suscripcion" UUID NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "estado" "EstadoPago" NOT NULL,
    "monto_centavos" INTEGER NOT NULL,
    "moneda" TEXT NOT NULL,
    "ref_transaccion_externa" TEXT NOT NULL,
    "ref_factura_dian" TEXT,
    "url_pdf_factura" TEXT,

    CONSTRAINT "pagos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categorias" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,

    CONSTRAINT "categorias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cursos" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "id_categoria" UUID NOT NULL,
    "titulo" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "imagen_portada" TEXT NOT NULL,
    "instructor" TEXT NOT NULL,
    "mostrado" BOOLEAN NOT NULL DEFAULT false,
    "id_admin_creador" UUID NOT NULL,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_edicion" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cursos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "modulos" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "id_curso" UUID NOT NULL,
    "titulo" TEXT NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "modulos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lecciones" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "id_modulo" UUID NOT NULL,
    "titulo" TEXT NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "id_video_mux" TEXT,
    "duracion" INTEGER,
    "estado_procesamiento" "EstadoProcesamientoLeccion" NOT NULL DEFAULT 'SUBIENDO',
    "resumen" TEXT,

    CONSTRAINT "lecciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "progreso" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "id_usuario" UUID NOT NULL,
    "id_leccion" UUID NOT NULL,
    "completado" BOOLEAN NOT NULL DEFAULT false,
    "segundo_actual" INTEGER NOT NULL DEFAULT 0,
    "fecha_actualizacion" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "progreso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "certificados" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "id_usuario" UUID NOT NULL,
    "id_curso" UUID NOT NULL,
    "fecha_emision" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "codigo_verificacion" TEXT NOT NULL,
    "archivo_pdf" TEXT,

    CONSTRAINT "certificados_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cupones" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "codigo" TEXT NOT NULL,
    "tipo_descuento" TEXT NOT NULL,
    "valor" INTEGER NOT NULL,
    "fecha_vencimiento" TIMESTAMP(3) NOT NULL,
    "limite_usos" INTEGER,
    "veces_usado" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "cupones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inscripciones" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "id_usuario" UUID NOT NULL,
    "id_curso" UUID,
    "otorgado_por" UUID,
    "tipo_acceso" TEXT NOT NULL,

    CONSTRAINT "inscripciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bitacora_administrativa" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "id_admin" UUID NOT NULL,
    "accion" TEXT NOT NULL,
    "id_entidad_afectada" UUID,
    "entidad_afectada" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "detalles" TEXT,

    CONSTRAINT "bitacora_administrativa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "eventos_webhook" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "proveedor" TEXT NOT NULL,
    "id_evento_externo" TEXT NOT NULL,
    "tipo_evento" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "procesado" BOOLEAN NOT NULL DEFAULT false,
    "fecha_recibida" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "eventos_webhook_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recursos_descargables" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "id_leccion" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo_archivo" TEXT NOT NULL,
    "url_archivo" TEXT NOT NULL,
    "tamano_bytes" INTEGER,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recursos_descargables_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "perfiles_correo_key" ON "perfiles"("correo");

-- CreateIndex
CREATE INDEX "suscripciones_id_usuario_idx" ON "suscripciones"("id_usuario");

-- CreateIndex
CREATE INDEX "suscripciones_id_plan_idx" ON "suscripciones"("id_plan");

-- CreateIndex
CREATE INDEX "suscripciones_proveedor_id_suscripcion_externa_idx" ON "suscripciones"("proveedor", "id_suscripcion_externa");

-- CreateIndex
CREATE UNIQUE INDEX "pagos_ref_transaccion_externa_key" ON "pagos"("ref_transaccion_externa");

-- CreateIndex
CREATE INDEX "pagos_id_suscripcion_idx" ON "pagos"("id_suscripcion");

-- CreateIndex
CREATE INDEX "cursos_id_categoria_idx" ON "cursos"("id_categoria");

-- CreateIndex
CREATE INDEX "modulos_id_curso_idx" ON "modulos"("id_curso");

-- CreateIndex
CREATE INDEX "lecciones_id_modulo_idx" ON "lecciones"("id_modulo");

-- CreateIndex
CREATE UNIQUE INDEX "progreso_id_usuario_id_leccion_key" ON "progreso"("id_usuario", "id_leccion");

-- CreateIndex
CREATE UNIQUE INDEX "certificados_codigo_verificacion_key" ON "certificados"("codigo_verificacion");

-- CreateIndex
CREATE INDEX "certificados_id_usuario_idx" ON "certificados"("id_usuario");

-- CreateIndex
CREATE UNIQUE INDEX "cupones_codigo_key" ON "cupones"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "inscripciones_id_usuario_id_curso_key" ON "inscripciones"("id_usuario", "id_curso");

-- CreateIndex
CREATE INDEX "bitacora_administrativa_id_admin_idx" ON "bitacora_administrativa"("id_admin");

-- CreateIndex
CREATE UNIQUE INDEX "eventos_webhook_id_evento_externo_key" ON "eventos_webhook"("id_evento_externo");

-- CreateIndex
CREATE INDEX "recursos_descargables_id_leccion_idx" ON "recursos_descargables"("id_leccion");

-- AddForeignKey
ALTER TABLE "suscripciones" ADD CONSTRAINT "suscripciones_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "perfiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suscripciones" ADD CONSTRAINT "suscripciones_id_plan_fkey" FOREIGN KEY ("id_plan") REFERENCES "planes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suscripciones" ADD CONSTRAINT "suscripciones_id_cupon_fkey" FOREIGN KEY ("id_cupon") REFERENCES "cupones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suscripciones" ADD CONSTRAINT "suscripciones_otorgado_por_fkey" FOREIGN KEY ("otorgado_por") REFERENCES "perfiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_id_suscripcion_fkey" FOREIGN KEY ("id_suscripcion") REFERENCES "suscripciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cursos" ADD CONSTRAINT "cursos_id_categoria_fkey" FOREIGN KEY ("id_categoria") REFERENCES "categorias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cursos" ADD CONSTRAINT "cursos_id_admin_creador_fkey" FOREIGN KEY ("id_admin_creador") REFERENCES "perfiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "modulos" ADD CONSTRAINT "modulos_id_curso_fkey" FOREIGN KEY ("id_curso") REFERENCES "cursos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lecciones" ADD CONSTRAINT "lecciones_id_modulo_fkey" FOREIGN KEY ("id_modulo") REFERENCES "modulos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "progreso" ADD CONSTRAINT "progreso_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "perfiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "progreso" ADD CONSTRAINT "progreso_id_leccion_fkey" FOREIGN KEY ("id_leccion") REFERENCES "lecciones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificados" ADD CONSTRAINT "certificados_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "perfiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificados" ADD CONSTRAINT "certificados_id_curso_fkey" FOREIGN KEY ("id_curso") REFERENCES "cursos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inscripciones" ADD CONSTRAINT "inscripciones_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "perfiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inscripciones" ADD CONSTRAINT "inscripciones_id_curso_fkey" FOREIGN KEY ("id_curso") REFERENCES "cursos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inscripciones" ADD CONSTRAINT "inscripciones_otorgado_por_fkey" FOREIGN KEY ("otorgado_por") REFERENCES "perfiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bitacora_administrativa" ADD CONSTRAINT "bitacora_administrativa_id_admin_fkey" FOREIGN KEY ("id_admin") REFERENCES "perfiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recursos_descargables" ADD CONSTRAINT "recursos_descargables_id_leccion_fkey" FOREIGN KEY ("id_leccion") REFERENCES "lecciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
