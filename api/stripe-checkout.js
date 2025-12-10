const Stripe = require('stripe');

module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.status(405).send('Method Not Allowed'); return; }
  try {
    const secret = process.env.STRIPE_SECRET_KEY;
    if (!secret) { res.status(500).json({ error: 'STRIPE_SECRET_KEY não configurado' }); return; }
    const stripe = Stripe(secret);
    const order = typeof req.body === 'object' ? req.body : JSON.parse(req.body || '{}');
    const line_items = (order.items || []).map((it) => ({
      quantity: it.quantity || 1,
      price_data: {
        currency: 'brl',
        unit_amount: Math.round(Number(it.unitPrice || it.price || 0) * 100),
        product_data: { name: it.name || 'Imantados', description: `Material: ${it.material || ''} • ${it.width}x${it.height}`.trim() },
      },
    }));
    if (!line_items.length && order.total) {
      line_items.push({ quantity: 1, price_data: { currency: 'brl', unit_amount: Math.round(Number(order.total) * 100), product_data: { name: 'Imantados' } } });
    }
    const success = process.env.SUCCESS_URL || 'https://www.imantados.com.br';
    const cancel = process.env.CANCEL_URL || 'https://www.imantados.com.br';
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card', 'pix'],
      line_items,
      customer_email: order.email,
      success_url: `${success}/confirmacao.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${cancel}/carrinho.html`,
      phone_number_collection: { enabled: true },
      locale: 'pt-BR',
    });
    res.status(200).json({ id: session.id, url: session.url });
  } catch (err) {
    res.status(500).json({ error: (err && err.message) || String(err) });
  }
};
