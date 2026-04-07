import { supabase } from '../../../lib/supabase'

export async function GET() {
  const { data, error } = await supabase
    .from('events')
    .select('*')

  if (error) {
    console.error(error)
    return Response.json({ error }, { status: 500 })
  }

  return Response.json(data)
}

export async function POST(req) {
  const body = await req.json()
  console.log("POST BODY:", body)

  const { data, error } = await supabase
    .from('events')
    .insert([{ text: body.text }])

  if (error) {
    console.error("INSERT ERROR:", error)
    return Response.json({ error }, { status: 500 })
  }

  return Response.json(data)
}