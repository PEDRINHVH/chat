const PRICES = { p300: 1990, p800: 3990, p2000: 6990 };
const PACKS = { p300: 300, p800: 900, p2000: 2500 };

module.exports = async function (req, res) {
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'private, no-store, max-age=0');

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method_not_allowed' });
    return;
  }

  const secret = process.env.PERFECTPAY_SECRET_KEY;
  const publicKey = process.env.PERFECTPAY_PUBLIC_KEY;
  const apiBase = process.env.PERFECTPAY_API_BASE || 'https://api.perfectpay.ai';
  const currency = process.env.PERFECTPAY_CURRENCY || 'BRL';
  if (!secret || !publicKey) {
    res.status(503).json({ error: 'gateway_not_configured' });
    return;
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { body = {}; }
  }
  body = body || {};
  const pack = String(body.pack || '');
  const amount = PRICES[pack];
  if (!amount) {
    res.status(400).json({ error: 'invalid_pack' });
    return;
  }

  const headers = { 'api-key': secret, 'content-type': 'application/json' };
  const name = String(body.name || '').slice(0, 80);
  const email = String(body.email || '').slice(0, 120);
  const phone = String(body.phone || '').replace(/\D/g, '').slice(0, 15);

  let customerId = null;
  if (email && email.includes('@')) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 12000);
      const cr = await fetch(apiBase + '/customers', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name: name || 'Cliente ZapRadar',
          email,
          phone,
          phone_country_code: '+55',
          metadata: { source: 'zapradar-acesso' }
        }),
        signal: ctrl.signal
      });
      clearTimeout(timer);
      if (cr.ok) {
        const cd = await cr.json();
        customerId = cd.customer_id || (cd.data && cd.data.customer_id) || null;
      }
    } catch (e) {}
  }

  try {
    const origin = req.headers.origin || 'https://www.chavedoamoroficial.com';
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15000);
    const pr = await fetch(apiBase + '/payments', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        amount,
        currency,
        customer_id: customerId || undefined,
        capture_method: 'automatic',
        authentication_type: 'no_three_ds',
        return_url: origin + '/acesso/?pagamento=retorno',
        confirm: false,
        description: 'ZapRadar - ' + PACKS[pack] + ' tokens',
        metadata: { pack, tokens: PACKS[pack], source: 'zapradar-acesso' }
      }),
      signal: ctrl.signal
    });
    clearTimeout(timer);
    const text = await pr.text();
    let data = {};
    try { data = JSON.parse(text); } catch (e) {}
    if (!pr.ok) {
      res.status(pr.status).json({ error: 'payment_failed', detail: data });
      return;
    }
    res.status(200).json({
      payment_id: data.payment_id,
      client_secret: data.client_secret,
      amount,
      currency,
      publicKey,
      apiBase
    });
  } catch (e) {
    res.status(502).json({ error: 'gateway_unreachable' });
  }
};
