const cors = require('cors');
const { MercadoPagoConfig, Preference } = require('mercadopago');

module.exports = async (req, res) => {
  const corsHandler = cors({ origin: true });
  await new Promise((resolve) => corsHandler(req, res, resolve));
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }

  if (req.method !== 'POST') { res.status(405).send('Method Not Allowed'); return; }
  try {
    const accessToken = process.env.MP_ACCESS_TOKEN;
    if (!accessToken) { res.status(500).json({ error: 'MP_ACCESS_TOKEN não configurado' }); return; }
    const order = typeof req.body === 'object' ? req.body : JSON.parse(req.body || '{}');
    const normalizePrice = (v) => {
      const s = String(v ?? 0);
      const t = s.replace(/\./g, '').replace(',', '.');
      const n = Number(t);
      return Number.isFinite(n) ? n : 0;
    };
    const items = (order.items || []).map((it) => ({
      title: it.name || 'Imantados',
      quantity: it.quantity || 1,
      unit_price: normalizePrice(it.unitPrice || it.price || 0),
      currency_id: 'BRL',
      description: `Material: ${it.material || ''} • Tamanho: ${it.width}x${it.height}`.trim(),
    }));
    const singleItem = (order.title || order.quantity || order.unit_price)
      ? [{
          title: order.title || 'Produto Imantados',
          quantity: order.quantity || 1,
          unit_price: normalizePrice(order.unit_price || order.total || 0),
          currency_id: 'BRL',
        }]
      : [];
    const proto = (req.headers['x-forwarded-proto'] || 'https');
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const base = host ? `${proto}://${host}` : (process.env.SUCCESS_URL || 'https://www.imantados.com.br');
    const success = process.env.SUCCESS_URL || base;
    const cancel = process.env.CANCEL_URL || base;

    const onlyPix = !!order.onlyPix;
    const preference = {
      items: items.length ? items : (singleItem.length ? singleItem : [{ title: 'Imantados', quantity: 1, unit_price: normalizePrice(order.total || 0), currency_id: 'BRL' }]),
      payer: { name: (order.customer && order.customer.name) || order.name || 'Cliente', email: (order.customer && order.customer.email) || order.email || 'no-reply@imantados.com.br' },
      external_reference: order.id || order.external_reference,
      payment_methods: onlyPix
        ? { excluded_payment_types: ['credit_card','debit_card','ticket','atm'], installments: 1, default_payment_method_id: 'pix' }
        : { excluded_payment_types: [], installments: 12 },
      back_urls: { success: `${success}/sucesso`, failure: `${cancel}/erro`, pending: `${success}/pendente` },
      auto_return: 'approved',
      notification_url: process.env.MP_NOTIFICATION_URL || `${base}/api/mp-webhook`,
    };

    const client = new MercadoPagoConfig({ accessToken });
    const pref = new Preference(client);
    try {
      const { body } = await pref.create({ body: preference });
      res.status(200).json(body);
    } catch (err) {
      const status = (err && (err.status || err.statusCode)) || 500;
      const details = (err && (err.cause || err.error || err.errors)) || null;
      const msg = (err && err.message) || (Array.isArray(details) && details[0] && (details[0].description || details[0].message)) || String(err);
      res.status(status).json({ error: msg, details });
      return;
    }
  } catch (err) {
    res.status(500).json({ error: (err && err.message) || String(err) });
  }
};
