// api/fetch-metadata.js — Scrape social media post metadata from URL
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const SESSION_TOKEN = process.env.SESSION_TOKEN || 'mock-admin-session-token-omega';
  if (req.headers.authorization !== `Bearer ${SESSION_TOKEN}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { url } = req.body || {};
  if (!url) return res.status(400).json({ error: 'URL is required' });

  try {
    const result = {
      title: '', excerpt: '', image: '', url: url, stars: 0, forks: 0,
      date: new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    };

    // 1. GitHub Repository
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
      } catch (e) { /* fallback below */ }
      result.title = repo.replace(/[-_]/g, ' ');
      result.excerpt = 'GitHub Repository';
      return res.json({ success: true, data: result });
    }

    // 2. Twitter / X
    const twRegex = /(twitter\.com|x\.com)\/[^\/]+\/status\/(\d+)/i;
    const twMatch = url.match(twRegex);
    if (twMatch) {
      const tweetId = twMatch[2];
      try {
        const twRes = await fetch(`https://cdn.syndication.twimg.com/tweet-result?id=${tweetId}`, {
          headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        if (twRes.ok) {
          const twData = await twRes.json();
          result.excerpt = twData.text || '';
          if (twData.created_at) {
            result.date = new Date(twData.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
          }
          return res.json({ success: true, data: result });
        }
      } catch (e) { /* fallback */ }
    }

    // 3. General OG parser (LinkedIn etc.)
    try {
      const pageRes = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5'
        }
      });
      if (pageRes.ok) {
        const html = await pageRes.text();
        const meta = {};
        const metaTagRegex = /<meta\s+[^>]*>/gi;
        let match;
        while ((match = metaTagRegex.exec(html)) !== null) {
          const tag = match[0];
          const propMatch = /property=["']([^"']+)["']/i.exec(tag) || /name=["']([^"']+)["']/i.exec(tag);
          const contentMatch = /content=["']([^"']+)["']/i.exec(tag);
          if (propMatch && contentMatch) {
            meta[propMatch[1].toLowerCase()] = contentMatch[1];
          }
        }
        const titleMatch = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
        if (titleMatch && !meta['title']) meta['title'] = titleMatch[1].trim();

        result.title = meta['og:title'] || meta['twitter:title'] || meta['title'] || '';
        result.excerpt = meta['og:description'] || meta['twitter:description'] || meta['description'] || '';
        result.image = meta['og:image'] || meta['twitter:image'] || '';

        if (url.includes('linkedin.com')) {
          const desc = result.excerpt;
          if (desc) {
            const lines = desc.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
            let titleIndex = 0;
            for (let i = 0; i < lines.length; i++) {
              const words = lines[i].split(/\s+/);
              if (!words.every(w => w.startsWith('#') || ['|', '•', '-'].includes(w))) {
                titleIndex = i; break;
              }
            }
            result.title = lines[titleIndex] || lines[0];
            result.excerpt = lines.slice(titleIndex + 1, titleIndex + 7).join('\n');
          }
        }
        return res.json({ success: true, data: result });
      }
    } catch (e) { /* fallback */ }

    // Final fallback
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/').filter(Boolean);
    result.title = (pathParts[pathParts.length - 1] || 'Link').replace(/[-_]/g, ' ');
    result.excerpt = `Post on ${urlObj.hostname}`;
    return res.json({ success: true, data: result });

  } catch (err) {
    console.error('fetch-metadata error:', err);
    return res.status(500).json({ error: 'Failed to fetch URL metadata' });
  }
};
