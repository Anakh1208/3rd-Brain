// scripts/seed-demo.js
// Run: node scripts/seed-demo.js
// Requires: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local

require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const DEMO_EMAIL = 'demo@3rdbrain.app'
const DEMO_PASSWORD = 'demo123456'

function daysAgo(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString()
}

function dateStr(daysBack) {
  const d = new Date()
  d.setDate(d.getDate() - daysBack)
  return d.toISOString().split('T')[0]
}

const WORRIES = [
  { text: "I haven't applied to any companies and placements start next month. I feel so behind.", topic: 'placements', created_at: daysAgo(6) },
  { text: "My DSA is so weak. I can't even solve easy leetcode problems. Everyone else seems ahead.", topic: 'placements', created_at: daysAgo(5) },
  { text: "Exams next week and I haven't touched half the syllabus. I'm going to fail.", topic: 'exams', created_at: daysAgo(5) },
  { text: "I haven't gone to the gym in 3 weeks. I feel lazy and sluggish.", topic: 'fitness', created_at: daysAgo(4) },
  { text: "I'm spending way too much money. My savings are almost zero.", topic: 'money', created_at: daysAgo(4) },
  { text: "Placement drive registration deadline is tomorrow and I still haven't prepared my resume.", topic: 'placements', created_at: daysAgo(3) },
  { text: "I keep procrastinating on studying. I open my laptop and just browse.", topic: 'exams', created_at: daysAgo(3) },
  { text: "I'm stressed about everything. Placements, exams, fitness — nothing is under control.", topic: 'placements', created_at: daysAgo(2) },
  { text: "My sleep schedule is completely broken. Sleeping at 3am, waking up at noon.", topic: 'health', created_at: daysAgo(1) },
  { text: "I worry that I'm not building anything impressive for my resume. Just coursework isn't enough.", topic: 'placements', created_at: daysAgo(0) },
]

const HABITS = [
  { name: 'Practice DSA – 1hr daily', topic: 'placements' },
  { name: 'Study syllabus – 2hrs daily', topic: 'exams' },
  { name: 'Go to gym – 5x/week', topic: 'fitness' },
  { name: 'Track daily expenses', topic: 'money' },
  { name: 'Sleep by midnight', topic: 'health' },
]

const EVENTS = [
  { name: 'Apply to 5 companies on LinkedIn', topic: 'placements', deadline: 'This Friday', done: false },
  { name: 'Register for campus placement drive', topic: 'placements', deadline: 'Tomorrow', done: true },
  { name: 'Submit OS assignment', topic: 'exams', deadline: 'This Monday', done: true },
  { name: 'Pay credit card bill', topic: 'money', deadline: 'This Sunday', done: false },
  { name: 'Book doctor appointment', topic: 'health', deadline: 'Next week', done: false },
]

async function seed() {
  console.log('🌱 Starting demo seed...')

  // 1. Create demo user (ignore error if exists)
  const { data: created, error: createErr } = await supabase.auth.admin.createUser({
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
    email_confirm: true,
  })

  let userId
  if (createErr?.message?.includes('already been registered')) {
    // user exists — get their id
    const { data: users } = await supabase.auth.admin.listUsers()
    const demo = users.users.find(u => u.email === DEMO_EMAIL)
    userId = demo?.id
    console.log('✓ Demo user already exists:', userId)
  } else if (createErr) {
    throw createErr
  } else {
    userId = created.user.id
    console.log('✓ Demo user created:', userId)
  }

  if (!userId) throw new Error('Could not get demo user ID')

  // 2. Clear existing demo data
  await supabase.from('habits').delete().eq('user_id', userId)
  await supabase.from('events').delete().eq('user_id', userId)
  await supabase.from('worries').delete().eq('user_id', userId)
  console.log('✓ Cleared old demo data')

  // 3. Seed worries
  const { data: worryRows, error: wErr } = await supabase.from('worries')
    .insert(WORRIES.map(w => ({ ...w, user_id: userId })))
    .select()
  if (wErr) throw wErr
  console.log('✓ Seeded', worryRows.length, 'worries')

  // 4. Seed habits with some completions
  for (let i = 0; i < HABITS.length; i++) {
    const h = HABITS[i]
    // generate realistic partial completions for last 7 days
    const completed_dates = []
    for (let d = 0; d < 7; d++) {
      // first habit (DSA) has good streak, others are spotty
      const chance = i === 0 ? 0.7 : i === 2 ? 0.4 : 0.3
      if (Math.random() < chance) completed_dates.push(dateStr(d))
    }
    const { error: hErr } = await supabase.from('habits')
      .insert({ ...h, user_id: userId, completed_dates })
    if (hErr) throw hErr
  }
  console.log('✓ Seeded', HABITS.length, 'habits')

  // 5. Seed events
  const { error: eErr } = await supabase.from('events')
    .insert(EVENTS.map(e => ({ ...e, user_id: userId })))
  if (eErr) throw eErr
  console.log('✓ Seeded', EVENTS.length, 'events')

  console.log('\n✅ Demo seed complete!')
  console.log('   Email:', DEMO_EMAIL)
  console.log('   Password:', DEMO_PASSWORD)
  console.log('   User ID:', userId)
}

seed().catch(err => {
  console.error('❌ Seed failed:', err.message)
  process.exit(1)
})