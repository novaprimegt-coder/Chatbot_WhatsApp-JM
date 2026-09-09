# Historial de cambios — JM Cruz L. Digital WhatsApp Bot

## V1.1.0 — Automatización exclusiva + preparación de conexión

### Cambio solicitado
- Eliminado el modo humano de la lógica, API y panel.
- Eliminados los controles para pausar automatización o pasar conversaciones a una persona.
- Conversaciones visibles únicamente como historial; el panel no permite responder manualmente.
- Solicitudes de asesor/persona reciben una respuesta automática que explica el alcance del canal.
- Problemas de pedido permanecen en automatización y nunca habilitan respuesta manual.

### Preparación para conectar un único número oficial
- Validación de firma `X-Hub-Signature-256` en modo `live` mediante `META_APP_SECRET`.
- Filtrado de eventos por `WHATSAPP_PHONE_NUMBER_ID`.
- Se ignoran eventos dirigidos a otro Phone Number ID.
- Registro de IDs de mensajes procesados para evitar respuestas duplicadas ante reintentos del webhook.
- El envío sigue ocurriendo únicamente como respuesta automática al número remitente del mensaje entrante.

### GitHub Pages
- Añadido `index.html` en la raíz.
- Añadido `.nojekyll`.
- `public/index.html` detecta GitHub Pages y muestra una vista pública de solo lectura del avance sin fingir que el backend está ejecutándose.

### Seguridad preservada
- No inventar precios, disponibilidad o promociones.
- No confirmar pagos por texto o comprobantes sin validación registrada.
- No prometer productos no disponibles.
- Credenciales privadas continúan fuera del repositorio mediante `.env`.

## V1.0.0 — Base local inicial

### Implementado
- Arquitectura separada: HTML + backend + motor conversacional + almacenamiento + módulo WhatsApp.
- Panel administrativo HTML para datos controlados.
- Productos, métodos de pago, promociones y simulador local.
- Persistencia de clientes y conversaciones.
- Webhook oficial preparado y envío real encapsulado en modo `mock` por defecto.

### Sustituido en V1.1.0
- El antiguo modo humano fue eliminado por requerimiento funcional: el sistema pasa a ser exclusivamente automático.
