import { createClient } from '@supabase/supabase-js'
import Groq from 'groq-sdk'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // use service role for server-side
)
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

// ── helpers ──────────────────────────────────────────────

function getSevenDaysAgo() {
  const d = new Date()
  d.setDate(d.getDate() - 7)
  return d.toISOString()
}

async function fetchWeekData(user_id) {
  const since = getSevenDaysAgo()
  const [w, h, e] = await Promise.all([
    supabase.from('worries').select('*').eq('user_id', user_id).gte('created_at', since),
    supabase.from('habits').select('*').eq('user_id', user_id),
    supabase.from('events').select('*').eq('user_id', user_id).gte('created_at', since),
  ])
  return {
    worries: w.data || [],
    habits: h.data || [],
    events: e.data || [],
  }
}

function computeStats({ worries, habits, events }) {
  const totalWorries = worries.length

  // completed habits: count completions in last 7 days
  const since = new Date(getSevenDaysAgo())
  let completedHabits = 0
  habits.forEach(h => {
    const dates = h.completed_dates || []
    completedHabits += dates.filter(d => new Date(d) >= since).length
  })

  const completedEvents = events.filter(e => e.done || e.completed).length
  const totalActions = completedHabits + completedEvents
  const actionRate = totalWorries > 0 ? +(totalActions / totalWorries).toFixed(2) : 0

  // most common topic
  const topicCount = {}
  worries.forEach(w => {
    const t = w.topic || 'unknown'
    topicCount[t] = (topicCount[t] || 0) + 1
  })
  const mostCommonTopic = Object.entries(topicCount).sort((a, b) => b[1] - a[1])[0]?.[0] || null

  // most neglected: topic with most worries but fewest completed events
  const topicActions = {}
  events.filter(e => e.done || e.completed).forEach(e => {
    const t = e.topic || 'unknown'
    topicActions[t] = (topicActions[t] || 0) + 1
  })
  const neglectedTopic = Object.entries(topicCount)
    .sort((a, b) => (b[1] - (topicActions[b[0]] || 0)) - (a[1] - (topicActions[a[0]] || 0)))[0]?.[0] || null

  return {
    totalWorries,
    totalActions,
    actionRate,
    mostCommonTopic,
    neglectedTopic,
    topicCount,
  }
}

async function generateInsight(stats) {
  const prompt = `You are a brutally honest behavioral coach. Given this user's weekly data, write a 2-sentence insight.
Data: ${JSON.stringify(stats)}
Rules:
- Start with what they're doing (worrying vs acting)
- End with one specific thing they should do NOW
- Tone: direct, caring, not preachy
- Max 40 words total
Return ONLY the insight text, nothing else.`

  const res = await groq.chat.completions.create({
    model: 'llama-3.1-8b-instant',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 100,
    temperature: 0.5,
  })
  return res.choices[0]?.message?.content?.trim() || ''
}

// ── route ─────────────────────────────────────────────────

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url)
    const user_id = searchParams.get('user_id') || 'demo'

    const weekData = await fetchWeekData(user_id)
    const stats = computeStats(weekData)
    const insight = await generateInsight(stats)

    const recap = {
      summary: `You worried ${stats.totalWorries} times but acted only ${stats.totalActions} times`,
      top_issue: stats.actionRate < 0.3 ? 'execution gap' : stats.actionRate < 0.7 ? 'moderate progress' : 'strong momentum',
      most_common_topic: stats.mostCommonTopic,
      neglected_topic: stats.neglectedTopic,
      action_rate: stats.actionRate,
      insight,
      raw: stats,
    }

    return Response.json(recap)
  } catch (err) {
    console.error(err)
    return Response.json({ error: err.message }, { status: 500 })
  }
}
