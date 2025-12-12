const cors = require('cors');

module.exports = async (req, res) => {
  const corsHandler = cors({ origin: true });
  await new Promise((resolve) => corsHandler(req, res, resolve));

  if (req.method !== 'GET') { res.status(405).send('Method Not Allowed'); return; }
  const publicKey = process.env.MP_PUBLIC_KEY || '';
  res.status(200).json({ public_key: publicKey });
};
