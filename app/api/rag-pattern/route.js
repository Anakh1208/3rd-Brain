import { createClient } from '@supabase/supabase-js'
import Groq from 'groq-sdk'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

// ── embedding via HuggingFace (updated URL) ────

// Simple fallback - generate a pseudo-embedding (not semantic but works for demo)
async function generateEmbedding(text) {
  // Create a simple vector from text hash
  const hash = text.split('').reduce((a, b) => {
    a = ((a << 5) - a) + b.charCodeAt(0)
    return a & a
  }, 0)
  
  // Generate 384-dim vector (what MiniLM would return)
  const embedding = []
  for (let i = 0; i < 384; i++) {
    embedding.push(Math.sin(hash * (i + 1)) * 0.5)
  }
  
  return embedding
}

async function findSimilarWorries(embedding, user_id, limit = 5) {
  // Requires the SQL function below to be created in Supabase
  const { data, error } = await supabase.rpc('match_worries', {
    query_embedding: embedding,
    match_user_id: user_id,
    match_threshold: 0.70,
    match_count: limit,
  })
  if (error) throw new Error('pgvector search failed: ' + error.message)
  return data || []
}

// ── pattern analysis ──────────────────────────────────────

function analyzePattern(similarWorries) {
  if (!similarWorries.length) {
    return { pattern_detected: false, repeat_count: 0, action_rate: 0, insight: null }
  }

  const repeatCount = similarWorries.length
  const actedCount = similarWorries.filter(w => w.action_taken).length
  const actionRate = +(actedCount / repeatCount).toFixed(2)

  // time span
  const dates = similarWorries.map(w => new Date(w.created_at)).sort((a, b) => a - b)
  const spanDays = dates.length > 1
    ? Math.round((dates[dates.length - 1] - dates[0]) / (1000 * 60 * 60 * 24))
    : 0

  return {
    pattern_detected: repeatCount >= 2,
    repeat_count: repeatCount,
    action_rate: actionRate,
    span_days: spanDays,
    acted_count: actedCount,
  }
}

async function generatePatternInsight(pattern, currentWorry) {
  if (!pattern.pattern_detected) return null

  const prompt = `User wrote: "${currentWorry}"
Pattern data: they've expressed similar worries ${pattern.repeat_count} times over ${pattern.span_days} days, but acted only ${pattern.acted_count} times (${Math.round(pattern.action_rate * 100)}% action rate).
Write ONE sentence (max 25 words) calling this out directly. Be specific. No fluff.
Return only the sentence.`

  const res = await groq.chat.completions.create({
    model: 'llama-3.1-8b-instant',  // Updated model
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 60,
    temperature: 0.4,
  })
  return res.choices[0]?.message?.content?.trim() || null
}

// ── route ─────────────────────────────────────────────────

export async function POST(req) {
  try {
    const { text, user_id } = await req.json()
    if (!text) return Response.json({ error: 'text required' }, { status: 400 })

    // 1. Generate embedding for new rant
    const embedding = await generateEmbedding(text)

    // 2. Find similar past worries
    const similarWorries = await findSimilarWorries(embedding, user_id || 'demo')

    // 3. Analyze pattern
    const pattern = analyzePattern(similarWorries)

    // 4. Generate insight if pattern found
    if (pattern.pattern_detected) {
      pattern.insight = await generatePatternInsight(pattern, text)
    }

    // 5. Store new worry with embedding (fix: use proper query)
    const { error: updateError } = await supabase
      .from('worries')
      .update({ embedding })
      .eq('user_id', user_id || 'demo')
      .order('created_at', { ascending: false })
      .limit(1)
    
    if (updateError) {
      console.error('Failed to store embedding:', updateError)
    }

    return Response.json({
      ...pattern,
      similar_count: similarWorries.length,
    })
  } catch (err) {
    console.error(err)
    return Response.json({ error: err.message }, { status: 500 })
  }
}