'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = __dirname;
const PORT = Number(process.env.PORT) || 4173;
const HOST = '127.0.0.1';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.mp4': 'video/mp4',
  '.vtt': 'text/vtt; charset=utf-8',
};

const ROUTES = {
  '/': '/try.html',
  '/try': '/try.html',
  '/try/': '/try.html',
  '/try/cta': '/cta.html',
  '/try/cta/': '/cta.html',
  '/direction': '/.bunshin/direction/preview.html',
  '/direction.html': '/.bunshin/direction/preview.html',
};

function sendJson(res, status, body) {
  const data = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  });
  res.end(data);
}

function safePath(urlPath) {
  const clean = decodeURIComponent(urlPath.split('?')[0]);
  const target = path.normalize(path.join(ROOT, clean));
  return target.startsWith(ROOT) ? target : null;
}

function serveFile(req, res, filePath) {
  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('Não encontrado');
      return;
    }

    const type = MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
    const cache = filePath.includes(`${path.sep}.bunshin${path.sep}`)
      ? 'no-store'
      : 'public, max-age=3600';

    const range = req.headers.range;
    const match = range && /^bytes=(\d*)-(\d*)$/.exec(range);
    if (match) {
      let start = match[1] === '' ? null : Number(match[1]);
      let end = match[2] === '' ? null : Number(match[2]);
      if (start === null && end !== null) {
        start = Math.max(stat.size - end, 0);
        end = stat.size - 1;
      }
      if (start === null) start = 0;
      if (end === null || end >= stat.size) end = stat.size - 1;
      if (start > end) {
        res.writeHead(416, { 'content-range': `bytes */${stat.size}` });
        res.end();
        return;
      }
      res.writeHead(206, {
        'content-type': type,
        'content-length': end - start + 1,
        'content-range': `bytes ${start}-${end}/${stat.size}`,
        'accept-ranges': 'bytes',
        'cache-control': cache,
      });
      if (req.method === 'HEAD') {
        res.end();
        return;
      }
      fs.createReadStream(filePath, { start, end }).pipe(res);
      return;
    }

    res.writeHead(200, {
      'content-type': type,
      'content-length': stat.size,
      'accept-ranges': 'bytes',
      'cache-control': cache,
    });
    if (req.method === 'HEAD') {
      res.end();
      return;
    }
    fs.createReadStream(filePath).pipe(res);
  });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || HOST}`);
  const pathname = url.pathname;

  if (pathname === '/api-wa-pic.php') {
    const phone = String(url.searchParams.get('phone') || '').replace(/\D/g, '');
    if (phone.length < 10 || phone.length > 13) {
      sendJson(res, 400, { photo: null, leaks: [], ai_summary: 'Número inválido.' });
      return;
    }
    const upstream = 'https://chavedoamor.site/api-wa-pic.php?phone=' + encodeURIComponent(phone) + '&o=scan';
    fetch(upstream, { headers: { accept: 'application/json' } })
      .then(async (r) => {
        const text = await r.text();
        const headers = {
          'content-type': 'application/json; charset=utf-8',
          'cache-control': 'private, no-store, max-age=0',
        };
        const consulta = r.headers.get('x-zr-consulta');
        if (consulta) headers['x-zr-consulta'] = consulta;
        const retry = r.headers.get('x-zr-retry');
        if (retry !== null) headers['x-zr-retry'] = retry;
        res.writeHead(r.status, headers);
        res.end(text);
      })
      .catch(() => sendJson(res, 502, { photo: null, leaks: [], ai_summary: 'Falha ao consultar.' }));
    return;
  }

  if (pathname === '/health') {
    sendJson(res, 200, { ok: true, uptime: process.uptime() });
    return;
  }

  if (pathname === '/_f/e') {
    req.resume();
    res.writeHead(204);
    res.end();
    return;
  }

  const route = ROUTES[pathname];
  const target = route ? path.join(ROOT, route) : safePath(pathname);
  if (!target) {
    res.writeHead(403, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Caminho inválido');
    return;
  }
  serveFile(req, res, target);
});

server.listen(PORT, HOST, () => {
  console.log(`ZapRadar clone: http://${HOST}:${PORT}/try`);
});
