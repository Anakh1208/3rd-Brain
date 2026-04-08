import { createClient } from '@supabase/supabase-js'

export async function POST(request) {
  try {
    let body = {}

    // ✅ FIX: safely parse JSON
    try {
      body = await request.json()
    } catch {
      return Response.json({ error: 'No body sent' }, { status: 400 })
    }

    const { email, password } = body

    if (!email || !password) {
      console.log("Missing fields ❌")
      return Response.json({ error: 'Email and password required' }, { status: 400 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    )

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    console.log("SUPABASE ERROR:", error)

    if (error) throw error

    return Response.json({ success: true })

  } catch (error) {
    console.log("FINAL ERROR:", error.message)
    return Response.json({ error: error.message }, { status: 400 })
  }
}