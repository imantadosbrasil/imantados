module.exports = async (req, res) => {
  if (req.method !== 'GET') { res.status(405).send('Method Not Allowed'); return; }
  try {
    const cepDestinoRaw = String(req.query.cepDestino || req.query.cep || '');
    const cepDestino = cepDestinoRaw.replace(/\D/g, '');
    if (!cepDestino || cepDestino.length !== 8) { res.status(400).json({ error: 'CEP inválido' }); return; }
    const originEnv = String(process.env.ORIGIN_CEP || '94930230');
    const cepOrigem = originEnv.replace(/\D/g, '');
    const servParam = String(req.query.servico || req.query.serv || 'mini').toLowerCase();
    let nCdServico = '04510';
    if (servParam === 'mini') nCdServico = '04227';
    if (servParam === 'sedex') nCdServico = '04014';
    const url = `http://ws.correios.com.br/calculador/CalcPrecoPrazo.asmx/CalcPrazo?nCdServico=${nCdServico}&sCepOrigem=${cepOrigem}&sCepDestino=${cepDestino}`;
    const r = await fetch(url);
    const t = await r.text();
    const m = t.match(/<PrazoEntrega>(\d+)<\/PrazoEntrega>/);
    if (m && m[1]) { res.status(200).json({ prazo: Number(m[1]), service: nCdServico }); return; }
    res.status(200).json({ prazo: null, service: nCdServico });
  } catch (err) {
    res.status(500).json({ error: (err && err.message) || String(err) });
  }
};
