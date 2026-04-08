require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function clearAll() {
  console.log('🗑️  Clearing all data...')
  
  // Delete in order (respect foreign keys if any)
  const { error: e1 } = await supabase.from('reminders').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  if (e1) console.log('reminders:', e1.message)
  else console.log('✓ reminders cleared')
  
  const { error: e2 } = await supabase.from('events').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  if (e2) console.log('events:', e2.message)
  else console.log('✓ events cleared')
  
  const { error: e3 } = await supabase.from('habits').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  if (e3) console.log('habits:', e3.message)
  else console.log('✓ habits cleared')
  
  const { error: e4 } = await supabase.from('worries').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  if (e4) console.log('worries:', e4.message)
  else console.log('✓ worries cleared')
  
  console.log('\n✅ All data deleted! Refresh your browser.')
}

clearAll().catch(err => {
  console.error('Error:', err)
  process.exit(1)
})