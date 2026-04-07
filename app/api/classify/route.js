import Groq from 'groq-sdk'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

export async function POST(req) {
  try {
    const { text } = await req.json()

    const prompt = `You are an AI that converts a user's worry/rant into structured action items.

User rant: "${text}"

Return ONLY valid JSON (no markdown, no backticks, no explanation) in this exact format:
{
  "topic": "one word topic like placements/exams/fitness/money/health/relationships/work",
  "summary": "one sentence about the core worry",
  "habits": [
    { "name": "short actionable daily habit", "topic": "same topic" }
  ],
  "events": [
    { "name": "specific one-time task", "topic": "same topic", "deadline": "e.g. this Friday / next Monday / ASAP" }
  ],
  "gap": "one sentence insight about the gap between worry and action e.g. You've worried about placements 3 times but haven't applied anywhere yet."
}

Rules:
- habits = repeatable daily/weekly actions (max 3)
- events = one-time deadline tasks (max 3)  
- Be specific and actionable, not generic
- Extract real deadlines if mentioned in the rant`

    const completion = await groq.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: "llama-3.1-8b-instant",
      temperature: 0.3,
      max_tokens: 600,
    })

    const raw = completion.choices[0]?.message?.content || '{}'
    
    // Strip any accidental markdown fences
    const clean = raw.replace(/```json|```/g, '').trim()
    const parsed = JSON.parse(clean)

    return Response.json({ success: true, data: parsed })
  } catch (err) {
    console.error('Classify error:', err)
    return Response.json({ success: false, error: err.message }, { status: 500 })
  }
}
