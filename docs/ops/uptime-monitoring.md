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
