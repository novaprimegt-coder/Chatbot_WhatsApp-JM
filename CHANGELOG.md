# Historial de cambios — JM Cruz L. Digital WhatsApp Bot

## V1.3.0 — Soporte multi-número independiente

### Cambio solicitado
- El sistema deja de estar limitado a un único número de WhatsApp.
- Se pueden crear varios perfiles de números desde el panel.
- Cada perfil tiene nombre interno, número visible, Phone Number ID, estado y base de conocimiento propia.
- Productos, precios, disponibilidad, métodos de pago, promociones y textos automáticos quedan separados por número.
- El simulador permite probar individualmente el número/perfil seleccionado.
- Las conversaciones quedan asociadas al perfil que recibió o simuló el mensaje.

### Enrutamiento Meta
- El webhook usa `metadata.phone_number_id` para identificar qué número recibió el mensaje.
- El backend busca el perfil que corresponde a ese Phone Number ID.
- La respuesta se genera únicamente con la información configurada para ese perfil.
- La respuesta se envía usando el mismo Phone Number ID que recibió el mensaje.
- `WHATSAPP_NUMBERS_JSON` permite configurar varios Phone Number ID con sus Access Tokens privados.
- Se mantiene compatibilidad con las variables anteriores de un solo número.
- Se admite `META_APP_SECRETS_JSON` para validar firmas de más de una app si fuera necesario.

### Seguridad preservada
- Los Access Tokens y App Secrets no se guardan en el panel ni se publican en GitHub.
- Continúa prohibida la respuesta manual desde el sistema.
- Continúan las reglas de no inventar precios, disponibilidad, promociones, pagos o estados.
- Continúa la protección contra mensajes duplicados por `wamid`.

### Validación
- Se agregaron pruebas específicas de resolución multi-número, Phone Number ID duplicados y respuestas independientes por perfil.
- La batería local V1.3.0 aprueba 14/14 pruebas.

## V1.2.0 — GitHub Pages operativo

### Corrección solicitada
- Se eliminaron los bloqueos que deshabilitaban los controles en GitHub Pages.
- Productos, métodos de pago y promociones pueden agregarse, editarse y eliminarse desde la plataforma publicada.
- Guardar cambios funciona en GitHub Pages mediante almacenamiento local del navegador.
- El simulador funciona directamente en GitHub Pages usando el mismo motor determinista de conversación.
- Las conversaciones simuladas y estadísticas funcionan y se conservan en el dispositivo.
- Se añadieron validaciones de campos y número de prueba.
- Se mantiene la prohibición de respuesta manual.
- Se añadió `public/pages-engine.js` y prueba automatizada equivalente al motor del backend.

### Límite técnico preservado
- GitHub Pages continúa siendo alojamiento estático: la conexión real de WhatsApp requiere ejecutar el backend HTTPS para recibir webhooks y proteger credenciales.

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
