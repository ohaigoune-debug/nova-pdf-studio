const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Initialize Database
const dbPath = path.join(__dirname, 'database.db');
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

// Create database tables if they don't exist
function initializeDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS contests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      contest_id INTEGER NOT NULL,
      platform TEXT NOT NULL CHECK(platform IN ('facebook', 'instagram')),
      post_id TEXT NOT NULL,
      post_url TEXT NOT NULL,
      post_type TEXT,
      total_comments INTEGER DEFAULT 0,
      fetched_at DATETIME,
      FOREIGN KEY(contest_id) REFERENCES contests(id),
      UNIQUE(contest_id, platform, post_id)
    );

    CREATE TABLE IF NOT EXISTS comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id INTEGER NOT NULL,
      comment_id TEXT NOT NULL UNIQUE,
      user_id TEXT,
      username TEXT,
      name TEXT NOT NULL,
      text TEXT,
      likes_count INTEGER DEFAULT 0,
      created_time DATETIME,
      is_reply INTEGER DEFAULT 0,
      parent_comment_id TEXT,
      mentions_count INTEGER DEFAULT 0,
      is_eligible INTEGER DEFAULT 1,
      fetched_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(post_id) REFERENCES posts(id)
    );

    CREATE TABLE IF NOT EXISTS winners (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      contest_id INTEGER NOT NULL,
      comment_id TEXT NOT NULL,
      user_id TEXT,
      username TEXT,
      name TEXT NOT NULL,
      comment_text TEXT,
      winner_rank INTEGER,
      drawn_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(contest_id) REFERENCES contests(id),
      FOREIGN KEY(comment_id) REFERENCES comments(comment_id)
    );

    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT UNIQUE NOT NULL,
      value TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_comments_post_id ON comments(post_id);
    CREATE INDEX IF NOT EXISTS idx_comments_eligible ON comments(is_eligible);
    CREATE INDEX IF NOT EXISTS idx_winners_contest_id ON winners(contest_id);
  `);
}

// Initialize database on startup
try {
  initializeDatabase();
  console.log('✓ Database initialized');
} catch (error) {
  console.error('✗ Database initialization error:', error.message);
}

// Helper function to safely log errors (no token exposure)
function logError(context, error) {
  const message = error.message || String(error);
  // Don't log sensitive info like tokens
  if (message.includes('401') || message.includes('403')) {
    console.error(`[${context}] Authentication error - check your Meta Access Token`);
  } else if (message.includes('4')) {
    console.error(`[${context}] API Error: ${message.substring(0, 100)}`);
  } else {
    console.error(`[${context}] Error: ${message}`);
  }
}

// ============ Meta API Helper Functions ============

// Extract Post ID from Facebook URL
function extractFacebookPostId(url) {
  try {
    const fbUrlPatterns = [
      /\/posts\/(\d+)/,
      /fbid=(\d+)/,
      /v\.(\d+)/,
      /\/photo\.php\?fbid=(\d+)/,
      /\/video\.php\?v=(\d+)/,
      /\/reel\/(\d+)/
    ];

    for (const pattern of fbUrlPatterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }
    return null;
  } catch (error) {
    return null;
  }
}

// Extract Instagram Media ID from URL
function extractInstagramMediaId(url) {
  try {
    const igUrlPatterns = [
      /\/p\/([A-Za-z0-9_-]+)/,
      /\/reel\/([A-Za-z0-9_-]+)/,
      /\/tv\/([A-Za-z0-9_-]+)/
    ];

    for (const pattern of igUrlPatterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }
    return null;
  } catch (error) {
    return null;
  }
}

// Extract mentions from text
function extractMentions(text) {
  if (!text) return 0;
  const mentions = text.match(/@\w+/g) || [];
  return mentions.length;
}

// ============ API Endpoints ============

// GET /api/meta/pages - Get Facebook pages
app.get('/api/meta/pages', (req, res) => {
  try {
    if (!process.env.META_ACCESS_TOKEN) {
      return res.status(400).json({
        error: 'META_ACCESS_TOKEN is not configured',
        message: 'Please set your Meta Access Token in settings'
      });
    }

    // TODO: Call Meta API to get pages
    res.json({
      message: 'Meta API integration available',
      status: 'ready'
    });
  } catch (error) {
    logError('GET /api/meta/pages', error);
    res.status(500).json({ error: 'Failed to fetch pages' });
  }
});

// POST /api/posts/resolve - Resolve post URL to post ID
app.post('/api/posts/resolve', (req, res) => {
  try {
    const { url, platform } = req.body;

    if (!url || !platform) {
      return res.status(400).json({ error: 'Missing url or platform' });
    }

    let postId = null;

    if (platform === 'facebook') {
      postId = extractFacebookPostId(url);
      if (!postId) {
        return res.status(400).json({
          error: 'Cannot extract Post ID from URL',
          message: 'Please enter the Post ID manually or use a direct post link'
        });
      }
    } else if (platform === 'instagram') {
      postId = extractInstagramMediaId(url);
      if (!postId) {
        return res.status(400).json({
          error: 'Cannot extract Media ID from URL',
          message: 'Please enter the Media ID manually or use a direct post link'
        });
      }
    }

    res.json({ postId, platform, url });
  } catch (error) {
    logError('POST /api/posts/resolve', error);
    res.status(500).json({ error: 'Failed to resolve post' });
  }
});

// POST /api/comments/fetch - Fetch comments from post
app.post('/api/comments/fetch', (req, res) => {
  try {
    const { platform, postId, contestId } = req.body;

    if (!platform || !postId || !contestId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (!process.env.META_ACCESS_TOKEN) {
      return res.status(401).json({
        error: 'Access Token not configured',
        message: 'Please set your Meta Access Token in settings'
      });
    }

    // TODO: Fetch comments from Meta API
    res.json({
      message: 'Comment fetching initialized',
      platform,
      postId,
      contestId
    });
  } catch (error) {
    logError('POST /api/comments/fetch', error);
    res.status(500).json({ error: 'Failed to fetch comments' });
  }
});

// GET /api/comments - Get comments for contest
app.get('/api/comments', (req, res) => {
  try {
    const { contestId, platform } = req.query;

    if (!contestId) {
      return res.status(400).json({ error: 'Missing contestId' });
    }

    const query = platform
      ? `SELECT c.*, p.platform, p.post_url FROM comments c
         JOIN posts p ON c.post_id = p.id
         WHERE p.contest_id = ? AND p.platform = ?
         ORDER BY c.created_time DESC`
      : `SELECT c.*, p.platform, p.post_url FROM comments c
         JOIN posts p ON c.post_id = p.id
         WHERE p.contest_id = ?
         ORDER BY c.created_time DESC`;

    const params = platform ? [contestId, platform] : [contestId];
    const comments = db.prepare(query).all(...params);

    res.json(comments);
  } catch (error) {
    logError('GET /api/comments', error);
    res.status(500).json({ error: 'Failed to fetch comments' });
  }
});

// POST /api/draw - Draw winners
app.post('/api/draw', (req, res) => {
  try {
    const {
      contestId,
      winnerCount,
      minMentions = 0,
      requiredKeyword = '',
      filterDuplicates = false,
      excludePageOwner = false,
      excludeReplies = false
    } = req.body;

    if (!contestId || !winnerCount) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Get eligible comments
    let query = `
      SELECT c.*, p.post_id, p.post_url, p.platform
      FROM comments c
      JOIN posts p ON c.post_id = p.id
      WHERE p.contest_id = ? AND c.is_eligible = 1
    `;
    const params = [contestId];

    if (excludeReplies) {
      query += ` AND c.is_reply = 0`;
    }

    if (minMentions > 0) {
      query += ` AND c.mentions_count >= ?`;
      params.push(minMentions);
    }

    if (requiredKeyword) {
      query += ` AND c.text LIKE ?`;
      params.push(`%${requiredKeyword}%`);
    }

    query += ` ORDER BY RANDOM()`;

    let candidates = db.prepare(query).all(...params);

    if (filterDuplicates || excludePageOwner) {
      const seen = new Set();
      candidates = candidates.filter(c => {
        if (seen.has(c.user_id || c.username)) return false;
        seen.add(c.user_id || c.username);
        return true;
      });
    }

    if (candidates.length < winnerCount) {
      return res.status(400).json({
        error: 'Not enough eligible comments',
        available: candidates.length,
        requested: winnerCount
      });
    }

    // Select winners using secure random
    const winners = candidates.slice(0, winnerCount);

    // Clear previous winners
    db.prepare('DELETE FROM winners WHERE contest_id = ?').run(contestId);

    // Insert new winners
    const insertStmt = db.prepare(`
      INSERT INTO winners (contest_id, comment_id, user_id, username, name, comment_text, winner_rank)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    winners.forEach((winner, index) => {
      insertStmt.run(
        contestId,
        winner.comment_id,
        winner.user_id,
        winner.username,
        winner.name,
        winner.text,
        index + 1
      );
    });

    res.json({
      success: true,
      winnersCount: winners.length,
      winners: winners.map((w, i) => ({
        rank: i + 1,
        name: w.name,
        username: w.username,
        comment: w.text,
        platform: w.platform
      }))
    });
  } catch (error) {
    logError('POST /api/draw', error);
    res.status(500).json({ error: 'Failed to draw winners' });
  }
});

// GET /api/export/csv - Export as CSV
app.get('/api/export/csv', (req, res) => {
  try {
    const { contestId } = req.query;

    if (!contestId) {
      return res.status(400).json({ error: 'Missing contestId' });
    }

    const comments = db.prepare(`
      SELECT c.*, p.platform, p.post_url,
             CASE WHEN w.id IS NOT NULL THEN w.winner_rank ELSE NULL END as winner_rank
      FROM comments c
      JOIN posts p ON c.post_id = p.id
      LEFT JOIN winners w ON c.comment_id = w.comment_id AND w.contest_id = ?
      WHERE p.contest_id = ?
      ORDER BY c.created_time DESC
    `).all(contestId, contestId);

    // Format CSV
    const csvRows = [
      ['Platform', 'Name', 'Username', 'User ID', 'Comment', 'Mentions', 'Date', 'Post URL', 'Comment ID', 'Eligible', 'Winner Rank']
    ];

    comments.forEach(c => {
      csvRows.push([
        c.platform,
        c.name || '',
        c.username || '',
        c.user_id || '',
        c.text || '',
        c.mentions_count || 0,
        c.created_time || '',
        c.post_url || '',
        c.comment_id,
        c.is_eligible ? 'Yes' : 'No',
        c.winner_rank || ''
      ]);
    });

    const csv = csvRows.map(row =>
      row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
    ).join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="contest_${contestId}_${Date.now()}.csv"`);
    res.send(csv);
  } catch (error) {
    logError('GET /api/export/csv', error);
    res.status(500).json({ error: 'Failed to export CSV' });
  }
});

// GET /api/export/xlsx - Export as Excel
app.get('/api/export/xlsx', (req, res) => {
  try {
    const xlsx = require('xlsx');
    const { contestId } = req.query;

    if (!contestId) {
      return res.status(400).json({ error: 'Missing contestId' });
    }

    const comments = db.prepare(`
      SELECT c.*, p.platform, p.post_url,
             CASE WHEN w.id IS NOT NULL THEN w.winner_rank ELSE NULL END as winner_rank
      FROM comments c
      JOIN posts p ON c.post_id = p.id
      LEFT JOIN winners w ON c.comment_id = w.comment_id AND w.contest_id = ?
      WHERE p.contest_id = ?
      ORDER BY c.created_time DESC
    `).all(contestId, contestId);

    // Format data
    const data = comments.map(c => ({
      'Platform': c.platform,
      'Name': c.name || '',
      'Username': c.username || '',
      'User ID': c.user_id || '',
      'Comment': c.text || '',
      'Mentions': c.mentions_count || 0,
      'Date': c.created_time || '',
      'Post URL': c.post_url || '',
      'Comment ID': c.comment_id,
      'Eligible': c.is_eligible ? 'Yes' : 'No',
      'Winner Rank': c.winner_rank || ''
    }));

    const worksheet = xlsx.utils.json_to_sheet(data);
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, 'Comments');

    // Set column widths
    worksheet['!cols'] = [
      { wch: 12 }, // Platform
      { wch: 20 }, // Name
      { wch: 20 }, // Username
      { wch: 15 }, // User ID
      { wch: 50 }, // Comment
      { wch: 10 }, // Mentions
      { wch: 20 }, // Date
      { wch: 40 }, // Post URL
      { wch: 20 }, // Comment ID
      { wch: 10 }, // Eligible
      { wch: 12 }  // Winner Rank
    ];

    const filename = `contest_${contestId}_${Date.now()}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    xlsx.write(workbook, { type: 'stream', bookType: 'xlsx' });
    xlsx.write(workbook, { type: 'stream' }).pipe(res);
  } catch (error) {
    logError('GET /api/export/xlsx', error);
    res.status(500).json({ error: 'Failed to export Excel' });
  }
});

// GET /api/health - Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Start server
app.listen(PORT, () => {
  console.log(`\n🎉 Comment Winner Server running on http://localhost:${PORT}`);
  console.log(`📊 Database: ${dbPath}`);
  console.log(`⚙️  Environment: ${process.env.NODE_ENV}\n`);
});

module.exports = app;
