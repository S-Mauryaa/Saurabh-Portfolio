const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const SESSION_TOKEN = process.env.SESSION_TOKEN || 'mock-admin-session-token-omega';

export default async (req, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers });
  }

  let body = {};
  try {
    body = await req.json();
  } catch (e) {}

  const { password } = body;

  if (password === ADMIN_PASSWORD) {
    return new Response(JSON.stringify({ success: true, token: SESSION_TOKEN }), { status: 200, headers });
  } else {
    return new Response(JSON.stringify({ success: false, error: 'Incorrect password' }), { status: 400, headers });
  }
};

export const config = {
  path: "/api/login"
};
