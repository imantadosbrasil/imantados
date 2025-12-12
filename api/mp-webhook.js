const cors = require('cors');
const { MercadoPagoConfig, Payment } = require('mercadopago');

module.exports = async (req, res) => {
  const corsHandler = cors({ origin: true });
  await new Promise((resolve) => corsHandler(req, res, resolve));

  try {
    if (req.method === 'OPTIONS') { res.status(204).end(); return; }

    const accessToken = process.env.MP_ACCESS_TOKEN;
    const hasAccess = !!accessToken;

    const parseBody = () => {
      try {
        if (typeof req.body === 'object') return req.body || {};
        return JSON.parse(req.body || '{}');
      } catch { return {}; }
    };

    const query = req.query || {};
    const body = parseBody();

    const getPaymentInfo = async (id) => {
      if (!hasAccess || !id) return null;
      const client = new MercadoPagoConfig({ accessToken });
      const pay = new Payment(client);
      try {
        const { body: payment } = await pay.get({ id: Number(id) });
        return payment || null;
      } catch { return null; }
    };

    if (req.method === 'GET') {
      const topic = String(query.topic || query.type || '').toLowerCase();
      const id = query.id || query.payment_id || query['data.id'];
      const info = await getPaymentInfo(id);
      res.status(200).json({ ok: true, topic, id: id || null, payment: info ? { id: info.id, status: info.status, status_detail: info.status_detail } : null });
      return;
    }

    if (req.method === 'POST') {
      const topic = String(body.topic || body.type || '').toLowerCase();
      const id = body?.data?.id || body?.id || query.id || null;
      const info = await getPaymentInfo(id);
      res.status(200).json({ ok: true, topic, id: id || null, payment: info ? { id: info.id, status: info.status, status_detail: info.status_detail } : null });
      return;
    }

    res.status(405).send('Method Not Allowed');
  } catch (err) {
    res.status(500).json({ error: (err && err.message) || String(err) });
  }
};
