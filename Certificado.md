# PDF de certificado con código de verificación + página pública de validación

Estado: Sin empezar
Fase: Fase 5 — Certificados y correos transaccionales (https://app.notion.com/p/Fase-5-Certificados-y-correos-transaccionales-3b4ba9d6712e81d78544d5d5de7ce459?pvs=21)
Prioridad: Media
Responsable: JuanMiguel
Semana estimada: 5–9 sep

## Qué hay que entregar

El PDF del certificado, descargable, más una página pública donde cualquiera pueda verificar su autenticidad con el código.

## Requisitos de calidad (nivel senior)

- [ ] El PDF se genera **en el servidor**, no en el navegador. Un PDF generado en el cliente es manipulable antes de guardarse.
- [ ] Generar bajo demanda y cachear en Supabase Storage, o generar una sola vez al emitir. No regenerar en cada descarga.
- [ ] Tipografías embebidas en el PDF, o el diseño se rompe en otros equipos.
- [ ] El diseño debe llevar identidad de UVA. Este documento lo van a compartir en LinkedIn — es marketing gratuito y tiene que verse profesional.
- [ ] La página de verificación es **pública y sin sesión** (ese es el punto), pero solo muestra: nombre del estudiante, curso, fecha de emisión y validez. **Nunca** correo, identificador interno ni otros datos personales.
- [ ] Rate limiting en la página de verificación para impedir que alguien enumere códigos.
- [ ] URL de verificación corta y legible, impresa en el propio PDF (idealmente también como código QR).
- [ ] Un código inválido muestra "certificado no encontrado", sin filtrar si el formato era correcto.

## Definición de "terminado"

Se descarga un certificado, se abre en otro equipo sin las fuentes instaladas y se ve correcto; el código impreso lleva a la página de verificación y valida.
