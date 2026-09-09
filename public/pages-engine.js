'use strict';

(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.JMEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  function normalize(text) {
    return String(text || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9ñü\s]/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function includesAny(text, phrases) {
    return phrases.some(phrase => text.includes(normalize(phrase)));
  }

  function detectIntent(message) {
    const text = normalize(message);
    if (!text) return 'unknown';
    if (includesAny(text, ['asesor', 'persona', 'humano', 'hablar con alguien', 'atencion humana', 'servicio al cliente'])) return 'automation_scope';
    if (includesAny(text, ['pago', 'pagar', 'deposito', 'transferencia', 'metodo de pago', 'cuenta bancaria'])) return 'payment_methods';
    if (includesAny(text, ['problema', 'pedido', 'orden', 'no me llego', 'no recibí', 'reclamo'])) return 'order_problem';
    if (includesAny(text, ['comprar', 'quiero', 'adquirir', 'compra'])) return 'purchase';
    if (includesAny(text, ['disponible', 'disponibilidad', 'hay stock', 'tienen', 'queda'])) return 'availability';
    if (includesAny(text, ['precio', 'precios', 'cuanto', 'cuesta', 'valor'])) return 'prices';
    if (includesAny(text, ['hola', 'buenas', 'buen dia', 'buenas tardes', 'buenas noches', 'hey'])) return 'greeting';
    if (includesAny(text, ['promocion', 'promociones', 'oferta', 'ofertas'])) return 'promotions';
    return 'unknown';
  }

  function money(value, currency) {
    if (!Number.isFinite(Number(value))) return 'Precio no registrado';
    const symbol = currency === 'GTQ' ? 'Q' : `${currency} `;
    return `${symbol}${Number(value).toFixed(2)}`;
  }

  function findMentionedProducts(message, products) {
    const text = normalize(message);
    return products.filter(product => {
      const name = normalize(product.name);
      if (!name) return false;
      if (text.includes(name)) return true;
      const tokens = name.split(' ').filter(token => token.length >= 4);
      return tokens.length > 0 && tokens.every(token => text.includes(token));
    });
  }

  function listProducts(products, currency, onlyAvailable = false) {
    const selected = onlyAvailable ? products.filter(product => product.available) : products;
    if (!selected.length) return null;
    return selected.map(product => `• ${product.name} — ${money(product.price, currency)} — ${product.available ? 'Disponible' : 'No disponible'}`).join('\n');
  }

  function buildReply({ message, knowledgeBase }) {
    const kb = knowledgeBase || {};
    const business = kb.business || {};
    const products = Array.isArray(kb.products) ? kb.products : [];
    const payments = Array.isArray(kb.paymentMethods) ? kb.paymentMethods.filter(item => item.enabled !== false) : [];
    const promotions = Array.isArray(kb.promotions) ? kb.promotions.filter(item => item.active) : [];
    const quick = kb.quickReplies || {};
    const currency = business.currency || 'GTQ';
    const intent = detectIntent(message);
    const mentioned = findMentionedProducts(message, products);

    switch (intent) {
      case 'greeting':
        return { intent, text: business.welcomeMessage || `¡Hola! Gracias por comunicarte con ${business.name || 'JM Cruz L. Digital'}. ¿En qué podemos ayudarte?` };
      case 'prices': {
        const source = mentioned.length ? mentioned : products;
        const list = listProducts(source, currency, false);
        return { intent, text: list ? `Estos son los precios registrados actualmente:\n${list}` : (quick.noProducts || 'Todavía no hay productos registrados.') };
      }
      case 'availability': {
        if (mentioned.length) {
          const lines = mentioned.map(product => `• ${product.name}: ${product.available ? 'Disponible' : 'No disponible'}`);
          return { intent, text: `Disponibilidad registrada:\n${lines.join('\n')}` };
        }
        const list = listProducts(products, currency, true);
        return { intent, text: list ? `Productos marcados como disponibles:\n${list}` : 'No hay productos marcados como disponibles en este momento.' };
      }
      case 'payment_methods': {
        if (!payments.length) return { intent, text: quick.noPaymentMethods || 'Todavía no hay métodos de pago registrados.' };
        const lines = payments.map(method => `• ${method.name}${method.details ? `: ${method.details}` : ''}`);
        return { intent, text: `Métodos de pago registrados:\n${lines.join('\n')}\n\nImportante: un mensaje o comprobante enviado por el cliente no se considera pago confirmado automáticamente.` };
      }
      case 'purchase': {
        if (!mentioned.length) return { intent, text: quick.purchase || 'Indícame qué producto deseas comprar.' };
        const product = mentioned[0];
        if (!product.available) return { intent, text: `${product.name} figura como no disponible. No puedo prometer existencias que no estén registradas.` };
        return { intent, text: `${product.name} figura como disponible por ${money(product.price, currency)}. Puedo darte únicamente la información registrada para este producto; no confirmaré pagos ni pedidos sin una validación registrada.` };
      }
      case 'promotions': {
        if (!promotions.length) return { intent, text: 'No hay promociones activas registradas en este momento.' };
        const lines = promotions.map(promo => `• ${promo.title}${promo.description ? `: ${promo.description}` : ''}`);
        return { intent, text: `Promociones activas registradas:\n${lines.join('\n')}` };
      }
      case 'order_problem':
        return { intent, text: quick.orderProblem || 'Este canal responde automáticamente con la información registrada. No puedo confirmar pagos, estados o soluciones de pedidos que no estén registrados.' };
      case 'automation_scope':
        return { intent, text: quick.automationScope || 'Este número funciona con atención automática. Respondo únicamente con la información registrada en JM Cruz L. Digital y no permite respuesta manual desde este sistema.' };
      default:
        return { intent: 'unknown', text: business.unknownMessage || 'No tengo información registrada para responder eso con seguridad.' };
    }
  }

  return { normalize, detectIntent, buildReply, findMentionedProducts };
});
