// api/messages.js — GET all messages / DELETE one by messageId
const connectDB = require('../lib/mongodb');
const { Message } = require('../lib/models');

const SESSION_TOKEN = process.env.SESSION_TOKEN || 'mock-admin-session-token-omega';

function checkAuth(req) {
  return req.headers.authorization === `Bearer ${SESSION_TOKEN}`;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (!checkAuth(req)) {
    return res.status(401).json({ error: 'Unauthorized access' });
  }

  await connectDB();

  // GET /api/messages — return all messages sorted by date desc
  if (req.method === 'GET') {
    try {
      const messages = await Message.find({}).sort({ date: -1 }).lean();
      // Map to match old format (id instead of messageId for frontend compatibility)
      return res.json(messages.map(m => ({
        id: m.messageId,
        name: m.name,
        email: m.email,
        subject: m.subject,
        message: m.message,
        date: m.date
      })));
    } catch (err) {
      console.error('GET /api/messages error:', err);
      return res.status(500).json({ error: 'Failed to fetch messages' });
    }
  }

  // DELETE /api/messages?id=<messageId>
  if (req.method === 'DELETE') {
    const id = req.query.id;
    if (!id) {
      return res.status(400).json({ error: 'Message ID is required in query param ?id=' });
    }
    try {
      const result = await Message.deleteOne({ messageId: id });
      if (result.deletedCount === 0) {
        return res.status(404).json({ success: false, error: 'Message not found' });
      }
      return res.json({ success: true, message: 'Message deleted successfully' });
    } catch (err) {
      console.error('DELETE /api/messages error:', err);
      return res.status(500).json({ success: false, error: 'Failed to delete message' });
    }
  }

  res.status(405).json({ error: 'Method not allowed' });
};
