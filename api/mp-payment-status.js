const cors = require('cors');
const { MercadoPagoConfig, Payment } = require('mercadopago');

module.exports = async (req, res) => {
  const corsHandler = cors({ origin: true });
  await new Promise((resolve) => corsHandler(req, res, resolve));

  if (req.method !== 'GET') { res.status(405).send('Method Not Allowed'); return; }
  try {
    const accessToken = process.env.MP_ACCESS_TOKEN;
    if (!accessToken) { res.status(500).json({ error: 'MP_ACCESS_TOKEN não configurado' }); return; }
    const id = Number(req.query.id || req.query.payment_id);
    if (!id) { res.status(400).json({ error: 'payment_id obrigatório' }); return; }
    const client = new MercadoPagoConfig({ accessToken });
    const pay = new Payment(client);
    const { body: payment } = await pay.get({ id });
    const t = payment?.point_of_interaction?.transaction_data || {};
    res.status(200).json({ id: payment?.id, status: payment?.status, status_detail: payment?.status_detail, amount: payment?.transaction_amount, qr_code: t.qr_code });
  } catch (err) {
    res.status(500).json({ error: (err && err.message) || String(err) });
  }
};
