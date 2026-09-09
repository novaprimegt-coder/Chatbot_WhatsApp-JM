'use strict';
const assert = require('node:assert/strict');
const { buildReply, detectIntent } = require('../public/pages-engine.js');

const kb = {
  business: { name: 'JM Cruz L. Digital', currency: 'GTQ', welcomeMessage: 'Bienvenido', unknownMessage: 'Sin información' },
  products: [
    { id: 'spotify', name: 'Spotify', price: 34.99, available: true, description: '' },
    { id: 'netflix', name: 'Netflix', price: 50, available: false, description: '' }
  ],
  paymentMethods: [{ id: 'transfer', name: 'Transferencia', details: 'Cuenta registrada', enabled: true }],
  promotions: [{ id: 'promo', title: 'Oferta', description: 'Prueba', active: true }],
  quickReplies: {}
};

assert.equal(detectIntent('hola'), 'greeting');
assert.match(buildReply({ message: 'precio spotify', knowledgeBase: kb }).text, /Q34\.99/);
assert.match(buildReply({ message: 'quiero Netflix', knowledgeBase: kb }).text, /no disponible/i);
assert.match(buildReply({ message: 'como pago', knowledgeBase: kb }).text, /Transferencia/);
assert.match(buildReply({ message: 'promociones', knowledgeBase: kb }).text, /Oferta/);
assert.match(buildReply({ message: 'quiero hablar con una persona', knowledgeBase: kb }).text, /automática/i);
assert.equal(buildReply({ message: 'tema desconocido', knowledgeBase: kb }).text, 'Sin información');
console.log('pages-engine: 7/7 OK');
