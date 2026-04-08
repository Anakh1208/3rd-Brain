import { supabase } from '../../../lib/supabase'

export async function GET() {
  const { data, error } = await supabase
    .from('habits')
    .select(`*, habit_completions(completed_date)`)
    .order('created_at', { ascending: false })

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

export async function POST(req) {
  const { name, topic, worry_id } = await req.json()
  const { data, error } = await supabase
    .from('habits')
    .insert({ name, topic, worry_id })
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

export async function DELETE(req) {
  const { id } = await req.json()
  const { error } = await supabase.from('habits').delete().eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ deleted: true })
}

export async function PATCH(req) {
  const { habit_id, completed_date } = await req.json()

  // Toggle: try insert, if exists delete
  const { data: existing } = await supabase
    .from('habit_completions')
    .select('id')
    .eq('habit_id', habit_id)
    .eq('completed_date', completed_date)
    .single()

  if (existing) {
    await supabase.from('habit_completions').delete().eq('id', existing.id)
    return Response.json({ done: false })
  } else {
    await supabase.from('habit_completions').insert({ habit_id, completed_date })
    return Response.json({ done: true })
  }
}