'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { detectIntent, buildReply } = require('../server/conversation-engine');

const kb = {
  business: { name: 'JM Cruz L. Digital', currency: 'GTQ', welcomeMessage: 'Bienvenido', humanMessage: 'Humano', unknownMessage: 'Sin datos' },
  products: [
    { id: 'spotify', name: 'Spotify', price: 34.99, available: true, description: '' },
    { id: 'netflix', name: 'Netflix', price: 50, available: false, description: '' }
  ],
  paymentMethods: [{ id: 'bank', name: 'Transferencia', details: 'Cuenta registrada', enabled: true }],
  promotions: [{ id: 'p1', title: 'Promo registrada', description: 'Detalle', active: true }],
  quickReplies: { noProducts: 'No products', noPaymentMethods: 'No payments' }
};

test('detecta intenciones principales', () => {
  assert.equal(detectIntent('Hola buenas tardes'), 'greeting');
  assert.equal(detectIntent('¿Cuánto cuesta Spotify?'), 'prices');
  assert.equal(detectIntent('Quiero hablar con una persona'), 'human_support');
});

test('precio sale únicamente de la base de conocimiento', () => {
  const result = buildReply({ message: 'Precio de Spotify', knowledgeBase: kb });
  assert.equal(result.intent, 'prices');
  assert.match(result.text, /Q34\.99/);
  assert.doesNotMatch(result.text, /Q99/);
});

test('no promete disponibilidad inexistente', () => {
  const result = buildReply({ message: 'Quiero comprar Netflix', knowledgeBase: kb });
  assert.equal(result.intent, 'purchase');
  assert.match(result.text, /no disponible/i);
});

test('problema de pedido deriva a modo humano', () => {
  const result = buildReply({ message: 'Tengo un problema con mi pedido', knowledgeBase: kb });
  assert.equal(result.requestHuman, true);
});

test('respuesta desconocida no inventa información', () => {
  const result = buildReply({ message: '¿Me regalas una cuenta premium vitalicia?', knowledgeBase: kb });
  assert.equal(result.intent, 'unknown');
  assert.equal(result.text, 'Sin datos');
});
