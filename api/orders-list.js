const cors = require('cors');

module.exports = async (req, res) => {
  const corsHandler = cors({ origin: true });
  await new Promise((resolve) => corsHandler(req, res, resolve));
  try {
    if (req.method === 'OPTIONS') { res.status(204).end(); return; }
    if (req.method !== 'GET') { res.status(405).send('Method Not Allowed'); return; }
    const prefix = (req.query.prefix || 'Pedidos/').toString();
    const limit = Math.min(1000, Number(req.query.limit || 100));
    const cursor = req.query.cursor || undefined;
    const { list } = await import('@vercel/blob');
    const { blobs, cursor: next } = await list({ prefix, cursor, limit });
    const out = (blobs || []).map(b => ({ pathname: b.pathname, size: b.size, uploadedAt: b.uploadedAt, url: b.url }));
    res.status(200).json({ prefix, count: out.length, nextCursor: next || null, blobs: out });
  } catch (err) {
    res.status(500).json({ error: (err && err.message) || String(err) });
  }
};

