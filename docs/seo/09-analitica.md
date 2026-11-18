# Analítica: GA4, Clarity, consentimiento y UTM

Tarea de Notion «SEO: analítica y conversiones». El código está listo y
**apagado**: sin las variables de abajo no se carga nada, no aparece el aviso
de cookies y la CSP no se abre a Google ni a Microsoft.

## Cómo funciona

- **Consentimiento primero.** Con alguna analítica encendida sale un aviso con
  «Aceptar» y «Rechazar», con el mismo peso. Hasta que la persona acepta no se
  pide ningún script ni se escribe ninguna cookie de analítica. La decisión se
  guarda en el navegador (`lib/consentimiento.ts`) y se cambia desde
  «Configurar cookies», en el pie. Rechazar después de aceptar borra las cookies
  `_ga*`, `_clck` y `_clsk` y recarga la página sin los scripts.
- **GA4** sin publicidad: `ad_storage`, `ad_user_data` y `ad_personalization`
  en `denied`.
- **Clarity solo en páginas públicas:** portada, catálogo, ficha del curso,
  legal, planes, soporte, login, registro, canje y recuperar contraseña
  (`clarityPermitida` en `lib/analitica.ts`). Nunca en el panel, el admin, las
  clases, el examen ni la verificación de certificados. Si alguien pasa de una
  página pública a una privada, la página se recarga sin Clarity, porque
  Clarity no tiene una forma documentada de detenerse una vez cargado.
- Si `/legal/cookies` tiene un texto vigente, el aviso lo enlaza.

## Para encenderlo (en este orden)

1. **Texto legal:** hoy el soporte (§4.11) dice «solo cookies técnicas, sin
   rastreo». Hay que publicar la política de cookies y actualizar el
   tratamiento de datos, con el abogado (docs/legal/03-paquete-abogado.md,
   pregunta 11). **Sin esto no se enciende.**
2. Poner en Railway `NEXT_PUBLIC_GA_ID` (formato `G-XXXXXXX`) y/o
   `NEXT_PUBLIC_CLARITY_ID` (el id del proyecto de Clarity). Las dos son
   `NEXT_PUBLIC_`, así que necesitan un nuevo build, no solo reiniciar.
3. Revisar la consola del navegador en producción: no debe haber bloqueos de
   la CSP para `googletagmanager.com`, `google-analytics.com` ni `clarity.ms`.

## Eventos

| Evento | Cuándo | Dónde |
| --- | --- | --- |
| `canje_invitacion` | Canje de código con éxito | `CanjearCodigoForm.tsx` |
| `registro_completado` | Cuenta creada con correo (`metodo: correo`) o con Google (`metodo: google`) | `RegistroForm.tsx`; con Google, `/auth/callback` deja la cookie `uva-registro-pendiente` (10 min) y `Analitica.tsx` la convierte en el evento |
| `clic_whatsapp` | Clic en cualquier enlace a WhatsApp | `Analitica.tsx` |
| `inicio_curso` | Abre la primera clase de un curso sin avance previo (por el botón, el temario o un enlace) | `LeccionMaqueta.tsx` (`cursoIniciado` en `lib/leccion.ts`) |
| `curso_completado` | Se marca la última clase con video que faltaba | `LeccionMaqueta.tsx` |
| `certificado_emitido` | Se aprueba el examen (la base emite el certificado) | `ExamenRendir.tsx` |
| `verificacion_certificado` | Alguien abre la verificación de un código (`resultado`: `valido`, `no-encontrado`…) | `verificar-certificado/[codigo]` |

Ningún evento lleva datos personales (nombre, correo ni código).

Un registro o canje hecho **antes** de aceptar el aviso no se mide: sin
consentimiento no hay medición. Es lo esperado.

## Prueba automática

`e2e/analitica-consentimiento.spec.ts` comprueba que antes de aceptar no sale
ninguna petición a Google ni a Microsoft, que rechazar borra las cookies, que
Clarity no carga en páginas privadas y que el aviso pasa axe y se usa con
teclado. Necesita la analítica encendida con ID falsos (las peticiones se
interceptan y nunca llegan a Google ni a Microsoft):

```bash
NEXT_PUBLIC_GA_ID=G-E2EPRUEBA1 NEXT_PUBLIC_CLARITY_ID=e2eprueba1 npx playwright test e2e/analitica-consentimiento.spec.ts
```

Sin esas variables se salta. No corre en el CI: el job `e2e` construye la app
sin analítica.

Los nombres de Notion (`sign_up`, `generate_lead`…) se cambiaron por los de
`07-webmasters.md` §7, que ya usaba el código. `generate_lead` (la solicitud de
invitación) hoy es `clic_whatsapp`: la invitación se pide por WhatsApp.

## Lo que se hace en los paneles (Aleck)

- Crear la propiedad de GA4 y el proyecto de Clarity, y pasar los id.
- GA4: marcar como **eventos clave** `canje_invitacion`, `registro_completado`,
  `curso_completado` y `certificado_emitido`.
- GA4: grupo de canales «Asistentes de IA» con fuente que coincida con
  `chatgpt\.com|perplexity\.ai|gemini\.google\.com|copilot\.microsoft\.com|claude\.ai`.
- Vincular GA4 con Search Console.
- Excluir el tráfico interno: regla por IP en GA4 y en Clarity.
- Clarity: enmascarado **Estricto** en la configuración del proyecto.

## Convención de UTM

Todo enlace a la plataforma desde fuera del sitio (redes, correos, campañas,
WhatsApp) lleva UTM. Si no, el tráfico llega como «directo» y no se sabe qué
funcionó.

| Parámetro | Qué va | Valores |
| --- | --- | --- |
| `utm_source` | De dónde viene | `instagram`, `tiktok`, `youtube`, `whatsapp`, `facebook`, `linkedin`, `resend` (correos), `google` (anuncios) |
| `utm_medium` | Tipo de canal | `social` (publicación), `paid_social` (pauta), `email`, `mensaje` (WhatsApp), `cpc` (búsqueda pagada), `bio` (enlace del perfil) |
| `utm_campaign` | La campaña | `aaaa-mm_tema`, por ejemplo `2026-12_lanzamiento-concreto` |
| `utm_content` | Opcional: qué pieza | `video-1`, `historia-2`, `boton-pie` |

Reglas:

- Todo en **minúsculas**, sin tildes ni espacios (usar `-`). GA4 distingue
  `Instagram` de `instagram`.
- **Nunca** en enlaces internos del sitio: un UTM en un enlace interno inicia
  una sesión nueva y borra la fuente real.
- Nunca datos personales en un UTM (ni correo ni nombre).

Ejemplo: `https://<dominio>/cursos/concreto-basico?utm_source=instagram&utm_medium=social&utm_campaign=2026-12_lanzamiento-concreto&utm_content=historia-1`
