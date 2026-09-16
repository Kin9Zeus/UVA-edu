# Límites y alertas de gasto por proveedor

P3-8 (`AUDIT-2026-09-15.md`): ninguno de los servicios de terceros con
facturación por uso tiene un tope configurado ni una alerta si el consumo
se dispara — por un bug (loop de reintentos), por abuso (una sesión de
admin comprometida generando exámenes o subiendo video sin parar), o
simplemente por crecimiento inesperado. Esto se configura en el dashboard
de cada proveedor, no en este repo — es un checklist para hacer a mano, no
algo que un PR pueda cerrar.

**No confundir con seguridad de la app**: `supabase/sql/107` (P3-9) ya le
pone un tope de 15 generaciones/hora por administrador a la generación de
exámenes con IA — eso reduce el gasto pero no lo elimina, y no cubre a
Mux/Resend. Esta capa (el dashboard del proveedor) es la red de seguridad
de última instancia si algo se escapa igual.

## Servicios con facturación por USO (sí tienen un "presupuesto" real que configurar)

| Servicio | Qué factura | Qué buscar en su dashboard |
|---|---|---|
| **Mux** (`MUX_TOKEN_ID`/`MUX_TOKEN_SECRET`) | Minutos de codificación, almacenamiento y entrega de video. | Sección de facturación/uso del dashboard de Mux — buscar límites de gasto o alertas de uso. El nombre exacto del menú puede haber cambiado desde que se escribió esto; confirmar en el dashboard real, no asumir la ruta. |
| **Gemini** (`GEMINI_API_KEY`, generación de exámenes con IA) | Tokens de entrada/salida del modelo por llamada. | Si la clave es de Google AI Studio: revisar el plan y cuota ahí. Si el proyecto está vinculado a un proyecto de Google Cloud (facturación real, no solo cuota gratuita): **Google Cloud Console → Facturación → Presupuestos y alertas** — ahí sí se puede fijar un monto mensual y que avise (por correo) al superarlo. |
| **Resend** (`RESEND_API_KEY`, correos transaccionales) | Correos enviados por mes, según el plan. | Sección de facturación/plan del dashboard de Resend — los planes por uso suelen tener su propio tope y aviso de acercarse al límite; confirmar que esté activado. |

## Stripe y Wompi — no aplican el mismo control, y por qué

Stripe y Wompi **no facturan un presupuesto prepago que se pueda agotar**:
cobran una comisión sobre el dinero que YA entró (dinero que el estudiante
pagó), no un servicio prepago como Mux/Gemini/Resend. No existe un
escenario de "se disparó el gasto" en el mismo sentido — el riesgo
análogo ahí es **fraude/contracargos**, no gasto:

- **Stripe:** Radar (su motor de detección de fraude) tiene reglas y
  umbrales configurables en su dashboard, bajo la sección de Radar. Hoy
  Stripe no está conectado a ningún checkout real (ver Addendum de
  `AUDIT-2026-09-15.md`), así que esto no es urgente — revisar cuando se
  conecte de verdad.
- **Wompi:** es el proveedor de pago real en producción hoy. No expone un
  control de "presupuesto" — la mitigación equivalente es revisar
  periódicamente el dashboard de transacciones por picos anómalos de
  intentos fallidos o contracargos, no una alerta automática configurable
  del lado de Wompi.

## Checklist

- [ ] Mux: confirmar si existe alerta de uso/gasto en su dashboard y activarla.
- [ ] Gemini: confirmar si el proyecto tiene facturación de Google Cloud
      vinculada; si la tiene, crear un presupuesto con alerta en Cloud
      Console. Si es solo la cuota gratuita de AI Studio, no hay nada que
      configurar — la cuota ya es el tope.
- [ ] Resend: confirmar el plan actual y que el aviso de acercarse al
      límite esté activo.
- [ ] Stripe: revisar reglas de Radar cuando se conecte un checkout real
      (no aplica hoy).
- [ ] Wompi: establecer una revisión periódica (manual) del dashboard de
      transacciones — no hay alerta automática equivalente que configurar.
