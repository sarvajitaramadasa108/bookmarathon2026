import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../local-server.mjs';
import { copy, devotees, statistics } from '../public/content.js';
import { validateRegistration } from '../public/validation.js';

const registration = () => ({ requestId: randomUUID(), name: 'పరీక్ష భక్తుడు', mobile: '+91 98765 43210', age: 28, gender: 'male', area: 'విశాఖపట్నం', category: 'CONGREGATION', devotee: devotees[0][0], participation: 'evenings', consent: true, language: 'te' });
async function listen(options = {}) {
  const app = await createApp({ dbPath: ':memory:', ...options });
  await new Promise(resolve => app.listen(0, '127.0.0.1', resolve));
  return { app, url: `http://127.0.0.1:${app.address().port}` };
}
const close = app => new Promise(resolve => app.close(resolve));
const post = (url, data, headers = {}) => fetch(`${url}/api/registrations`, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(data) });

test('English and Telugu have complete matching translation keys', () => {
  assert.deepEqual(Object.keys(copy.en).sort(), Object.keys(copy.te).sort());
  assert.equal(devotees.length, 22);
  assert.equal(new Set(devotees.map(([name]) => name)).size, 22);
  assert.equal(statistics.find(row => row.key === 'medium').values[0], Math.round(161 * 161 / 404));
  assert.deepEqual(statistics.find(row => row.key === 'medium').estimated, [2023]);
});

test('validation accepts Telugu names and all participation options', () => {
  for (const participation of ['full_day', 'evenings', 'weekends']) {
    const result = validateRegistration({ ...registration(), participation });
    assert.equal(result.valid, true);
    assert.equal(result.data.mobile, '9876543210');
  }
});

test('validation rejects missing consent, forged options, invalid age and mobile', () => {
  const result = validateRegistration({ ...registration(), name: ' ', mobile: '1234', age: 1.5, devotee: 'Unknown', gender: 'unknown', participation: 'unknown', consent: false, area: '' });
  assert.equal(result.valid, false);
  assert.equal(Object.keys(result.errors).length, 8);
});

test('registrations persist across restart; retries return the same reference', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'bookmarathon-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const options = { dbPath: join(directory, 'registrations.sqlite') };
  let { app, url } = await listen(options);
  const data = registration();
  try {
    const response = await post(url, data);
    assert.equal(response.status, 201);
    const result = await response.json();
    assert.match(result.reference, /^BM26-[A-F0-9]{8}$/);
    await close(app);
    ({ app, url } = await listen(options));
    const retry = await post(url, data);
    assert.equal(retry.status, 200);
    assert.deepEqual(await retry.json(), result);
    const languageRetry = await post(url, { ...data, language: 'en' });
    assert.equal(languageRetry.status, 200);
    assert.deepEqual(await languageRetry.json(), result);
    assert.equal((await post(url, { ...data, area: 'Different area' })).status, 409);
    assert.equal((await fetch(`${url}/api/registrations`)).status, 405);
    assert.equal((await fetch(`${url}/data/registrations.sqlite`)).status, 404);
  } finally { await close(app); }
});

test('API rejects cross-origin, invalid, oversized and non-JSON submissions', async () => {
  const { app, url } = await listen();
  try {
    assert.equal((await post(url, registration(), { origin: 'https://unrelated.example' })).status, 403);
    assert.equal((await post(url, { ...registration(), consent: false })).status, 422);
    assert.equal((await post(url, { ...registration(), requestId: 'invalid' })).status, 400);
    assert.equal((await post(url, { ...registration(), name: 'x'.repeat(9000) })).status, 413);
    assert.equal((await fetch(`${url}/api/registrations`, { method: 'POST', body: 'not json' })).status, 415);
    assert.equal((await post(url, null)).status, 400);
  } finally { await close(app); }
});

test('API throttles requests and serves static assets with correct types', async () => {
  const { app, url } = await listen({ rateLimit: 1 });
  try {
    assert.equal((await post(url, registration())).status, 201);
    const limited = await post(url, registration());
    assert.equal(limited.status, 429); assert.ok(limited.headers.get('retry-after'));
    for (const path of ['/', '/app.js', '/content.js', '/validation.js', '/styles.css', '/assets/marathon-poster.jpg', '/assets/prabhupada-appeal.jpg', '/assets/world-of-books.jpg']) {
      const response = await fetch(`${url}${path}`);
      assert.equal(response.status, 200, path);
      assert.ok(response.headers.get('content-security-policy'));
    }
    assert.equal((await fetch(`${url}/server.mjs`)).status, 404);
    assert.equal((await fetch(`${url}/%2e%2e%5cserver.mjs`)).status, 404);
  } finally { await close(app); }
});
