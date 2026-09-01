/**
 * ============================================================================
 * ⚠️  SALVAGUARDA — LEE ESTO ANTES DE EJECUTAR
 * ============================================================================
 *
 * Este script BORRA y RECREA datos. Nunca debe correr contra Producción.
 *
 * No hay forma fiable de distinguir un proyecto de Supabase de producción por
 * su URL (todos son https://<ref>.supabase.co, el `ref` es opaco), así que la
 * protección es explícita y de doble llave:
 *
 *   1. La variable de entorno ALLOW_SEED debe valer exactamente "true".
 *      Si falta, el script aborta sin tocar nada. Deliberadamente NO se
 *      define en .env.local: tiene que escribirse a mano en cada ejecución,
 *      para que sembrar sea siempre un acto consciente.
 *   2. Si NODE_ENV === "production", aborta aunque ALLOW_SEED esté puesto.
 *   3. Si la URL de Supabase o DATABASE_URL contienen "prod", aborta.
 *
 * Además, antes de escribir imprime el host de Supabase al que se conectó
 * para que puedas verificar a simple vista que es el proyecto correcto.
 *
 * Uso (PowerShell):
 *   $env:ALLOW_SEED="true"; npx prisma db seed
 *   $env:ALLOW_SEED="true"; npm run db:seed:clean     # solo limpiar
 *
 * Uso (bash):
 *   ALLOW_SEED=true npx prisma db seed
 *   ALLOW_SEED=true npm run db:seed:clean
 *
 * ============================================================================
 * QUÉ CREA ESTE SEED
 * ============================================================================
 *
 * Usuarios (5) — creados vía Supabase Auth Admin API; el trigger
 * `on_auth_user_created` (supabase/sql/000_trigger_perfiles.sql) sincroniza
 * la fila en `perfiles` como ESTUDIANTE/ACTIVO, y este script corrige después
 * rol y estado con Prisma donde hace falta:
 *
 *   | correo                          | rol           | estado     | suscripción         |
 *   |---------------------------------|---------------|------------|---------------------|
 *   | admin@uva.test                  | ADMINISTRADOR | ACTIVO     | —                   |
 *   | estudiante-activo@uva.test      | ESTUDIANTE    | ACTIVO     | ACTIVA (+ hist.)    |
 *   | estudiante-sin-plan@uva.test    | ESTUDIANTE    | ACTIVO     | ninguna (acceso manual, cortesía) |
 *   | estudiante-suspendido@uva.test  | ESTUDIANTE    | SUSPENDIDO | VENCIDA (sin acceso)|
 *   | estudiante-pastdue@uva.test     | ESTUDIANTE    | ACTIVO     | PAST_DUE            |
 *   | estudiante-por-codigo@uva.test  | ESTUDIANTE    | ACTIVO     | ACTIVA vía código   |
 *
 *   Contraseña de todos: ver la constante PASSWORD_PRUEBA más abajo.
 *
 *   Las 3 variantes de acceso de estudiante pedidas en el checklist de
 *   seed quedan cubiertas así: sin acceso -> estudiante-suspendido (cuenta
 *   suspendida, sin suscripción vigente); acceso manual ->
 *   estudiante-sin-plan (inscripción CORTESIA otorgada por el admin, sin
 *   pasar por Stripe/Wompi); acceso por código -> estudiante-por-codigo
 *   (suscripción creada por public.canjear_codigo_invitacion(), mismas
 *   columnas que dejaría un canje real: proveedor "invitacion",
 *   monto_centavos 0, id_codigo_invitacion apuntando al código sembrado).
 *
 * Contenido y operación:
 *   - 4 categorías temáticas (arquitectura / construcción).
 *   - 3 instructores con especialidad. No son cuentas de usuario: no existen
 *     en auth.users ni inician sesión, son catálogo que gestiona el admin.
 *   - 3 planes: Mensual y Anual activos, Trimestral descontinuado (activo=false).
 *     Los códigos de invitación ya NO usan planes (ver más abajo), pero
 *     "otorgar membresía" del panel admin sigue pidiendo uno.
 *   - 6 cursos (4 con mostrado=true, 2 con mostrado=false), con los tres
 *     niveles representados y 2 destacados, creados por el admin.
 *   - 2-3 módulos por curso, 2-3 lecciones por módulo. NINGUNA con video:
 *     quedan en SUBIENDO (dos en PROCESANDO) porque un playback ID inventado
 *     rompe el reproductor firmado. Los videos reales se suben por el CMS.
 *   - 4 suscripciones: ACTIVA, PAST_DUE, VENCIDA y CANCELADA (historial),
 *     más la ACTIVA vía código descrita arriba.
 *   - 2 inscripciones: una MEMBRESIA y una CORTESIA otorgada por el admin
 *     (Flujo 11 de docs/functional-spec.md).
 *   - 6 códigos de invitación, uno por cada rama de
 *     canjear_codigo_invitacion(): vigente con cupo, de uso único sin
 *     estrenar, de 90 días, agotado, vencido y desactivado. Es el único
 *     camino de acceso del MVP, así que todas sus ramas de error tienen que
 *     poder probarse sin editar filas a mano.
 *   - 2 filas de progreso (una completada, una a mitad de video).
 *   - 1 certificado con código de verificación único.
 *   - 2 recursos descargables.
 *
 * NO siembra:
 *   - `pagos` ni `cupones`: son artefactos de Stripe/Wompi, y el MVP del 12
 *     de septiembre de 2026 no tiene pasarela de pago. Vuelven con los cobros.
 *   - `bitacora_administrativa` (se genera con acciones reales) ni
 *     `eventos_webhook` (son eventos reales de Stripe/Wompi/Mux).
 *   - `mux_assets_pendientes_eliminacion` ni `tokens_vista_previa`, que sí
 *     las escriben acciones reales — limpiar() las borra aunque no las siembre.
 *
 * ============================================================================
 * IDEMPOTENCIA
 * ============================================================================
 *
 * Correr el seed dos veces seguidas produce exactamente el mismo resultado:
 *
 *   - Toda entidad sembrada usa un UUID fijo y determinista (ver `uuid()`),
 *     así que las referencias cruzadas no cambian entre corridas.
 *   - El script limpia lo sembrado antes de volver a insertar, respetando el
 *     orden de las Foreign Keys (ver `limpiar()`).
 *   - Los usuarios de Auth se reutilizan si ya existen (se busca por correo y
 *     se les reescribe la contraseña) en vez de fallar con "already registered".
 *
 * El criterio de "dato sembrado" es el dominio @uva.test para usuarios, y los
 * UUID/códigos fijos para el resto. Nada fuera de eso se toca jamás.
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { PrismaPg } from "@prisma/adapter-pg";
import { createClient } from "@supabase/supabase-js";
import { PrismaClient } from "../src/generated/prisma/client";
import { slugificar } from "../src/lib/slug";

// ---------------------------------------------------------------------------
// Constantes de identidad de los usuarios de prueba
// ---------------------------------------------------------------------------

/**
 * Dominio reservado para los usuarios de prueba. Es un TLD que no existe
 * (RFC 2606 reserva `.test` justamente para esto), así que ningún correo real
 * puede colisionar. Todo el borrado de usuarios se filtra por este sufijo.
 */
const DOMINIO_SEED = "@uva.test";

/**
 * Contraseña compartida por los 5 usuarios de prueba. Es deliberadamente
 * simple y está en texto plano porque solo aplica a cuentas ficticias en un
 * entorno de desarrollo. Si alguna vez este valor se usara fuera de un entorno
 * desechable, sería un incidente de seguridad — de ahí la salvaguarda de
 * ALLOW_SEED al inicio del archivo.
 */
const PASSWORD_PRUEBA = "UvaSeed2026!";

const USUARIOS = [
  {
    correo: `admin${DOMINIO_SEED}`,
    nombre: "Ana Ruiz (Admin)",
    rol: "ADMINISTRADOR" as const,
    estado: "ACTIVO" as const,
  },
  {
    correo: `estudiante-activo${DOMINIO_SEED}`,
    nombre: "Camilo Restrepo",
    rol: "ESTUDIANTE" as const,
    estado: "ACTIVO" as const,
  },
  {
    correo: `estudiante-sin-plan${DOMINIO_SEED}`,
    nombre: "Valentina Ospina",
    rol: "ESTUDIANTE" as const,
    estado: "ACTIVO" as const,
  },
  {
    correo: `estudiante-suspendido${DOMINIO_SEED}`,
    nombre: "Jorge Betancur",
    rol: "ESTUDIANTE" as const,
    estado: "SUSPENDIDO" as const,
  },
  {
    correo: `estudiante-pastdue${DOMINIO_SEED}`,
    nombre: "Laura Mejía",
    rol: "ESTUDIANTE" as const,
    estado: "ACTIVO" as const,
  },
  {
    correo: `estudiante-por-codigo${DOMINIO_SEED}`,
    nombre: "Simón Uribe",
    rol: "ESTUDIANTE" as const,
    estado: "ACTIVO" as const,
  },
];

// ---------------------------------------------------------------------------
// UUID deterministas
// ---------------------------------------------------------------------------

/**
 * Genera un UUID estable a partir de un prefijo de bloque y un índice. Que los
 * IDs sean fijos (y no `gen_random_uuid()`) es lo que hace el seed idempotente:
 * la segunda corrida vuelve a apuntar exactamente a las mismas filas, y el
 * borrado puede identificar con precisión qué es dato sembrado y qué no.
 */
function uuid(bloque: string, n: number): string {
  return `${bloque}-0000-4000-8000-${n.toString(16).padStart(12, "0")}`;
}

const B = {
  categoria: "0a000000",
  instructor: "2a000000",
  plan: "0b000000",
  curso: "0c000000",
  modulo: "0d000000",
  leccion: "0e000000",
  suscripcion: "0f000000",
  inscripcion: "1c000000",
  progreso: "1d000000",
  certificado: "1e000000",
  recurso: "1f000000",
  codigoInvitacion: "20000000",
};

// ---------------------------------------------------------------------------
// Catálogo de contenido
// ---------------------------------------------------------------------------

const CATEGORIAS = [
  {
    nombre: "Modelado BIM",
    descripcion:
      "Modelado paramétrico, coordinación de disciplinas y flujos de trabajo BIM.",
  },
  {
    nombre: "Visualización Arquitectónica",
    descripcion:
      "Render fotorrealista, iluminación, materiales y recorridos en tiempo real.",
  },
  {
    nombre: "Estructuras y Construcción",
    descripcion:
      "Diseño estructural, detalle constructivo y comportamiento de materiales.",
  },
  {
    nombre: "Gestión y Normativa",
    descripcion:
      "Dirección de obra, presupuesto, programación y marco normativo colombiano.",
  },
];

/// Instructores del catálogo. No son cuentas: no existen en auth.users ni
/// inician sesión (ver el modelo Instructores en schema.prisma). Se siembran
/// antes que los cursos porque `cursos.id_instructor` es una FK obligatoria.
const INSTRUCTORES = [
  {
    nombre: "Ana Ruiz",
    especialidad: "Modelado BIM y coordinación de disciplinas",
  },
  {
    nombre: "Daniel Castaño",
    especialidad: "Visualización arquitectónica y render",
  },
  {
    nombre: "Mauricio Gallego",
    especialidad: "Estructuras y dirección de obra",
  },
];

type LeccionSeed = {
  titulo: string;
  duracion: number;
  /**
   * Sin video real no hay estado LISTO posible: por defecto queda SUBIENDO, y
   * "PROCESANDO" se marca en un par de lecciones para poder ver ese estado en
   * la UI del CMS.
   */
  estado?: "SUBIENDO" | "PROCESANDO";
};

type CursoSeed = {
  categoria: number;
  titulo: string;
  descripcion: string;
  /** Índice dentro de INSTRUCTORES, no el nombre suelto. */
  instructor: number;
  mostrado: boolean;
  /**
   * Antes no se sembraba y los 6 cursos caían al default BASICO, así que la
   * insignia de nivel del detalle decía "Básico" en todos y no había forma
   * de ver que el filtro por nivel funciona.
   */
  nivel: "BASICO" | "INTERMEDIO" | "AVANZADO";
  /** Al menos uno en true: el toggle de "destacado" del CMS no tenía ejemplo. */
  destacado?: boolean;
  modulos: { titulo: string; lecciones: LeccionSeed[] }[];
};

const CURSOS: CursoSeed[] = [
  {
    categoria: 0,
    titulo: "Revit desde Cero para Arquitectos",
    descripcion:
      "Del muro básico al modelo coordinado: aprende Revit resolviendo un proyecto de vivienda completo, desde los ejes hasta la documentación para licencia.",
    instructor: 0,
    mostrado: true,
    nivel: "BASICO",
    destacado: true,
    modulos: [
      {
        titulo: "Fundamentos y entorno de trabajo",
        lecciones: [
          { titulo: "Qué es BIM y qué no es", duracion: 742 },
          { titulo: "Interfaz, navegador de proyecto y vistas", duracion: 1105 },
          { titulo: "Niveles, rejillas y ejes estructurales", duracion: 968 },
        ],
      },
      {
        titulo: "Elementos constructivos",
        lecciones: [
          { titulo: "Muros compuestos y capas de material", duracion: 1330 },
          { titulo: "Pisos, cubiertas y escaleras", duracion: 1512 },
        ],
      },
      {
        titulo: "Documentación y entrega",
        lecciones: [
          { titulo: "Cortes, fachadas y detalles", duracion: 1044 },
          { titulo: "Planchas, cajetines y exportación a PDF", duracion: 896 },
        ],
      },
    ],
  },
  {
    categoria: 0,
    titulo: "BIM 4D y 5D: Tiempo y Costos",
    descripcion:
      "Vincula el modelo con el cronograma y el presupuesto. Simulación constructiva, cantidades de obra y control de desviaciones sobre el modelo federado.",
    instructor: 0,
    mostrado: false,
    nivel: "AVANZADO",
    modulos: [
      {
        titulo: "Modelo federado y coordinación",
        lecciones: [
          { titulo: "Federación de disciplinas en Navisworks", duracion: 1187 },
          { titulo: "Detección de interferencias (clash detection)", duracion: 1402 },
        ],
      },
      {
        titulo: "Simulación 4D",
        lecciones: [
          {
            titulo: "Vinculación del cronograma al modelo",
            duracion: 1265,
            estado: "PROCESANDO",
          },
          { titulo: "Animación de la secuencia constructiva", duracion: 980 },
        ],
      },
    ],
  },
  {
    categoria: 1,
    titulo: "Render Fotorrealista con V-Ray",
    descripcion:
      "Iluminación física, materiales PBR y postproducción. Aprende a leer un render como fotografía y a controlar el ruido sin quemar horas de cómputo.",
    instructor: 1,
    mostrado: true,
    nivel: "INTERMEDIO",
    destacado: true,
    modulos: [
      {
        titulo: "Iluminación",
        lecciones: [
          { titulo: "Sol, cielo y HDRI: cuándo usar cada uno", duracion: 1120 },
          { titulo: "Iluminación de interiores sin ruido", duracion: 1488 },
        ],
      },
      {
        titulo: "Materiales y cámara",
        lecciones: [
          { titulo: "Materiales PBR: metalness y roughness", duracion: 1301 },
          { titulo: "Cámara física: exposición, ISO y profundidad de campo", duracion: 1057 },
          { titulo: "Postproducción no destructiva", duracion: 842 },
        ],
      },
    ],
  },
  {
    categoria: 1,
    titulo: "Lumion y Twinmotion: Visualización en Tiempo Real",
    descripcion:
      "Recorridos, animaciones y presentaciones de cliente en horas, no en días. Flujo de sincronización en vivo desde Revit, SketchUp y Rhino.",
    instructor: 1,
    mostrado: true,
    nivel: "BASICO",
    modulos: [
      {
        titulo: "Flujo de trabajo en vivo",
        lecciones: [
          { titulo: "Sincronización directa desde Revit", duracion: 903 },
          { titulo: "Biblioteca de vegetación y entorno", duracion: 1176 },
        ],
      },
      {
        titulo: "Animación y entrega",
        lecciones: [
          { titulo: "Recorridos con cámara sobre rieles", duracion: 1240 },
          {
            titulo: "Render de secuencias y formatos de entrega",
            duracion: 995,
            estado: "SUBIENDO",
          },
        ],
      },
    ],
  },
  {
    categoria: 2,
    titulo: "Diseño Estructural en Concreto Reforzado",
    descripcion:
      "Predimensionamiento, análisis y detallado de vigas, columnas y losas. Del diagrama de momentos al despiece que realmente se construye en obra.",
    instructor: 2,
    mostrado: true,
    nivel: "AVANZADO",
    modulos: [
      {
        titulo: "Comportamiento del material",
        lecciones: [
          { titulo: "Concreto y acero: por qué trabajan juntos", duracion: 1088 },
          { titulo: "Estados límite y factores de seguridad", duracion: 1223 },
        ],
      },
      {
        titulo: "Elementos a flexión",
        lecciones: [
          { titulo: "Diseño de vigas a flexión", duracion: 1560 },
          { titulo: "Cortante y refuerzo transversal", duracion: 1345 },
        ],
      },
      {
        titulo: "Detallado constructivo",
        lecciones: [
          { titulo: "Longitudes de desarrollo y empalmes", duracion: 1012 },
          { titulo: "Despiece y planos de taller", duracion: 1198 },
        ],
      },
    ],
  },
  {
    categoria: 3,
    titulo: "Gestión de Obra y Normativa NSR-10",
    descripcion:
      "Programación, presupuesto y control de una obra real, con el marco normativo colombiano como columna vertebral de las decisiones de diseño.",
    instructor: 2,
    mostrado: false,
    nivel: "INTERMEDIO",
    modulos: [
      {
        titulo: "Marco normativo",
        lecciones: [
          { titulo: "Estructura de la NSR-10 título por título", duracion: 1420 },
          { titulo: "Zonificación sísmica y microzonificación", duracion: 1155 },
        ],
      },
      {
        titulo: "Programación y presupuesto",
        lecciones: [
          { titulo: "APU: análisis de precios unitarios", duracion: 1308 },
          { titulo: "Ruta crítica y curva S", duracion: 1076 },
        ],
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Clientes
// ---------------------------------------------------------------------------

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// ---------------------------------------------------------------------------
// Salvaguarda
// ---------------------------------------------------------------------------

function verificarEntorno(): void {
  const faltantes = [
    "DATABASE_URL",
    "NEXT_PUBLIC_SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
  ].filter((v) => !process.env[v]);

  if (faltantes.length > 0) {
    console.error(
      `\n❌ Faltan variables de entorno en .env.local: ${faltantes.join(", ")}\n`
    );
    process.exit(1);
  }

  if (process.env.NODE_ENV === "production") {
    console.error(
      "\n❌ NODE_ENV=production. Este script nunca debe correr en Producción.\n"
    );
    process.exit(1);
  }

  const pistasProd = `${process.env.NEXT_PUBLIC_SUPABASE_URL} ${process.env.DATABASE_URL}`;
  if (/prod/i.test(pistasProd)) {
    console.error(
      "\n❌ La URL de Supabase o DATABASE_URL contienen 'prod'. Abortado por precaución.\n"
    );
    process.exit(1);
  }

  if (process.env.ALLOW_SEED !== "true") {
    console.error(
      [
        "",
        "❌ ALLOW_SEED no está definida — abortado sin tocar la base de datos.",
        "",
        "   Este script BORRA y RECREA datos. No existe forma fiable de saber si",
        "   una URL de Supabase apunta a Producción (todas tienen la forma",
        "   https://<ref>.supabase.co), así que la única protección real es que",
        "   tú confirmes explícitamente la intención en cada ejecución.",
        "",
        "   PowerShell:  $env:ALLOW_SEED=\"true\"; npx prisma db seed",
        "   bash:        ALLOW_SEED=true npx prisma db seed",
        "",
      ].join("\n")
    );
    process.exit(1);
  }

  // Confirmación visual del destino antes de escribir nada.
  const host = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).host;
  console.log(`\n🎯 Destino: ${host}`);
  console.log(`   Solo se tocarán usuarios ${DOMINIO_SEED} y los IDs fijos del seed.\n`);
}

// ---------------------------------------------------------------------------
// Limpieza
// ---------------------------------------------------------------------------

const IDS_CATEGORIAS = CATEGORIAS.map((_, i) => uuid(B.categoria, i + 1));
const IDS_INSTRUCTORES = INSTRUCTORES.map((_, i) => uuid(B.instructor, i + 1));
const IDS_PLANES = [1, 2, 3].map((i) => uuid(B.plan, i));
const IDS_CURSOS = CURSOS.map((_, i) => uuid(B.curso, i + 1));
/**
 * Los códigos son el ÚNICO camino de acceso del MVP del 12 de septiembre, así
 * que se siembra uno por cada rama de canjear_codigo_invitacion()
 * (035_canje_codigo_por_dias.sql). Antes había uno solo y las ramas de error
 * — vencido, inactivo, agotado — no se podían probar sin editar filas a mano.
 *
 * `duracion_dias` va en el propio código desde la migración 20260827000000:
 * ya no se hereda de un plan.
 */
const CODIGOS_INVITACION = [
  {
    n: 1,
    codigo: "UVA-BIENVENIDA-2026",
    duracion_dias: 30,
    limite_usos: 25,
    // 1, no 10: `veces_usado` debe cuadrar con las suscripciones realmente
    // sembradas. Antes decía 10 con un solo canje existente, así que el panel
    // mostraba "10/25 usos" que ninguna fila respaldaba.
    veces_usado: 1,
    vence_en_dias: 90,
    activo: true,
    nota: "campaña con cupo, ya canjeado por estudiante-por-codigo",
  },
  {
    n: 2,
    codigo: "UVA-UNICO-2026",
    duracion_dias: 30,
    limite_usos: 1,
    veces_usado: 0,
    vence_en_dias: 60,
    activo: true,
    nota: "uso único sin estrenar — el caso del lanzamiento",
  },
  {
    n: 3,
    codigo: "UVA-TRIMESTRE-2026",
    duracion_dias: 90,
    limite_usos: 10,
    veces_usado: 0,
    vence_en_dias: 45,
    activo: true,
    nota: "90 días: prueba que la duración sale del código, no de un plan",
  },
  {
    n: 4,
    codigo: "UVA-AGOTADO-2026",
    duracion_dias: 30,
    limite_usos: 5,
    veces_usado: 5,
    vence_en_dias: 30,
    activo: true,
    nota: "sin cupo -> codigo_agotado",
  },
  {
    n: 5,
    codigo: "UVA-VENCIDO-2025",
    duracion_dias: 30,
    limite_usos: 50,
    veces_usado: 12,
    vence_en_dias: -10,
    activo: true,
    nota: "fuera de fecha -> codigo_vencido",
  },
  {
    n: 6,
    codigo: "UVA-APAGADO-2026",
    duracion_dias: 30,
    limite_usos: 20,
    veces_usado: 3,
    vence_en_dias: 120,
    activo: false,
    nota: "desactivado a mano -> codigo_inactivo",
  },
];

/** El que ya canjeó estudiante-por-codigo; su suscripción lo referencia. */
const ID_CODIGO_CANJEADO = uuid(B.codigoInvitacion, 1);

/**
 * Borra todo lo que este seed puede haber creado, en orden inverso a las
 * Foreign Keys. `cursos` cascadea a `modulos` y `lecciones` (y `lecciones` a
 * `progreso`), pero `recursos_descargables`, `certificados` e `inscripciones`
 * NO cascadean — hay que borrarlos antes a mano o el DELETE de cursos falla.
 */
async function limpiar(): Promise<void> {
  console.log("🧹 Limpiando datos de seed previos…");

  const perfilesSeed = await prisma.perfiles.findMany({
    where: { correo: { endsWith: DOMINIO_SEED } },
    select: { id: true },
  });
  const idsUsuarios = perfilesSeed.map((p) => p.id);

  const enCursosSeed = { modulo: { curso: { id: { in: IDS_CURSOS } } } };

  await prisma.progreso.deleteMany({
    where: {
      OR: [{ id_usuario: { in: idsUsuarios } }, { leccion: enCursosSeed }],
    },
  });
  await prisma.certificados.deleteMany({
    where: {
      OR: [{ id_usuario: { in: idsUsuarios } }, { id_curso: { in: IDS_CURSOS } }],
    },
  });
  await prisma.recursosDescargables.deleteMany({
    where: { leccion: enCursosSeed },
  });
  // `mux_assets_pendientes_eliminacion` y `tokens_vista_previa` no se
  // siembran, pero sí las escriben acciones reales sobre cursos sembrados
  // (reemplazar un video, generar un enlace de vista previa). Ninguna se
  // borraba antes: la primera tiene FK ON DELETE SET NULL, así que sus filas
  // sobrevivían al borrado del curso y se acumulaban huérfanas corrida tras
  // corrida; la segunda cascadea, pero borrarla explícitamente deja el
  // recuento del resumen honesto.
  await prisma.muxAssetsPendientesEliminacion.deleteMany({
    where: { leccion: enCursosSeed },
  });
  await prisma.tokensVistaPrevia.deleteMany({
    where: { id_curso: { in: IDS_CURSOS } },
  });
  await prisma.inscripciones.deleteMany({
    where: {
      OR: [
        { id_usuario: { in: idsUsuarios } },
        { otorgado_por: { in: idsUsuarios } },
        { id_curso: { in: IDS_CURSOS } },
      ],
    },
  });
  await prisma.suscripciones.deleteMany({
    where: {
      OR: [{ id_usuario: { in: idsUsuarios } }, { otorgado_por: { in: idsUsuarios } }],
    },
  });
  // Después de suscripciones (FK id_codigo_invitacion) y antes de planes
  // (FK id_plan), mismo criterio de orden que instructores/cupones: se
  // borra por ID fijo o por código único, por si sobrevivió con otro id.
  await prisma.codigosInvitacion.deleteMany({
    where: {
      OR: [
        { id: { in: CODIGOS_INVITACION.map((c) => uuid(B.codigoInvitacion, c.n)) } },
        { codigo: { in: CODIGOS_INVITACION.map((c) => c.codigo) } },
      ],
    },
  });
  // No sembramos bitácora, pero si alguna acción real la escribió apuntando a
  // un admin de prueba, bloquearía el borrado del perfil.
  await prisma.bitacoraAdministrativa.deleteMany({
    where: { id_admin: { in: idsUsuarios } },
  });
  await prisma.cursos.deleteMany({ where: { id: { in: IDS_CURSOS } } });
  // Después de cursos, nunca antes: `cursos.id_instructor` es una FK con
  // ON DELETE RESTRICT, así que Postgres bloquea el borrado de un instructor
  // mientras le quede algún curso apuntando.
  //
  // Se borra por ID fijo *o* por nombre, no solo por ID: `instructores.nombre`
  // es UNIQUE, y pueden existir filas con estos mismos nombres pero con otro
  // id — las creó la migración que convirtió `cursos.instructor` de texto
  // libre a relación, con `gen_random_uuid()`. Si solo se filtrara por id,
  // sobrevivirían y la siembra fallaría con P2002. Mismo criterio que se usa
  // con `cupones.codigo`.
  await prisma.instructores.deleteMany({
    where: {
      OR: [
        { id: { in: IDS_INSTRUCTORES } },
        { nombre: { in: INSTRUCTORES.map((i) => i.nombre) } },
      ],
    },
  });
  await prisma.categorias.deleteMany({ where: { id: { in: IDS_CATEGORIAS } } });
  await prisma.planes.deleteMany({ where: { id: { in: IDS_PLANES } } });
  await prisma.perfiles.deleteMany({ where: { id: { in: idsUsuarios } } });

  // Usuarios de Supabase Auth. Borrar aquí también dispararía el borrado en
  // cascada de `perfiles` si hubiera una FK real hacia auth.users, pero como
  // la sincronización es por trigger (no por FK), el orden es indiferente.
  const borrados = await borrarUsuariosAuthSeed();

  console.log(
    `   Perfiles borrados: ${idsUsuarios.length} · usuarios de Auth borrados: ${borrados}`
  );
}

/** Elimina de auth.users todas las cuentas cuyo correo termine en @uva.test. */
async function borrarUsuariosAuthSeed(): Promise<number> {
  let borrados = 0;
  for (const usuario of await listarUsuariosAuth()) {
    if (usuario.email?.endsWith(DOMINIO_SEED)) {
      const { error } = await supabaseAdmin.auth.admin.deleteUser(usuario.id);
      if (error) throw new Error(`No se pudo borrar ${usuario.email}: ${error.message}`);
      borrados++;
    }
  }
  return borrados;
}

async function listarUsuariosAuth() {
  const todos: { id: string; email?: string }[] = [];
  for (let page = 1; ; page++) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error) throw new Error(`No se pudo listar auth.users: ${error.message}`);
    todos.push(...data.users);
    if (data.users.length < 200) break;
  }
  return todos;
}

// ---------------------------------------------------------------------------
// Usuarios
// ---------------------------------------------------------------------------

const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Crea el usuario en Supabase Auth (o reutiliza el existente), espera a que el
 * trigger `on_auth_user_created` haya insertado su fila en `perfiles`, y luego
 * corrige nombre/rol/estado con Prisma — el trigger siempre crea la fila como
 * ESTUDIANTE/ACTIVO, así que el ADMINISTRADOR solo puede quedar bien con este
 * UPDATE posterior.
 */
async function sembrarUsuario(u: (typeof USUARIOS)[number]): Promise<string> {
  let id: string;

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email: u.correo,
    password: PASSWORD_PRUEBA,
    email_confirm: true, // evita el correo de verificación
    user_metadata: { nombre: u.nombre },
  });

  if (error) {
    // Idempotencia: si la cuenta sobrevivió a una limpieza parcial, la
    // reutilizamos en vez de reventar con "email already registered".
    const existente = (await listarUsuariosAuth()).find((x) => x.email === u.correo);
    if (!existente) throw new Error(`No se pudo crear ${u.correo}: ${error.message}`);
    id = existente.id;
    await supabaseAdmin.auth.admin.updateUserById(id, {
      password: PASSWORD_PRUEBA,
      email_confirm: true,
      user_metadata: { nombre: u.nombre },
    });
  } else {
    id = data.user.id;
  }

  await esperarPerfil(id, u.correo);

  await prisma.perfiles.update({
    where: { id },
    data: { nombre: u.nombre, rol: u.rol, estado: u.estado },
  });

  return id;
}

/** El trigger es asíncrono respecto a la respuesta de la Admin API. */
async function esperarPerfil(id: string, correo: string): Promise<void> {
  for (let intento = 0; intento < 40; intento++) {
    const perfil = await prisma.perfiles.findUnique({ where: { id } });
    if (perfil) return;
    await dormir(250);
  }
  throw new Error(
    `El trigger handle_new_user no creó el perfil de ${correo} tras 10s. ` +
      `¿Se corrió supabase/sql/000_trigger_perfiles.sql en este proyecto?`
  );
}

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------

const DIA = 24 * 60 * 60 * 1000;
const ahora = Date.now();
const enDias = (d: number) => new Date(ahora + d * DIA);

async function sembrar(): Promise<void> {
  // --- Usuarios -----------------------------------------------------------
  console.log("👤 Creando usuarios en Supabase Auth…");
  const ids: Record<string, string> = {};
  for (const u of USUARIOS) {
    ids[u.correo] = await sembrarUsuario(u);
    console.log(`   ${u.rol.padEnd(13)} ${u.correo}`);
  }
  const idAdmin = ids[`admin${DOMINIO_SEED}`];
  const idActivo = ids[`estudiante-activo${DOMINIO_SEED}`];
  const idSinPlan = ids[`estudiante-sin-plan${DOMINIO_SEED}`];
  const idSuspendido = ids[`estudiante-suspendido${DOMINIO_SEED}`];
  const idPastDue = ids[`estudiante-pastdue${DOMINIO_SEED}`];
  const idPorCodigo = ids[`estudiante-por-codigo${DOMINIO_SEED}`];

  // --- Categorías ---------------------------------------------------------
  // El slug sale de slugificar(), la misma función que usa el CMS: si el
  // seed lo escribiera a mano, las categorías sembradas y las creadas desde
  // el panel podrían normalizar distinto el mismo nombre.
  await prisma.categorias.createMany({
    data: CATEGORIAS.map((c, i) => ({
      id: IDS_CATEGORIAS[i],
      slug: slugificar(c.nombre),
      ...c,
    })),
  });
  console.log(`📚 ${CATEGORIAS.length} categorías`);

  // --- Planes -------------------------------------------------------------
  // Precios en centavos de COP. El Anual equivale a 10 meses: el descuento
  // está implícito en el precio, no hay campo de descuento en el esquema.
  await prisma.planes.createMany({
    data: [
      {
        id: IDS_PLANES[0],
        nombre: "Mensual",
        descripcion: "Acceso completo al catálogo, facturado cada mes.",
        precio_centavos: 8_990_000,
        moneda: "COP",
        duracion_dias: 30,
        nivel_acceso: "TOTAL",
        activo: true,
        orden: 1,
      },
      {
        id: IDS_PLANES[1],
        nombre: "Anual",
        descripcion: "Acceso completo por 12 meses pagando 10.",
        precio_centavos: 89_900_000,
        moneda: "COP",
        duracion_dias: 365,
        nivel_acceso: "TOTAL",
        activo: true,
        orden: 2,
      },
      {
        id: IDS_PLANES[2],
        nombre: "Trimestral (descontinuado)",
        descripcion: "Plan retirado del catálogo. Solo lo conservan suscriptores antiguos.",
        precio_centavos: 24_900_000,
        moneda: "COP",
        duracion_dias: 90,
        nivel_acceso: "TOTAL",
        activo: false,
        orden: 3,
      },
    ],
  });
  console.log("💳 3 planes (2 activos, 1 descontinuado)");

  // --- Códigos de invitación -----------------------------------------------
  // Ver CODIGOS_INVITACION arriba: uno por cada rama de
  // canjear_codigo_invitacion(), para que las de error se puedan probar sin
  // editar filas a mano.
  await prisma.codigosInvitacion.createMany({
    data: CODIGOS_INVITACION.map((c) => ({
      id: uuid(B.codigoInvitacion, c.n),
      codigo: c.codigo,
      duracion_dias: c.duracion_dias,
      id_admin_creador: idAdmin,
      fecha_vencimiento: enDias(c.vence_en_dias),
      limite_usos: c.limite_usos,
      veces_usado: c.veces_usado,
      activo: c.activo,
    })),
  });
  console.log(`🎫 ${CODIGOS_INVITACION.length} códigos de invitación:`);
  for (const c of CODIGOS_INVITACION) {
    console.log(
      `   ${c.codigo.padEnd(20, " ")} ${String(c.duracion_dias).padStart(3, " ")} días · ` +
        `${c.veces_usado}/${c.limite_usos} usos · ${c.nota}`
    );
  }

  // --- Instructores --------------------------------------------------------
  // Antes que los cursos: `cursos.id_instructor` es obligatorio.
  await prisma.instructores.createMany({
    data: INSTRUCTORES.map((instructor, i) => ({
      id: IDS_INSTRUCTORES[i],
      ...instructor,
      id_admin_creador: idAdmin,
    })),
  });
  console.log(`🎓 ${INSTRUCTORES.length} instructores`);

  // --- Cursos, módulos y lecciones ----------------------------------------
  await prisma.cursos.createMany({
    data: CURSOS.map((c, i) => ({
      id: IDS_CURSOS[i],
      titulo: c.titulo,
      descripcion: c.descripcion,
      imagen_portada: `https://picsum.photos/seed/uva-curso-${i + 1}/1200/675`,
      id_instructor: IDS_INSTRUCTORES[c.instructor],
      nivel: c.nivel,
      destacado: c.destacado ?? false,
      // Orden explícito y espaciado (mismo criterio que `modulos`/`lecciones`,
      // migración 20260824020000): reordenar en el CMS no obliga a reescribir
      // todas las filas.
      orden_visualizacion: (i + 1) * 10,
      mostrado: c.mostrado,
      id_admin_creador: idAdmin,
    })),
  });

  // curso_categorias: el seed solo asigna una categoría por curso (mismo
  // comportamiento que el CMS hoy), ver auditoría de esquema Bloque 3.
  await prisma.cursoCategorias.createMany({
    data: CURSOS.map((c, i) => ({
      id_curso: IDS_CURSOS[i],
      id_categoria: IDS_CATEGORIAS[c.categoria],
    })),
  });

  const modulos: { id: string; id_curso: string; titulo: string; orden: number }[] = [];
  const lecciones: {
    id: string;
    id_modulo: string;
    titulo: string;
    orden: number;
    duracion: number;
    estado_procesamiento: "SUBIENDO" | "PROCESANDO";
    resumen: string;
  }[] = [];

  CURSOS.forEach((curso, c) => {
    curso.modulos.forEach((modulo, m) => {
      const idModulo = uuid(B.modulo, (c + 1) * 100 + (m + 1));
      modulos.push({
        id: idModulo,
        id_curso: IDS_CURSOS[c],
        titulo: modulo.titulo,
        orden: m + 1,
      });
      modulo.lecciones.forEach((leccion, l) => {
        lecciones.push({
          id: uuid(B.leccion, (c + 1) * 10_000 + (m + 1) * 100 + (l + 1)),
          id_modulo: idModulo,
          titulo: leccion.titulo,
          orden: l + 1,
          duracion: leccion.duracion,
          // NINGUNA lección sembrada tiene `id_video_mux`.
          //
          // Antes se escribían playback IDs inventados (`mux_pb_111_uvaseed`)
          // con estado LISTO. Eso era inofensivo mientras el reproductor no
          // existía, pero desde que obtenerTokenReproduccion() firma tokens
          // contra Mux (actions/video/reproduccion.ts) esos IDs producen un
          // reproductor roto en TODAS las lecciones: Mux rechaza un playback
          // ID que no existe, y el estudiante ve un error en vez de un video.
          //
          // Dejarlas en SUBIENDO/PROCESANDO muestra el estado honesto de
          // "el video todavía no está disponible" y deja el árbol de módulos,
          // el candado de la lección bloqueada y la duración total —que es lo
          // que estas filas existen para probar— funcionando igual. Los
          // videos reales se suben por el CMS.
          estado_procesamiento: leccion.estado === "PROCESANDO" ? "PROCESANDO" : "SUBIENDO",
          resumen: `Notas y recursos de la lección **${leccion.titulo}**.`,
        });
      });
    });
  });

  await prisma.modulos.createMany({ data: modulos });
  await prisma.lecciones.createMany({ data: lecciones });

  console.log(
    `🎬 ${CURSOS.length} cursos (${CURSOS.filter((c) => c.mostrado).length} mostrados) · ` +
      `${modulos.length} módulos · ${lecciones.length} lecciones (ninguna con video: se suben por el CMS)`
  );

  // --- Suscripciones ------------------------------------------------------
  await prisma.suscripciones.createMany({
    data: [
      {
        id: uuid(B.suscripcion, 1),
        id_usuario: idActivo,
        id_plan: IDS_PLANES[0],
        fecha_inicio: enDias(-12),
        fecha_renovacion: enDias(18),
        estado: "ACTIVA",
        proveedor: "stripe",
        id_cliente_externo: "cus_seed_activo",
        id_suscripcion_externa: "sub_seed_activo",
        monto_centavos: 8_990_000,
        moneda: "COP",
      },
      {
        id: uuid(B.suscripcion, 2),
        id_usuario: idPastDue,
        id_plan: IDS_PLANES[0],
        fecha_inicio: enDias(-42),
        fecha_renovacion: enDias(-2), // el cobro falló hace 2 días
        estado: "PAST_DUE",
        proveedor: "stripe",
        id_cliente_externo: "cus_seed_pastdue",
        id_suscripcion_externa: "sub_seed_pastdue",
        monto_centavos: 8_990_000,
        moneda: "COP",
      },
      {
        // Historial: reintentos agotados (Flujo 06, resultado B).
        id: uuid(B.suscripcion, 3),
        id_usuario: idSuspendido,
        id_plan: IDS_PLANES[2],
        fecha_inicio: enDias(-210),
        fecha_renovacion: enDias(-120),
        estado: "VENCIDA",
        proveedor: "wompi",
        id_cliente_externo: "cus_seed_vencida",
        id_suscripcion_externa: "sub_seed_vencida",
        monto_centavos: 24_900_000,
        moneda: "COP",
      },
      {
        // Historial del propio estudiante-activo: canceló su plan anual y
        // luego volvió con el mensual (la suscripción #1).
        id: uuid(B.suscripcion, 4),
        id_usuario: idActivo,
        id_plan: IDS_PLANES[1],
        fecha_inicio: enDias(-400),
        fecha_renovacion: enDias(-35),
        estado: "CANCELADA",
        proveedor: "stripe",
        id_cliente_externo: "cus_seed_activo",
        id_suscripcion_externa: "sub_seed_cancelada",
        monto_centavos: 89_900_000,
        moneda: "COP",
      },
      {
        // Mismas columnas que dejaría un canje real de código de invitación
        // (public.canjear_codigo_invitacion(), 035_canje_codigo_por_dias.sql):
        // proveedor "invitacion", monto_centavos 0, acceso_manual true,
        // otorgado_por = el admin que creó el código y — desde la migración
        // 20260827000000 — id_plan NULL: un acceso regalado no compró ningún
        // plan. Las fechas reflejan los 30 días de UVA-BIENVENIDA-2026,
        // canjeados hace 5 días.
        id: uuid(B.suscripcion, 5),
        id_usuario: idPorCodigo,
        id_plan: null,
        fecha_inicio: enDias(-5),
        fecha_renovacion: enDias(25),
        estado: "ACTIVA",
        proveedor: "invitacion",
        monto_centavos: 0,
        moneda: "COP",
        id_codigo_invitacion: ID_CODIGO_CANJEADO,
        acceso_manual: true,
        otorgado_por: idAdmin,
      },
    ],
  });
  console.log("🔁 5 suscripciones (ACTIVA, PAST_DUE, VENCIDA, CANCELADA, ACTIVA vía código)");

  // Sin `pagos` ni `cupones`: son artefactos de Stripe/Wompi y el MVP del 12
  // de septiembre no tiene pasarela de pago (el acceso se da solo por códigos
  // de invitación). Sembrar transacciones y descuentos de un checkout que no
  // existe solo mete ruido en el panel administrativo. Vuelven cuando vuelvan
  // los cobros.

  // --- Inscripciones ------------------------------------------------------
  await prisma.inscripciones.createMany({
    data: [
      {
        // Alta automática al entrar por primera vez a un curso teniendo
        // suscripción activa (Flujo 01). otorgado_por queda null: así lo
        // exige la policy inscripciones_insert_propio de 003.
        id: uuid(B.inscripcion, 1),
        id_usuario: idActivo,
        id_curso: IDS_CURSOS[0],
        tipo_acceso: "MEMBRESIA",
        otorgado_por: null,
      },
      {
        // Cortesía otorgada a mano por un administrador (Flujo 11): el
        // estudiante no tiene ninguna suscripción, su acceso viene de aquí.
        id: uuid(B.inscripcion, 2),
        id_usuario: idSinPlan,
        id_curso: IDS_CURSOS[2],
        tipo_acceso: "CORTESIA",
        otorgado_por: idAdmin,
      },
    ],
  });
  console.log("🎓 2 inscripciones (1 MEMBRESIA, 1 CORTESIA del admin)");

  // --- Progreso -----------------------------------------------------------
  // Sobre las dos primeras lecciones del curso al que está inscrito.
  const leccionesCurso1 = lecciones.filter((l) =>
    modulos.some((m) => m.id === l.id_modulo && m.id_curso === IDS_CURSOS[0])
  );
  await prisma.progreso.createMany({
    data: [
      {
        id: uuid(B.progreso, 1),
        id_usuario: idActivo,
        id_leccion: leccionesCurso1[0].id,
        completado: true,
        segundo_actual: leccionesCurso1[0].duracion,
      },
      {
        id: uuid(B.progreso, 2),
        id_usuario: idActivo,
        id_leccion: leccionesCurso1[1].id,
        completado: false,
        segundo_actual: Math.floor(leccionesCurso1[1].duracion * 0.42),
      },
    ],
  });
  console.log("📈 2 filas de progreso (1 completada, 1 a mitad)");

  // --- Certificados -------------------------------------------------------
  // Código fijo (no aleatorio) para que la página pública de verificación
  // tenga siempre la misma URL de prueba entre corridas del seed.
  await prisma.certificados.create({
    data: {
      id: uuid(B.certificado, 1),
      id_usuario: idActivo,
      id_curso: IDS_CURSOS[0],
      fecha_emision: enDias(-3),
      codigo_verificacion: "UVA-2026-REVIT-7F3A9C2E",
      archivo_pdf: null, // se genera on the fly con pdf-lib (Flujo 07)
      // Snapshot congelado (Deteccion.md): en producción lo escribe el
      // trigger de emisión (supabase/sql/047); el seed lo replica a mano
      // porque inserta directo con Prisma, sin pasar por ese trigger.
      nombre_estudiante: "Camilo Restrepo",
      nombre_curso: "Revit desde Cero para Arquitectos",
      notificado_en: enDias(-3), // dato sembrado: no debe disparar un correo real
    },
  });
  console.log("🏅 1 certificado (UVA-2026-REVIT-7F3A9C2E)");

  // --- Recursos descargables ----------------------------------------------
  const leccionesCurso3 = lecciones.filter((l) =>
    modulos.some((m) => m.id === l.id_modulo && m.id_curso === IDS_CURSOS[2])
  );
  await prisma.recursosDescargables.createMany({
    data: [
      {
        id: uuid(B.recurso, 1),
        id_leccion: leccionesCurso1[0].id,
        nombre: "Plantilla base Revit (UVA).rte",
        tipo_archivo: "RTE",
        url_archivo:
          "https://ejemplo.supabase.co/storage/v1/object/public/recursos/plantilla-base-uva.rte",
        tamano_bytes: 4_812_544,
      },
      {
        id: uuid(B.recurso, 2),
        id_leccion: leccionesCurso3[0].id,
        nombre: "Guía de iluminación V-Ray.pdf",
        tipo_archivo: "PDF",
        url_archivo:
          "https://ejemplo.supabase.co/storage/v1/object/public/recursos/guia-iluminacion-vray.pdf",
        tamano_bytes: 1_204_338,
      },
    ],
  });
  console.log("📎 2 recursos descargables");

  void idSuspendido; // referenciado arriba en la suscripción VENCIDA
}

// ---------------------------------------------------------------------------
// Resumen final
// ---------------------------------------------------------------------------

async function resumen(): Promise<void> {
  const conteos = {
    perfiles: await prisma.perfiles.count({
      where: { correo: { endsWith: DOMINIO_SEED } },
    }),
    categorias: await prisma.categorias.count({ where: { id: { in: IDS_CATEGORIAS } } }),
    instructores: await prisma.instructores.count({
      where: { id: { in: IDS_INSTRUCTORES } },
    }),
    planes: await prisma.planes.count({ where: { id: { in: IDS_PLANES } } }),
    cursos: await prisma.cursos.count({ where: { id: { in: IDS_CURSOS } } }),
    modulos: await prisma.modulos.count({ where: { id_curso: { in: IDS_CURSOS } } }),
    lecciones: await prisma.lecciones.count({
      where: { modulo: { id_curso: { in: IDS_CURSOS } } },
    }),
    suscripciones: await prisma.suscripciones.count({
      where: { usuario: { correo: { endsWith: DOMINIO_SEED } } },
    }),
    codigos_invitacion: await prisma.codigosInvitacion.count({
      where: { id: { in: CODIGOS_INVITACION.map((c) => uuid(B.codigoInvitacion, c.n)) } },
    }),
    inscripciones: await prisma.inscripciones.count({
      where: { id_curso: { in: IDS_CURSOS } },
    }),
    progreso: await prisma.progreso.count({
      where: { usuario: { correo: { endsWith: DOMINIO_SEED } } },
    }),
    certificados: await prisma.certificados.count({
      where: { usuario: { correo: { endsWith: DOMINIO_SEED } } },
    }),
    recursos: await prisma.recursosDescargables.count({
      where: { leccion: { modulo: { id_curso: { in: IDS_CURSOS } } } },
    }),
  };

  console.log("\n📊 Filas de seed en la base:");
  console.table(conteos);
  console.log(`🔑 Credenciales de prueba — contraseña común: ${PASSWORD_PRUEBA}`);
  for (const u of USUARIOS) console.log(`   ${u.correo.padEnd(32)} ${u.rol}`);
}

// ---------------------------------------------------------------------------
// Entrada
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const soloLimpiar = process.argv.includes("--clean");

  verificarEntorno();
  await limpiar();

  if (soloLimpiar) {
    console.log("\n✅ Limpieza completada. No se sembró nada (--clean).\n");
    return;
  }

  await sembrar();
  await resumen();
  console.log("\n✅ Seed completado.\n");
}

main()
  .catch((e) => {
    console.error("\n❌ El seed falló:\n", e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
