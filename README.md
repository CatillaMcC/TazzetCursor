# Tazzet

AI-powered eLearning authoring wizard for instructional designers. Built with Node.js, Express, and the Anthropic Claude API.

---

## What it does

Tazzet guides an instructional designer through an 8-step wizard that collects:

1. **Content type** — lesson or course
2. **Source content** — file upload, pasted text, or URL
3. **Learning goal** — Cathy Moore's action mapping approach
4. **Learning outcomes** — Bloom's Taxonomy aligned, AI-generated and editable
5. **Learner profile** — experience level, audience type, delivery context
6. **Interactions** — full library: reflective moments, scenarios, knowledge checks, exploration, games, storytelling
7. **Scenario** — real-world situation library across water, wastewater, gas networks, offshore wind, energy, transport, and change management
8. **Video** — optional YouTube, Vimeo, or direct video URLs

It then calls Claude to generate a structured eLearning storyboard applying:

- Absorb-Do-Connect sequencing (Horton)
- Bloom's Taxonomy alignment
- Patti Shank MCQ quality rules
- Schon / Gibbs reflective prompts in every lesson
- Cognitive Load Theory chunking
- Knowles' adult learning principles

---

## Requirements

- Node.js 18 or higher (`node --version` to check)
- An Anthropic API key — get one at [console.anthropic.com](https://console.anthropic.com)

---

## Setup

```bash
# 1. Clone or unzip the project
cd tazzet

# 2. Install dependencies
npm install

# 3. Add your API key
cp .env.example .env
# Then open .env and replace sk-ant-... with your real key

# 4. Start the server
npm start
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Development (auto-restart on file changes)

```bash
npm run dev
```

Requires Node.js 18+ (uses the built-in `--watch` flag, no extra tools needed).

---

## Project structure

```
tazzet/
├── server.js          — Express API, auth, DB, Claude/Freepik proxies
├── package.json
├── .env.example       — Copy to `.env` and configure (see table below)
├── .gitignore
├── README.md
└── public/
    ├── index.html     — Main wizard UI (self-contained)
    ├── login.html
    ├── auth-callback.html
    ├── js/            — router, overrides, dots
    └── css/
```

---

## How Claude requests work

**Recommended (production):** Set `ANTHROPIC_API_KEY` on the server. The app can call `POST /api/generate`, `POST /api/stream`, and knowledge-article routes so the key stays on the server.

**Optional (local / dev):** The wizard can also call Anthropic directly from the browser using a key stored in `sessionStorage` when no server key is configured. That is less secure (key visible to the page); prefer the server proxy for shared deployments.

```
Browser → POST /api/generate  →  server.js  →  api.anthropic.com/v1/messages
```

---

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | For server-side AI | Anthropic API key (used by `/api/generate`, `/api/stream`, knowledge routes) |
| `JWT_SECRET` | **Yes in production** | Secret for signing session JWTs. Omit only for quick local dev (tokens reset on restart) |
| `DATABASE_URL` | For auth & persistence | PostgreSQL connection string; without it, auth features are limited |
| `DATABASE_SSL_REJECT_UNAUTHORIZED` | No | Set `true` when your DB TLS chain is trusted by Node (default is permissive for many cloud DBs) |
| `CLAUDE_MODEL` | No | Defaults to `claude-sonnet-4-20250514` |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | No | Google sign-in |
| `TAZZET_INVITE_CODE` | No | If set, registration requires this invite code |
| `FREEPIK_API_KEY` | No | Freepik search / image generation |
| `PORT` | No | Listen port (default `3000`) |

See `.env.example` for a template.

---

## Deploying

Tazzet runs anywhere Node.js is available.

**Railway / Render / Fly.io:** Set `ANTHROPIC_API_KEY`, `JWT_SECRET`, and `DATABASE_URL` (and any OAuth keys you use) in the dashboard. The server reads `process.env.PORT` automatically.

**Docker:**
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
EXPOSE 3000
CMD ["node", "server.js"]
```

---

## Extending Tazzet

- **Add more scenarios:** Edit the `SCENARIOS` object in `public/index.html`
- **Change the generation model:** Set `CLAUDE_MODEL` in `.env`
- **Streaming:** `POST /api/stream` in `server.js` already proxies SSE from Anthropic

---

## Built with

- [Express](https://expressjs.com/)
- [Anthropic Claude API](https://docs.anthropic.com/en/api/overview)
- [Material Design 3](https://m3.material.io/) principles
- Amplify Infrastructure brand system
