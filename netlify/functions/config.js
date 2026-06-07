import connectDB from '../../lib/mongodb';
import { PortfolioData } from '../../lib/models';

const SESSION_TOKEN = process.env.SESSION_TOKEN || 'mock-admin-session-token-omega';

export default async (req, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json'
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers });
  }

  await connectDB();

  if (req.method === 'GET') {
    try {
      let doc = await PortfolioData.findOne({ _id: 'portfolio_config' }).lean();
      if (!doc) {
        console.log('🌱 MongoDB portfolio_config not found. Seeding from local data.json...');
        const fs = require('fs');
        const path = require('path');
        const localDataPath = path.join(process.cwd(), 'data.json');
        if (fs.existsSync(localDataPath)) {
          const localData = JSON.parse(fs.readFileSync(localDataPath, 'utf8'));
          await PortfolioData.findOneAndUpdate(
            { _id: 'portfolio_config' },
            { $set: { data: localData, updatedAt: new Date() } },
            { upsert: true, new: true }
          );
          return new Response(JSON.stringify(localData), { status: 200, headers });
        }
        return new Response(JSON.stringify({}), { status: 200, headers });
      }
      return new Response(JSON.stringify(doc.data || {}), { status: 200, headers });
    } catch (err) {
      console.error('GET /api/config error:', err);
      return new Response(JSON.stringify({ error: 'Failed to fetch portfolio data' }), { status: 500, headers });
    }
  }

  if (req.method === 'POST') {
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${SESSION_TOKEN}`) {
      return new Response(JSON.stringify({ error: 'Unauthorized access' }), { status: 401, headers });
    }
    try {
      const newConfig = await req.json();
      await PortfolioData.findOneAndUpdate(
        { _id: 'portfolio_config' },
        { $set: { data: newConfig, updatedAt: new Date() } },
        { upsert: true, new: true }
      );
      return new Response(JSON.stringify({ success: true, message: 'Configuration updated successfully' }), { status: 200, headers });
    } catch (err) {
      console.error('POST /api/config error:', err);
      return new Response(JSON.stringify({ success: false, error: 'Failed to save configuration' }), { status: 500, headers });
    }
  }

  return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers });
};

export const config = {
  path: "/api/config"
};
