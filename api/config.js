// api/config.js — GET portfolio config (public) / POST update (admin only)
const connectDB = require('../lib/mongodb');
const { PortfolioData } = require('../lib/models');

const SESSION_TOKEN = process.env.SESSION_TOKEN || 'mock-admin-session-token-omega';

module.exports = async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  await connectDB();

  if (req.method === 'GET') {
    try {
      const doc = await PortfolioData.findOne({ _id: 'portfolio_config' }).lean();
      if (!doc) return res.json({});
      return res.json(doc.data || {});
    } catch (err) {
      console.error('GET /api/config error:', err);
      return res.status(500).json({ error: 'Failed to fetch portfolio data' });
    }
  }

  if (req.method === 'POST') {
    // Auth check
    const authHeader = req.headers.authorization;
    if (authHeader !== `Bearer ${SESSION_TOKEN}`) {
      return res.status(401).json({ error: 'Unauthorized access' });
    }
    try {
      const newConfig = req.body;
      await PortfolioData.findOneAndUpdate(
        { _id: 'portfolio_config' },
        { $set: { data: newConfig, updatedAt: new Date() } },
        { upsert: true, new: true }
      );
      return res.json({ success: true, message: 'Configuration updated successfully' });
    } catch (err) {
      console.error('POST /api/config error:', err);
      return res.status(500).json({ success: false, error: 'Failed to save configuration' });
    }
  }

  res.status(405).json({ error: 'Method not allowed' });
};
