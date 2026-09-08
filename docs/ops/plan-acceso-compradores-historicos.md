# Plan de acceso para compradores históricos

Tarea "Migración o plan de acceso para compradores históricos". El lanzamiento
del 12-sep-2026 es por invitación, sin cobro y con cupo limitado — **no hace
falta migrar a nadie ahora**. Lo único que hay que resolver hoy es no tomar
decisiones que sean costosas de revertir después.

## 1. Confirmación técnica: el esquema ya lo soporta, sin rediseño

El "permiso de acceso" de la plataforma son las tablas `Suscripciones`
(acceso a toda la plataforma) e `Inscripciones` (acceso a un curso puntual) —
ver `prisma/schema.prisma`. Ambas ya están pensadas para acceso otorgado a
mano, sin pago: `proveedor = 'manual'`, `acceso_manual = true`,
`otorgado_por` = el admin que lo dio (`otorgarMembresia`/`ofrecerCortesia`,
`src/actions/admin/usuarios.ts`).

**Lo que ya funciona hoy, sin tocar el esquema:** para un comprador histórico
que **ya se registró** en la plataforma nueva (tiene fila en `Perfiles`,
`correo` es `@unique`), un script agregado de admin puede recorrer la lista
de correos, buscar cada uno en `Perfiles.correo` y, si existe, insertar la
`Suscripción`/`Inscripción` correspondiente — exactamente el mismo camino que
usa el otorgamiento manual uno-por-uno hoy, solo en lote. Cero cambios
estructurales.

**Lo que el esquema NO cubre todavía:** otorgar acceso a alguien que **aún
no se ha registrado**, identificándolo solo por correo. Ni `Suscripciones` ni
`Inscripciones` tienen columna `correo` — están atadas a `id_usuario`, que
no existe hasta que la persona crea cuenta. Si el momento de la migración
llega y se quiere que el acceso "ya esté esperando" desde el primer login
(en vez de que el admin lo otorgue manualmente después de que cada uno se
registre), hace falta **una tabla nueva y aditiva** —
`AccesoPreOtorgado(correo, tipo_acceso, ...)`, consumida por un trigger en el
primer login, igual de aditivo que como ya funciona
`CodigosInvitacion`/`LotesCodigosInvitacion` para invitaciones anónimas hoy.
Eso **no es un rediseño**: es agregar una tabla, no tocar ninguna existente
— compatible con la misma regla de migraciones aditivas de
`docs/ops/plan-de-reversion.md`.

**Conclusión:** el modelo soporta otorgar acceso masivo a un lote de correos
sin rediseñar nada, siempre que el otorgamiento ocurra después de que cada
comprador se registre. Pre-otorgar antes del registro es posible más
adelante sin rediseño tampoco, pero sí requiere una tabla nueva que hoy no
existe — no se construye ahora porque no hace falta para el MVP.

## 2. Qué se le va a ofrecer (decisión comercial, no técnica)

Pendiente de decidir por el equipo de negocio, no por ingeniería. Opciones
que el esquema ya soporta sin cambios, cualquiera que sea la elegida:

- Acceso solo al curso que compró → `Inscripciones` con `tipo_acceso: CORTESIA`.
- Acceso completo por un tiempo → `Suscripciones` con `proveedor: 'manual'` y
  `fecha_renovacion` = la fecha límite elegida.
- Migración a la suscripción de pago con descuento → requiere que el cobro
  esté enchufado (`Cupones` ya existe en el esquema, sin uso todavío) —
  depende de que Stripe/Wompi estén integrados primero.

**Este documento no decide cuál** — solo confirma que ingeniería puede
implementar cualquiera de las tres sin migrar el esquema.

## 3. Dónde está la lista y si es legalmente utilizable

**Sin confirmar todavía — no verificable desde el código ni desde esta
sesión.** Antes de escribir una sola línea de importación hay que confirmar
con quien tiene la relación comercial con los diplomados históricos:

- **Dónde vive** la lista (¿planilla de Google Sheets, base de datos del
  proveedor de pago original, CRM, correos sueltos?) y en qué formato
  (columnas: correo, nombre, qué compró, cuándo).
- **Si esas personas dieron consentimiento** para ser contactadas con este
  propósito. No basta con que hayan pagado un diplomado — eso autoriza a
  entregar el diplomado, no a incluirlas en una campaña de correo de la
  plataforma nueva.

## 4. Advertencia — reputación de dominio

`RESEND_FROM_EMAIL` corre sobre un subdominio de envío recién configurado
(pendiente de Fase 5, ver `Deteccion.md`/`dms.md`). Importar una lista sin
consentimiento verificado y hacerle un envío masivo puede quemar la
reputación de ese dominio (rebotes, marcado como spam) — con eso se arriesga
la entregabilidad de **todos** los correos de la plataforma (verificación de
cuenta, recuperación de contraseña, notificaciones de certificado), no solo
los de esta campaña. Este riesgo es la razón real de por qué "no hacer la
migración masiva ahora" no es solo una simplificación del MVP, sino la
decisión correcta hasta tener la lista confirmada y el consentimiento
verificado.

## 5. Qué NO se hace ahora

- No se importa ninguna lista de correos.
- No se envía ningún correo a compradores históricos.
- No se crea la tabla `AccesoPreOtorgado` — se documenta como opción
  disponible para cuando el negocio decida qué ofrecer y confirme la lista.

## 6. Siguiente paso concreto

1. Negocio decide qué se ofrece (sección 2).
2. Negocio confirma ubicación, formato y consentimiento de la lista (sección 3).
3. Con ambas respuestas, ingeniería decide entre: (a) script de otorgamiento
   post-registro (ya soportado, sin cambios), o (b) tabla
   `AccesoPreOtorgado` + trigger de consumo en primer login (aditivo, sin
   rediseño) — y lo implementa como una tarea aparte, fuera de este MVP.
