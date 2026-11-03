export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const adminKey = process.env.ADMIN_VIEW_KEY;
  const suppliedKey = req.headers['x-admin-key'];
  if (!adminKey) return res.status(503).json({ error: 'Admin access is not configured' });
  if (typeof suppliedKey !== 'string' || suppliedKey !== adminKey) {
    return res.status(401).json({ error: 'Invalid admin key' });
  }

  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return res.status(503).json({ error: 'Registration storage is not configured' });

  const endpoint = `${url.replace(/\/$/, '')}/rest/v1/book_marathon_registrations?select=id,created_at,name,whatsapp_mobile,age,gender,area,category,devotee,availability,language&order=created_at.desc&limit=5000`;
  const response = await fetch(endpoint, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
  });
  if (!response.ok) return res.status(502).json({ error: 'Could not load registrations' });

  const rows = await response.json();
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({ rows });
}
