# Legal Research Alerts

AI-powered legal research monitoring dashboard. Add research topics, run on-demand reports using Claude + live web search, review sourced findings with methodology transparency.

## How it works

- **Frontend** — dashboard served as static HTML from `public/index.html`
- **Backend** — Express server in `server.js` proxies requests to the Anthropic API
- **API key** — stored only as a server environment variable, never sent to the browser

---

## Deploy to Render (recommended)

### 1. Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
# Create a new repo on github.com, then:
git remote add origin https://github.com/YOUR_USERNAME/legal-research-alerts.git
git push -u origin main
```

### 2. Create a Web Service on Render

1. Go to [render.com](https://render.com) → **New** → **Web Service**
2. Connect your GitHub repo
3. Configure:
   - **Name:** `legal-research-alerts` (or anything you like)
   - **Runtime:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Instance Type:** Free (sufficient for personal use)

### 3. Add your Anthropic API key

In Render's **Environment** tab, add:

| Key | Value |
|-----|-------|
| `ANTHROPIC_API_KEY` | `sk-ant-api03-...` |
| `APP_PIN` | `your-pin` |

Get your API key at [console.anthropic.com](https://console.anthropic.com)

`APP_PIN` gates the site with a PIN prompt. If not set, the endpoint is unprotected (fine for local-only use).

### 4. Deploy

Click **Create Web Service**. Render will build and deploy in ~2 minutes. You'll get a URL like `https://legal-research-alerts.onrender.com` — share this with anyone who needs access.

---

## Run locally

```bash
# Install dependencies
npm install

# Copy env file and add your key
cp .env.example .env
# Edit .env and set ANTHROPIC_API_KEY

# Start the server
npm start
# or for auto-reload during development:
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Adding new research alerts

In the dashboard sidebar, click **Add New Alert** and provide:
- **Alert Name** — short label (e.g. "BEPS Action 6 — LOB Clause")
- **Research Query** — detailed description of what to search for. Be specific about the legal provision, jurisdiction, and type of development you want tracked.
- **Frequency** — weekly / daily / monthly (display only; all alerts are run manually via the Run Now button)

---

## Security notes

- The Anthropic API key is stored only in Render's environment — it never reaches the browser
- No user authentication is included by default. If the URL should be private, add HTTP Basic Auth via Render's access controls, or add an auth layer to `server.js`
- Alert data is stored in each user's browser localStorage — it is not shared between users or persisted server-side

---

## Cost

Each report run uses approximately 4,000–10,000 tokens on Claude Sonnet.
At $3/million input + $15/million output, each run costs roughly **$0.02–$0.05**.
A weekly cadence across 5 alerts = ~$0.50–$1.00/month.
