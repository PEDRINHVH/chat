module.exports = async function (req, res) {
  const phone = String((req.query && req.query.phone) || '').replace(/\D/g, '');
  if (phone.length < 10 || phone.length > 13) {
    res.status(400).json({ photo: null, leaks: [], ai_summary: 'Número inválido.' });
    return;
  }
  try {
    const r = await fetch('https://chavedoamor.site/api-wa-pic.php?phone=' + encodeURIComponent(phone) + '&o=scan', {
      headers: { accept: 'application/json' },
    });
    const text = await r.text();
    res.setHeader('content-type', 'application/json; charset=utf-8');
    res.setHeader('cache-control', 'private, no-store, max-age=0');
    const consulta = r.headers.get('x-zr-consulta');
    if (consulta) res.setHeader('x-zr-consulta', consulta);
    const retry = r.headers.get('x-zr-retry');
    if (retry !== null) res.setHeader('x-zr-retry', retry);
    res.status(r.status).send(text);
  } catch (e) {
    res.status(502).json({ photo: null, leaks: [], ai_summary: 'Falha ao consultar.' });
  }
};
