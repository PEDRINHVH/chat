const { db, body } = require('./_db');

function send(res, code, obj) { res.statusCode = code; res.end(JSON.stringify(obj)); }


const BASE = 180;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function entry(req, res) {
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'private, no-store, max-age=0');

  const data = req.method === 'POST' ? await body(req) : Object.fromEntries(new URL(req.url, 'http://x').searchParams);
  const id = String(data.account_id || '').trim();
  if (!UUID.test(id)) {
    send(res, 400, { error: 'invalid_account' });
    return;
  }

  try {
    const client = await db().connect();
    try {
      if (req.method === 'POST') {
        const up = await client.query(
          'update public.zr_accounts set waitlist_at = coalesce(waitlist_at, now()), last_seen = now() where id = $1 returning waitlist_at',
          [id]
        );
        if (!up.rows.length) {
          send(res, 404, { error: 'account_not_found' });
          return;
        }
      }
      const row = await client.query('select waitlist_at from public.zr_accounts where id = $1', [id]);
      if (!row.rows.length || !row.rows[0].waitlist_at) {
        send(res, 404, { error: 'not_in_waitlist' });
        return;
      }
      const ahead = await client.query(
        'select count(*)::int as n from public.zr_accounts where waitlist_at is not null and waitlist_at < $1',
        [row.rows[0].waitlist_at]
      );
      const position = BASE + ahead.rows[0].n + 1;
      const eta = Math.max(45, Math.round(position * 1.9));
      send(res, 200, { position, eta_seconds: eta, since: row.rows[0].waitlist_at });
    } finally {
      client.release();
    }
  } catch (e) {
    send(res, 500, { error: 'db_error', code: e.code || 'unknown' });
  }
}

module.exports = entry;
