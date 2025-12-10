const cors = require('cors');
const { MercadoPagoConfig, Payment } = require('mercadopago');

module.exports = async (req, res) => {
  const corsHandler = cors({ origin: true });
  await new Promise((resolve) => corsHandler(req, res, resolve));
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }

  if (req.method !== 'POST') { res.status(405).send('Method Not Allowed'); return; }
  try {
    const accessToken = process.env.MP_ACCESS_TOKEN;
    if (!accessToken) { res.status(500).json({ error: 'MP_ACCESS_TOKEN não configurado' }); return; }
    const order = typeof req.body === 'object' ? req.body : JSON.parse(req.body || '{}');
    const amount = Number(order.total || 0);
    if (!(amount > 0)) { res.status(400).json({ error: 'Valor inválido para Pix' }); return; }

    const client = new MercadoPagoConfig({ accessToken });
    const fallbackEmail = (order.customer && order.customer.email) || order.email || 'no-reply@imantados.com.br';
    const fallbackName = (order.customer && order.customer.name) || order.name || 'Cliente';
    const proto = (req.headers['x-forwarded-proto'] || 'https');
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const base = host ? `${proto}://${host}` : (process.env.SUCCESS_URL || 'https://www.imantados.com.br');
    const paymentPayload = {
      transaction_amount: amount,
      description: (order.items && order.items[0] && (order.items[0].name || order.items[0].title)) || 'Imantados',
      payment_method_id: 'pix',
      external_reference: order.id || order.external_reference,
      notification_url: (process.env.MP_NOTIFICATION_URL || (base + '/api/mp-webhook')),
      payer: { email: fallbackEmail, first_name: fallbackName },
    };
    const pay = new Payment(client);
    const { body: payment } = await pay.create({ body: paymentPayload });
    const t = payment?.point_of_interaction?.transaction_data || {};
    res.status(200).json({ id: payment?.id, status: payment?.status, qr_code: t.qr_code, qr_code_base64: t.qr_code_base64, amount });
  } catch (err) {
    const status = (err && (err.status || err.statusCode)) || 500;
    const details = (err && (err.cause || err.error || err.errors)) || null;
    const msg = (err && err.message) || (Array.isArray(details) && details[0] && (details[0].description || details[0].message)) || String(err);
    res.status(status).json({ error: msg, details });
  }
};
