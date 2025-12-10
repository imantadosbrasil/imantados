const cors = require('cors');

module.exports = async (req, res) => {
  const corsHandler = cors({ origin: true });
  await new Promise((resolve) => corsHandler(req, res, resolve));
  try {
    if (req.method === 'OPTIONS') { res.status(204).end(); return; }
    if (req.method !== 'GET') { res.status(405).send('Method Not Allowed'); return; }

    const id = (req.query.id || '').toString().trim();
    if (!id) { res.status(400).json({ error: 'id obrigatório' }); return; }
    const pathname = `Pedidos/${id}.json`;
    const { list } = await import('@vercel/blob');
    const { blobs } = await list({ prefix: pathname, limit: 1 });
    const blob = blobs && blobs[0];
    if (!blob || !blob.url) { res.status(404).json({ error: 'Pedido não encontrado' }); return; }
    const r = await fetch(blob.url);
    const text = await r.text();
    try {
      const json = JSON.parse(text);
      res.status(200).json(json);
      return;
    } catch {
      res.status(200).send(text);
      return;
    }
  } catch (err) {
    res.status(500).json({ error: (err && err.message) || String(err) });
  }
};

