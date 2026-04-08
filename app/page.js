'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import WeeklyRecap from '../components/WeeklyRecap'
import DemoButton from '../components/DemoButton'
import RemindersTab from '../components/RemindersTab'

const TOPIC_COLORS_DARK = {
  placements:    { bg: '#12102b', border: '#534AB7', text: '#AFA9EC', bubble: '#7F77DD' },
  exams:         { bg: '#1c1500', border: '#BA7517', text: '#FAC775', bubble: '#EF9F27' },
  fitness:       { bg: '#00170f', border: '#0F6E56', text: '#5DCAA5', bubble: '#1D9E75' },
  money:         { bg: '#180d00', border: '#993C1D', text: '#F0997B', bubble: '#D85A30' },
  health:        { bg: '#00170f', border: '#0F6E56', text: '#5DCAA5', bubble: '#1D9E75' },
  relationships: { bg: '#180012', border: '#993556', text: '#ED93B1', bubble: '#D4537E' },
  work:          { bg: '#12102b', border: '#534AB7', text: '#AFA9EC', bubble: '#7F77DD' },
  default:       { bg: '#141414', border: '#444',    text: '#999',    bubble: '#777'    },
}
const TOPIC_COLORS_LIGHT = {
  placements:    { bg: '#EEEDFE', border: '#534AB7', text: '#3C3489', bubble: '#7F77DD' },
  exams:         { bg: '#FEF5E0', border: '#BA7517', text: '#633806', bubble: '#EF9F27' },
  fitness:       { bg: '#E0F5EE', border: '#0F6E56', text: '#085041', bubble: '#1D9E75' },
  money:         { bg: '#FAECE7', border: '#993C1D', text: '#712B13', bubble: '#D85A30' },
  health:        { bg: '#E0F5EE', border: '#0F6E56', text: '#085041', bubble: '#1D9E75' },
  relationships: { bg: '#FBEAF0', border: '#993556', text: '#72243E', bubble: '#D4537E' },
  work:          { bg: '#EEEDFE', border: '#534AB7', text: '#3C3489', bubble: '#7F77DD' },
  default:       { bg: '#F0EFE9', border: '#888780', text: '#444441', bubble: '#888780' },
}

function getColor(topic, isDark) {
  const map = isDark ? TOPIC_COLORS_DARK : TOPIC_COLORS_LIGHT
  return map[topic?.toLowerCase()] || map.default
}

function getToday() { return new Date().toISOString().split('T')[0] }
function getLast7Days() {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i)); return d.toISOString().split('T')[0]
  })
}
function dayLabel(dateStr) {
  return ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'][new Date(dateStr + 'T12:00:00').getDay()]
}

export default function Home() {
  const [isDark, setIsDark] = useState(true)

  // Core data
  const [rantText, setRantText]     = useState('')
  const [loading, setLoading]       = useState(false)
  const [aiReply, setAiReply]       = useState(null)
  const [worries, setWorries]       = useState([])
  const [habits,  setHabits]        = useState([])
  const [events,  setEvents]        = useState([])
  const [selectedBubble, setSelectedBubble] = useState(null)
  const [toast,   setToast]         = useState(null)
  const [userEmail, setUserEmail]   = useState('')

  // Nudge-in-bubble state
  const [nudgeEmail,    setNudgeEmail]    = useState('')
  const [nudgeSentMap,  setNudgeSentMap]  = useState({})

  // Focus timer
  const [activeTopic,   setActiveTopic]  = useState(null)
  const [timeLeft,      setTimeLeft]     = useState(0)
  const [isRunning,     setIsRunning]    = useState(false)
  const [timerMinutes,  setTimerMinutes] = useState(5)
  const intervalRef = useRef(null)

  // ── Theme tokens ──────────────────────────────────────────────
  const T = isDark ? {
    bg:       '#07070f',
    surface:  '#0e0e1a',
    card:     '#111120',
    border:   '#1c1c2e',
    divider:  '#181826',
    text:     '#eeeeff',
    muted:    '#7777a0',
    faint:    '#222233',
    inputBg:  '#09091a',
    accent:   '#7F77DD',
    green:    '#1D9E75',
    amber:    '#EF9F27',
  } : {
    bg:       '#f2f2f8',
    surface:  '#ffffff',
    card:     '#f9f9ff',
    border:   '#dedeed',
    divider:  '#ebebf5',
    text:     '#111120',
    muted:    '#555570',
    faint:    '#e0e0ee',
    inputBg:  '#f6f6fd',
    accent:   '#534AB7',
    green:    '#0F6E56',
    amber:    '#854F0B',
  }

  const suggestions = [
    "I'm stressed about exams",
    "I'm worried about placements",
    "I'm procrastinating a lot",
    "I don't have a proper routine",
  ]

  // ── Data helpers ──────────────────────────────────────────────
  const showToast = msg => { setToast(msg); setTimeout(() => setToast(null), 2800) }

  const loadData = useCallback(async () => {
    try {
      const [w, h, e] = await Promise.all([
        fetch('/api/worries').then(r => r.json()),
        fetch('/api/habits').then(r => r.json()),
        fetch('/api/events').then(r => r.json()),
      ])
      if (Array.isArray(w)) setWorries(w)
      if (Array.isArray(h)) setHabits(h)
      if (Array.isArray(e)) setEvents(e)
    } catch (err) { console.error('Load error', err) }
  }, [])

  useEffect(() => {
    loadData()
    const saved = localStorage.getItem('3b_email')
    if (saved) { setUserEmail(saved); setNudgeEmail(saved) }
  }, [loadData])

  useEffect(() => () => { if (intervalRef.current) clearInterval(intervalRef.current) }, [])

  // ── Actions ───────────────────────────────────────────────────
  async function handleRant() {
    if (!rantText.trim()) return
    setLoading(true); setAiReply(null)
    try {
      const classRes = await fetch('/api/classify', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: rantText }),
      })
      const { data } = await classRes.json()
      if (!data) throw new Error('No classification returned')

      const worryRes = await fetch('/api/worries', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: rantText, topic: data.topic }),
      })
      const worry = await worryRes.json()

      if (data.habits?.length) {
        await Promise.all(data.habits.map(h =>
          fetch('/api/habits', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: h.name, topic: data.topic, worry_id: worry.id }),
          })
        ))
      }
      if (data.events?.length) {
        await Promise.all(data.events.map(ev =>
          fetch('/api/events', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: ev.name, topic: data.topic, deadline: ev.deadline, worry_id: worry.id }),
          })
        ))
      }

      try {
        const ragRes = await fetch('/api/rag-pattern', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: rantText, user_id: 'demo' }),
        })
        const ragData = await ragRes.json()
        if (ragData.pattern_detected && ragData.insight) {
          data.pattern_insight = ragData.insight
          data.repeat_count    = ragData.repeat_count
        }
      } catch (_) {}

      if (userEmail) {
        try {
          const rRes = await fetch('/api/reminders', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: rantText, email: userEmail }),
          })
          const rData = await rRes.json()
          if (rData.has_reminder && rData.reminder) data._reminder = rData.reminder
        } catch (_) {}
      }

      setAiReply(data); setRantText('')
      await loadData(); showToast('Plan generated ✓')
    } catch (err) { console.error(err); showToast('Error: ' + err.message) }
    finally { setLoading(false) }
  }

  async function toggleHabit(habitId) {
    await fetch('/api/habits', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ habit_id: habitId, completed_date: getToday() }),
    })
    await loadData()
  }

  async function toggleEvent(eventId, currentDone) {
    await fetch('/api/events', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: eventId, done: !currentDone }),
    })
    await loadData()
  }

  async function deleteHabit(id) {
    if (!confirm('Remove this habit?')) return
    await fetch('/api/habits', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    await loadData(); showToast('Habit removed')
  }

  async function deleteEvent(id) {
    if (!confirm('Remove this event?')) return
    await fetch('/api/events', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    await loadData(); showToast('Event removed')
  }

  async function deleteWorry(id) {
    if (!confirm('Remove this worry?')) return
    await fetch('/api/worries', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    await loadData(); showToast('Worry removed')
  }

  async function sendBubbleNudge(topic, email) {
    if (!email || !email.trim()) { showToast('Enter your email first'); return }
    try {
      const res  = await fetch('/api/reminders', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: `remind me to work on my ${topic} concern`, email }),
      })
      const data = await res.json()
      if (data.has_reminder) {
        setNudgeSentMap(p => ({ ...p, [topic]: true }))
        showToast(`Nudge set for "${topic}" ✓`)
      } else {
        showToast('Nudge scheduled ✓')
      }
    } catch (_) { showToast('Could not set nudge') }
  }

  // ── Timer ─────────────────────────────────────────────────────
  function startTimer() {
    if (isRunning) return
    const start = timeLeft > 0 ? timeLeft : timerMinutes * 60
    setTimeLeft(start); setIsRunning(true)
    intervalRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) { clearInterval(intervalRef.current); setIsRunning(false); return 0 }
        return prev - 1
      })
    }, 1000)
  }
  function pauseTimer() { if (intervalRef.current) clearInterval(intervalRef.current); setIsRunning(false) }
  function resetTimer()  { if (intervalRef.current) clearInterval(intervalRef.current); setIsRunning(false); setTimeLeft(0) }
  const fmt = s => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`

  // ── Computed ──────────────────────────────────────────────────
  const topicMap = {}
  worries.forEach(w => {
    const t = w.topic || 'other'
    if (!topicMap[t]) topicMap[t] = { count: 0, habits: [], events: [], worries: [] }
    topicMap[t].count++; topicMap[t].worries.push(w)
  })
  habits.forEach(h => { const t = h.topic || 'other'; if (topicMap[t]) topicMap[t].habits.push(h) })
  events.forEach(e => { const t = e.topic || 'other'; if (topicMap[t]) topicMap[t].events.push(e) })
  const topics = Object.entries(topicMap).sort((a, b) => b[1].count - a[1].count)

  const totalWorries     = worries.length
  const totalActionsDone = events.filter(e => e.done).length +
    habits.reduce((acc, h) => acc + (h.habit_completions?.length || 0), 0)
  const gapScore = totalWorries > 0
    ? Math.max(0, Math.round(100 - (totalActionsDone / Math.max(totalWorries, 1)) * 50))
    : 0

  function getWeekDone(habit) {
    const days         = getLast7Days()
    const completedSet = new Set((habit.habit_completions || []).map(c => c.completed_date))
    return days.map(d => ({ date: d, done: completedSet.has(d) }))
  }
  function getStreak(habit) {
    const completedSet = new Set((habit.habit_completions || []).map(c => c.completed_date))
    let streak = 0
    const today = new Date()
    for (let i = 0; i < 30; i++) {
      const d = new Date(today); d.setDate(d.getDate() - i)
      if (completedSet.has(d.toISOString().split('T')[0])) streak++
      else if (i > 0) break
    }
    return streak
  }

  // ── Shared mini styles ────────────────────────────────────────
  const card = {
    background: T.surface,
    border: `1px solid ${T.border}`,
    borderRadius: 16,
    padding: '20px',
  }
  const sectionLabel = {
    fontSize: 10, fontWeight: 700, letterSpacing: '0.12em',
    textTransform: 'uppercase', color: T.muted, marginBottom: 14,
  }
  const emptyBox = {
    fontSize: 12, color: T.muted, textAlign: 'center',
    padding: '24px 0', border: `1px dashed ${T.border}`,
    borderRadius: 10, marginBottom: 12,
  }
  const delBtn = {
    width: 20, height: 20, borderRadius: '50%', background: 'transparent',
    border: `0.5px solid ${T.border}`, cursor: 'pointer', color: T.muted,
    fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0, transition: 'border-color 0.15s',
  }

  // ─────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: T.bg, color: T.text }}>

      {/* ── Global CSS ── */}
      <style>{`
        @keyframes fadeDown { from { opacity:0; transform:translateY(-6px); } to { opacity:1; transform:translateY(0); } }
        @keyframes fadeUp   { from { opacity:0; transform:translateY(6px);  } to { opacity:1; transform:translateY(0); } }
        @keyframes pulse    { 0%,100%{transform:scale(1)} 50%{transform:scale(1.04)} }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-thumb { background: ${T.faint}; border-radius: 2px; }
        textarea, input, select { font-family: inherit; }
        textarea:focus, input:focus, select:focus { outline: none; }
        @media (max-width: 900px) {
          .grid-2col { grid-template-columns: 1fr !important; }
          .grid-3col { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 600px) {
          .main-pad { padding: 12px !important; }
          .header-stats { display: none !important; }
        }
      `}</style>

      {/* ── Toast ── */}
      {toast && (
        <div style={{
          position: 'fixed', top: 18, right: 18, zIndex: 999,
          background: '#1D9E75', color: '#fff', padding: '9px 16px',
          borderRadius: 10, fontSize: 12, fontWeight: 600,
          boxShadow: '0 4px 20px rgba(29,158,117,0.35)',
          animation: 'fadeDown 0.2s ease',
        }}>{toast}</div>
      )}

      {/* ══════════════════════════════════════════
          HEADER
      ══════════════════════════════════════════ */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 60,
        background: T.surface, borderBottom: `1px solid ${T.border}`,
        padding: '0 24px', height: 52,
        display: 'flex', alignItems: 'center', gap: 14,
      }}>
        {/* Logo + gap badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
          <span style={{ fontSize: 15, fontWeight: 800, color: T.text, letterSpacing: '-0.5px' }}>3rd Brain</span>
          <span style={{
            fontSize: 10, fontWeight: 700, letterSpacing: '0.05em',
            color: isDark ? '#AFA9EC' : '#3C3489',
            background: isDark ? '#1a1535' : '#EEEDFE',
            border: `1px solid ${isDark ? '#534AB740' : '#534AB740'}`,
            padding: '3px 9px', borderRadius: 20,
          }}>gap · {gapScore}</span>
        </div>

        {/* Stats */}
        <div className="header-stats" style={{ display: 'flex', gap: 12, fontSize: 11, color: T.muted }}>
          <span>{worries.length} worries</span>
          <span style={{ color: T.faint }}>·</span>
          <span>{habits.length} habits</span>
          <span style={{ color: T.faint }}>·</span>
          <span>{events.length} events</span>
        </div>

        <DemoButton onDemoLogin={id => console.log('demo:', id)} />

        {/* Day / Night toggle */}
        <button
          onClick={() => setIsDark(d => !d)}
          title={isDark ? 'Light mode' : 'Dark mode'}
          style={{
            width: 34, height: 34, borderRadius: '50%',
            background: T.card, border: `1px solid ${T.border}`,
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 15, transition: 'all 0.2s',
            color: isDark ? '#FAC775' : '#534AB7',
          }}
        >
          {isDark ? '☀' : '☾'}
        </button>
      </header>

      {/* ══════════════════════════════════════════
          MAIN DASHBOARD
      ══════════════════════════════════════════ */}
      <main className="main-pad" style={{ padding: '20px 24px', maxWidth: 1320, margin: '0 auto' }}>

        {/* ── ROW 1 : Rant  +  Concern Map ── */}
        <div
          className="grid-2col"
          style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}
        >

          {/* ─── RANT CARD ─── */}
          <div style={card}>
            <div style={sectionLabel}>unload your mind</div>
            <textarea
              value={rantText}
              onChange={e => setRantText(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && e.ctrlKey && handleRant()}
              placeholder="i have exams next week and haven't studied. also terrified about placements..."
              rows={5}
              style={{
                width: '100%', background: T.inputBg,
                border: `1px solid ${T.border}`, borderRadius: 12,
                padding: '12px 14px', fontSize: 13, color: T.text,
                resize: 'none', lineHeight: 1.75, marginBottom: 10,
                transition: 'border-color 0.2s',
              }}
              onFocus={e  => e.target.style.borderColor = T.accent + '80'}
              onBlur={e   => e.target.style.borderColor = T.border}
            />

            {/* Suggestions */}
            {!rantText && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                {suggestions.map((s, i) => (
                  <button key={i} onClick={() => setRantText(s)} style={{
                    padding: '5px 12px', fontSize: 11, borderRadius: 20,
                    background: 'transparent', border: `1px solid ${T.border}`,
                    color: T.muted, cursor: 'pointer', transition: 'all 0.15s', fontWeight: 500,
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = T.accent; e.currentTarget.style.color = T.accent }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.color = T.muted }}
                  >{s}</button>
                ))}
              </div>
            )}

            <button
              onClick={handleRant}
              disabled={loading || !rantText.trim()}
              style={{
                width: '100%', padding: '12px',
                background: loading || !rantText.trim()
                  ? T.faint
                  : isDark ? '#7F77DD' : '#534AB7',
                border: 'none', borderRadius: 12, color: '#fff',
                fontSize: 13, fontWeight: 700, cursor: loading || !rantText.trim() ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s', opacity: loading || !rantText.trim() ? 0.4 : 1,
                letterSpacing: '0.02em',
              }}
            >{loading ? 'analyzing...' : 'unload it →'}</button>

            {/* AI Reply */}
            {aiReply && (
              <div style={{
                marginTop: 14,
                background: T.card,
                border: `1px solid ${T.border}`,
                borderRadius: 12, padding: 14,
                animation: 'fadeUp 0.25s ease',
              }}>
                <div style={{ fontSize: 10, color: isDark ? '#7F77DD' : '#534AB7', fontWeight: 700, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  {aiReply.topic} · classified
                </div>
                <p style={{ fontSize: 13, color: T.muted, lineHeight: 1.7, marginBottom: 10 }}>{aiReply.summary}</p>

                {aiReply.habits?.length > 0 && (
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 10, color: isDark ? '#1D9E75' : '#0F6E56', marginBottom: 6, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>habits suggested</div>
                    {aiReply.habits.map((h, i) => (
                      <div key={i} style={{ fontSize: 12, color: T.text, padding: '3px 0', display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span style={{ width: 4, height: 4, borderRadius: '50%', background: isDark ? '#1D9E75' : '#0F6E56', flexShrink: 0 }} />
                        {h.name}
                      </div>
                    ))}
                  </div>
                )}

                {aiReply.events?.length > 0 && (
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 10, color: isDark ? '#EF9F27' : '#854F0B', marginBottom: 6, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>events suggested</div>
                    {aiReply.events.map((e, i) => (
                      <div key={i} style={{ fontSize: 12, color: T.text, padding: '3px 0', display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span style={{ width: 4, height: 4, borderRadius: '50%', background: isDark ? '#EF9F27' : '#854F0B', flexShrink: 0 }} />
                        {e.name}{e.deadline && <span style={{ color: T.muted, fontSize: 11 }}>· {e.deadline}</span>}
                      </div>
                    ))}
                  </div>
                )}

                {aiReply.gap && (
                  <div style={{ background: isDark ? '#1a1535' : '#EEEDFE', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: isDark ? '#AFA9EC' : '#3C3489', lineHeight: 1.6 }}>
                    {aiReply.gap}
                  </div>
                )}
                {aiReply.pattern_insight && (
                  <div style={{ background: isDark ? '#1a0e00' : '#FAECE7', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: isDark ? '#F0997B' : '#712B13', marginTop: 6, lineHeight: 1.5 }}>
                    repeated pattern ({aiReply.repeat_count}×) — {aiReply.pattern_insight}
                  </div>
                )}
                {aiReply._reminder && (
                  <div style={{ background: isDark ? '#001710' : '#E0F5EE', border: `1px solid ${isDark ? '#0F6E56' : '#0F6E5660'}`, borderRadius: 8, padding: '8px 12px', fontSize: 12, color: isDark ? '#5DCAA5' : '#085041', marginTop: 6 }}>
                    nudge set for <strong>{aiReply._reminder.title}</strong>
                  </div>
                )}

                <button onClick={() => document.getElementById('plan-section')?.scrollIntoView({ behavior: 'smooth' })} style={{
                  marginTop: 10, width: '100%', padding: '8px', background: 'transparent',
                  border: `1px solid ${T.border}`, borderRadius: 9, color: T.muted,
                  fontSize: 11, cursor: 'pointer', fontWeight: 500, transition: 'all 0.2s',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = T.muted; e.currentTarget.style.color = T.text }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.color = T.muted }}
                >view full plan ↓</button>
              </div>
            )}

            {/* Recent worries */}
            {worries.length > 0 && (
              <div style={{ marginTop: 14 }}>
                <div style={{ ...sectionLabel, marginBottom: 8 }}>recent worries</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {worries.slice(0, 7).map(w => {
                    const c = getColor(w.topic, isDark)
                    return (
                      <span key={w.id} style={{
                        display: 'inline-flex', alignItems: 'center', gap: 5,
                        padding: '4px 10px', background: c.bg,
                        border: `1px solid ${c.border}`, borderRadius: 16,
                        fontSize: 11, color: c.text, fontWeight: 500,
                      }}>
                        <span style={{ width: 4, height: 4, borderRadius: '50%', background: c.bubble }} />
                        {w.topic || 'worry'}
                        <button onClick={e => { e.stopPropagation(); deleteWorry(w.id) }}
                          style={{ background: 'none', border: 'none', color: T.muted, cursor: 'pointer', fontSize: 13, paddingLeft: 4, fontWeight: 700 }}>×</button>
                      </span>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {/* ─── CONCERN MAP CARD ─── */}
          <div style={card}>
            <div style={sectionLabel}>concern map</div>

            {topics.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '80px 20px', color: T.muted, fontSize: 13 }}>
                <div style={{ fontSize: 36, marginBottom: 10 }}>🧠</div>
                rant first to see your concern bubbles
              </div>
            ) : (
              <>
                {/* Bubble canvas */}
                <div style={{
                  position: 'relative', height: 230, marginBottom: 14,
                  background: isDark
                    ? 'radial-gradient(circle at 50% 50%, #0d0d1e 0%, #07070f 100%)'
                    : 'radial-gradient(circle at 50% 50%, #f5f5ff 0%, #eeeef8 100%)',
                  borderRadius: 12, overflow: 'hidden',
                  border: `1px solid ${T.border}`,
                }}>
                  {topics.slice(0, 7).map(([topic, data], i) => {
                    const c       = getColor(topic, isDark)
                    const max     = topics[0][1].count
                    const size    = 52 + (data.count / max) * 72
                    const POSITIONS = [
                      { left: '10%', top: '14%' }, { left: '54%', top: '15%' },
                      { left: '28%', top: '52%' }, { left: '63%', top: '55%' },
                      { left: '40%', top: '30%' }, { left: '7%',  top: '65%' },
                      { left: '74%', top: '35%' },
                    ]
                    const pos      = POSITIONS[i % POSITIONS.length]
                    const selected = selectedBubble === topic
                    return (
                      <div key={topic}
                        onClick={() => setSelectedBubble(selected ? null : topic)}
                        style={{
                          position: 'absolute', left: pos.left, top: pos.top,
                          width: size, height: size, borderRadius: '50%',
                          background: c.bg,
                          border: `${selected ? 2 : 1}px solid ${selected ? c.bubble : c.border}`,
                          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                          cursor: 'pointer',
                          transform: selected ? 'scale(1.14)' : 'scale(1)',
                          transition: 'all 0.28s cubic-bezier(0.34, 1.56, 0.64, 1)',
                          zIndex: selected ? 3 : 1,
                          boxShadow: selected ? `0 6px 22px ${c.bubble}50` : 'none',
                        }}
                        onMouseEnter={e => { if (!selected) e.currentTarget.style.transform = 'scale(1.07)' }}
                        onMouseLeave={e => { if (!selected) e.currentTarget.style.transform = 'scale(1)' }}
                      >
                        <span style={{ fontSize: Math.max(9, size * 0.15), fontWeight: 600, color: c.text, textAlign: 'center', padding: '0 4px', lineHeight: 1.2 }}>{topic}</span>
                        <span style={{ fontSize: 9, color: c.bubble, marginTop: 2, fontWeight: 700 }}>{data.count}×</span>
                      </div>
                    )
                  })}
                </div>

                {/* Selected bubble detail — with inline nudge */}
                {selectedBubble && topicMap[selectedBubble] && (
                  <div style={{
                    background: T.card,
                    border: `1px solid ${getColor(selectedBubble, isDark).border}`,
                    borderRadius: 12, padding: 14, marginBottom: 12,
                    animation: 'fadeUp 0.2s ease',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: T.text }}>{selectedBubble}</span>
                      <span style={{
                        fontSize: 9, padding: '3px 9px', borderRadius: 10, fontWeight: 700,
                        background: topicMap[selectedBubble].count >= 4
                          ? (isDark ? '#1a0505' : '#FCEBEB')
                          : topicMap[selectedBubble].count >= 2
                          ? (isDark ? '#1c1400' : '#FEF5E0')
                          : (isDark ? '#001710' : '#E0F5EE'),
                        color: topicMap[selectedBubble].count >= 4
                          ? (isDark ? '#F09595' : '#A32D2D')
                          : topicMap[selectedBubble].count >= 2
                          ? (isDark ? '#FAC775' : '#633806')
                          : (isDark ? '#5DCAA5' : '#085041'),
                      }}>
                        {topicMap[selectedBubble].count >= 4 ? 'high gap' : topicMap[selectedBubble].count >= 2 ? 'med gap' : 'low gap'}
                      </span>
                    </div>

                    <div style={{ fontSize: 11, color: T.muted, marginBottom: 10 }}>
                      {topicMap[selectedBubble].count} worries · {topicMap[selectedBubble].habits.length} habits · {topicMap[selectedBubble].events.length} events
                    </div>

                    {topicMap[selectedBubble].habits.slice(0, 3).map(h => (
                      <div key={h.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderBottom: `1px solid ${T.divider}`, fontSize: 12, color: T.muted }}>
                        <span style={{ width: 3, height: 3, borderRadius: '50%', background: isDark ? '#1D9E75' : '#0F6E56', flexShrink: 0 }} />
                        <span style={{ flex: 1 }}>{h.name}</span>
                        <span style={{ fontSize: 9, color: T.muted }}>habit</span>
                        <button onClick={() => deleteHabit(h.id)} style={delBtn}>×</button>
                      </div>
                    ))}
                    {topicMap[selectedBubble].events.slice(0, 3).map(e => (
                      <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderBottom: `1px solid ${T.divider}`, fontSize: 12, color: e.done ? T.muted : T.text, textDecoration: e.done ? 'line-through' : 'none' }}>
                        <span style={{ width: 3, height: 3, borderRadius: '50%', background: isDark ? '#7F77DD' : '#534AB7', flexShrink: 0 }} />
                        <span style={{ flex: 1 }}>{e.name}</span>
                        {e.deadline && <span style={{ fontSize: 9, color: T.muted }}>· {e.deadline}</span>}
                        <span style={{ fontSize: 9, color: e.done ? (isDark ? '#1D9E75' : '#0F6E56') : T.muted }}>{e.done ? 'done' : 'event'}</span>
                        <button onClick={() => deleteEvent(e.id)} style={delBtn}>×</button>
                      </div>
                    ))}

                    {/* ── Nudge inline in bubble ── */}
                    <div style={{ marginTop: 12, paddingTop: 10, borderTop: `1px solid ${T.divider}` }}>
                      <div style={{ fontSize: 10, color: T.muted, marginBottom: 8, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                        schedule a nudge for this
                      </div>
                      {nudgeSentMap[selectedBubble] ? (
                        <div style={{ fontSize: 11, color: isDark ? '#5DCAA5' : '#085041', fontWeight: 600, padding: '6px 0' }}>
                          nudge scheduled ✓ — check your inbox
                        </div>
                      ) : (
                        <div style={{ display: 'flex', gap: 6 }}>
                          <input
                            type="email"
                            placeholder="your email"
                            value={nudgeEmail}
                            onChange={e => setNudgeEmail(e.target.value)}
                            style={{
                              flex: 1, background: T.inputBg,
                              border: `1px solid ${T.border}`, borderRadius: 8,
                              padding: '7px 10px', fontSize: 12, color: T.text,
                            }}
                            onFocus={e  => e.target.style.borderColor = T.accent + '80'}
                            onBlur={e   => e.target.style.borderColor = T.border}
                          />
                          <button
                            onClick={() => sendBubbleNudge(selectedBubble, nudgeEmail)}
                            style={{
                              padding: '7px 14px',
                              background: nudgeEmail ? (isDark ? '#1D9E75' : '#0F6E56') : T.faint,
                              border: 'none', borderRadius: 8, color: '#fff',
                              fontSize: 11, fontWeight: 700,
                              cursor: nudgeEmail ? 'pointer' : 'not-allowed',
                              whiteSpace: 'nowrap', transition: 'all 0.2s',
                            }}
                          >nudge me</button>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Topic list */}
                <div style={{ maxHeight: 220, overflowY: 'auto' }}>
                  {topics.map(([topic, data]) => {
                    const c          = getColor(topic, isDark)
                    const actionsDone = data.events.filter(e => e.done).length
                    const actionsTotal = data.habits.length + data.events.length
                    const isSelected  = selectedBubble === topic
                    return (
                      <div key={topic}
                        onClick={() => setSelectedBubble(isSelected ? null : topic)}
                        style={{
                          background: c.bg,
                          border: `1px solid ${isSelected ? c.bubble : c.border}`,
                          borderRadius: 10, padding: '10px 12px', marginBottom: 6,
                          cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          transition: 'all 0.15s',
                        }}
                        onMouseEnter={e => e.currentTarget.style.borderColor = c.bubble}
                        onMouseLeave={e => e.currentTarget.style.borderColor = isSelected ? c.bubble : c.border}
                      >
                        <div>
                          <span style={{ fontSize: 13, fontWeight: 600, color: c.text }}>{topic}</span>
                          <div style={{ fontSize: 10, color: T.muted, marginTop: 2 }}>
                            {data.count} worries · {actionsDone}/{actionsTotal} done
                          </div>
                        </div>
                        <span style={{ fontSize: 22, fontWeight: 800, color: c.bubble, opacity: 0.8 }}>{data.count}×</span>
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </div>
        </div>

        {/* ── ROW 2 : My Plan  +  Gap Score  +  Focus Timer ── */}
        <div
          id="plan-section"
          className="grid-3col"
          style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 16, marginBottom: 16 }}
        >

          {/* ─── MY PLAN ─── */}
          <div style={card}>
            <div style={sectionLabel}>my plan</div>

            {/* Habits */}
            <div style={{ fontSize: 11, color: isDark ? '#1D9E75' : '#0F6E56', fontWeight: 700, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>✓</span> habits ({habits.length})
            </div>
            {habits.length === 0
              ? <div style={emptyBox}>no habits yet — rant to generate some</div>
              : (
                <div style={{ marginBottom: 18 }}>
                  {habits.map(habit => {
                    const streak   = getStreak(habit)
                    const week     = getWeekDone(habit)
                    const c        = getColor(habit.topic, isDark)
                    const todayDone = week.find(d => d.date === getToday())?.done
                    return (
                      <div key={habit.id} style={{
                        background: T.card,
                        border: `1px solid ${todayDone ? (isDark ? '#1D9E75' : '#0F6E56') : T.border}`,
                        borderRadius: 12, padding: '12px 14px', marginBottom: 8, transition: 'border-color 0.2s',
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: T.text, marginBottom: 3 }}>{habit.name}</div>
                            <span style={{ fontSize: 9, color: c.text, background: c.bg, padding: '2px 7px', borderRadius: 8, fontWeight: 600, border: `1px solid ${c.border}` }}>{habit.topic}</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            {streak > 0 && (
                              <span style={{ fontSize: 10, color: isDark ? '#FAC775' : '#633806', background: isDark ? '#1c1500' : '#FEF5E0', padding: '3px 8px', borderRadius: 10, fontWeight: 700 }}>
                                🔥 {streak}
                              </span>
                            )}
                            <button onClick={() => toggleHabit(habit.id)} style={{
                              width: 28, height: 28, borderRadius: '50%',
                              background: todayDone ? (isDark ? '#1D9E75' : '#0F6E56') : 'transparent',
                              border: `2px solid ${todayDone ? (isDark ? '#1D9E75' : '#0F6E56') : T.border}`,
                              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                              transition: 'all 0.2s', flexShrink: 0,
                            }}
                            onMouseEnter={e => { if (!todayDone) e.currentTarget.style.borderColor = isDark ? '#1D9E75' : '#0F6E56' }}
                            onMouseLeave={e => { if (!todayDone) e.currentTarget.style.borderColor = T.border }}>
                              {todayDone && <svg width="10" height="10" viewBox="0 0 10 10"><polyline points="2,5 4,7 8,3" stroke="#fff" strokeWidth="2" fill="none" /></svg>}
                            </button>
                            <button onClick={() => deleteHabit(habit.id)} style={delBtn}>×</button>
                          </div>
                        </div>
                        {/* Week grid */}
                        <div style={{ display: 'flex', gap: 4 }}>
                          {week.map(({ date, done }) => (
                            <div key={date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                              <div style={{ fontSize: 8, color: T.muted }}>{dayLabel(date)}</div>
                              <div style={{
                                width: '100%', height: 22, borderRadius: 5,
                                background: done
                                  ? (isDark ? '#1D9E75' : '#0F6E56')
                                  : date === getToday()
                                  ? (isDark ? '#1a1535' : '#EEEDFE')
                                  : T.faint,
                                border: `1px solid ${date === getToday() ? (isDark ? '#534AB760' : '#534AB740') : 'transparent'}`,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                transition: 'all 0.2s',
                              }}>
                                {done && <span style={{ fontSize: 9, color: '#fff', fontWeight: 700 }}>✓</span>}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

            {/* Events */}
            <div style={{ fontSize: 11, color: isDark ? '#7F77DD' : '#534AB7', fontWeight: 700, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>📅</span> events ({events.length})
            </div>
            {events.length === 0
              ? <div style={emptyBox}>no events yet — rant to generate some</div>
              : events.map(event => (
                <div key={event.id} style={{
                  background: T.card,
                  border: `1px solid ${T.border}`,
                  borderRadius: 10, padding: '10px 12px', marginBottom: 6,
                  display: 'flex', gap: 10, alignItems: 'center',
                  opacity: event.done ? 0.55 : 1, transition: 'opacity 0.2s',
                }}>
                  <button onClick={() => toggleEvent(event.id, event.done)} style={{
                    width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                    background: event.done ? (isDark ? '#7F77DD' : '#534AB7') : 'transparent',
                    border: `2px solid ${event.done ? (isDark ? '#7F77DD' : '#534AB7') : T.border}`,
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s',
                  }}
                  onMouseEnter={e => { if (!event.done) e.currentTarget.style.borderColor = isDark ? '#7F77DD' : '#534AB7' }}
                  onMouseLeave={e => { if (!event.done) e.currentTarget.style.borderColor = T.border }}>
                    {event.done && <svg width="9" height="9" viewBox="0 0 9 9"><polyline points="2,4.5 3.5,6 7,2.5" stroke="#fff" strokeWidth="2" fill="none" /></svg>}
                  </button>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: event.done ? T.muted : T.text, textDecoration: event.done ? 'line-through' : 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {event.name}
                    </div>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 3 }}>
                      {event.deadline && <span style={{ fontSize: 9, color: T.muted }}>📆 {event.deadline}</span>}
                      <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 6, background: getColor(event.topic, isDark).bg, color: getColor(event.topic, isDark).text, border: `1px solid ${getColor(event.topic, isDark).border}` }}>{event.topic}</span>
                    </div>
                  </div>
                  <button onClick={() => deleteEvent(event.id)} style={delBtn}>×</button>
                </div>
              ))
            }
          </div>

          {/* ─── GAP SCORE ─── */}
          <div style={card}>
            <div style={sectionLabel}>gap score</div>

            <WeeklyRecap userId="demo" />

            <div style={{ textAlign: 'center', padding: '14px 0 10px' }}>
              <div style={{
                fontSize: 68, fontWeight: 900, lineHeight: 1,
                background: gapScore > 70
                  ? 'linear-gradient(135deg, #F09595, #D4537E)'
                  : gapScore > 40
                  ? 'linear-gradient(135deg, #FAC775, #EF9F27)'
                  : 'linear-gradient(135deg, #5DCAA5, #1D9E75)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                backgroundClip: 'text', marginBottom: 8,
              }}>{gapScore}</div>
              <div style={{ fontSize: 11, color: T.muted, lineHeight: 1.5 }}>
                {gapScore > 70 ? '— high, take action' : gapScore > 40 ? '— medium, keep going' : '— low, you\'re crushing it'}
              </div>
            </div>

            <div style={{ borderTop: `1px solid ${T.divider}`, paddingTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, textAlign: 'center', marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 22, fontWeight: 700, color: isDark ? '#7F77DD' : '#534AB7' }}>{totalWorries}</div>
                <div style={{ fontSize: 9, color: T.muted, marginTop: 2 }}>worries</div>
              </div>
              <div>
                <div style={{ fontSize: 22, fontWeight: 700, color: isDark ? '#1D9E75' : '#0F6E56' }}>{totalActionsDone}</div>
                <div style={{ fontSize: 9, color: T.muted, marginTop: 2 }}>actions</div>
              </div>
              <div>
                <div style={{ fontSize: 22, fontWeight: 700, color: isDark ? '#EF9F27' : '#854F0B' }}>
                  {Math.round(totalWorries > 0 ? (totalActionsDone / totalWorries) * 100 : 0)}%
                </div>
                <div style={{ fontSize: 9, color: T.muted, marginTop: 2 }}>progress</div>
              </div>
            </div>

            <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: '12px 14px' }}>
              <div style={{ fontSize: 10, color: isDark ? '#7F77DD' : '#534AB7', fontWeight: 700, marginBottom: 8 }}>tips to close the gap</div>
              {['complete daily habits', 'check off events', 'break worries into small steps', 'revisit plan often'].map((tip, i) => (
                <div key={i} style={{ fontSize: 11, color: T.muted, padding: '3px 0' }}>→ {tip}</div>
              ))}
            </div>
          </div>

          {/* ─── FOCUS TIMER ─── */}
          <div style={card}>
            <div style={sectionLabel}>focus timer</div>

            {topics.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '50px 10px', color: T.muted, fontSize: 12 }}>
                rant to unlock focus bubbles
              </div>
            ) : (
              <>
                {/* Bubble chips */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 14 }}>
                  {topics.map(([topic, data]) => {
                    const c        = getColor(topic, isDark)
                    const isActive = activeTopic === topic
                    return (
                      <button key={topic}
                        onClick={() => setActiveTopic(isActive ? null : topic)}
                        style={{
                          padding: '5px 11px', borderRadius: 20,
                          background: c.bg, border: `${isActive ? 2 : 1}px solid ${isActive ? c.bubble : c.border}`,
                          color: c.text, fontSize: 11, fontWeight: isActive ? 700 : 500,
                          cursor: 'pointer', transition: 'all 0.15s',
                          display: 'flex', alignItems: 'center', gap: 5,
                        }}
                      >
                        <span style={{ width: 5, height: 5, borderRadius: '50%', background: c.bubble }} />
                        {topic}
                        <span style={{ fontSize: 9, color: c.bubble }}>({data.count})</span>
                      </button>
                    )
                  })}
                </div>

                {activeTopic && (
                  <div style={{ textAlign: 'center' }}>
                    {/* Clock face */}
                    <div style={{
                      fontSize: 42, fontWeight: 900, fontFamily: 'monospace',
                      color: T.text, background: T.inputBg,
                      padding: '14px 10px', borderRadius: 12, marginBottom: 12,
                      letterSpacing: '3px', border: `1px solid ${T.border}`,
                    }}>
                      {fmt(timeLeft > 0 ? timeLeft : timerMinutes * 60)}
                    </div>

                    {!isRunning && timeLeft === 0 && (
                      <select value={timerMinutes} onChange={e => setTimerMinutes(parseInt(e.target.value))} style={{
                        background: T.inputBg, border: `1px solid ${T.border}`,
                        borderRadius: 8, padding: '7px 10px', color: T.text,
                        fontSize: 12, marginBottom: 10, width: '100%',
                      }}>
                        {[5, 10, 15, 20, 25, 30].map(m => <option key={m} value={m}>{m} minutes</option>)}
                      </select>
                    )}

                    <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 14 }}>
                      <button onClick={isRunning ? pauseTimer : startTimer} style={{
                        padding: '8px 22px',
                        background: isRunning ? (isDark ? '#EF9F27' : '#854F0B') : (isDark ? '#1D9E75' : '#0F6E56'),
                        border: 'none', borderRadius: 20, color: '#fff',
                        fontWeight: 700, fontSize: 12, cursor: 'pointer', transition: 'all 0.2s',
                      }}>
                        {isRunning ? 'pause' : 'start'}
                      </button>
                      <button onClick={resetTimer} style={{
                        padding: '8px 14px', background: 'transparent',
                        border: `1px solid ${T.border}`, borderRadius: 20,
                        color: T.muted, fontSize: 12, cursor: 'pointer',
                      }}>reset</button>
                    </div>

                    {/* Related worries */}
                    <div style={{ textAlign: 'left' }}>
                      <div style={{ fontSize: 9, color: T.muted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700 }}>
                        related worries
                      </div>
                      <div style={{ maxHeight: 140, overflowY: 'auto' }}>
                        {topicMap[activeTopic]?.worries.slice(0, 4).map(w => (
                          <div key={w.id} style={{ fontSize: 11, color: T.muted, padding: '5px 0', borderBottom: `1px solid ${T.divider}`, lineHeight: 1.5 }}>
                            "{w.text.length > 72 ? w.text.slice(0, 72) + '...' : w.text}"
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {!activeTopic && (
                  <div style={{ fontSize: 12, color: T.muted, textAlign: 'center', paddingTop: 10 }}>
                    select a concern above to start focusing
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* ── ROW 3 : Scheduled Nudges (Reminders) ── */}
        <div style={card}>
          <div style={sectionLabel}>scheduled nudges</div>
          <RemindersTab
            userEmail={userEmail}
            onEmailSave={em => {
              setUserEmail(em)
              setNudgeEmail(em)
              localStorage.setItem('3b_email', em)
            }}
          />
        </div>

      </main>
    </div>
  )
}