'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');
const db = require('./database');
const engine = require('./conversation-engine');
const whatsapp = require('./whatsapp');

function loadEnvFile() {
  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const index = trimmed.indexOf('=');
    if (index < 1) continue;
    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnvFile();

const VERSION = '1.3.0';
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '127.0.0.1';
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const INDEX_FILE = path.join(PUBLIC_DIR, 'index.html');
const MAX_BODY = 1024 * 1024;

function json(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY'
  });
  res.end(body);
}

function text(res, status, body, contentType = 'text/plain; charset=utf-8') {
  const output = String(body ?? '');
  res.writeHead(status, {
    'Content-Type': contentType,
    'Content-Length': Buffer.byteLength(output),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY'
  });
  res.end(output);
}

function readJsonBody(req, includeRaw = false) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', chunk => {
      size += chunk.length;
      if (size > MAX_BODY) {
        reject(Object.assign(new Error('La solicitud excede 1 MB.'), { statusCode: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      const rawBody = Buffer.concat(chunks);
      if (!rawBody.length) return resolve(includeRaw ? { body: {}, rawBody } : {});
      try {
        const body = JSON.parse(rawBody.toString('utf8'));
        resolve(includeRaw ? { body, rawBody } : body);
      } catch (_) {
        reject(Object.assign(new Error('JSON inválido.'), { statusCode: 400 }));
      }
    });
    req.on('error', reject);
  });
}

function safePhone(value) {
  return String(value || '').replace(/[^0-9+]/g, '').slice(0, 25) || 'local-demo';
}

async function processIncoming({ phone, name = '', messageText, source = 'local', profileId = 'default', phoneNumberId = '' }) {
  const profile = db.getNumberProfileById(profileId);
  if (!profile || profile.enabled === false) throw new Error('El perfil de número indicado no está disponible.');
  const conversation = db.getOrCreateConversation(phone, name, { profileId: profile.id, phoneNumberId });
  db.appendMessage(conversation.id, { direction: 'inbound', source, text: messageText });
  const result = engine.buildReply({ message: messageText, knowledgeBase: profile.knowledgeBase });
  db.appendMessage(conversation.id, { direction: 'outbound', source: 'automation', text: result.text, intent: result.intent });
  return { conversationId: conversation.id, profileId: profile.id, reply: result.text, intent: result.intent };
}

function servePublicFile(res, filePath, contentType) {
  try {
    const body = fs.readFileSync(filePath);
    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': body.length,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY'
    });
    res.end(body);
  } catch (error) {
    text(res, 500, `No se pudo cargar el recurso: ${error.message}`);
  }
}

function serveIndex(res) {
  try {
    const body = fs.readFileSync(INDEX_FILE);
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Length': body.length,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY'
    });
    res.end(body);
  } catch (error) {
    text(res, 500, `No se pudo cargar el panel: ${error.message}`);
  }
}

async function handleWebhookPayload(payload) {
  const incoming = whatsapp.extractIncomingMessages(payload);
  for (const message of incoming) {
    if (!message.from || !whatsapp.isForConfiguredNumber(message.phoneNumberId)) continue;
    if (message.id && !db.markMessageProcessed(message.id)) continue;

    const profile = db.getNumberProfileByPhoneNumberId(message.phoneNumberId);
    if (!profile || profile.enabled === false) {
      console.error(`[WEBHOOK] No existe perfil activo para Phone Number ID ${message.phoneNumberId}`);
      continue;
    }

    try {
      if (message.unsupported) {
        const conversation = db.getOrCreateConversation(message.from, message.name, { profileId: profile.id, phoneNumberId: message.phoneNumberId });
        db.appendMessage(conversation.id, { direction: 'inbound', source: 'whatsapp', text: `[Mensaje ${message.type} no procesado]` });
        const reply = 'Este canal responde automáticamente únicamente mensajes de texto con la información registrada en JM Cruz L. Digital.';
        db.appendMessage(conversation.id, { direction: 'outbound', source: 'automation', text: reply, intent: 'unsupported_message' });
        await whatsapp.sendText({ to: message.from, text: reply, phoneNumberId: message.phoneNumberId });
        continue;
      }
      const result = await processIncoming({
        phone: message.from,
        name: message.name,
        messageText: message.text,
        source: 'whatsapp',
        profileId: profile.id,
        phoneNumberId: message.phoneNumberId
      });
      await whatsapp.sendText({ to: message.from, text: result.reply, phoneNumberId: message.phoneNumberId });
    } catch (error) {
      console.error('[WEBHOOK ERROR]', error.message);
    }
  }
}

const server = http.createServer(async (req, res) => {
  const requestUrl = new URL(req.url, `http://${req.headers.host || `${HOST}:${PORT}`}`);
  const pathname = requestUrl.pathname;

  try {
    if (req.method === 'GET' && pathname === '/health') {
      return json(res, 200, {
        ok: true,
        service: 'JM Cruz L. Digital WhatsApp Bot',
        version: VERSION,
        automaticOnly: true,
        multiNumber: true,
        whatsapp: whatsapp.configurationStatus(),
        numberProfiles: db.getNumberProfiles().map(({ knowledgeBase, ...profile }) => profile)
      });
    }

    if (req.method === 'GET' && pathname === '/api/dashboard') {
      return json(res, 200, {
        ok: true,
        version: VERSION,
        automaticOnly: true,
        multiNumber: true,
        stats: db.getStats(),
        whatsapp: whatsapp.configurationStatus(),
        numberProfiles: db.getNumberProfiles()
      });
    }

    if (req.method === 'GET' && pathname === '/api/number-profiles') return json(res, 200, { ok: true, data: db.getNumberProfiles() });

    if (req.method === 'PUT' && pathname === '/api/number-profiles') {
      const body = await readJsonBody(req);
      return json(res, 200, { ok: true, data: db.saveNumberProfiles(body) });
    }

    if (req.method === 'GET' && pathname === '/api/knowledge-base') {
      const profileId = String(requestUrl.searchParams.get('profileId') || 'default');
      return json(res, 200, { ok: true, data: db.getKnowledgeBase(profileId) });
    }

    if (req.method === 'PUT' && pathname === '/api/knowledge-base') {
      const body = await readJsonBody(req);
      const profileId = String(requestUrl.searchParams.get('profileId') || 'default');
      return json(res, 200, { ok: true, data: db.saveKnowledgeBase(body, profileId) });
    }

    if (req.method === 'GET' && pathname === '/api/conversations') return json(res, 200, { ok: true, data: db.listConversations() });

    if (req.method === 'POST' && pathname === '/api/simulate') {
      const body = await readJsonBody(req);
      const messageText = String(body.text || '').trim();
      if (!messageText) return json(res, 400, { ok: false, error: 'Escribe un mensaje para simular.' });
      const phone = safePhone(body.phone || '50200000000');
      const profileId = String(body.profileId || 'default');
      const profile = db.getNumberProfileById(profileId);
      if (!profile) return json(res, 404, { ok: false, error: 'Perfil de número no encontrado.' });
      const result = await processIncoming({
        phone,
        name: 'Cliente de prueba',
        messageText,
        source: 'simulator',
        profileId: profile.id,
        phoneNumberId: profile.phoneNumberId
      });
      return json(res, 200, { ok: true, data: result });
    }

    if (req.method === 'GET' && pathname === '/webhook/whatsapp') {
      const query = Object.fromEntries(requestUrl.searchParams.entries());
      const result = whatsapp.verifyWebhook({ query });
      return text(res, result.status, result.body);
    }

    if (req.method === 'POST' && pathname === '/webhook/whatsapp') {
      const { body, rawBody } = await readJsonBody(req, true);
      const signature = req.headers['x-hub-signature-256'];
      if (!whatsapp.verifyWebhookSignature({ rawBody, signature })) return text(res, 401, 'Firma de webhook inválida.');
      text(res, 200, 'EVENT_RECEIVED');
      setImmediate(() => handleWebhookPayload(body));
      return;
    }

    if (pathname.startsWith('/api/') || pathname.startsWith('/webhook/')) return json(res, 404, { ok: false, error: 'Ruta no encontrada.' });

    if (req.method === 'GET' && pathname === '/pages-engine.js') {
      return servePublicFile(res, path.join(PUBLIC_DIR, 'pages-engine.js'), 'application/javascript; charset=utf-8');
    }

    if (req.method === 'GET' || req.method === 'HEAD') {
      if (req.method === 'HEAD') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
        return res.end();
      }
      return serveIndex(res);
    }

    return json(res, 405, { ok: false, error: 'Método no permitido.' });
  } catch (error) {
    const status = Number(error.statusCode || (error.message === 'Conversación no encontrada.' ? 404 : 500));
    return json(res, status, { ok: false, error: error.message || 'Error interno.' });
  }
});

server.listen(PORT, HOST, () => {
  console.log('');
  console.log(`JM Cruz L. Digital — WhatsApp Bot V${VERSION}`);
  console.log(`Panel local: http://${HOST}:${PORT}`);
  console.log(`Modo WhatsApp: ${whatsapp.configurationStatus().mode}`);
  console.log(`Números configurados en Meta: ${whatsapp.configurationStatus().numberCount}`);
  console.log('Respuesta manual desde el sistema: deshabilitada');
  console.log('');
});
