const crypto = require('crypto');
const { db, body } = require('./_db');

function send(res, code, obj) { res.statusCode = code; res.end(JSON.stringify(obj)); }


function digits(v) { return String(v || '').replace(/\D/g, '').slice(0, 15); }
function clean(v, max) { return String(v || '').trim().replace(/\s+/g, ' ').slice(0, max); }

module.exports = async function (req, res) {
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'private, no-store, max-age=0');
  if (req.method !== 'POST') {
    send(res, 405, { error: 'method_not_allowed' });
    return;
  }

  const data = await body(req);
  const name = clean(data.name, 80);
  const email = clean(data.email, 120).toLowerCase();
  const phone = digits(data.phone);

  if (name.length < 2) {
    send(res, 400, { error: 'invalid_name' });
    return;
  }
  if (phone.length < 10 || phone.length > 11) {
    send(res, 400, { error: 'invalid_phone' });
    return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    send(res, 400, { error: 'invalid_email' });
    return;
  }

  try {
    const client = await db().connect();
    try {
      const found = await client.query(
        'select id from public.zr_accounts where phone = $1 or lower(email) = $2 limit 1',
        [phone, email]
      );
      if (found.rows.length) {
        const id = found.rows[0].id;
        await client.query(
          'update public.zr_accounts set name = $2, phone = $3, email = $4, last_seen = now() where id = $1',
          [id, name, phone, email]
        );
        send(res, 200, { account_id: id, existing: true });
        return;
      }
      const inserted = await client.query(
        'insert into public.zr_accounts (name, email, phone, meta) values ($1,$2,$3,$4) returning id',
        [name, email, phone, { source: 'acesso', ua: String(req.headers['user-agent'] || '').slice(0, 160) }]
      );
      const id = inserted.rows[0].id;
      send(res, 201, { account_id: id, existing: false, ref: crypto.createHash('sha1').update(id).digest('hex').slice(0, 8) });
    } finally {
      client.release();
    }
  } catch (e) {
    send(res, 500, { error: 'db_error', code: e.code || 'unknown' });
  }
};
