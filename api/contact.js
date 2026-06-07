// api/contact.js — POST: save contact form submission
const connectDB = require('../lib/mongodb');
const { Message } = require('../lib/models');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  await connectDB();

  const { name, email, subject, message } = req.body || {};

  if (!name || !email || !message) {
    return res.status(400).json({ success: false, error: 'Missing required fields: name, email, message' });
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
    return res.json({ success: true, message: 'Message sent successfully!' });
  } catch (err) {
    console.error('POST /api/contact error:', err);
    return res.status(500).json({ success: false, error: 'Failed to save message' });
  }
};
