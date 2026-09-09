# JM Cruz L. Digital — WhatsApp Bot V1.0.0

Primera versión funcional local del sistema de atención automática. No requiere instalar librerías externas: utiliza Node.js y módulos nativos.

## Qué incluye

- Panel administrativo HTML.
- Base de conocimiento editable desde el panel.
- Catálogo con precio y disponibilidad controlados.
- Métodos de pago y promociones controladas.
- Motor conversacional determinista para las intenciones principales.
- Clientes, conversaciones y mensajes persistidos localmente.
- Modo humano por conversación.
- Simulador local que usa el mismo motor de conversación.
- Webhook GET/POST preparado para WhatsApp Business Platform.
- Módulo de envío oficial preparado, pero desactivado por defecto.
- Reglas para no inventar precios/disponibilidad ni confirmar pagos automáticamente.
- Pruebas automáticas básicas del motor.

## Ejecutar sin editar código

### Windows
Doble clic en `start-local.bat`.

### macOS / Linux
En una terminal dentro de la carpeta:

```bash
./start-local.sh
```

### Alternativa universal

```bash
npm start
```

Luego abre: `http://127.0.0.1:3000`

## Estado de WhatsApp real

V1.0.0 inicia con `WHATSAPP_MODE=mock`, por lo que no necesita credenciales y no envía mensajes reales.

La conexión real se activará en una fase posterior mediante variables privadas de entorno. Esas credenciales nunca deben escribirse dentro de `index.html` ni publicarse en GitHub.

## Archivos principales

- `public/index.html`: panel administrativo HTML.
- `server/server.js`: servidor y API local.
- `server/whatsapp.js`: webhook y envío a WhatsApp.
- `server/conversation-engine.js`: detección de intención y respuestas seguras.
- `server/database.js`: persistencia local.
- `data/knowledge-base.json`: información controlada del negocio.
- `data/store.json`: clientes, conversaciones, pedidos y auditoría.

## Alcance exacto de V1.0.0

Esta versión es la base local y su código fuente ya está publicado en el repositorio autorizado `novaprimegt-coder/Chatbot_WhatsApp-JM`. No conecta todavía cuentas reales de Meta, no usa Supabase y no ejecuta despliegue 24/7. Esos pasos requieren autorización y configuración posteriores.
