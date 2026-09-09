# JM Cruz L. Digital — WhatsApp Bot V1.3.0

Sistema de atención automática multi-número para WhatsApp de JM Cruz L. Digital. El panel no permite responder manualmente a clientes: cada número conectado responde automáticamente con la información configurada exclusivamente para ese perfil.

## Qué incluye

- Panel administrativo HTML.
- Soporte para varios números de WhatsApp en una misma instalación.
- Perfil independiente por número: nombre interno, número visible, Phone Number ID, estado y base de conocimiento propia.
- Productos, precios, disponibilidad, métodos de pago, promociones y textos automáticos independientes por número.
- Motor conversacional determinista: no inventa información externa.
- Historial de conversaciones separado por perfil/número.
- Simulador que prueba la configuración del número seleccionado.
- Webhook GET/POST preparado para WhatsApp Business Platform.
- Enrutamiento por `metadata.phone_number_id`: cada mensaje entra al perfil correcto.
- Envío por el mismo Phone Number ID que recibió el mensaje.
- Soporte de varios Access Tokens mediante `WHATSAPP_NUMBERS_JSON`.
- Validación HMAC de Meta mediante `META_APP_SECRET` o varios secretos con `META_APP_SECRETS_JSON`.
- Protección contra procesamiento duplicado de un mismo `wamid`.
- Sin endpoint ni botón de respuesta manual.

## GitHub Pages operativo

En GitHub Pages se pueden crear varios perfiles de números, cambiar entre ellos, configurar respuestas diferentes y probar cada perfil con el simulador. Esa configuración se conserva localmente en el navegador durante esta etapa.

GitHub Pages continúa siendo alojamiento estático: no ejecuta el backend ni puede guardar Access Tokens de forma segura. La conexión real de los números requiere ejecutar `server/server.js` en un backend HTTPS.

## Cómo se conectan varios números

Cada perfil configurado en el panel tiene un `phoneNumberId` de Meta. En el backend privado, `WHATSAPP_NUMBERS_JSON` vincula ese Phone Number ID con su Access Token. Ejemplo conceptual:

```text
WHATSAPP_NUMBERS_JSON=[{"profileId":"default","phoneNumberId":"ID_1","accessToken":"TOKEN_1"},{"profileId":"number-2","phoneNumberId":"ID_2","accessToken":"TOKEN_2"}]
```

Los tokens reales nunca deben subirse a GitHub.

Cuando Meta envía un webhook, el sistema lee `metadata.phone_number_id`, localiza el perfil correspondiente, usa exclusivamente la base de conocimiento de ese perfil y responde desde ese mismo número.

## Regla funcional permanente

El sistema es **solo automático**. No tiene modo humano ni botón para responder al cliente. Cada número responde únicamente con su configuración registrada.

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

Copia `.env.example` como `.env` en el servidor privado y completa:

- `META_GRAPH_VERSION`
- `META_APP_SECRET` o `META_APP_SECRETS_JSON`
- `WHATSAPP_VERIFY_TOKEN`
- `WHATSAPP_NUMBERS_JSON`
- `WHATSAPP_MODE=live`

La configuración anterior de un solo número con `WHATSAPP_PHONE_NUMBER_ID` y `WHATSAPP_ACCESS_TOKEN` sigue siendo compatible.

## Archivos principales

- `index.html`: entrada para GitHub Pages.
- `public/index.html`: panel HTML multi-número.
- `public/pages-engine.js`: motor conversacional usado por el simulador en GitHub Pages.
- `server/server.js`: servidor, API, simulación y webhook multi-número.
- `server/whatsapp.js`: configuración Meta, resolución de números y envío automático.
- `server/conversation-engine.js`: detección de intención y respuestas controladas.
- `server/database.js`: persistencia, perfiles de números, conversaciones e idempotencia.
- `data/number-profiles.json`: perfiles y base de conocimiento independiente de cada número.
- `data/knowledge-base.json`: compatibilidad con la base inicial anterior.
- `data/store.json`: clientes, conversaciones, pedidos, auditoría e IDs procesados.
