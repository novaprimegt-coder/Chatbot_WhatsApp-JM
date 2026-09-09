'use strict';

const https = require('https');

function getMode() {
  return String(process.env.WHATSAPP_MODE || 'mock').toLowerCase();
}

function configurationStatus() {
  const required = ['META_GRAPH_VERSION', 'WHATSAPP_PHONE_NUMBER_ID', 'WHATSAPP_ACCESS_TOKEN', 'WHATSAPP_VERIFY_TOKEN'];
  const missing = required.filter(key => !process.env[key]);
  return {
    mode: getMode(),
    configured: missing.length === 0,
    missing
  };
}

function verifyWebhook(req) {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  const expected = process.env.WHATSAPP_VERIFY_TOKEN;

  if (!expected) return { ok: false, status: 503, body: 'WHATSAPP_VERIFY_TOKEN no configurado.' };
  if (mode === 'subscribe' && token === expected) return { ok: true, status: 200, body: challenge };
  return { ok: false, status: 403, body: 'Verificación rechazada.' };
}

function extractIncomingMessages(payload) {
  const results = [];
  const entries = Array.isArray(payload?.entry) ? payload.entry : [];
  for (const entry of entries) {
    const changes = Array.isArray(entry?.changes) ? entry.changes : [];
    for (const change of changes) {
      const value = change?.value || {};
      const contacts = Array.isArray(value.contacts) ? value.contacts : [];
      const messages = Array.isArray(value.messages) ? value.messages : [];
      for (const message of messages) {
        const contact = contacts.find(item => item.wa_id === message.from) || contacts[0] || {};
        if (message.type !== 'text') {
          results.push({
            id: message.id || '',
            from: message.from || '',
            name: contact?.profile?.name || '',
            type: message.type || 'unknown',
            text: '',
            unsupported: true
          });
          continue;
        }
        results.push({
          id: message.id || '',
          from: message.from || '',
          name: contact?.profile?.name || '',
          type: 'text',
          text: message?.text?.body || '',
          unsupported: false
        });
      }
    }
  }
  return results;
}

function sendText({ to, text }) {
  const mode = getMode();
  if (mode !== 'live') {
    console.log(`[WHATSAPP MOCK] -> ${to}: ${text}`);
    return Promise.resolve({ mock: true, to, text });
  }

  const status = configurationStatus();
  if (!status.configured) {
    return Promise.reject(new Error(`Configuración de WhatsApp incompleta: ${status.missing.join(', ')}`));
  }

  const version = process.env.META_GRAPH_VERSION;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const body = JSON.stringify({ messaging_product: 'whatsapp', recipient_type: 'individual', to, type: 'text', text: { body: text } });

  return new Promise((resolve, reject) => {
    const request = https.request({
      hostname: 'graph.facebook.com',
      path: `/${version}/${phoneNumberId}/messages`,
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    }, response => {
      let data = '';
      response.on('data', chunk => { data += chunk; });
      response.on('end', () => {
        let parsed = data;
        try { parsed = data ? JSON.parse(data) : {}; } catch (_) {}
        if (response.statusCode >= 200 && response.statusCode < 300) resolve(parsed);
        else reject(new Error(`WhatsApp API ${response.statusCode}: ${typeof parsed === 'string' ? parsed : JSON.stringify(parsed)}`));
      });
    });
    request.on('error', reject);
    request.write(body);
    request.end();
  });
}

module.exports = { configurationStatus, verifyWebhook, extractIncomingMessages, sendText };
