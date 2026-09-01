# Configurar autenticación de dominio (SPF, DKIM, DMARC)

Estado: En curso
Fase: Fase 5 — Certificados y correos transaccionales (https://app.notion.com/p/Fase-5-Certificados-y-correos-transaccionales-3b4ba9d6712e81d78544d5d5de7ce459?pvs=21)
Prioridad: Media
Responsable: JuanMiguel
Semana estimada: 5–9 sep

## Qué hay que entregar

El dominio de UVA configurado para enviar correo de forma autenticada, de modo que los mensajes lleguen a bandeja de entrada y no a spam.

## Por qué es crítico en este MVP

Los invitados del cupo gratuito reciben su código y su bienvenida por correo. Si esos correos caen en spam, el lanzamiento fracasa aunque la plataforma funcione perfecto. **Esta tarea tiene dependencia externa: la propagación DNS tarda horas.** No dejarla para el 11 de septiembre.

## Alcance

- **SPF** — registro TXT que autoriza a Resend a enviar en nombre del dominio.
- **DKIM** — firma criptográfica de los mensajes, con las claves que entrega Resend.
- **DMARC** — política de qué hacer con el correo que falle las validaciones anteriores.
- Subdominio de envío dedicado (por ejemplo `mail.uvarq.com` o `correo.uvarq.com`).

## Requisitos de calidad (nivel senior)

- [ ] Usar un **subdominio dedicado** para envíos transaccionales, nunca el dominio raíz. Así, si la reputación de envío se daña, no arrastra al correo corporativo de UVA.
- [ ] Un solo registro SPF por dominio. Dos registros SPF invalidan ambos — error muy común.
- [ ] DMARC arranca en `p=none` con reportes activados, se observa unos días, y solo entonces se endurece a `p=quarantine`. Empezar en `p=reject` puede bloquear correo legítimo el día del lanzamiento.
- [ ] La dirección remitente debe ser una real y monitoreada. Nada de `noreply@`: si un invitado responde pidiendo ayuda, alguien tiene que leerlo.
- [ ] Verificar el resultado con una herramienta de diagnóstico de entregabilidad antes de dar por cerrada la tarea.
- [ ] Documentar los registros DNS en el repositorio, para que no se pierdan si cambia quien administra el dominio.

## Definición de "terminado"

Un correo enviado desde staging a cuentas de Gmail, Outlook y un correo corporativo llega a bandeja de entrada, y el análisis del encabezado muestra SPF, DKIM y DMARC en `pass`.
