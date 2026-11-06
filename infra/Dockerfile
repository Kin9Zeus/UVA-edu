# syntax=docker/dockerfile:1.7
#
# Construcción reproducible de U.V.A (fase 11.1 del plan de blindaje).
# La misma imagen corre en Railway, Render, Fly.io o un servidor propio: es
# el plan B si Railway falla o hay que salir de él (docs/ops/plan-b-despliegue.md).
#
# Va en infra/ y no en la raíz A PROPÓSITO: Railway usa solo un Dockerfile
# que encuentre en la raíz, y hoy construye con su propio sistema y arranca
# con `next start`. Pasar Railway a esta imagen es una decisión aparte.
#
# Construir (desde la raíz del repo):
#   docker build -f infra/Dockerfile \
#     --build-arg NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co \
#     --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=<llave anónima> \
#     --build-arg NEXT_PUBLIC_SITE_URL=https://<dominio> \
#     --build-arg NEXT_PUBLIC_SENTRY_DSN=<dsn> \
#     -t uva .
#
# Correr (los secretos llegan al arrancar, nunca en la imagen):
#   docker run --env-file <archivo con las variables del servidor> -p 3000:3000 uva
#
# Variables NEXT_PUBLIC_*: Next las escribe dentro del JavaScript durante el
# build, así que van como --build-arg. Todas son públicas (las ve cualquier
# navegador). Los secretos (llave maestra de Supabase, Mux, Resend, Gemini,
# ORIGEN_SECRETO…) NO van aquí: el build no los necesita.
#
# Imagen base fijada por digest (la misma en las tres etapas): una etiqueta
# (`22-bookworm-slim`) puede apuntar mañana a otra cosa. Dependabot
# (ecosistema docker) propone el digest nuevo.

# ---------- 1. Dependencias (exactas, del lockfile) ----------
FROM node:22-bookworm-slim@sha256:4b150b48b4116e2a22f2c39cc27025fbf4f153e2078fd3b14d159fdb5c7279da AS dependencias
WORKDIR /app
# `postinstall` corre `prisma generate`: necesita el esquema y su config.
COPY package.json package-lock.json prisma.config.ts ./
COPY prisma ./prisma
RUN npm ci --no-audit --no-fund

# ---------- 2. Build ----------
FROM node:22-bookworm-slim@sha256:4b150b48b4116e2a22f2c39cc27025fbf4f153e2078fd3b14d159fdb5c7279da AS build
WORKDIR /app
COPY --from=dependencias /app/node_modules ./node_modules
COPY . .
# El cliente de Prisma que generó `postinstall` en la etapa anterior. Está
# en .gitignore (no viene con el código) y `next build` revisa los tipos de
# prisma/seed.ts, que lo importa: sin esto el build normal falla. El modo
# `compile` del CI no revisa tipos y no lo notaría.
COPY --from=dependencias /app/src/generated ./src/generated

ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_SENTRY_DSN
ARG NEXT_PUBLIC_PRICING_ENABLED
ARG NEXT_PUBLIC_LEGAL_ENABLED
# Vacío es el build de verdad. El CI usa `compile` (compila todo pero
# no pre-genera páginas): no tiene la URL de Supabase y el sitemap se arma
# consultando la base. Una imagen para desplegar NUNCA va con `compile`.
ARG NEXT_BUILD_MODE=

ENV NEXT_OUTPUT=standalone \
    NEXT_TELEMETRY_DISABLED=1 \
    NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL} \
    NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY} \
    NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL} \
    NEXT_PUBLIC_SENTRY_DSN=${NEXT_PUBLIC_SENTRY_DSN} \
    NEXT_PUBLIC_PRICING_ENABLED=${NEXT_PUBLIC_PRICING_ENABLED} \
    NEXT_PUBLIC_LEGAL_ENABLED=${NEXT_PUBLIC_LEGAL_ENABLED}

# El token de Sentry (subir los source maps) es opcional y entra como secreto
# de BuildKit: existe solo durante este RUN y no queda en ninguna capa.
#   docker build --secret id=sentry_auth_token,env=SENTRY_AUTH_TOKEN ...
#
# `compile` se salta la revisión de tipos que sí hace el build normal: se
# corre a mano, para que el CI detecte lo que rompería la imagen de verdad
# (así se encontró que faltaba copiar src/generated).
RUN --mount=type=secret,id=sentry_auth_token \
    if [ -f /run/secrets/sentry_auth_token ]; then export SENTRY_AUTH_TOKEN="$(cat /run/secrets/sentry_auth_token)"; fi; \
    if [ "${NEXT_BUILD_MODE}" = "compile" ]; then \
      npx next typegen && npx tsc --noEmit && npx next build --experimental-build-mode=compile; \
    else \
      npx next build; \
    fi

# ---------- 3. Imagen final: solo lo que corre ----------
FROM node:22-bookworm-slim@sha256:4b150b48b4116e2a22f2c39cc27025fbf4f153e2078fd3b14d159fdb5c7279da AS app
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# `standalone` trae el servidor y solo los paquetes que usa (incluido sharp y
# las fuentes del certificado, ver outputFileTracingIncludes). Los archivos
# estáticos y public/ se copian aparte, como pide Next.
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public

# Sin root: si alguien llega a ejecutar código en el contenedor, no es dueño
# de él. `node` (uid 1000) ya existe en la imagen oficial.
USER node
EXPOSE 3000

# El chequeo de salud lo hace el proveedor contra /api/health (consulta
# Supabase de verdad), no Docker: un HEALTHCHECK aquí reiniciaría el
# contenedor cada vez que Supabase tarde, y eso no arregla nada.
CMD ["node", "server.js"]
