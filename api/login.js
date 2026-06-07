// api/login.js — Admin authentication
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { password } = req.body || {};
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
  const SESSION_TOKEN = process.env.SESSION_TOKEN || 'mock-admin-session-token-omega';

  if (password === ADMIN_PASSWORD) {
    return res.json({ success: true, token: SESSION_TOKEN });
  } else {
    return res.status(400).json({ success: false, error: 'Incorrect password' });
  }
};
