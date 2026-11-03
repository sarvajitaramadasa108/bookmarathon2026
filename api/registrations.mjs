import { createApp } from '../local-server.mjs';

let appPromise;

export default async function handler(req, res) {
  // Vercel's Node runtime gives us the standard IncomingMessage/ServerResponse
  // pair. Reuse the tested request handler; use /tmp because function storage is
  // ephemeral and Vercel does not provide a persistent SQLite volume.
  appPromise ??= createApp({ dbPath: '/tmp/bookmarathon2026-registrations.sqlite' });
  const app = await appPromise;
  app.emit('request', req, res);
}
