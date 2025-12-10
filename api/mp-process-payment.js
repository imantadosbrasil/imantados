const cors = require('cors');
const { MercadoPagoConfig, Payment } = require('mercadopago');

module.exports = async (req, res) => {
  const corsHandler = cors({ origin: true });
  await new Promise((resolve) => corsHandler(req, res, resolve));

  if (req.method !== 'POST') { res.status(405).send('Method Not Allowed'); return; }
  try {
    const accessToken = process.env.MP_ACCESS_TOKEN;
    if (!accessToken) { res.status(500).json({ error: 'MP_ACCESS_TOKEN não configurado' }); return; }
    const body = typeof req.body === 'object' ? req.body : JSON.parse(req.body || '{}');
    const formData = body.formData || body || {};
    const order = body.order || {};
    const client = new MercadoPagoConfig({ accessToken });
    const fallbackEmail = (order.customer && order.customer.email) || (formData.payer && formData.payer.email) || order.email || 'no-reply@imantados.com.br';
    const paymentPayload = {
      transaction_amount: Number(order.total || formData.transaction_amount || 0),
      token: formData.token,
      description: (order.items && order.items[0] && order.items[0].title) || 'Imantados',
      installments: formData.installments || 1,
      payment_method_id: formData.payment_method_id,
      issuer_id: formData.issuer_id,
      payer: {
        email: fallbackEmail,
        identification: formData.payer && formData.payer.identification,
      },
    };
    const pay = new Payment(client);
    const { body: payment } = await pay.create({ body: paymentPayload });
    res.status(200).json(payment);
  } catch (err) {
    res.status(500).json({ error: (err && err.message) || String(err) });
  }
};
