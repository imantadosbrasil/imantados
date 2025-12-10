const { MercadoPagoConfig, Payment, MerchantOrder } = require('mercadopago');

module.exports = async (req, res) => {
  try {
    const accessToken = process.env.MP_ACCESS_TOKEN;
    if (!accessToken) { res.status(500).json({ error: 'MP_ACCESS_TOKEN não configurado' }); return; }
    const client = new MercadoPagoConfig({ accessToken });
    const body = typeof req.body === 'object' ? req.body : JSON.parse(req.body || '{}');
    const typeBody = body.type || body.action || '';
    const typeQuery = (req.query && (req.query.type || req.query.topic)) || '';
    const type = String(typeBody || typeQuery).toLowerCase();
    const id = body.data?.id || body?.id || (req.query && req.query.id);
    if (type.includes('payment') && id) { try { await new Payment(client).get({ id }); } catch {} }
    if (type.includes('merchant_order') && id) { try { await new MerchantOrder(client).get({ merchantOrderId: id }); } catch {} }
    res.status(200).json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: (err && err.message) || String(err) });
  }
};
