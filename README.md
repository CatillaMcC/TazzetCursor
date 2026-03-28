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
├── server.js          — Express server and /api/generate proxy
├── package.json
├── .env.example       — Copy to .env and add your API key
├── .gitignore
├── README.md
└── public/
    └── index.html     — The full wizard front-end (self-contained)
```

---

## How the API proxy works

The browser never sees the API key. All Claude calls go through:

```
Browser → POST /api/generate  →  server.js  →  api.anthropic.com/v1/messages
                                                        ↓
Browser ← { text, model, usage }  ←  server.js  ←  response
```

The server adds the `x-api-key` header server-side. The front-end only sends a `prompt` string to `/api/generate`.

---

## Environment variables

| Variable            | Required | Default                        | Description                        |
|---------------------|----------|--------------------------------|------------------------------------|
| `ANTHROPIC_API_KEY` | Yes      | —                              | Your Anthropic API key             |
| `CLAUDE_MODEL`      | No       | `claude-sonnet-4-20250514`     | Override the Claude model          |
| `MAX_TOKENS`        | No       | `4000`                         | Max tokens for generation response |
| `PORT`              | No       | `3000`                         | Port the server listens on         |

---

## Deploying

Tazzet runs anywhere Node.js is available.

**Railway / Render / Fly.io:** Set `ANTHROPIC_API_KEY` as an environment variable in the dashboard. The server reads `process.env.PORT` automatically.

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
- **Add streaming:** Replace the single-shot fetch in `server.js` with `stream: true` and pipe the SSE response to the browser
- **Add authentication:** Add an Express middleware before the `/api/generate` route

---

## Built with

- [Express](https://expressjs.com/)
- [Anthropic Claude API](https://docs.anthropic.com/en/api/overview)
- [Material Design 3](https://m3.material.io/) principles
- Amplify Infrastructure brand system
