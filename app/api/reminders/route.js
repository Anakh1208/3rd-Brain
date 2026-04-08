import { createClient } from '@supabase/supabase-js'
import Groq from 'groq-sdk'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

// GET - fetch user's reminders
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url)
    const email = searchParams.get('email')
    
    if (!email) {
      return Response.json({ error: 'email required' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('reminders')
      .select('*')
      .eq('email', email)
      .order('deadline', { ascending: true })

    if (error) throw error
    return Response.json(data || [])
  } catch (err) {
    console.error('GET reminders error:', err)
    return Response.json({ error: err.message }, { status: 500 })
  }
}

// POST - create reminder (manual or auto-detected)
export async function POST(req) {
  try {
    const { text, email, title, deadline, manual } = await req.json()
    
    if (!email) {
      return Response.json({ error: 'email required' }, { status: 400 })
    }

    // Manual creation (from RemindersTab form)
    if (manual && title && deadline) {
      const { data, error } = await supabase
        .from('reminders')
        .insert({ email, title, deadline, user_id: 'demo' })
        .select()
        .single()

      if (error) throw error
      return Response.json({ reminder: data, has_reminder: true })
    }

    // Auto-detect from rant text using Groq
    const prompt = `Analyze this text and extract if there's an event that needs a reminder. If yes, return JSON with: title (short, max 5 words), deadline (ISO 8601 datetime), confidence (0-1). If no reminder needed, return {"has_reminder": false}.

Text: "${text}"

Current time: ${new Date().toISOString()}

Return only valid JSON, no other text.`

    const res = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 150,
      temperature: 0.1,
    })

    const content = res.choices[0]?.message?.content?.trim()
    let parsed
    try {
      parsed = JSON.parse(content)
    } catch {
      return Response.json({ has_reminder: false })
    }

    if (!parsed.has_reminder || parsed.confidence < 0.6) {
      return Response.json({ has_reminder: false })
    }

    // Save the detected reminder
    const { data, error } = await supabase
      .from('reminders')
      .insert({ 
        email, 
        title: parsed.title, 
        deadline: parsed.deadline,
        user_id: 'demo'
      })
      .select()
      .single()

    if (error) throw error
    return Response.json({ reminder: data, has_reminder: true })
  } catch (err) {
    console.error('POST reminder error:', err)
    return Response.json({ error: err.message, has_reminder: false }, { status: 500 })
  }
}

// DELETE - remove a reminder
export async function DELETE(req) {
  try {
    const { id, email } = await req.json()
    
    const { error } = await supabase
      .from('reminders')
      .delete()
      .eq('id', id)
      .eq('email', email)

    if (error) throw error
    return Response.json({ success: true })
  } catch (err) {
    console.error('DELETE reminder error:', err)
    return Response.json({ error: err.message }, { status: 500 })
  }
}