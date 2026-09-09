# JM Cruz L. Digital — WhatsApp Bot V1.2.0

Sistema de atención automática para el número oficial de WhatsApp que se conecte a JM Cruz L. Digital. El panel no permite responder manualmente a clientes: el sistema únicamente genera respuestas automáticas a partir de la información registrada.

## Qué incluye

- Panel administrativo HTML.
- Base de conocimiento editable desde el backend.
- Productos, precios, disponibilidad, métodos de pago y promociones controlados.
- Motor conversacional determinista: no inventa información externa.
- Historial de clientes, conversaciones y mensajes en modo solo lectura desde el panel.
- Simulador local para probar el mismo motor antes de conectar Meta.
- Webhook GET/POST preparado para WhatsApp Business Platform.
- Validación de firma HMAC `X-Hub-Signature-256` usando `META_APP_SECRET` en modo real.
- Filtro por `WHATSAPP_PHONE_NUMBER_ID`: el backend procesa únicamente eventos destinados al número configurado.
- Protección básica contra procesamiento duplicado de un mismo `wamid`.
- Envío de respuestas exclusivamente al remitente del mensaje entrante; no existe endpoint de respuesta manual.
- GitHub Pages preparado como vista pública del avance del panel.

## GitHub Pages operativo

En V1.2.0 el panel publicado en GitHub Pages permite editar productos, precios, disponibilidad, métodos de pago y promociones, guardar la configuración en el navegador y usar el simulador automático. Las conversaciones simuladas y estadísticas también se conservan localmente en el dispositivo. Esto no sustituye el backend HTTPS necesario para recibir webhooks reales de Meta.

## Regla funcional permanente de esta versión

El sistema **no tiene modo humano ni botón para responder al cliente**. Si alguien pide un asesor, el motor informa que ese número funciona con atención automática. Los problemas de pedido tampoco activan una conversación manual: solo se responde con la información segura registrada.

## Ejecutar el backend local

Requiere Node.js 18 o superior.

### Windows
Doble clic en `start-local.bat`.

### macOS / Linux

```bash
./start-local.sh
```

### Alternativa

```bash
npm start
```

Panel local: `http://127.0.0.1:3000`

## Variables necesarias para conectar Meta

Copia `.env.example` como `.env` y completa únicamente con los valores oficiales de tu cuenta:

- `META_GRAPH_VERSION`
- `META_APP_SECRET`
- `WHATSAPP_PHONE_NUMBER_ID`
- `WHATSAPP_ACCESS_TOKEN`
- `WHATSAPP_VERIFY_TOKEN`
- `WHATSAPP_MODE=live`

Las credenciales privadas nunca deben subirse al repositorio.

## GitHub y GitHub Pages

El código está alojado únicamente en `novaprimegt-coder/Chatbot_WhatsApp-JM` durante esta etapa. La raíz contiene `index.html` y `.nojekyll` para que GitHub Pages pueda mostrar la vista pública del panel desde `gh-pages/(root)`.

**Importante:** GitHub Pages es alojamiento estático. La V1.2.0 hace operativas las funciones del panel y el simulador directamente en el navegador, pero Pages no ejecuta `server/server.js`, no puede recibir el webhook real de Meta y no mantiene el bot activo 24/7. Para conectar el número de forma operativa hará falta, en la fase correspondiente, un entorno HTTPS que ejecute Node.js. El código de esa conexión ya queda preparado.

## Archivos principales

- `index.html`: entrada para GitHub Pages.
- `public/index.html`: panel HTML dual: backend real cuando existe API y panel operativo en GitHub Pages.
- `public/pages-engine.js`: motor conversacional usado directamente por el simulador en GitHub Pages.
- `server/server.js`: servidor, API y webhook.
- `server/whatsapp.js`: validación de Meta, filtro del número y envío automático.
- `server/conversation-engine.js`: detección de intención y respuestas controladas.
- `server/database.js`: persistencia local e idempotencia de mensajes.
- `data/knowledge-base.json`: fuente controlada inicial de información comercial.
- `data/store.json`: clientes, conversaciones, pedidos, auditoría e IDs procesados.
