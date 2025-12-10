const cors = require('cors');

module.exports = async (req, res) => {
  const corsHandler = cors({ origin: true });
  await new Promise((resolve) => corsHandler(req, res, resolve));
  try {
    const pk = process.env.MP_PUBLIC_KEY || '';
    res.status(200).json({ public_key: pk || null });
  } catch (err) {
    res.status(500).json({ error: (err && err.message) || String(err) });
  }
};
