# Revisión mensual de seguridad

Una vez al mes, el primer lunes. Toma unos 45 minutos. Lo que no se revisa
se apaga sin que nadie lo note: una alerta que dejó de llegar, un respaldo
que lleva semanas fallando, una llave trampa que nadie mira.

Cada revisión se anota en la tabla del final.

## 1. Llaves trampa (fase 10.5)

Una llave trampa es una credencial falsa puesta donde un intruso la
buscaría (un `.env` viejo, el gestor de contraseñas, una nota). Nadie la usa
de verdad: si alguien la usa, avisa. Es la forma más barata de enterarse de
que alguien entró.

**Estado: creadas en la fase E** (llaves AWS señuelo, octubre de 2026). Son
credenciales de AWS falsas: no abren nada, pero si alguien intenta usarlas,
el servicio que las generó avisa. Van **sin sellar** a propósito: un intruso
que mire las variables tiene que verlas y caer. El sufijo `_BACKUP` la hace
parecer una llave de respaldos, y ninguna librería la toma sola (no son los
nombres estándar de AWS): la app nunca la usa por accidente.

| Llave trampa | Dónde está | Creada | El aviso va a |
| --- | --- | --- | --- |
| Llave AWS señuelo (par ID + secreta) | Variables de Railway, servicio de la app, sin sellar, como `AWS_ACCESS_KEY_ID_BACKUP` y `AWS_SECRET_ACCESS_KEY_BACKUP` | Fase E (octubre 2026) | Aleck |
| La misma llave, copia local | `.env.local` y `.env.produccion.local` de quien corre scripts, con los mismos nombres | Fase E | Aleck |

**Pendiente:** confirmar que el aviso llega. Nunca se probó (Cerebro,
"Hallazgos abiertos"). Prueba segura: desde un computador cualquiera, con
la AWS CLI, `aws sts get-caller-identity` usando esa llave (en las
variables estándar `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` de esa
terminal, no del proyecto). Debe fallar, y a los pocos minutos Aleck recibe
el aviso. Anotar aquí la fecha.

Mejora sugerida: que el aviso llegue también al canal del equipo
(`canal-alertas.md`), no solo a una persona.

Cada mes: abrir la página de cada una (el enlace llega en el correo de
creación) y confirmar que **sigue activa y sin disparos**. Un disparo es un
incidente: seguir `respuesta-a-incidentes.md`.

## 2. Respaldos (fase 11.3)

- [ ] El workflow "Respaldo propio de la base" corrió en verde los últimos
      7 días, y el bucket tiene los archivos.
- [ ] **Restaurar el último en staging** (`respaldos-y-restauracion.md`,
      Parte D) y anotar el resultado allá.

## 3. Alertas

- [ ] Sentry: las reglas de `canal-alertas.md` siguen activas y la última
      alerta llegó al canal. Si no hubo ninguna en el mes, mandar una de
      prueba.
- [ ] Monitor de disponibilidad: sigue activo y su último aviso llegó.
- [ ] Registros externos (cuando existan, fase 10.1): llegan líneas
      `"tipo":"seguridad"` de los últimos días.

## 4. Dependencias y código

- [ ] Dependabot: ningún PR de seguridad abierto más allá del plazo de
      `respuesta-a-incidentes.md` (48 horas si es crítica, 7 días si es
      alta).
- [ ] CodeQL (Security → Code scanning): ningún hallazgo nuevo sin revisar.
- [ ] El job `imagen` del CI está en verde. Sin eso, el plan B no funciona.
- [ ] ¿Se cerró el bug de Vector con R2 ([#23029](https://github.com/vectordotdev/vector/issues/23029))? Si sí, subir Vector desde 0.45.0 (`infra/vector/Dockerfile`) y comprobar que llega un archivo a R2.
- [ ] R2 `uva-registros`: hay archivos de los últimos días en `registros/`.

## 5. Accesos

- [ ] ¿Sobra alguien en Railway, Supabase, GitHub, Sentry, Mux, Resend o
      Cloudflare? (`salida-de-miembro-y-cambio-de-llaves.md`).
- [ ] Administradores de la plataforma (/admin/usuarios): ¿todos tienen la
      verificación en dos pasos y todos siguen en el equipo?

## Registro

| Fecha | Quién | ¿Todo bien? | Qué se encontró |
| --- | --- | --- | --- |
| | | | |
