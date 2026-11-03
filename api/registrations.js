const allowed = {
  gender: new Set(['male', 'female']),
  category: new Set(['FOLK', 'CONGREGATION']),
  availability: new Set(['full_day', 'evenings', 'weekends']),
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return res.status(503).json({ error: 'Registration storage is not configured' });
  let body;
  try { body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body; } catch { return res.status(400).json({ error: 'Invalid JSON' }); }
  const mobile = String(body?.mobile ?? '').replace(/[\s()+-]/g, '').replace(/^91(?=\d{10}$)/, '');
  const age = Number(body?.age);
  if (!body?.name || body.name.length > 100 || !/^[6-9]\d{9}$/.test(mobile) || !Number.isInteger(age) || age < 1 || age > 120 || !allowed.gender.has(body.gender) || !body.area || body.area.length > 150 || !allowed.category.has(body.category) || !body.devotee || !allowed.availability.has(body.participation) || body.consent !== true) return res.status(422).json({ error: 'Invalid registration details' });
  const response = await fetch(`${url.replace(/\/$/, '')}/rest/v1/book_marathon_registrations`, { method: 'POST', headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' }, body: JSON.stringify({ name: body.name.trim(), whatsapp_mobile: mobile, age, gender: body.gender, area: body.area.trim(), category: body.category, devotee: body.devotee, availability: body.participation, language: body.language === 'te' ? 'te' : 'en' }) });
  if (!response.ok) return res.status(502).json({ error: 'Could not save registration' });
  return res.status(201).json({ ok: true });
}
