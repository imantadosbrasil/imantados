const functions = require('firebase-functions');
const cors = require('cors');

// Stripe Checkout – HTTP Function
const Stripe = require('stripe');

exports.stripeCheckout = functions.https.onRequest((req, res) => {
  const corsHandler = cors({ origin: true });
  corsHandler(req, res, async () => {
    if (req.method !== 'POST') {
      res.status(405).send('Method Not Allowed');
      return;
    }
    try {
      const secret = process.env.STRIPE_SECRET_KEY;
      if (!secret) {
        res.status(500).json({ error: 'STRIPE_SECRET_KEY não configurado' });
        return;
      }
      const stripe = Stripe(secret);
      const order = typeof req.body === 'object' ? req.body : JSON.parse(req.body || '{}');
      const line_items = (order.items || []).map((it) => ({
        quantity: it.quantity || 1,
        price_data: {
          currency: 'brl',
          unit_amount: Math.round(Number(it.unitPrice || it.price || 0) * 100),
          product_data: { name: it.name || 'Imantados', description: `Material: ${it.material || ''} • ${it.width}x${it.height}`.trim() },
        },
      }));
      if (!line_items.length && order.total) {
        line_items.push({
          quantity: 1,
          price_data: { currency: 'brl', unit_amount: Math.round(Number(order.total) * 100), product_data: { name: 'Imantados' } },
        });
      }
      const success = process.env.SUCCESS_URL || 'https://www.imantados.com.br';
      const cancel = process.env.CANCEL_URL || 'https://www.imantados.com.br';
      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        payment_method_types: ['card', 'pix'],
        line_items,
        customer_email: order.email,
        success_url: `${success}/confirmacao.html?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${cancel}/carrinho.html`,
        phone_number_collection: { enabled: true },
        locale: 'pt-BR',
      });
      res.status(200).json({ id: session.id, url: session.url });
    } catch (err) {
      res.status(500).json({ error: (err && err.message) || String(err) });
    }
  });
});

// Mercado Pago – HTTP Function
const mercadopago = require('mercadopago');

exports.mpCreatePreference = functions.https.onRequest((req, res) => {
  const corsHandler = cors({ origin: true });
  corsHandler(req, res, async () => {
    if (req.method !== 'POST') {
      res.status(405).send('Method Not Allowed');
      return;
    }
    try {
      const accessToken = process.env.MP_ACCESS_TOKEN;
      if (!accessToken) {
        res.status(500).json({ error: 'MP_ACCESS_TOKEN não configurado' });
        return;
      }
      const order = typeof req.body === 'object' ? req.body : JSON.parse(req.body || '{}');
      const items = (order.items || []).map((it) => ({
        title: it.name || 'Imantados',
        quantity: it.quantity || 1,
        unit_price: Number(it.unitPrice || it.price || 0),
        currency_id: 'BRL',
        description: `Material: ${it.material || ''} • Tamanho: ${it.width}x${it.height}`.trim(),
      }));

      mercadopago.configure({ access_token: accessToken });
      const success = process.env.SUCCESS_URL || 'https://www.imantados.com.br';
      const cancel = process.env.CANCEL_URL || 'https://www.imantados.com.br';

      const preference = {
        items: items.length ? items : [{ title: 'Imantados', quantity: 1, unit_price: Number(order.total || 0), currency_id: 'BRL' }],
        payer: { name: order.name, email: order.email },
        payment_methods: {
          excluded_payment_types: [],
          installments: 12,
        },
        back_urls: {
          success: `${success}/confirmacao.html`,
          failure: `${cancel}/carrinho.html`,
          pending: `${success}/confirmacao.html`,
        },
        auto_return: 'approved',
      };
      const { body } = await mercadopago.preferences.create(preference);
      res.status(200).json(body);
    } catch (err) {
      res.status(500).json({ error: (err && err.message) || String(err) });
    }
  });
});

// Mercado Pago – Payment Brick backend
exports.mpProcessPayment = functions.https.onRequest((req, res) => {
  const corsHandler = cors({ origin: true });
  corsHandler(req, res, async () => {
    if (req.method !== 'POST') {
      res.status(405).send('Method Not Allowed');
      return;
    }
    try {
      const accessToken = process.env.MP_ACCESS_TOKEN;
      if (!accessToken) {
        res.status(500).json({ error: 'MP_ACCESS_TOKEN não configurado' });
        return;
      }
      const body = typeof req.body === 'object' ? req.body : JSON.parse(req.body || '{}');
      const formData = body.formData || body || {};
      const order = body.order || {};
      mercadopago.configure({ access_token: accessToken });
      const paymentPayload = {
        transaction_amount: Number(order.total || formData.transaction_amount || 0),
        token: formData.token,
        description: (order.items && order.items[0] && order.items[0].title) || 'Imantados',
        installments: formData.installments || 1,
        payment_method_id: formData.payment_method_id,
        issuer_id: formData.issuer_id,
        payer: {
          email: (order.customer && order.customer.email) || formData.payer?.email,
          identification: formData.payer?.identification,
        },
      };
      const { body: payment } = await mercadopago.payment.create(paymentPayload);
      res.status(200).json(payment);
    } catch (err) {
      res.status(500).json({ error: (err && err.message) || String(err) });
    }
  });
});

exports.mpInstallments = functions.https.onRequest((req, res) => {
  const corsHandler = cors({ origin: true });
  corsHandler(req, res, async () => {
    try {
      const accessToken = process.env.MP_ACCESS_TOKEN;
      if (!accessToken) {
        res.status(500).json({ error: 'MP_ACCESS_TOKEN não configurado' });
        return;
      }
      const method = (req.method || 'GET').toUpperCase();
      const bin = (method === 'GET' ? (req.query.bin || '') : (req.body && req.body.bin) || '').toString().replace(/\D/g,'').slice(0,6);
      const amountRaw = method === 'GET' ? (req.query.amount || '') : (req.body && req.body.amount) || '';
      const amount = Number(amountRaw || 0);
      if (!bin || bin.length < 6) { res.status(400).json({ error: 'BIN inválido' }); return; }
      if (!(amount > 0)) { res.status(400).json({ error: 'Valor inválido' }); return; }
      const url = `https://api.mercadopago.com/v1/payment_methods/installments?bin=${encodeURIComponent(bin)}&amount=${encodeURIComponent(amount)}&locale=pt_BR`;
      const r = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
      const data = await r.json();
      if (!r.ok) { res.status(r.status).json(data); return; }
      res.status(200).json(data);
    } catch (err) {
      res.status(500).json({ error: (err && err.message) || String(err) });
    }
  });
});

exports.correiosPrazo = functions.https.onRequest((req, res) => {
  const corsHandler = cors({ origin: true });
  corsHandler(req, res, async () => {
    if (req.method !== 'GET') {
      res.status(405).send('Method Not Allowed');
      return;
    }
    try {
      const cepDestinoRaw = (req.query.cepDestino || req.query.cep || '').toString();
      const cepDestino = cepDestinoRaw.replace(/\D/g, '');
      if (!cepDestino || cepDestino.length !== 8) {
        res.status(400).json({ error: 'CEP inválido' });
        return;
      }
      const originEnv = (process.env.ORIGIN_CEP || '94930230').toString();
      const cepOrigem = originEnv.replace(/\D/g, '');
      const servParam = (req.query.servico || req.query.serv || 'mini').toString().toLowerCase();
      let nCdServico = '04510';
      if (servParam === 'mini') nCdServico = '04227';
      if (servParam === 'sedex') nCdServico = '04014';
      const url = `http://ws.correios.com.br/calculador/CalcPrecoPrazo.asmx/CalcPrazo?nCdServico=${nCdServico}&sCepOrigem=${cepOrigem}&sCepDestino=${cepDestino}`;
      const r = await fetch(url);
      const t = await r.text();
      const m = t.match(/<PrazoEntrega>(\d+)<\/PrazoEntrega>/);
      if (m && m[1]) {
        res.status(200).json({ prazo: Number(m[1]), service: nCdServico });
        return;
      }
      res.status(200).json({ prazo: null, service: nCdServico });
    } catch (err) {
      res.status(500).json({ error: (err && err.message) || String(err) });
    }
  });
});
