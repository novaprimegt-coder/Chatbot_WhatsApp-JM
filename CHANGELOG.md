# Historial de cambios — JM Cruz L. Digital WhatsApp Bot

## V1.0.0 — Base local inicial

### Implementado
- Arquitectura separada: HTML + backend + motor conversacional + almacenamiento + módulo WhatsApp.
- Panel administrativo HTML para datos controlados.
- Productos: nombre, precio, disponibilidad y descripción.
- Métodos de pago editables.
- Promociones editables.
- Simulador local de mensajes.
- Persistencia de clientes y conversaciones.
- Pausa de automatización por conversación (modo humano).
- Webhook oficial preparado.
- Envío real encapsulado y desactivado por defecto.

### Reglas de seguridad incorporadas
- No inventar precios.
- No inventar disponibilidad.
- No confirmar pagos por texto o comprobante sin validación registrada.
- No prometer producto marcado como no disponible.
- Problemas de pedido pasan a modo humano.
- Mensajes no textuales pasan a modo humano en esta versión.

### Fuera de alcance de V1.0.0
- Credenciales reales de Meta.
- Autenticación del panel para Internet.
- Supabase.
- GitHub.
- Integración con tienda central.
- Validación automatizada de pagos.
- Pedidos transaccionales completos.
