const express = require('express');
const fs = require('fs');
const path = require('path');
const bodyParser = require('body-parser');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const SESSION_TOKEN = process.env.SESSION_TOKEN || 'mock-admin-session-token-omega';

app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname)));

// ====================================================
// DATA LAYER: Use MongoDB if MONGODB_URI is set,
// otherwise fall back to local JSON files (dev mode)
// ====================================================
const MONGODB_URI = process.env.MONGODB_URI;
const DATA_FILE = path.join(__dirname, 'data.json');
const MESSAGES_FILE = path.join(__dirname, 'messages.json');

let mongoose, PortfolioData, Message;
let useDB = false;

async function initDB() {
  if (!MONGODB_URI) {
    console.log('📁 No MONGODB_URI found — using local file storage (dev mode)');
    return;
  }
  try {
    mongoose = require('mongoose');
    const { PortfolioData: PD, Message: Msg } = require('./lib/models');
    PortfolioData = PD;
    Message = Msg;
    await mongoose.connect(MONGODB_URI, { bufferCommands: false });
    useDB = true;
    console.log('✅ Connected to MongoDB Atlas');
  } catch (err) {
    console.error('❌ MongoDB connection failed, falling back to file storage:', err.message);
    useDB = false;
  }
}

// --- File-based helpers (local dev fallback) ---
function readFileData(filePath, defaultVal) {
  if (!fs.existsSync(filePath)) return defaultVal;
  try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch { return defaultVal; }
}
function writeFileData(filePath, data) {
  try { fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8'); return true; } catch { return false; }
}

// --- Unified data access helpers ---
async function getPortfolioData() {
  if (useDB) {
    let doc = await PortfolioData.findOne({ _id: 'portfolio_config' }).lean();
    if (!doc) {
      console.log('🌱 MongoDB portfolio_config not found. Seeding from local data.json...');
      const localData = readFileData(DATA_FILE, {});
      if (Object.keys(localData).length > 0) {
        await savePortfolioData(localData);
        return localData;
      }
      return {};
    }
    return doc.data || {};
  }
  return readFileData(DATA_FILE, {});
}

async function savePortfolioData(data) {
  if (useDB) {
    await PortfolioData.findOneAndUpdate(
      { _id: 'portfolio_config' },
      { $set: { data, updatedAt: new Date() } },
      { upsert: true, new: true }
    );
    return true;
  }
  return writeFileData(DATA_FILE, data);
}

async function getMessages() {
  if (useDB) {
    const msgs = await Message.find({}).sort({ date: -1 }).lean();
    return msgs.map(m => ({ id: m.messageId, name: m.name, email: m.email, subject: m.subject, message: m.message, date: m.date }));
  }
  return readFileData(MESSAGES_FILE, []);
}

async function addMessage(msg) {
  if (useDB) {
    const newMsg = new Message({ messageId: msg.id, name: msg.name, email: msg.email, subject: msg.subject, message: msg.message, date: new Date(msg.date) });
    await newMsg.save();
    return true;
  }
  const messages = readFileData(MESSAGES_FILE, []);
  messages.unshift(msg);
  return writeFileData(MESSAGES_FILE, messages);
}

async function deleteMessage(id) {
  if (useDB) {
    const result = await Message.deleteOne({ messageId: id });
    return result.deletedCount > 0;
  }
  let messages = readFileData(MESSAGES_FILE, []);
  const initialLen = messages.length;
  messages = messages.filter(m => m.id !== id);
  if (messages.length === initialLen) return false;
  return writeFileData(MESSAGES_FILE, messages);
}

// ====================================================
// AUTH MIDDLEWARE
// ====================================================
function checkAuth(req, res, next) {
  if (req.headers.authorization === `Bearer ${SESSION_TOKEN}`) {
    next();
  } else {
    res.status(401).json({ error: 'Unauthorized access' });
  }
}

// ====================================================
// ROUTES
// ====================================================
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'home.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'admin.html')));

// Auth
app.post('/api/login', (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) {
    res.json({ success: true, token: SESSION_TOKEN });
  } else {
    res.status(400).json({ success: false, error: 'Incorrect password' });
  }
});

// Portfolio config
app.get('/api/config', async (req, res) => {
  try {
    res.json(await getPortfolioData());
  } catch (err) {
    console.error('GET /api/config error:', err);
    res.status(500).json({ error: 'Failed to fetch data' });
  }
});

app.post('/api/config', checkAuth, async (req, res) => {
  try {
    await savePortfolioData(req.body);
    res.json({ success: true, message: 'Configuration updated successfully' });
  } catch (err) {
    console.error('POST /api/config error:', err);
    res.status(500).json({ success: false, error: 'Failed to save configuration' });
  }
});

// Contact messages
app.post('/api/contact', async (req, res) => {
  const { name, email, subject, message } = req.body;
  if (!name || !email || !message) {
    return res.status(400).json({ success: false, error: 'Missing required fields' });
  }
  const newMessage = {
    id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
    name, email,
    subject: subject || 'No Subject',
    message,
    date: new Date().toISOString()
  };
  try {
    await addMessage(newMessage);
    res.json({ success: true, message: 'Message sent successfully!' });
  } catch (err) {
    console.error('POST /api/contact error:', err);
    res.status(500).json({ success: false, error: 'Failed to save message' });
  }
});

app.get('/api/messages', checkAuth, async (req, res) => {
  try {
    res.json(await getMessages());
  } catch (err) {
    console.error('GET /api/messages error:', err);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// DELETE /api/messages/:id — supports both route param AND ?id= query for Vercel compatibility
app.delete('/api/messages/:id', checkAuth, async (req, res) => {
  const id = req.params.id || req.query.id;
  if (!id) return res.status(400).json({ success: false, error: 'Message ID required' });
  try {
    const deleted = await deleteMessage(id);
    if (!deleted) return res.status(404).json({ success: false, error: 'Message not found' });
    res.json({ success: true, message: 'Message deleted successfully' });
  } catch (err) {
    console.error('DELETE /api/messages error:', err);
    res.status(500).json({ success: false, error: 'Failed to delete message' });
  }
});

// Social metadata fetcher
app.post('/api/fetch-metadata', checkAuth, async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL is required' });

  try {
    const result = {
      title: '', excerpt: '', image: '', url,
      stars: 0, forks: 0,
      date: new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    };

    const ghRegex = /github\.com\/([^\/]+)\/([^\/]+)/i;
    const ghMatch = url.match(ghRegex);
    if (ghMatch) {
      const owner = ghMatch[1];
      const repo = ghMatch[2].split('#')[0].split('?')[0];
      try {
        const ghRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
          headers: { 'User-Agent': 'Portfolio-Bot/1.0' }
        });
        if (ghRes.ok) {
          const ghData = await ghRes.json();
          result.title = ghData.name || repo;
          result.excerpt = ghData.description || '';
          result.stars = ghData.stargazers_count || 0;
          result.forks = ghData.forks_count || 0;
          result.url = ghData.html_url || url;
          return res.json({ success: true, data: result });
        }
      } catch (e) {}
      result.title = repo.replace(/[-_]/g, ' ');
      result.excerpt = 'GitHub Repository';
      return res.json({ success: true, data: result });
    }

    const twRegex = /(twitter\.com|x\.com)\/[^\/]+\/status\/(\d+)/i;
    const twMatch = url.match(twRegex);
    if (twMatch) {
      try {
        const twRes = await fetch(`https://cdn.syndication.twimg.com/tweet-result?id=${twMatch[2]}`, {
          headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        if (twRes.ok) {
          const twData = await twRes.json();
          result.excerpt = twData.text || '';
          if (twData.created_at) result.date = new Date(twData.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
          return res.json({ success: true, data: result });
        }
      } catch (e) {}
    }

    try {
      const pageRes = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/115.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5'
        }
      });
      if (pageRes.ok) {
        const html = await pageRes.text();
        const meta = {};
        const metaTagRegex = /<meta\s+[^>]*>/gi;
        let m;
        while ((m = metaTagRegex.exec(html)) !== null) {
          const tag = m[0];
          const propMatch = /property=["']([^"']+)["']/i.exec(tag) || /name=["']([^"']+)["']/i.exec(tag);
          const contentMatch = /content=["']([^"']+)["']/i.exec(tag);
          if (propMatch && contentMatch) meta[propMatch[1].toLowerCase()] = contentMatch[1];
        }
        const titleMatch = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
        if (titleMatch && !meta['title']) meta['title'] = titleMatch[1].trim();
        result.title = meta['og:title'] || meta['twitter:title'] || meta['title'] || '';
        result.excerpt = meta['og:description'] || meta['twitter:description'] || meta['description'] || '';
        result.image = meta['og:image'] || meta['twitter:image'] || '';
        if (url.includes('linkedin.com') && result.excerpt) {
          const lines = result.excerpt.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
          let ti = 0;
          for (let i = 0; i < lines.length; i++) {
            if (!lines[i].split(/\s+/).every(w => w.startsWith('#') || ['|','•','-'].includes(w))) { ti = i; break; }
          }
          result.title = lines[ti] || lines[0];
          result.excerpt = lines.slice(ti + 1, ti + 7).join('\n');
        }
        return res.json({ success: true, data: result });
      }
    } catch (e) {}

    const urlObj = new URL(url);
    const parts = urlObj.pathname.split('/').filter(Boolean);
    result.title = (parts[parts.length - 1] || 'Link').replace(/[-_]/g, ' ');
    result.excerpt = `Post on ${urlObj.hostname}`;
    res.json({ success: true, data: result });
  } catch (err) {
    console.error('fetch-metadata error:', err);
    res.status(500).json({ error: 'Failed to fetch URL metadata' });
  }
});

// --- Coding Profiles Autofetch helpers ---
async function fetchLeetCode(username) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch('https://leetcode.com/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      body: JSON.stringify({
        query: `
          query userProblemsSolved($username: String!) {
            matchedUser(username: $username) {
              submitStats {
                acSubmissionNum {
                  difficulty
                  count
                }
              }
            }
          }
        `,
        variables: { username }
      }),
      signal: controller.signal
    });
    clearTimeout(id);
    if (!res.ok) return null;
    const json = await res.json();
    const stats = json.data?.matchedUser?.submitStats?.acSubmissionNum;
    if (!stats) return null;
    const easyObj = stats.find(s => s.difficulty === 'Easy') || { count: 0 };
    const medObj = stats.find(s => s.difficulty === 'Medium') || { count: 0 };
    const hardObj = stats.find(s => s.difficulty === 'Hard') || { count: 0 };
    const totalObj = stats.find(s => s.difficulty === 'All') || { count: 0 };
    return {
      easy: easyObj.count,
      medium: medObj.count,
      hard: hardObj.count,
      total: totalObj.count
    };
  } catch (err) {
    clearTimeout(id);
    console.error('LeetCode fetch error:', err);
    return null;
  }
}

async function fetchGFG(username) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(`https://www.geeksforgeeks.org/user/${username}/`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
      },
      signal: controller.signal
    });
    clearTimeout(id);
    if (!res.ok) return null;
    const html = await res.text();
    
    // Attempt Next.js data parse first
    const matchJson = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
    if (matchJson) {
      try {
        const nextData = JSON.parse(matchJson[1]);
        const userInfo = nextData.props?.pageProps?.userInfo || nextData.props?.pageProps?.profileData || {};
        const total = userInfo.total_problems_solved || userInfo.totalProblemsSolved || 0;
        const diffStats = userInfo.difficultyStats || userInfo.difficulty_stats || {};
        const easy = diffStats.easy || diffStats.Easy || 0;
        const medium = diffStats.medium || diffStats.Medium || 0;
        const hard = diffStats.hard || diffStats.Hard || 0;
        
        if (total > 0) {
          return { easy, medium, hard, total };
        }
      } catch (e) {}
    }
    
    // Regexp fallbacks
    const solvedMatch = html.match(/Problems Solved:?\s*<\/span>\s*<span[^>]*>(\d+)/i) || 
                        html.match(/scoreCard_card_value[^>]*>(\d+)<\/span>/i) ||
                        html.match(/total_problems_solved(?:\\")?\s*:\s*(\d+)/i) ||
                        html.match(/totalProblemsSolved(?:\\")?\s*:\s*(\d+)/i);
    const total = solvedMatch ? parseInt(solvedMatch[1]) : 0;
    const easyMatch = html.match(/easy(?:\\")?\s*:\s*(\d+)/i);
    const medMatch = html.match(/medium(?:\\")?\s*:\s*(\d+)/i);
    const hardMatch = html.match(/hard(?:\\")?\s*:\s*(\d+)/i);
    
    return {
      easy: easyMatch ? parseInt(easyMatch[1]) : Math.round(total * 0.4),
      medium: medMatch ? parseInt(medMatch[1]) : Math.round(total * 0.45),
      hard: hardMatch ? parseInt(hardMatch[1]) : Math.round(total * 0.15),
      total: total
    };
  } catch (err) {
    clearTimeout(id);
    console.error('GFG fetch error:', err);
    return null;
  }
}

async function fetchCodeChef(username) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(`https://www.codechef.com/users/${username}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      signal: controller.signal
    });
    clearTimeout(id);
    if (!res.ok) return null;
    const html = await res.text();
    
    const ratingMatch = html.match(/rating-number">\s*(\d+)/i) || html.match(/<div class="rating-number">(\d+)/i);
    const ratingVal = ratingMatch ? ratingMatch[1].trim() : '';
    
    const starMatch = html.match(/class="rating-star"[^>]*>([\s\S]*?)<\/span>/i) || html.match(/(\d\s*★)/i);
    const stars = starMatch ? starMatch[1].replace(/<[^>]*>/g, '').trim() : '';
    const rating = ratingVal ? `${ratingVal} ${stars}`.trim() : '';
    
    const solvedMatch = html.match(/Total Problems Solved:\s*(\d+)/i) || html.match(/Fully Solved\s*\((\d+)\)/i) || html.match(/fullySolved\s*:\s*(\d+)/i);
    const total = solvedMatch ? parseInt(solvedMatch[1]) : 0;
    
    return {
      rating: rating || 'Unrated',
      easy: Math.round(total * 0.5),
      medium: Math.round(total * 0.4),
      hard: Math.round(total * 0.1),
      total: total
    };
  } catch (err) {
    clearTimeout(id);
    console.error('CodeChef fetch error:', err);
    return null;
  }
}

async function fetchHackerRank(username) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(`https://www.hackerrank.com/rest/hackers/${username}/profile`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      signal: controller.signal
    });
    clearTimeout(id);
    if (!res.ok) return null;
    const json = await res.json();
    const profile = json.model;
    if (!profile) return null;
    const total = profile.solved_challenges || 0;
    
    return {
      stars: profile.personal_brand || 'Developer',
      easy: Math.round(total * 0.5),
      medium: Math.round(total * 0.35),
      hard: Math.round(total * 0.15),
      total: total
    };
  } catch (err) {
    clearTimeout(id);
    console.error('HackerRank fetch error:', err);
    return null;
  }
}

// API to fetch stats for competitive programming profiles
app.post('/api/fetch-coding-stats', checkAuth, async (req, res) => {
  const { platform, username } = req.body;
  if (!platform || !username) {
    return res.status(400).json({ error: 'Platform and username are required' });
  }

  try {
    let data = null;
    const cleanUser = username.trim();

    if (platform === 'leetcode') {
      data = await fetchLeetCode(cleanUser);
    } else if (platform === 'gfg') {
      data = await fetchGFG(cleanUser);
    } else if (platform === 'codechef') {
      data = await fetchCodeChef(cleanUser);
    } else if (platform === 'hackerrank') {
      data = await fetchHackerRank(cleanUser);
    }

    if (data) {
      res.json({ success: true, data });
    } else {
      res.status(404).json({ error: `Could not fetch stats for ${platform} user: ${username}` });
    }
  } catch (err) {
    console.error('fetch-coding-stats error:', err);
    res.status(500).json({ error: 'Failed to fetch coding stats' });
  }
});

// ====================================================
// START SERVER
// ====================================================
initDB().then(() => {
  app.listen(PORT, () => {
    console.log('====================================================');
    console.log(`🚀 Server running on: http://localhost:${PORT}`);
    console.log(`🔧 Admin panel:      http://localhost:${PORT}/admin`);
    console.log(`💾 Storage:          ${useDB ? 'MongoDB Atlas' : 'Local JSON files'}`);
    console.log('====================================================');
  });
});
