# 3rd Brain — AI Behavioral Insight App

> You tell it what's stressing you. It tells you exactly what to do today.

Converts user worries into classified habits and deadline events using Groq LLM, with a gap analysis engine showing the delta between anxiety and action.

**Stack:** Next.js · Supabase · Groq API · Vercel · React

---

## 🚀 Deploy in 15 minutes

### Step 1 — Get API keys (5 mins)

1. **Groq API key**: go to https://console.groq.com → API Keys → Create key. FREE.
2. **Supabase**: go to https://supabase.com → New project → copy Project URL and anon key

### Step 2 — Set up Supabase database (2 mins)

1. In Supabase dashboard → SQL Editor
2. Paste the entire contents of `SUPABASE_SCHEMA.sql` and click Run

### Step 3 — Run locally (1 min)

```bash
npm install
cp .env.local.example .env.local
# Fill in your keys in .env.local
npm run dev
```

Open http://localhost:3000

### Step 4 — Deploy to Vercel (3 mins)

```bash
# Option A: Vercel CLI
npx vercel --prod

# Option B: Push to GitHub, import on vercel.com
git init
git add .
git commit -m "3rd brain v1"
git remote add origin YOUR_GITHUB_REPO
git push -u origin main
# Then go to vercel.com → Import → add env vars
```

**Add these environment variables in Vercel:**
- `GROQ_API_KEY` = your groq key
- `NEXT_PUBLIC_SUPABASE_URL` = your supabase project url  
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` = your supabase anon key

---

## Features
- **Rant input** — type anything stressing you
- **AI classification** — Groq (llama3-8b) converts rant → habits + events
- **Concern map** — bubble visualization by topic
- **Habit tracker** — daily checkboxes with streak counter
- **Event tracker** — deadline tasks with done/not done toggle
- **Gap score** — shows the delta between worry frequency and action completion
- **Missed opportunity alerts** — flags topics with 3+ worries and 0 actions

---

## Built at hackathon in 1 day
