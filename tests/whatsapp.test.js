'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const whatsapp = require('../server/whatsapp');

test('extrae mensajes únicamente con el Phone Number ID recibido', () => {
  const result = whatsapp.extractIncomingMessages({
    entry: [{ changes: [{ value: {
      metadata: { phone_number_id: '123456' },
      contacts: [{ wa_id: '50255550000', profile: { name: 'Cliente' } }],
      messages: [{ id: 'wamid.1', from: '50255550000', type: 'text', text: { body: 'Hola' } }]
    } }] }]
  });
  assert.equal(result.length, 1);
  assert.equal(result[0].phoneNumberId, '123456');
  assert.equal(result[0].from, '50255550000');
  assert.equal(result[0].text, 'Hola');
});

test('valida firma HMAC de Meta en modo live', () => {
  const previousMode = process.env.WHATSAPP_MODE;
  const previousSecret = process.env.META_APP_SECRET;
  process.env.WHATSAPP_MODE = 'live';
  process.env.META_APP_SECRET = 'secret-test';
  const rawBody = Buffer.from('{"object":"whatsapp_business_account"}');
  const signature = `sha256=${crypto.createHmac('sha256', 'secret-test').update(rawBody).digest('hex')}`;
  assert.equal(whatsapp.verifyWebhookSignature({ rawBody, signature }), true);
  assert.equal(whatsapp.verifyWebhookSignature({ rawBody, signature: 'sha256=incorrecta' }), false);
  if (previousMode === undefined) delete process.env.WHATSAPP_MODE; else process.env.WHATSAPP_MODE = previousMode;
  if (previousSecret === undefined) delete process.env.META_APP_SECRET; else process.env.META_APP_SECRET = previousSecret;
});

test('en modo live rechaza eventos destinados a otro número', () => {
  const previousMode = process.env.WHATSAPP_MODE;
  const previousPhone = process.env.WHATSAPP_PHONE_NUMBER_ID;
  process.env.WHATSAPP_MODE = 'live';
  process.env.WHATSAPP_PHONE_NUMBER_ID = '111';
  assert.equal(whatsapp.isForConfiguredNumber('111'), true);
  assert.equal(whatsapp.isForConfiguredNumber('222'), false);
  if (previousMode === undefined) delete process.env.WHATSAPP_MODE; else process.env.WHATSAPP_MODE = previousMode;
  if (previousPhone === undefined) delete process.env.WHATSAPP_PHONE_NUMBER_ID; else process.env.WHATSAPP_PHONE_NUMBER_ID = previousPhone;
});
