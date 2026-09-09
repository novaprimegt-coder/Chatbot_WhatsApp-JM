'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, '..', 'data');
const STORE_FILE = path.join(DATA_DIR, 'store.json');
const KNOWLEDGE_FILE = path.join(DATA_DIR, 'knowledge-base.json');

function ensureFile(filePath, fallback) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  if (!fs.existsSync(filePath)) fs.writeFileSync(filePath, JSON.stringify(fallback, null, 2), 'utf8');
}

function atomicWriteJson(filePath, value) {
  const temp = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(value, null, 2), 'utf8');
  fs.renameSync(temp, filePath);
}

function readJson(filePath, fallback) {
  ensureFile(filePath, fallback);
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    const backup = `${filePath}.corrupt-${Date.now()}`;
    try { fs.copyFileSync(filePath, backup); } catch (_) {}
    atomicWriteJson(filePath, fallback);
    return structuredClone(fallback);
  }
}

function loadStore() {
  const store = readJson(STORE_FILE, { customers: [], conversations: [], orders: [], audit: [], processedMessageIds: [] });
  for (const key of ['customers', 'conversations', 'orders', 'audit', 'processedMessageIds']) {
    if (!Array.isArray(store[key])) store[key] = [];
  }
  return store;
}

function saveStore(store) {
  atomicWriteJson(STORE_FILE, store);
}

function getKnowledgeBase() {
  return readJson(KNOWLEDGE_FILE, {
    business: { name: 'JM Cruz L. Digital', currency: 'GTQ' },
    products: [], paymentMethods: [], promotions: [], quickReplies: {}
  });
}

function validateKnowledgeBase(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('La base de conocimiento debe ser un objeto JSON válido.');
  const result = structuredClone(input);
  result.business = result.business && typeof result.business === 'object' ? result.business : {};
  result.business.name = String(result.business.name || 'JM Cruz L. Digital').trim();
  result.business.description = String(result.business.description || '').trim();
  result.business.currency = String(result.business.currency || 'GTQ').trim().toUpperCase();
  result.business.welcomeMessage = String(result.business.welcomeMessage || '').trim();
  result.business.unknownMessage = String(result.business.unknownMessage || '').trim();

  for (const key of ['products', 'paymentMethods', 'promotions']) if (!Array.isArray(result[key])) result[key] = [];
  result.quickReplies = result.quickReplies && typeof result.quickReplies === 'object' ? result.quickReplies : {};

  result.products = result.products.map((product, index) => ({
    id: String(product.id || `product-${index + 1}`).trim(),
    name: String(product.name || '').trim(),
    price: Number.isFinite(Number(product.price)) ? Number(product.price) : null,
    available: Boolean(product.available),
    description: String(product.description || '').trim()
  })).filter(product => product.name);

  result.paymentMethods = result.paymentMethods.map((method, index) => ({
    id: String(method.id || `payment-${index + 1}`).trim(),
    name: String(method.name || '').trim(),
    details: String(method.details || '').trim(),
    enabled: method.enabled !== false
  })).filter(method => method.name);

  result.promotions = result.promotions.map((promo, index) => ({
    id: String(promo.id || `promo-${index + 1}`).trim(),
    title: String(promo.title || '').trim(),
    description: String(promo.description || '').trim(),
    active: Boolean(promo.active)
  })).filter(promo => promo.title);

  return result;
}

function saveKnowledgeBase(input) {
  const validated = validateKnowledgeBase(input);
  atomicWriteJson(KNOWLEDGE_FILE, validated);
  return validated;
}

function nowIso() { return new Date().toISOString(); }
function id(prefix) { return `${prefix}_${crypto.randomUUID()}`; }

function upsertCustomer(phone, displayName = '') {
  const store = loadStore();
  let customer = store.customers.find(item => item.phone === phone);
  if (!customer) {
    customer = { id: id('cus'), phone, displayName, createdAt: nowIso(), updatedAt: nowIso() };
    store.customers.push(customer);
  } else {
    if (displayName) customer.displayName = displayName;
    customer.updatedAt = nowIso();
  }
  saveStore(store);
  return customer;
}

function getOrCreateConversation(phone, displayName = '') {
  const customer = upsertCustomer(phone, displayName);
  const store = loadStore();
  let conversation = store.conversations.find(item => item.customerId === customer.id && item.status !== 'closed');
  if (!conversation) {
    conversation = {
      id: id('con'), customerId: customer.id, phone, displayName: customer.displayName,
      status: 'open', messages: [], createdAt: nowIso(), updatedAt: nowIso(), lastInteractionAt: nowIso()
    };
    store.conversations.push(conversation);
    saveStore(store);
  }
  return conversation;
}

function appendMessage(conversationId, message) {
  const store = loadStore();
  const conversation = store.conversations.find(item => item.id === conversationId);
  if (!conversation) throw new Error('Conversación no encontrada.');
  const normalized = {
    id: id('msg'),
    direction: message.direction === 'outbound' ? 'outbound' : 'inbound',
    source: String(message.source || 'system'),
    text: String(message.text || ''),
    intent: String(message.intent || ''),
    createdAt: nowIso()
  };
  conversation.messages.push(normalized);
  conversation.updatedAt = nowIso();
  conversation.lastInteractionAt = nowIso();
  saveStore(store);
  return normalized;
}

function listConversations() {
  return [...loadStore().conversations].sort((a, b) => String(b.lastInteractionAt).localeCompare(String(a.lastInteractionAt)));
}

function markMessageProcessed(messageId) {
  const normalized = String(messageId || '').trim();
  if (!normalized) return true;
  const store = loadStore();
  if (store.processedMessageIds.includes(normalized)) return false;
  store.processedMessageIds.push(normalized);
  if (store.processedMessageIds.length > 2000) store.processedMessageIds = store.processedMessageIds.slice(-2000);
  saveStore(store);
  return true;
}

function getStats() {
  const store = loadStore();
  return {
    customers: store.customers.length,
    conversations: store.conversations.length,
    openConversations: store.conversations.filter(item => item.status === 'open').length,
    orders: store.orders.length
  };
}

module.exports = {
  getKnowledgeBase,
  saveKnowledgeBase,
  getOrCreateConversation,
  appendMessage,
  listConversations,
  markMessageProcessed,
  getStats
};
