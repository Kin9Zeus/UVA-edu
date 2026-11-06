# Chequeo de disponibilidad externo

`GET /api/health` (`src/app/api/health/route.ts`) confirma que Supabase
responde de verdad (no solo que el proceso de Next.js sigue arriba) y que
las variables de Mux/Resend existen. Devuelve `200` si todo está bien,
`503` si algo falla — sin autenticación, para que un monitor externo pueda
pegarle directo.

No manda alertas por sí solo: solo reporta el estado y, si falla, registra
el error en Sentry (`logError`, tag `area: health`). La alerta de "el sitio
cayó" la dispara el servicio externo que lo consulta.

## Cómo conectarlo (una sola vez, fuera de este repo)

1. Crear una cuenta en un servicio de uptime con plan gratuito —
   [UptimeRobot](https://uptimerobot.com) o
   [BetterStack/BetterUptime](https://betterstack.com/uptime) sirven igual
   para esto.
2. Agregar un monitor tipo "HTTP(s)" apuntando a
   `https://<dominio-de-producción>/api/health`, intervalo de 1-5 min.
3. Configurar la alerta para que dispare solo si el chequeo falla **N
   veces seguidas** (2-3), no en el primer fallo — un timeout de red
   aislado no debería despertar a nadie a las 3am (ver "umbral de ruido",
   Módulo 6).
4. Apuntar la notificación al canal que el equipo realmente mira (Slack,
   WhatsApp vía integración, o el que se decida en el Módulo 6) — no solo
   correo.

Esto es responsabilidad de quien tenga acceso a facturación/cuentas del
equipo; no se puede hacer desde el código ni desde esta sesión.

## Fase 10.4: el monitor pasa por Cloudflare

Cuando el dominio esté detrás de Cloudflare (fases 1 y 2), el monitor
apunta al **dominio**, no a `*.up.railway.app`. Así prueba el camino real de
un estudiante (DNS, Cloudflare, origen). Con el cierre de origen encendido,
la URL de Railway responde 403 a todo salvo `/api/health`, que queda
abierta para que este mismo monitor sirva de respaldo si Cloudflare falla.

Dos monitores, si el plan gratuito lo permite:

| Monitor | URL | Qué detecta |
| --- | --- | --- |
| Principal | `https://<dominio>/api/health` | Cualquier caída que vea un estudiante |
| Origen | `https://<servicio>.up.railway.app/api/health` | Si el principal cae y este no, el problema es Cloudflare o el DNS, no la app |

Que el monitor no mande la cabecera `X-Origen-Uva`: no la necesita y sería
otro lugar donde guardar el secreto.

## Estado (2026-11-06): hecho

- Monitor en **Better Stack** (Uptime): `https://beta.uvarq.com/api/health`,
  que pasa por Cloudflare (`cf-ray` en la respuesta). Cada 3 minutos,
  confirmación y recuperación de 3 minutos, verificación de SSL, aviso por
  correo al responsable de turno (hoy Miguel). "Send test alert" probado.
- **Sin monitor de origen** (`*.up.railway.app`) por decisión del equipo: los
  estudiantes no usan esa dirección y puede borrarse al terminar el paso a
  Cloudflare. Para diagnosticar a mano: si `beta.uvarq.com` cae, abrir la
  de Railway; si responde, el problema es Cloudflare o el DNS.
- Cuando la plataforma pase a `www.uvarq.com`, cambiar la URL del monitor.
- El plan gratis no revisa el vencimiento del dominio ni del certificado:
  `uvarq.com` vence el 2026-11-24 (renovación automática en GoDaddy).
