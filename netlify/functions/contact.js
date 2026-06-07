import connectDB from '../../lib/mongodb';
import { Message } from '../../lib/models';

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

  await connectDB();

  let body = {};
  try {
    body = await req.json();
  } catch (e) {}

  const { name, email, subject, message } = body;

  if (!name || !email || !message) {
    return new Response(JSON.stringify({ success: false, error: 'Missing required fields: name, email, message' }), { status: 400, headers });
  }

  try {
    const newMsg = new Message({
      messageId: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
      name,
      email,
      subject: subject || 'No Subject',
      message,
      date: new Date()
    });
    await newMsg.save();
    return new Response(JSON.stringify({ success: true, message: 'Message sent successfully!' }), { status: 200, headers });
  } catch (err) {
    console.error('POST /api/contact error:', err);
    return new Response(JSON.stringify({ success: false, error: 'Failed to save message' }), { status: 500, headers });
  }
};

export const config = {
  path: "/api/contact"
};
