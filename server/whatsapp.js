'use strict';

const https = require('https');
const crypto = require('crypto');

function getMode() {
  return String(process.env.WHATSAPP_MODE || 'mock').toLowerCase();
}

function parseJsonArray(value) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(String(value));
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

function getConfiguredNumbers() {
  const multi = parseJsonArray(process.env.WHATSAPP_NUMBERS_JSON)
    .map((item, index) => ({
      profileId: String(item?.profileId || `number-${index + 1}`).trim(),
      phoneNumberId: String(item?.phoneNumberId || '').trim(),
      accessToken: String(item?.accessToken || '').trim()
    }))
    .filter(item => item.phoneNumberId && item.accessToken);

  if (multi.length) return multi;

  const legacyPhoneNumberId = String(process.env.WHATSAPP_PHONE_NUMBER_ID || '').trim();
  const legacyAccessToken = String(process.env.WHATSAPP_ACCESS_TOKEN || '').trim();
  if (legacyPhoneNumberId && legacyAccessToken) {
    return [{ profileId: 'default', phoneNumberId: legacyPhoneNumberId, accessToken: legacyAccessToken }];
  }

  return [];
}

function getAppSecrets() {
  const fromJson = parseJsonArray(process.env.META_APP_SECRETS_JSON)
    .map(value => String(value || '').trim())
    .filter(Boolean);
  const legacy = String(process.env.META_APP_SECRET || '').trim();
  return [...new Set([...fromJson, legacy].filter(Boolean))];
}

function configurationStatus() {
  const missing = [];
  if (!process.env.META_GRAPH_VERSION) missing.push('META_GRAPH_VERSION');
  if (!process.env.WHATSAPP_VERIFY_TOKEN) missing.push('WHATSAPP_VERIFY_TOKEN');
  if (!getAppSecrets().length) missing.push('META_APP_SECRET o META_APP_SECRETS_JSON');
  const numbers = getConfiguredNumbers();
  if (!numbers.length) missing.push('WHATSAPP_NUMBERS_JSON');

  return {
    mode: getMode(),
    configured: missing.length === 0,
    missing,
    configuredNumbers: numbers.map(item => ({ profileId: item.profileId, phoneNumberId: item.phoneNumberId })),
    numberCount: numbers.length
  };
}

function verifyWebhook({ query }) {
  const mode = query['hub.mode'];
  const token = query['hub.verify_token'];
  const challenge = query['hub.challenge'];
  const expected = process.env.WHATSAPP_VERIFY_TOKEN;

  if (!expected) return { ok: false, status: 503, body: 'WHATSAPP_VERIFY_TOKEN no configurado.' };
  if (mode === 'subscribe' && token === expected) return { ok: true, status: 200, body: challenge };
  return { ok: false, status: 403, body: 'Verificación rechazada.' };
}

function verifyWebhookSignature({ rawBody, signature }) {
  if (getMode() !== 'live') return true;
  if (!signature || !Buffer.isBuffer(rawBody)) return false;
  const provided = String(signature);

  for (const secret of getAppSecrets()) {
    const expected = `sha256=${crypto.createHmac('sha256', secret).update(rawBody).digest('hex')}`;
    if (provided.length !== expected.length) continue;
    if (crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(expected))) return true;
  }
  return false;
}

function resolveNumberConfig(phoneNumberId) {
  const normalized = String(phoneNumberId || '').trim();
  if (!normalized) return null;
  return getConfiguredNumbers().find(item => item.phoneNumberId === normalized) || null;
}

function isForConfiguredNumber(phoneNumberId) {
  if (getMode() !== 'live') return true;
  return Boolean(resolveNumberConfig(phoneNumberId));
}

function extractIncomingMessages(payload) {
  const results = [];
  const entries = Array.isArray(payload?.entry) ? payload.entry : [];
  for (const entry of entries) {
    const changes = Array.isArray(entry?.changes) ? entry.changes : [];
    for (const change of changes) {
      const value = change?.value || {};
      const phoneNumberId = value?.metadata?.phone_number_id || '';
      const contacts = Array.isArray(value.contacts) ? value.contacts : [];
      const messages = Array.isArray(value.messages) ? value.messages : [];
      for (const message of messages) {
        const contact = contacts.find(item => item.wa_id === message.from) || contacts[0] || {};
        if (message.type !== 'text') {
          results.push({
            id: message.id || '',
            from: message.from || '',
            name: contact?.profile?.name || '',
            phoneNumberId,
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
          phoneNumberId,
          type: 'text',
          text: message?.text?.body || '',
          unsupported: false
        });
      }
    }
  }
  return results;
}

function sendText({ to, text, phoneNumberId }) {
  const mode = getMode();
  if (mode !== 'live') {
    console.log(`[WHATSAPP MOCK ${phoneNumberId || 'sin-id'}] -> ${to}: ${text}`);
    return Promise.resolve({ mock: true, to, text, phoneNumberId: phoneNumberId || '' });
  }

  const status = configurationStatus();
  if (!status.configured) {
    return Promise.reject(new Error(`Configuración de WhatsApp incompleta: ${status.missing.join(', ')}`));
  }

  const numberConfig = resolveNumberConfig(phoneNumberId);
  if (!numberConfig) {
    return Promise.reject(new Error(`Phone Number ID no configurado: ${phoneNumberId || '(vacío)'}`));
  }

  const version = process.env.META_GRAPH_VERSION;
  const token = numberConfig.accessToken;
  const body = JSON.stringify({
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'text',
    text: { body: text }
  });

  return new Promise((resolve, reject) => {
    const request = https.request({
      hostname: 'graph.facebook.com',
      path: `/${version}/${numberConfig.phoneNumberId}/messages`,
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

module.exports = {
  configurationStatus,
  getConfiguredNumbers,
  getAppSecrets,
  resolveNumberConfig,
  verifyWebhook,
  verifyWebhookSignature,
  isForConfiguredNumber,
  extractIncomingMessages,
  sendText
};
