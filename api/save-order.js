const cors = require('cors');

module.exports = async (req, res) => {
  const corsHandler = cors({ origin: true });
  await new Promise((resolve) => corsHandler(req, res, resolve));
  try {
    if (req.method === 'OPTIONS') { res.status(204).end(); return; }
    if (req.method !== 'POST') { res.status(405).send('Method Not Allowed'); return; }

    const parseBody = () => {
      try {
        if (typeof req.body === 'object') return req.body || {};
        return JSON.parse(req.body || '{}');
      } catch { return {}; }
    };
    const payload = parseBody();

    const order = payload.order || payload || {};
    const paymentId = payload.paymentId || order.paymentId || null;
    const status = String(payload.status || order.status || 'initiated');

    const safeNum = (v) => {
      const n = Number(v || 0); return Number.isFinite(n) ? n : 0;
    };

    const items = Array.isArray(order.items) ? order.items.map((it, idx) => {
      const sizeCm = it.sizeCm || { width: it.width || null, height: it.height || null };
      const dims = (sizeCm && sizeCm.width && sizeCm.height) ? `${sizeCm.width}x${sizeCm.height}cm` : [it.width, it.height].filter(Boolean).join('x');
      return {
        id: it.id || `item-${idx}`,
        name: it.name || it.title || 'Imagem personalizada',
        material: it.material || null,
        sizeCm,
        dimensions: dims || null,
        unitPrice: safeNum(it.unitPrice || it.price),
        quantity: safeNum(it.quantity || 1),
        total: safeNum(it.total || ((it.unitPrice || 0) * (it.quantity || 1))),
        imageUrl: it.displayUrl || it.url || it.imageUrl || null,
      };
    }) : [];

    const record = {
      id: order.id || ('IM' + Date.now().toString(36).toUpperCase()),
      createdAt: order.createdAt || new Date().toISOString(),
      status,
      payment: { provider: order.payment?.provider || 'mercado', method: order.payment?.method || 'pix', id: paymentId },
      customer: order.customer || {},
      shipping: {
        cep: (order.shipping && order.shipping.cep) || null,
        price: safeNum(order.shipping && order.shipping.price),
        eta: order.shipping && order.shipping.eta || null,
      },
      amounts: {
        subtotal: safeNum(order.subtotal),
        shipping: safeNum(order.shipping && order.shipping.price),
        total: safeNum(order.total),
      },
      items,
    };

    const folder = (payload.folder || 'Pedidos').replace(/[^\w\-\/]/g, '');
    const blobPath = `${folder}/${record.id}.json`;
    const data = JSON.stringify(record, null, 2);
    const { put } = await import('@vercel/blob');
    const { url } = await put(blobPath, data, { access: 'private', contentType: 'application/json; charset=utf-8' });

    res.status(200).json({ ok: true, id: record.id, blob: url });
  } catch (err) {
    res.status(500).json({ error: (err && err.message) || String(err) });
  }
};
