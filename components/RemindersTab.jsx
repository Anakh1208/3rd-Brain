'use client'
import { useState, useEffect } from 'react'

export default function RemindersTab({ userEmail, onEmailSave }) {
  const [email, setEmail] = useState(userEmail || '')
  const [reminders, setReminders] = useState([])
  const [loading, setLoading] = useState(false)
  const [newReminder, setNewReminder] = useState({ title: '', date: '', time: '' })
  const [toast, setToast] = useState(null)

  useEffect(() => {
    if (userEmail) loadReminders()
  }, [userEmail])

  const showToast = (msg) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

  async function loadReminders() {
    if (!userEmail) return
    setLoading(true)
    try {
      const res = await fetch(`/api/reminders?email=${encodeURIComponent(userEmail)}`)
      const data = await res.json()
      setReminders(data || [])
    } catch (err) {
      console.error('Load reminders error:', err)
    } finally {
      setLoading(false)
    }
  }

  async function saveEmail() {
    if (!email.includes('@')) {
      showToast('Please enter a valid email')
      return
    }
    onEmailSave(email)
    showToast('Email saved ✓')
    loadReminders()
  }

  async function addReminder(e) {
    e.preventDefault()
    if (!newReminder.title || !newReminder.date || !newReminder.time) {
      showToast('Please fill all fields')
      return
    }

    const deadline = new Date(`${newReminder.date}T${newReminder.time}`).toISOString()

    try {
      const res = await fetch('/api/reminders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          manual: true,
          email: userEmail,
          title: newReminder.title,
          deadline,
        }),
      })

      if (res.ok) {
        showToast('Reminder set ✓')
        setNewReminder({ title: '', date: '', time: '' })
        loadReminders()
      }
    } catch (err) {
      showToast('Error setting reminder')
    }
  }

  async function deleteReminder(id) {
    if (!confirm('Delete this reminder?')) return

    try {
      const res = await fetch('/api/reminders', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, email: userEmail }),
      })

      if (res.ok) {
        showToast('Reminder deleted')
        loadReminders()
      }
    } catch (err) {
      showToast('Error deleting')
    }
  }

  const getStatusDot = (sent) => (
    <span style={{
      width: 8,
      height: 8,
      borderRadius: '50%',
      background: sent ? '#1D9E75' : '#333',
      display: 'inline-block',
      marginRight: 6,
    }} />
  )

  if (!userEmail) {
    return (
      <div style={{ animation: 'scaleIn 0.3s ease' }}>
        <div style={{
          background: '#111', border: '1px solid #1a1a1a',
          borderRadius: 14, padding: 24, textAlign: 'center',
        }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📧</div>
          <h3 style={{ margin: '0 0 8px 0', fontSize: 16, color: '#fff' }}>Set your email</h3>
          <p style={{ margin: '0 0 16px 0', fontSize: 13, color: '#666' }}>
            We'll send reminders to this address. Saved locally in your browser.
          </p>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            style={{
              width: '100%', maxWidth: 280, background: '#1a1a1a', border: '1px solid #2a2a2a',
              borderRadius: 10, padding: '12px 16px', fontSize: 14, color: '#f0f0f0',
              marginBottom: 12,
            }}
          />
          <button
            onClick={saveEmail}
            style={{
              width: '100%', maxWidth: 280, padding: '12px',
              background: 'linear-gradient(135deg, #7F77DD 0%, #6B63C5 100%)',
              border: 'none', borderRadius: 10, color: '#fff',
              fontSize: 14, fontWeight: 600, cursor: 'pointer',
            }}
          >
            Save & Continue →
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ animation: 'scaleIn 0.3s ease' }}>
      {toast && (
        <div style={{
          position: 'fixed', top: 20, right: 20, zIndex: 100,
          background: '#1D9E75', color: '#fff', padding: '10px 16px',
          borderRadius: 10, fontSize: 13, fontWeight: 500,
        }}>
          {toast}
        </div>
      )}

      {/* Email header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 20, padding: '12px 16px', background: '#111',
        borderRadius: 12, border: '1px solid #1a1a1a',
      }}>
        <div>
          <div style={{ fontSize: 11, color: '#666', marginBottom: 2 }}>Reminders sent to</div>
          <div style={{ fontSize: 14, color: '#AFA9EC', fontWeight: 500 }}>{userEmail}</div>
        </div>
        <button
          onClick={() => onEmailSave('')}
          style={{
            padding: '6px 12px', background: 'transparent', border: '1px solid #2a2a2a',
            borderRadius: 8, color: '#666', fontSize: 12, cursor: 'pointer',
          }}
        >
          Change
        </button>
      </div>

      {/* Add new reminder */}
      <form onSubmit={addReminder} style={{ marginBottom: 24 }}>
        <div style={{
          background: '#111', border: '1px solid #1a1a1a',
          borderRadius: 14, padding: 16,
        }}>
          <div style={{ fontSize: 12, color: '#7F77DD', marginBottom: 12, fontWeight: 600 }}>
            + New Reminder
          </div>

          <input
            type="text"
            value={newReminder.title}
            onChange={(e) => setNewReminder({ ...newReminder, title: e.target.value })}
            placeholder="What should we remind you about?"
            style={{
              width: '100%', background: '#1a1a1a', border: '1px solid #2a2a2a',
              borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#f0f0f0',
              marginBottom: 10,
            }}
          />

          <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
            <input
              type="date"
              value={newReminder.date}
              onChange={(e) => setNewReminder({ ...newReminder, date: e.target.value })}
              style={{
                flex: 1, background: '#1a1a1a', border: '1px solid #2a2a2a',
                borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#f0f0f0',
              }}
            />
            <input
              type="time"
              value={newReminder.time}
              onChange={(e) => setNewReminder({ ...newReminder, time: e.target.value })}
              style={{
                flex: 1, background: '#1a1a1a', border: '1px solid #2a2a2a',
                borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#f0f0f0',
              }}
            />
          </div>

          <button
            type="submit"
            style={{
              width: '100%', padding: '12px',
              background: 'linear-gradient(135deg, #1D9E75 0%, #0F6E56 100%)',
              border: 'none', borderRadius: 10, color: '#fff',
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}
          >
            Set Reminder
          </button>
        </div>
      </form>

      {/* List reminders */}
      <div style={{ fontSize: 11, color: '#555', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        Your reminders ({reminders.length})
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#555' }}>Loading...</div>
      ) : reminders.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: 40, background: '#0f0f0f',
          borderRadius: 12, border: '1px solid #1a1a1a', color: '#555',
        }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>📝</div>
          No reminders yet. Add one above or type in the rant tab.
        </div>
      ) : (
        reminders.map((r) => (
          <div key={r.id} style={{
            background: '#111', border: '1px solid #1a1a1a',
            borderRadius: 12, padding: 14, marginBottom: 10,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
              <div style={{ fontSize: 14, fontWeight: 500, color: '#f0f0f0' }}>{r.title}</div>
              <button
                onClick={() => deleteReminder(r.id)}
                style={{
                  padding: '4px 8px', background: 'transparent', border: '1px solid #2a2a2a',
                  borderRadius: 6, color: '#666', fontSize: 11, cursor: 'pointer',
                }}
              >
                ×
              </button>
            </div>

            <div style={{ fontSize: 12, color: '#666', marginBottom: 10 }}>
              {new Date(r.deadline).toLocaleString('en-US', {
                weekday: 'short', month: 'short', day: 'numeric',
                hour: '2-digit', minute: '2-digit',
              })}
            </div>

            <div style={{ display: 'flex', gap: 16, fontSize: 11, color: '#555' }}>
              <span style={{ display: 'flex', alignItems: 'center' }}>
                {getStatusDot(r.reminder_24h_sent)}
                24h before
              </span>
              <span style={{ display: 'flex', alignItems: 'center' }}>
                {getStatusDot(r.reminder_1h_sent)}
                1h before
              </span>
            </div>
          </div>
        ))
      )}
    </div>
  )
}