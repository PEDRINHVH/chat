const { Pool } = require('pg');

const FALLBACK = 'postgresql://postgres.jpsmhelzcgxaomxfasdt:entregavel321%21@aws-0-us-east-2.pooler.supabase.com:5432/postgres';

let pool = null;

function db() {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.SUPABASE_DB_URL || FALLBACK,
      ssl: { rejectUnauthorized: false },
      max: 2,
      idleTimeoutMillis: 8000,
      connectionTimeoutMillis: 8000
    });
  }
  return pool;
}

function body(req) {
  if (req.body && typeof req.body === 'object') return Promise.resolve(req.body);
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (c) => { raw += c; if (raw.length > 20000) { raw = raw.slice(0, 20000); } });
    req.on('end', () => {
      try { resolve(JSON.parse(raw || '{}')); } catch (e) { resolve({}); }
    });
  });
}

module.exports = { db, body };
