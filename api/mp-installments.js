const cors = require('cors');

module.exports = async (req, res) => {
  const corsHandler = cors({ origin: true });
  await new Promise((resolve) => corsHandler(req, res, resolve));

  try {
    const accessToken = process.env.MP_ACCESS_TOKEN;
    if (!accessToken) { res.status(500).json({ error: 'MP_ACCESS_TOKEN não configurado' }); return; }
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
};
