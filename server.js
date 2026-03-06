import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';

const app = express();
app.use(express.json({ limit: '2mb' }));
app.use(express.static('public'));

// ── Validate API key is set ───────────────────────────────────────────────────
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
if (!ANTHROPIC_API_KEY) {
  console.error('ERROR: ANTHROPIC_API_KEY environment variable is not set.');
  console.error('Set it in your .env file (local) or Render environment variables (production).');
  process.exit(1);
}

// ── Proxy endpoint ────────────────────────────────────────────────────────────
// The frontend POSTs its request body here; we forward it to Anthropic
// with the API key injected server-side. The key never reaches the browser.
app.post('/api/research', async (req, res) => {
  try {
    const body = req.body;

    // Safety: only allow the model we expect, ignore any model override from client
    body.model = 'claude-sonnet-4-20250514';

    // Always include web search tool
    body.tools = [{ type: 'web_search_20250305', name: 'web_search' }];

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
