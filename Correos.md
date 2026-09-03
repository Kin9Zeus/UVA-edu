# Correos: verificación, bienvenida tras canje, recuperación y certificado

Estado: En curso
Fase: Fase 5 — Certificados y correos transaccionales (https://app.notion.com/p/Fase-5-Certificados-y-correos-transaccionales-3b4ba9d6712e81d78544d5d5de7ce459?pvs=21)
Prioridad: Media
Responsable: Andres Felipe Escobar Duque
Semana estimada: 5–9 sep

## Qué hay que entregar

Los correos transaccionales del MVP, con plantillas propias de UVA.

## Correos necesarios (ajustados al modelo de cupos gratuitos)

1. **Verificación de correo** al registrarse.
2. **Bienvenida** tras canjear el código — el más importante: es el primer contacto con los invitados.
3. **Recuperación de contraseña**.
4. **Certificado emitido** con enlace de descarga.

> El "recibo de pago" del plan original **no aplica** en este MVP, porque no hay cobro.

## Requisitos de calidad (nivel senior)

- [ ] El envío se hace desde el servidor, con la clave de Resend fuera del bundle del cliente.
- [ ] Los correos se envían de forma asíncrona. Un fallo de Resend nunca debe romper el registro del usuario.
- [ ] Reintentos ante fallo y registro de correos enviados y rebotados.
- [ ] Plantillas con HTML compatible (tablas, estilos en línea). Los clientes de correo no soportan CSS moderno.
- [ ] Versión en texto plano de cada correo — sin ella, aumenta la probabilidad de caer en spam.
- [ ] Enlaces con token de un solo uso y expiración corta para verificación y recuperación.
- [ ] Todo en español, con el tono de UVA, y con datos de contacto reales al pie.
- [ ] Probar en Gmail, Outlook y móvil antes de dar por terminada la tarea.

## Definición de "terminado"

Los cuatro correos llegan a bandeja de entrada (no spam) en Gmail y Outlook, se ven correctos en móvil, y sus enlaces funcionan.
