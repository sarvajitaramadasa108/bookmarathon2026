import http from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { resolve, dirname, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { validateRegistration } from './public/validation.js';

const root = dirname(fileURLToPath(import.meta.url));
const publicDir = resolve(root, 'public');
const securityHeaders = {
  'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'DENY', 'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
};
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };

export async function createApp({ dbPath = process.env.DB_PATH || resolve(root, 'data/registrations.sqlite'), publicOrigin = process.env.PUBLIC_ORIGIN || '', rateLimit = 20 } = {}) {
  if (dbPath !== ':memory:') await mkdir(dirname(resolve(dbPath)), { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec(`PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS registrations (
      reference TEXT PRIMARY KEY, request_id TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL,
      name TEXT NOT NULL, mobile TEXT NOT NULL, age INTEGER NOT NULL, gender TEXT NOT NULL,
      area TEXT NOT NULL, devotee TEXT NOT NULL, participation TEXT NOT NULL,
      consent INTEGER NOT NULL, language TEXT NOT NULL
    );`);
  const insert = db.prepare('INSERT INTO registrations VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
  const find = db.prepare('SELECT * FROM registrations WHERE request_id = ?');
  const attempts = new Map();
  const cleanup = setInterval(() => { for (const [key, value] of attempts) if (value.until < Date.now()) attempts.delete(key); }, 60000);
  cleanup.unref();
  const json = (res, status, body, extra = {}) => {
    res.writeHead(status, { ...securityHeaders, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extra });
    res.end(JSON.stringify(body));
  };
  const server = http.createServer(async (req, res) => {
    try {
      const pathname = new URL(req.url, 'http://localhost').pathname;
      if (pathname.startsWith('/api/')) {
        if (pathname !== '/api/registrations') return json(res, 404, { error: 'Not found' });
        if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' }, { Allow: 'POST' });
        const origin = req.headers.origin;
        if (req.headers['sec-fetch-site'] === 'cross-site' || (origin && (publicOrigin ? origin !== publicOrigin : new URL(origin).host !== req.headers.host))) return json(res, 403, { error: 'Origin not allowed' });
        if (!/^application\/json(?:;|$)/i.test(req.headers['content-type'] || '')) return json(res, 415, { error: 'JSON required' });
        // Use the actual peer address, never an untrusted X-Forwarded-For header.
        const ip = req.socket.remoteAddress;
        let bucket = attempts.get(ip);
        if (!bucket || bucket.until < Date.now()) { bucket = { count: 0, until: Date.now() + 10 * 60000 }; attempts.set(ip, bucket); }
        if (++bucket.count > rateLimit) return json(res, 429, { error: 'Please try later' }, { 'Retry-After': String(Math.ceil((bucket.until - Date.now()) / 1000)) });
        const chunks = []; let size = 0;
        for await (const chunk of req) {
          size += chunk.length;
          if (size > 8192) { json(res, 413, { error: 'Request too large' }); return; }
          chunks.push(chunk);
        }
        let input;
        try { input = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { return json(res, 400, { error: 'Invalid JSON' }); }
        if (!input || typeof input !== 'object' || Array.isArray(input)) return json(res, 400, { error: 'Invalid request' });
        if (typeof input.requestId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.requestId)) return json(res, 400, { error: 'Invalid request ID' });
        const { data, errors, valid } = validateRegistration(input);
        if (!valid) return json(res, 422, { errors });
        const previous = find.get(input.requestId);
        if (previous) {
          if (Object.entries(data).some(([key, value]) => key !== 'language' && previous[key] !== (key === 'consent' ? Number(value) : value))) return json(res, 409, { error: 'Request ID already used' });
          return json(res, 200, { reference: previous.reference });
        }
        const reference = `BM26-${randomUUID().slice(0, 8).toUpperCase()}`;
        insert.run(reference, input.requestId, new Date().toISOString(), data.name, data.mobile, data.age, data.gender, data.area, data.devotee, data.participation, 1, data.language);
        return json(res, 201, { reference });
      }
      if (!['GET', 'HEAD'].includes(req.method)) return json(res, 405, { error: 'Method not allowed' }, { Allow: 'GET, HEAD' });
      let decoded;
      try { decoded = decodeURIComponent(pathname); } catch { return json(res, 400, { error: 'Invalid URL' }); }
      const path = resolve(publicDir, decoded === '/' ? 'index.html' : `.${decoded}`);
      if (!path.startsWith(publicDir + sep) || !types[extname(path)]) return json(res, 404, { error: 'Not found' });
      let body;
      try { body = await readFile(path); } catch { return json(res, 404, { error: 'Not found' }); }
      res.writeHead(200, { ...securityHeaders, 'Content-Type': types[extname(path)], 'Content-Length': body.length, 'Cache-Control': 'no-cache' });
      res.end(req.method === 'HEAD' ? undefined : body);
    } catch {
      // Do not log request bodies or personal registration details.
      if (!res.headersSent) json(res, 500, { error: 'Registration temporarily unavailable' });
      else res.end();
    }
  });
  server.headersTimeout = 15000; server.requestTimeout = 25000;
  server.on('close', () => { clearInterval(cleanup); db.close(); });
  return server;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const server = await createApp();
  const port = Number(process.env.PORT || 3026);
  server.listen(port, process.env.HOST || '127.0.0.1', () => console.log(`Book Marathon 2026: http://localhost:${port}`));
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close());
}
