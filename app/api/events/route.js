import { supabase } from '../../../lib/supabase'


export async function GET() {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

export async function POST(req) {
  const { name, topic, deadline, worry_id } = await req.json()
  const { data, error } = await supabase
    .from('events')
    .insert({ name, topic, deadline, worry_id })
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

export async function DELETE(req) {
  const { id } = await req.json()
  const { error } = await supabase.from('events').delete().eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ deleted: true })
}

export async function PATCH(req) {
  const { id, done } = await req.json()
  const { data, error } = await supabase
    .from('events')
    .update({ done })
    .eq('id', id)
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}