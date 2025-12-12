const cors = require('cors');

module.exports = async (req, res) => {
  const corsHandler = cors({ origin: true });
  await new Promise((resolve) => corsHandler(req, res, resolve));

  if (req.method !== 'GET') { res.status(405).send('Method Not Allowed'); return; }
  try {
    const accessToken = process.env.MP_ACCESS_TOKEN;
    if (!accessToken) { res.status(500).json({ error: 'MP_ACCESS_TOKEN não configurado' }); return; }
    const bin = String(req.query.bin || '').trim();
    const amount = Number(req.query.amount || 0);
    if (bin.length < 6 || !(amount > 0)) { res.status(400).json({ error: 'Parâmetros inválidos: bin e amount' }); return; }
    const url = `https://api.mercadopago.com/v1/payment_methods/installments?bin=${encodeURIComponent(bin)}&amount=${encodeURIComponent(amount)}`;
    const r = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' } });
    const data = await r.json();
    if (!r.ok) { res.status(r.status).json(data); return; }
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: (err && err.message) || String(err) });
  }
};
