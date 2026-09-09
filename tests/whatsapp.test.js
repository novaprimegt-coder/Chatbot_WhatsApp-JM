'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const whatsapp = require('../server/whatsapp');

function withEnv(values, fn) {
  const previous = {};
  for (const [key, value] of Object.entries(values)) {
    previous[key] = process.env[key];
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
  try { return fn(); }
  finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
}

test('extrae mensajes con el Phone Number ID recibido', () => {
  const result = whatsapp.extractIncomingMessages({entry:[{changes:[{value:{metadata:{phone_number_id:'123456'},contacts:[{wa_id:'50255550000',profile:{name:'Cliente'}}],messages:[{id:'wamid.1',from:'50255550000',type:'text',text:{body:'Hola'}}]}}]}]});
  assert.equal(result.length, 1);
  assert.equal(result[0].phoneNumberId, '123456');
  assert.equal(result[0].from, '50255550000');
  assert.equal(result[0].text, 'Hola');
});

test('valida firma HMAC de Meta en modo live', () => withEnv({WHATSAPP_MODE:'live',META_APP_SECRET:'secret-test',META_APP_SECRETS_JSON:undefined}, () => {
  const rawBody = Buffer.from('{"object":"whatsapp_business_account"}');
  const signature = `sha256=${crypto.createHmac('sha256', 'secret-test').update(rawBody).digest('hex')}`;
  assert.equal(whatsapp.verifyWebhookSignature({ rawBody, signature }), true);
  assert.equal(whatsapp.verifyWebhookSignature({ rawBody, signature: 'sha256=incorrecta' }), false);
}));

test('mantiene compatibilidad con un solo número legado', () => withEnv({WHATSAPP_MODE:'live',WHATSAPP_NUMBERS_JSON:undefined,WHATSAPP_PHONE_NUMBER_ID:'111',WHATSAPP_ACCESS_TOKEN:'token'}, () => {
  assert.equal(whatsapp.isForConfiguredNumber('111'), true);
  assert.equal(whatsapp.isForConfiguredNumber('222'), false);
}));

test('acepta varios Phone Number ID y resuelve su token correcto', () => withEnv({
  WHATSAPP_MODE:'live',
  WHATSAPP_PHONE_NUMBER_ID:undefined,
  WHATSAPP_ACCESS_TOKEN:undefined,
  WHATSAPP_NUMBERS_JSON:JSON.stringify([
    {profileId:'ventas',phoneNumberId:'111',accessToken:'token-ventas'},
    {profileId:'soporte',phoneNumberId:'222',accessToken:'token-soporte'}
  ])
}, () => {
  assert.equal(whatsapp.isForConfiguredNumber('111'), true);
  assert.equal(whatsapp.isForConfiguredNumber('222'), true);
  assert.equal(whatsapp.isForConfiguredNumber('333'), false);
  assert.equal(whatsapp.resolveNumberConfig('111').profileId, 'ventas');
  assert.equal(whatsapp.resolveNumberConfig('222').accessToken, 'token-soporte');
}));

test('estado reporta cantidad de números configurados', () => withEnv({
  WHATSAPP_MODE:'live',META_GRAPH_VERSION:'v99.0',META_APP_SECRET:'secret',WHATSAPP_VERIFY_TOKEN:'verify',
  WHATSAPP_NUMBERS_JSON:JSON.stringify([{profileId:'a',phoneNumberId:'1',accessToken:'t1'},{profileId:'b',phoneNumberId:'2',accessToken:'t2'}])
}, () => {
  const status = whatsapp.configurationStatus();
  assert.equal(status.configured, true);
  assert.equal(status.numberCount, 2);
}));
