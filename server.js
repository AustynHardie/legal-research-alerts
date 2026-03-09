import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';

const app = express();
app.use(express.json({ limit: '2mb' }));
app.use(express.static('public'));

// ── Validate required env vars ────────────────────────────────────────────────
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
if (!ANTHROPIC_API_KEY) {
  console.error('ERROR: ANTHROPIC_API_KEY environment variable is not set.');
  console.error('Set it in your .env file (local) or Render environment variables (production).');
  process.exit(1);
}

const APP_PIN = process.env.APP_PIN;
if (!APP_PIN) {
  console.warn('WARNING: APP_PIN is not set. The /api/research endpoint is unprotected.');
}

// ── PIN auth middleware ───────────────────────────────────────────────────────
function requirePin(req, res, next) {
  if (!APP_PIN) return next();
  const pin = req.headers['x-pin'];
  if (!pin || pin !== APP_PIN) {
    return res.status(401).json({ error: 'Invalid or missing PIN.' });
  }
  next();
}

// ── Rate limiting (in-memory, no dependencies) ────────────────────────────────
const rateLimitMap = new Map();
const RATE_LIMIT = 10;           // max requests per window
const RATE_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

function rateLimit(req, res, next) {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  let entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + RATE_WINDOW_MS };
  }

  entry.count++;
  rateLimitMap.set(ip, entry);

  if (entry.count > RATE_LIMIT) {
    const retryAfterSec = Math.ceil((entry.resetAt - now) / 1000);
    res.set('Retry-After', retryAfterSec);
    return res.status(429).json({
      error: `Rate limit exceeded. Max ${RATE_LIMIT} requests per 15 minutes. Retry in ${Math.ceil(retryAfterSec / 60)} min.`
    });
  }
  next();
}

// ── Kill switch ───────────────────────────────────────────────────────────────
// Set KILL_SWITCH=true in env to block all research requests instantly (no redeploy needed)
const KILL_SWITCH = process.env.KILL_SWITCH === 'true';
if (KILL_SWITCH) console.warn('WARNING: Kill switch is active. All research requests will be rejected.');

// ── Proxy endpoint ────────────────────────────────────────────────────────────
// The frontend POSTs its request body here; we forward it to Anthropic
// with the API key injected server-side. The key never reaches the browser.
app.post('/api/research', requirePin, rateLimit, async (req, res) => {
  if (KILL_SWITCH) {
    return res.status(503).json({ error: 'Service is currently paused. Set KILL_SWITCH=false to resume.' });
  }
  try {
    const body = req.body;

    // Safety: only allow the model we expect, ignore any model override from client
    body.model = 'claude-sonnet-4-6';

    // Cap output tokens — 4000 is plenty for a structured report
    if (!body.max_tokens || body.max_tokens > 4000) body.max_tokens = 4000;

    // Cap web searches to 3 — each search result accumulates in context, driving up input tokens fast
    body.tools = [{ type: 'web_search_20250305', name: 'web_search', max_uses: 3 }];

    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'web-search-2025-03-05'
      },
      body: JSON.stringify(body)
    });

    const data = await upstream.json();

    if (!upstream.ok) {
      return res.status(upstream.status).json({
        error: data.error?.message || 'Anthropic API error',
        type: data.error?.type || 'api_error'
      });
    }

    res.json(data);

  } catch (err) {
    console.error('Proxy error:', err);
    res.status(500).json({ error: 'Internal server error', detail: err.message });
  }
});

// ── Health check (Render uses this to confirm service is up) ─────────────────
app.get('/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
createServer(app).listen(PORT, () => {
  console.log(`Legal Research Alerts running on http://localhost:${PORT}`);
});
