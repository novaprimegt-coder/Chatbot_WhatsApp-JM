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
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnvFile();

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

function readJsonBody(req) {
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
      if (!chunks.length) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
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

async function processIncoming({ phone, name = '', messageText, source = 'local' }) {
  const conversation = db.getOrCreateConversation(phone, name);
  db.appendMessage(conversation.id, { direction: 'inbound', source, text: messageText });

  const current = db.getConversation(conversation.id);
  if (current.humanMode) {
    return { conversationId: conversation.id, humanMode: true, skippedAutomation: true, reply: null };
  }

  const result = engine.buildReply({ message: messageText, knowledgeBase: db.getKnowledgeBase() });
  if (result.requestHuman) db.setHumanMode(conversation.id, true);
  db.appendMessage(conversation.id, { direction: 'outbound', source: 'automation', text: result.text, intent: result.intent });

  return {
    conversationId: conversation.id,
    humanMode: Boolean(result.requestHuman),
    skippedAutomation: false,
    reply: result.text,
    intent: result.intent
  };
}

function routeParam(pathname, pattern) {
  const match = pathname.match(pattern);
  return match ? decodeURIComponent(match[1]) : null;
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
    if (!message.from) continue;
    try {
      if (message.unsupported) {
        const conversation = db.getOrCreateConversation(message.from, message.name);
        db.appendMessage(conversation.id, { direction: 'inbound', source: 'whatsapp', text: `[Mensaje ${message.type} no procesado en V1.0.0]` });
        const current = db.getConversation(conversation.id);
        if (!current.humanMode) {
          const reply = 'Por ahora puedo responder automáticamente mensajes de texto. Para este tipo de mensaje se requiere atención humana.';
          db.setHumanMode(conversation.id, true);
          db.appendMessage(conversation.id, { direction: 'outbound', source: 'automation', text: reply, intent: 'human_support' });
          await whatsapp.sendText({ to: message.from, text: reply });
        }
        continue;
      }

      const result = await processIncoming({ phone: message.from, name: message.name, messageText: message.text, source: 'whatsapp' });
      if (result.reply) await whatsapp.sendText({ to: message.from, text: result.reply });
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
      return json(res, 200, { ok: true, service: 'JM Cruz L. Digital WhatsApp Bot', version: '1.0.0', whatsapp: whatsapp.configurationStatus() });
    }

    if (req.method === 'GET' && pathname === '/api/dashboard') {
      return json(res, 200, {
        ok: true,
        version: '1.0.0',
        stats: db.getStats(),
        whatsapp: whatsapp.configurationStatus(),
        knowledgeBase: db.getKnowledgeBase()
      });
    }

    if (req.method === 'GET' && pathname === '/api/knowledge-base') {
      return json(res, 200, { ok: true, data: db.getKnowledgeBase() });
    }

    if (req.method === 'PUT' && pathname === '/api/knowledge-base') {
      const body = await readJsonBody(req);
      const saved = db.saveKnowledgeBase(body);
      return json(res, 200, { ok: true, data: saved });
    }

    if (req.method === 'GET' && pathname === '/api/conversations') {
      return json(res, 200, { ok: true, data: db.listConversations() });
    }

    const humanModeId = routeParam(pathname, /^\/api\/conversations\/([^/]+)\/human-mode$/);
    if (req.method === 'POST' && humanModeId) {
      const body = await readJsonBody(req);
      const conversation = db.setHumanMode(humanModeId, Boolean(body.humanMode));
      return json(res, 200, { ok: true, data: conversation });
    }

    if (req.method === 'POST' && pathname === '/api/simulate') {
      const body = await readJsonBody(req);
      const messageText = String(body.text || '').trim();
      if (!messageText) return json(res, 400, { ok: false, error: 'Escribe un mensaje para simular.' });
      const phone = safePhone(body.phone || '50200000000');
      const result = await processIncoming({ phone, name: 'Cliente de prueba', messageText, source: 'simulator' });
      return json(res, 200, { ok: true, data: result });
    }

    if (req.method === 'GET' && pathname === '/webhook/whatsapp') {
      const query = Object.fromEntries(requestUrl.searchParams.entries());
      const result = whatsapp.verifyWebhook({ query });
      return text(res, result.status, result.body);
    }

    if (req.method === 'POST' && pathname === '/webhook/whatsapp') {
      const payload = await readJsonBody(req);
      text(res, 200, 'EVENT_RECEIVED');
      setImmediate(() => handleWebhookPayload(payload));
      return;
    }

    if (pathname.startsWith('/api/') || pathname.startsWith('/webhook/')) {
      return json(res, 404, { ok: false, error: 'Ruta no encontrada.' });
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
  console.log('JM Cruz L. Digital — WhatsApp Bot V1.0.0');
  console.log(`Panel local: http://${HOST}:${PORT}`);
  console.log(`Modo WhatsApp: ${whatsapp.configurationStatus().mode}`);
  console.log('');
});
