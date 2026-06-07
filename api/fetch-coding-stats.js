// api/fetch-coding-stats.js — Fetch stats for competitive programming profiles
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

  const { platform, username } = req.body || {};
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
      return res.json({ success: true, data });
    } else {
      return res.status(404).json({ error: `Could not fetch stats for ${platform} user: ${username}` });
    }
  } catch (err) {
    console.error('fetch-coding-stats error:', err);
    return res.status(500).json({ error: 'Failed to fetch coding stats' });
  }
};

// Helper functions (same as in server.js)
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
