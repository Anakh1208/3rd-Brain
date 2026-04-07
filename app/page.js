'use client'
import { useState, useEffect, useCallback } from 'react'

const TOPIC_COLORS = {
  placements: { bg: '#1a1535', border: '#534AB7', text: '#AFA9EC', bubble: '#7F77DD' },
  exams: { bg: '#1f1800', border: '#BA7517', text: '#FAC775', bubble: '#EF9F27' },
  fitness: { bg: '#001a12', border: '#0F6E56', text: '#5DCAA5', bubble: '#1D9E75' },
  money: { bg: '#1a0e00', border: '#993C1D', text: '#F0997B', bubble: '#D85A30' },
  health: { bg: '#001a12', border: '#0F6E56', text: '#5DCAA5', bubble: '#1D9E75' },
  relationships: { bg: '#1a0014', border: '#993556', text: '#ED93B1', bubble: '#D4537E' },
  work: { bg: '#1a1535', border: '#534AB7', text: '#AFA9EC', bubble: '#7F77DD' },
  default: { bg: '#1a1a1a', border: '#555', text: '#aaa', bubble: '#888' },
}

function getColor(topic) {
  return TOPIC_COLORS[topic?.toLowerCase()] || TOPIC_COLORS.default
}

function getToday() {
  return new Date().toISOString().split('T')[0]
}

function getLast7Days() {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (6 - i))
    return d.toISOString().split('T')[0]
  })
}

function dayLabel(dateStr) {
  const days = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
  return days[new Date(dateStr + 'T12:00:00').getDay()]
}

export default function Home() {
  const [tab, setTab] = useState('rant')
  const [rantText, setRantText] = useState('')
  const [loading, setLoading] = useState(false)
  const [aiReply, setAiReply] = useState(null)
  const [worries, setWorries] = useState([])
  const [habits, setHabits] = useState([])
  const [events, setEvents] = useState([])
  const [selectedBubble, setSelectedBubble] = useState(null)
  const [toast, setToast] = useState(null)

  const showToast = (msg) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

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
    } catch (err) {
      console.error('Load error', err)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  async function handleRant() {
    if (!rantText.trim()) return
    setLoading(true)
    setAiReply(null)
    try {
      // 1. Classify with Groq
      const classRes = await fetch('/api/classify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: rantText }),
      })
      const { data } = await classRes.json()
      if (!data) throw new Error('No classification returned')

      // 2. Save worry
      const worryRes = await fetch('/api/worries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: rantText, topic: data.topic }),
      })
      const worry = await worryRes.json()

      // 3. Save habits
      if (data.habits?.length) {
        await Promise.all(data.habits.map(h =>
          fetch('/api/habits', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: h.name, topic: data.topic, worry_id: worry.id }),
          })
        ))
      }

      // 4. Save events
      if (data.events?.length) {
        await Promise.all(data.events.map(ev =>
          fetch('/api/events', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: ev.name, topic: data.topic, deadline: ev.deadline, worry_id: worry.id }),
          })
        ))
      }

      setAiReply(data)
      setRantText('')
      await loadData()
      showToast('Plan generated ✓')
    } catch (err) {
      console.error(err)
      showToast('Error: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  async function toggleHabit(habitId) {
    await fetch('/api/habits', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ habit_id: habitId, completed_date: getToday() }),
    })
    await loadData()
  }

  async function toggleEvent(eventId, currentDone) {
    await fetch('/api/events', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: eventId, done: !currentDone }),
    })
    await loadData()
  }

  // Group by topic for bubble map
  const topicMap = {}
  worries.forEach(w => {
    const t = w.topic || 'other'
    if (!topicMap[t]) topicMap[t] = { count: 0, habits: [], events: [] }
    topicMap[t].count++
  })
  habits.forEach(h => {
    const t = h.topic || 'other'
    if (topicMap[t]) topicMap[t].habits.push(h)
  })
  events.forEach(e => {
    const t = e.topic || 'other'
    if (topicMap[t]) topicMap[t].events.push(e)
  })

  const topics = Object.entries(topicMap).sort((a, b) => b[1].count - a[1].count)

  // Gap score
  const totalWorries = worries.length
  const totalActionsDone = events.filter(e => e.done).length +
    habits.reduce((acc, h) => acc + (h.habit_completions?.length || 0), 0)
  const gapScore = totalWorries > 0
    ? Math.max(0, Math.round(100 - (totalActionsDone / Math.max(totalWorries, 1)) * 50))
    : 0

  // Get 7 day completions for a habit
  function getWeekDone(habit) {
    const days = getLast7Days()
    const completedSet = new Set((habit.habit_completions || []).map(c => c.completed_date))
    return days.map(d => ({ date: d, done: completedSet.has(d) }))
  }

  function getStreak(habit) {
    const completedSet = new Set((habit.habit_completions || []).map(c => c.completed_date))
    let streak = 0
    const today = new Date()
    for (let i = 0; i < 30; i++) {
      const d = new Date(today)
      d.setDate(d.getDate() - i)
      const ds = d.toISOString().split('T')[0]
      if (completedSet.has(ds)) streak++
      else if (i > 0) break
    }
    return streak
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a' }}>
      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: 20, right: 20, zIndex: 100,
          background: '#1D9E75', color: '#fff', padding: '10px 18px',
          borderRadius: 10, fontSize: 13, fontWeight: 500,
          boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
          animation: 'fadeIn 0.2s ease',
        }}>
          {toast}
        </div>
      )}

      {/* Header */}
      <div style={{
        padding: '16px 20px 0',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        borderBottom: '0.5px solid #222', paddingBottom: 12,
      }}>
        <div>
          <span style={{ fontSize: 18, fontWeight: 600, color: '#fff', letterSpacing: '-0.5px' }}>3rd Brain</span>
          <span style={{
            marginLeft: 10, fontSize: 10, background: '#1a1535', color: '#AFA9EC',
            padding: '2px 8px', borderRadius: 12, fontWeight: 500,
          }}>
            gap score: {gapScore}
          </span>
        </div>
        <div style={{ fontSize: 11, color: '#555' }}>
          {worries.length} worries · {habits.length} habits · {events.length} events
        </div>
      </div>

      {/* Tab Bar */}
      <div style={{
        display: 'flex', borderBottom: '0.5px solid #222',
        background: '#0a0a0a', position: 'sticky', top: 0, zIndex: 10,
      }}>
        {[
          { id: 'rant', label: 'rant' },
          { id: 'map', label: 'concern map' },
          { id: 'plan', label: 'my plan' },
          { id: 'gap', label: 'gap score' },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              flex: 1, padding: '12px 4px', border: 'none', background: 'none',
              color: tab === t.id ? '#7F77DD' : '#666',
              fontSize: 12, fontWeight: tab === t.id ? 500 : 400,
              cursor: 'pointer', borderBottom: tab === t.id ? '2px solid #7F77DD' : '2px solid transparent',
              transition: 'all 0.15s',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ padding: '20px 16px', maxWidth: 500, margin: '0 auto' }}>

        {/* ═══════════ RANT TAB ═══════════ */}
        {tab === 'rant' && (
          <div>
            <p style={{ fontSize: 13, color: '#666', marginBottom: 14, lineHeight: 1.5 }}>
              just type it out. what's stressing you?
            </p>
            <textarea
              value={rantText}
              onChange={e => setRantText(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && e.ctrlKey && handleRant()}
              placeholder="i have exams next week and haven't studied. also terrified about placements..."
              rows={5}
              style={{
                width: '100%', background: '#141414', border: '0.5px solid #333',
                borderRadius: 12, padding: 14, fontSize: 14, color: '#f0f0f0',
                fontFamily: 'inherit', resize: 'none', lineHeight: 1.6,
                marginBottom: 10,
              }}
            />
            <button
              onClick={handleRant}
              disabled={loading || !rantText.trim()}
              style={{
                width: '100%', padding: '12px', background: loading ? '#333' : '#7F77DD',
                border: 'none', borderRadius: 10, color: '#fff', fontSize: 14,
                fontWeight: 500, cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'background 0.2s',
              }}
            >
              {loading ? 'analyzing...' : 'unload it →'}
            </button>

            {/* AI Reply */}
            {aiReply && (
              <div style={{ marginTop: 16, background: '#141414', border: '0.5px solid #333', borderRadius: 12, padding: 14 }}>
                <div style={{ fontSize: 11, color: '#7F77DD', fontWeight: 500, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  {aiReply.topic} · classified
                </div>
                <p style={{ fontSize: 13, color: '#aaa', lineHeight: 1.6, marginBottom: 12 }}>{aiReply.summary}</p>
                {aiReply.habits?.length > 0 && (
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 11, color: '#1D9E75', marginBottom: 6, fontWeight: 500 }}>habits →</div>
                    {aiReply.habits.map((h, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', fontSize: 13, color: '#ddd' }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#1D9E75', flexShrink: 0 }} />
                        {h.name}
                      </div>
                    ))}
                  </div>
                )}
                {aiReply.events?.length > 0 && (
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 11, color: '#EF9F27', marginBottom: 6, fontWeight: 500 }}>events →</div>
                    {aiReply.events.map((e, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', fontSize: 13, color: '#ddd' }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#EF9F27', flexShrink: 0 }} />
                        {e.name} {e.deadline && <span style={{ color: '#666', fontSize: 11 }}>· {e.deadline}</span>}
                      </div>
                    ))}
                  </div>
                )}
                {aiReply.gap && (
                  <div style={{ background: '#1a1535', borderRadius: 8, padding: '8px 10px', fontSize: 12, color: '#AFA9EC', lineHeight: 1.5 }}>
                    {aiReply.gap}
                  </div>
                )}
                <button onClick={() => setTab('plan')} style={{
                  marginTop: 12, width: '100%', padding: '9px', background: 'transparent',
                  border: '0.5px solid #333', borderRadius: 8, color: '#888',
                  fontSize: 12, cursor: 'pointer',
                }}>
                  view full plan →
                </button>
              </div>
            )}

            {/* Recent worries */}
            {worries.length > 0 && (
              <div style={{ marginTop: 20 }}>
                <div style={{ fontSize: 11, color: '#444', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>recent worries</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {worries.slice(0, 8).map(w => {
                    const c = getColor(w.topic)
                    return (
                      <span key={w.id} style={{
                        display: 'inline-flex', alignItems: 'center', gap: 5,
                        padding: '4px 10px', background: c.bg,
                        border: `0.5px solid ${c.border}`, borderRadius: 20,
                        fontSize: 11, color: c.text,
                      }}>
                        <span style={{ width: 5, height: 5, borderRadius: '50%', background: c.bubble }} />
                        {w.topic || 'worry'}
                      </span>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══════════ CONCERN MAP TAB ═══════════ */}
        {tab === 'map' && (
          <div>
            {topics.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 0', color: '#444', fontSize: 14 }}>
                no worries yet. start ranting →
              </div>
            ) : (
              <>
                {/* Bubble visualization */}
                <div style={{ position: 'relative', height: 280, marginBottom: 16, background: '#0f0f0f', borderRadius: 16, border: '0.5px solid #1a1a1a', overflow: 'hidden' }}>
                  {topics.map(([topic, data], i) => {
                    const c = getColor(topic)
                    const maxCount = topics[0][1].count
                    const size = 50 + (data.count / maxCount) * 80
                    // Position bubbles in a scattered layout
                    const positions = [
                      { left: '15%', top: '15%' },
                      { left: '55%', top: '20%' },
                      { left: '25%', top: '55%' },
                      { left: '62%', top: '55%' },
                      { left: '40%', top: '35%' },
                      { left: '5%', top: '60%' },
                    ]
                    const pos = positions[i % positions.length]
                    const isSelected = selectedBubble === topic

                    return (
                      <div
                        key={topic}
                        onClick={() => setSelectedBubble(isSelected ? null : topic)}
                        style={{
                          position: 'absolute',
                          left: pos.left, top: pos.top,
                          width: size, height: size,
                          borderRadius: '50%',
                          background: c.bg,
                          border: `${isSelected ? 2 : 0.5}px solid ${isSelected ? c.bubble : c.border}`,
                          display: 'flex', flexDirection: 'column',
                          alignItems: 'center', justifyContent: 'center',
                          cursor: 'pointer',
                          transform: isSelected ? 'scale(1.08)' : 'scale(1)',
                          transition: 'all 0.2s',
                          zIndex: isSelected ? 2 : 1,
                        }}
                      >
                        <span style={{ fontSize: Math.max(9, size * 0.14), fontWeight: 500, color: c.text, textAlign: 'center', padding: '0 4px', lineHeight: 1.2 }}>
                          {topic}
                        </span>
                        <span style={{ fontSize: 9, color: c.bubble, marginTop: 2, opacity: 0.8 }}>
                          {data.count}x
                        </span>
                      </div>
                    )
                  })}
                </div>

                {/* Detail card for selected bubble */}
                {selectedBubble && topicMap[selectedBubble] && (
                  <div style={{ background: '#141414', border: `0.5px solid ${getColor(selectedBubble).border}`, borderRadius: 12, padding: 14, marginBottom: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <span style={{ fontSize: 14, fontWeight: 500, color: '#fff' }}>{selectedBubble}</span>
                      <span style={{
                        fontSize: 10, padding: '2px 8px', borderRadius: 10,
                        background: topicMap[selectedBubble].count >= 4 ? '#1a0505' : '#1a1200',
                        color: topicMap[selectedBubble].count >= 4 ? '#F09595' : '#FAC775',
                        fontWeight: 500,
                      }}>
                        {topicMap[selectedBubble].count >= 4 ? 'high gap' : topicMap[selectedBubble].count >= 2 ? 'med gap' : 'low gap'}
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: '#555', marginBottom: 10 }}>
                      worried {topicMap[selectedBubble].count}x · {topicMap[selectedBubble].habits.length} habits · {topicMap[selectedBubble].events.length} events
                    </div>
                    {topicMap[selectedBubble].habits.map(h => (
                      <div key={h.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderBottom: '0.5px solid #1a1a1a', fontSize: 12, color: '#bbb' }}>
                        <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#1D9E75', flexShrink: 0 }} />
                        {h.name}
                        <span style={{ marginLeft: 'auto', fontSize: 10, color: '#444' }}>habit</span>
                      </div>
                    ))}
                    {topicMap[selectedBubble].events.map(e => (
                      <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderBottom: '0.5px solid #1a1a1a', fontSize: 12, color: e.done ? '#555' : '#bbb', textDecoration: e.done ? 'line-through' : 'none' }}>
                        <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#7F77DD', flexShrink: 0 }} />
                        {e.name}
                        {e.deadline && <span style={{ fontSize: 10, color: '#555' }}>· {e.deadline}</span>}
                        <span style={{ marginLeft: 'auto', fontSize: 10, color: e.done ? '#1D9E75' : '#444' }}>{e.done ? 'done' : 'event'}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Topic list */}
                {topics.map(([topic, data]) => {
                  const c = getColor(topic)
                  const actionsTotal = data.habits.length + data.events.length
                  const actionsDone = data.events.filter(e => e.done).length
                  return (
                    <div
                      key={topic}
                      onClick={() => setSelectedBubble(selectedBubble === topic ? null : topic)}
                      style={{
                        background: c.bg, border: `0.5px solid ${c.border}`,
                        borderRadius: 10, padding: '10px 12px', marginBottom: 8,
                        cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      }}
                    >
                      <div>
                        <span style={{ fontSize: 13, fontWeight: 500, color: c.text }}>{topic}</span>
                        <div style={{ fontSize: 11, color: '#555', marginTop: 2 }}>
                          {data.count} worries · {actionsTotal} actions · {actionsDone} done
                        </div>
                      </div>
                      <div style={{ fontSize: 22, fontWeight: 600, color: c.bubble, opacity: 0.8 }}>{data.count}x</div>
                    </div>
                  )
                })}
              </>
            )}
          </div>
        )}

        {/* ═══════════ MY PLAN TAB ═══════════ */}
        {tab === 'plan' && (
          <div>
            {/* Habits section */}
            <div style={{ fontSize: 11, color: '#1D9E75', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 500 }}>
              habits — {habits.length} total
            </div>
            {habits.length === 0 ? (
              <div style={{ background: '#111', borderRadius: 10, padding: 14, marginBottom: 16, fontSize: 13, color: '#444', textAlign: 'center' }}>
                no habits yet. rant to generate some.
              </div>
            ) : (
              habits.map(habit => {
                const streak = getStreak(habit)
                const week = getWeekDone(habit)
                const c = getColor(habit.topic)
                const todayDone = week.find(d => d.date === getToday())?.done

                return (
                  <div key={habit.id} style={{
                    background: '#111', border: `0.5px solid ${todayDone ? '#1D9E75' : '#222'}`,
                    borderRadius: 12, padding: 14, marginBottom: 10,
                    transition: 'border-color 0.2s',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 500, color: '#f0f0f0' }}>{habit.name}</div>
                        <span style={{ fontSize: 10, color: '#555' }}>{habit.topic}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {streak > 0 && (
                          <span style={{ fontSize: 10, background: '#1f1800', color: '#FAC775', padding: '2px 8px', borderRadius: 10, fontWeight: 500 }}>
                            🔥 {streak}
                          </span>
                        )}
                        <button
                          onClick={() => toggleHabit(habit.id)}
                          style={{
                            width: 28, height: 28, borderRadius: '50%',
                            background: todayDone ? '#1D9E75' : 'transparent',
                            border: `1.5px solid ${todayDone ? '#1D9E75' : '#333'}`,
                            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            transition: 'all 0.15s',
                          }}
                        >
                          {todayDone && (
                            <svg width="10" height="10" viewBox="0 0 10 10">
                              <polyline points="2,5 4,7 8,3" stroke="#fff" strokeWidth="1.5" fill="none" />
                            </svg>
                          )}
                        </button>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {week.map(({ date, done }) => (
                        <div key={date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                          <div style={{ fontSize: 9, color: '#444' }}>{dayLabel(date)}</div>
                          <div style={{
                            width: '100%', height: 24, borderRadius: 5,
                            background: done ? '#1D9E75' : date === getToday() ? '#1a1535' : '#1a1a1a',
                            border: `0.5px solid ${date === getToday() ? '#534AB7' : 'transparent'}`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}>
                            {done && <span style={{ fontSize: 8, color: '#fff' }}>✓</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })
            )}

            {/* Events section */}
            <div style={{ fontSize: 11, color: '#7F77DD', marginBottom: 10, marginTop: 20, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 500 }}>
              events — {events.length} total
            </div>
            {events.length === 0 ? (
              <div style={{ background: '#111', borderRadius: 10, padding: 14, fontSize: 13, color: '#444', textAlign: 'center' }}>
                no events yet. rant to generate some.
              </div>
            ) : (
              events.map(event => (
                <div key={event.id} style={{
                  background: '#111', border: `0.5px solid ${event.done ? '#222' : '#2a2a2a'}`,
                  borderRadius: 12, padding: 12, marginBottom: 8,
                  display: 'flex', gap: 12, alignItems: 'center',
                  opacity: event.done ? 0.5 : 1,
                  transition: 'opacity 0.2s',
                }}>
                  <button
                    onClick={() => toggleEvent(event.id, event.done)}
                    style={{
                      width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                      background: event.done ? '#7F77DD' : 'transparent',
                      border: `1.5px solid ${event.done ? '#7F77DD' : '#333'}`,
                      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'all 0.15s',
                    }}
                  >
                    {event.done && (
                      <svg width="10" height="10" viewBox="0 0 10 10">
                        <polyline points="2,5 4,7 8,3" stroke="#fff" strokeWidth="1.5" fill="none" />
                      </svg>
                    )}
                  </button>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: event.done ? '#555' : '#f0f0f0', textDecoration: event.done ? 'line-through' : 'none' }}>
                      {event.name}
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 3, alignItems: 'center' }}>
                      {event.deadline && (
                        <span style={{ fontSize: 10, color: '#555' }}>· {event.deadline}</span>
                      )}
                      <span style={{
                        fontSize: 10, padding: '1px 6px', borderRadius: 8,
                        background: '#1a1535', color: '#AFA9EC',
                      }}>
                        {event.topic}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* ═══════════ GAP SCORE TAB ═══════════ */}
        {tab === 'gap' && (
          <div>
            {/* Big gap score */}
            <div style={{ background: '#111', borderRadius: 16, padding: 20, marginBottom: 16, textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: '#555', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                mind gap score
              </div>
              <div style={{
                fontSize: 72, fontWeight: 700, lineHeight: 1,
                color: gapScore > 70 ? '#F09595' : gapScore > 40 ? '#FAC775' : '#5DCAA5',
              }}>
                {gapScore}
              </div>
              <div style={{ fontSize: 12, color: '#555', marginTop: 8 }}>
                {gapScore > 70 ? 'high anxiety, low action' : gapScore > 40 ? 'making some progress' : 'great balance!'}
              </div>

              {/* Progress bars */}
              <div style={{ marginTop: 20, textAlign: 'left' }}>
                {[
                  { label: 'worries', count: totalWorries, color: '#E24B4A', max: Math.max(totalWorries, totalActionsDone, 1) },
                  { label: 'actions done', count: totalActionsDone, color: '#1D9E75', max: Math.max(totalWorries, totalActionsDone, 1) },
                ].map(({ label, count, color, max }) => (
                  <div key={label} style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontSize: 11, color: '#555', width: 80, flexShrink: 0 }}>{label}</span>
                    <div style={{ flex: 1, height: 6, background: '#1a1a1a', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{
                        width: `${(count / max) * 100}%`, height: '100%',
                        background: color, borderRadius: 3,
                        transition: 'width 0.5s ease',
                      }} />
                    </div>
                    <span style={{ fontSize: 11, color: '#555', width: 20, textAlign: 'right' }}>{count}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Per-topic breakdown */}
            <div style={{ fontSize: 11, color: '#555', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              by topic
            </div>
            {topics.length === 0 ? (
              <div style={{ background: '#111', borderRadius: 10, padding: 14, fontSize: 13, color: '#444', textAlign: 'center' }}>
                rant first to see your gap score
              </div>
            ) : (
              topics.map(([topic, data]) => {
                const c = getColor(topic)
                const actionsDone = data.events.filter(e => e.done).length
                const pct = data.count > 0 ? Math.round((actionsDone / data.count) * 100) : 0
                const isHighGap = data.count >= 3 && actionsDone === 0

                return (
                  <div key={topic} style={{
                    background: '#111', border: `0.5px solid ${isHighGap ? '#3a1010' : '#1a1a1a'}`,
                    borderRadius: 12, padding: 14, marginBottom: 8,
                  }}>
                    {isHighGap && (
                      <div style={{ background: '#1a0505', borderRadius: 8, padding: '8px 10px', marginBottom: 10, fontSize: 12, color: '#F09595', lineHeight: 1.5 }}>
                        ⚠ you've worried about {topic} {data.count}x and completed 0 actions.
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 500, color: c.text }}>{topic}</span>
                      <span style={{ fontSize: 12, color: pct >= 50 ? '#5DCAA5' : '#F09595', fontWeight: 500 }}>
                        {pct}% done
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span style={{ fontSize: 11, color: '#444' }}>worried {data.count}x</span>
                      <div style={{ flex: 1, height: 4, background: '#1a1a1a', borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{
                          width: `${pct}%`, height: '100%',
                          background: c.bubble, borderRadius: 2,
                          transition: 'width 0.5s',
                        }} />
                      </div>
                      <span style={{ fontSize: 11, color: '#444' }}>{actionsDone} done</span>
                    </div>
                  </div>
                )
              })
            )}

            {/* Stats row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 16 }}>
              {[
                { label: 'total worries', value: totalWorries, color: '#E24B4A' },
                { label: 'habits', value: habits.length, color: '#1D9E75' },
                { label: 'events done', value: events.filter(e => e.done).length + '/' + events.length, color: '#7F77DD' },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ background: '#111', borderRadius: 10, padding: '10px 12px', textAlign: 'center' }}>
                  <div style={{ fontSize: 20, fontWeight: 600, color }}>{value}</div>
                  <div style={{ fontSize: 10, color: '#444', marginTop: 2 }}>{label}</div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
        button { font-family: inherit; }
        textarea { font-family: inherit; }
      `}</style>
    </div>
  )
}
