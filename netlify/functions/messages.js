import connectDB from '../../lib/mongodb';
import { Message } from '../../lib/models';

const SESSION_TOKEN = process.env.SESSION_TOKEN || 'mock-admin-session-token-omega';

export default async (req, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json'
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers });
  }

  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${SESSION_TOKEN}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized access' }), { status: 401, headers });
  }

  await connectDB();

  if (req.method === 'GET') {
    try {
      const messages = await Message.find({}).sort({ date: -1 }).lean();
      const mapped = messages.map(m => ({
        id: m.messageId,
        name: m.name,
        email: m.email,
        subject: m.subject,
        message: m.message,
        date: m.date
      }));
      return new Response(JSON.stringify(mapped), { status: 200, headers });
    } catch (err) {
      console.error('GET /api/messages error:', err);
      return new Response(JSON.stringify({ error: 'Failed to fetch messages' }), { status: 500, headers });
    }
  }

  if (req.method === 'DELETE') {
    const url = new URL(req.url);
    const id = url.searchParams.get('id');
    if (!id) {
      return new Response(JSON.stringify({ error: 'Message ID is required in query param ?id=' }), { status: 400, headers });
    }
    try {
      const result = await Message.deleteOne({ messageId: id });
      if (result.deletedCount === 0) {
        return new Response(JSON.stringify({ success: false, error: 'Message not found' }), { status: 404, headers });
      }
      return new Response(JSON.stringify({ success: true, message: 'Message deleted successfully' }), { status: 200, headers });
    } catch (err) {
      console.error('DELETE /api/messages error:', err);
      return new Response(JSON.stringify({ success: false, error: 'Failed to delete message' }), { status: 500, headers });
    }
  }

  return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers });
};

export const config = {
  path: "/api/messages"
};
