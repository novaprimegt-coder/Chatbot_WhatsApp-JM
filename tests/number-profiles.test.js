'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const db = require('../server/database');
const engine = require('../server/conversation-engine');

const base = {business:{name:'JM',currency:'GTQ',welcomeMessage:'Hola'},products:[],paymentMethods:[],promotions:[],quickReplies:{}};

test('valida varios perfiles con Phone Number ID únicos', () => {
  const profiles = db.validateNumberProfiles({profiles:[
    {id:'ventas',label:'Ventas',displayPhone:'+502 1111 1111',phoneNumberId:'111',enabled:true,knowledgeBase:{...base,business:{...base.business,welcomeMessage:'Hola ventas'}}},
    {id:'info',label:'Información',displayPhone:'+502 2222 2222',phoneNumberId:'222',enabled:true,knowledgeBase:{...base,business:{...base.business,welcomeMessage:'Hola info'}}}
  ]});
  assert.equal(profiles.length, 2);
  assert.equal(profiles[0].phoneNumberId, '111');
  assert.equal(profiles[1].knowledgeBase.business.welcomeMessage, 'Hola info');
});

test('rechaza Phone Number ID duplicados', () => {
  assert.throws(() => db.validateNumberProfiles({profiles:[
    {id:'a',label:'A',phoneNumberId:'111',knowledgeBase:base},
    {id:'b',label:'B',phoneNumberId:'111',knowledgeBase:base}
  ]}), /duplicado/i);
});

test('cada perfil puede generar una respuesta distinta', () => {
  const a = engine.buildReply({message:'Hola',knowledgeBase:{...base,business:{...base.business,welcomeMessage:'Respuesta A'}}});
  const b = engine.buildReply({message:'Hola',knowledgeBase:{...base,business:{...base.business,welcomeMessage:'Respuesta B'}}});
  assert.equal(a.text,'Respuesta A');
  assert.equal(b.text,'Respuesta B');
});
