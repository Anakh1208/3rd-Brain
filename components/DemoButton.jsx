'use client'
import { useState } from 'react'

// Drop this button anywhere in your layout/header
// Props: onDemoLogin(userId) — callback after login
export default function DemoButton({ onDemoLogin }) {
  const [loading, setLoading] = useState(false)

  async function handleDemo() {
    setLoading(true)
    try {
      const res = await fetch('/api/demo-login', { method: 'POST' })
      const { access_token, user_id, error } = await res.json()
      if (error) throw new Error(error)

      // Store session
      if (typeof window !== 'undefined') {
        localStorage.setItem('demo_user_id', user_id)
        localStorage.setItem('demo_token', access_token)
        localStorage.setItem('is_demo', 'true')
      }

      if (onDemoLogin) onDemoLogin(user_id)
      // Reload to reflect demo data
      window.location.reload()
    } catch (err) {
      alert('Demo login failed: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleDemo}
      disabled={loading}
      style={{
        padding: '8px 16px',
        background: '#1a1535',
        border: '0.5px solid #534AB7',
        borderRadius: 20,
        color: '#AFA9EC',
        fontSize: 12,
        fontWeight: 500,
        cursor: loading ? 'not-allowed' : 'pointer',
        display: 'flex', alignItems: 'center', gap: 6,
        transition: 'opacity 0.15s',
        opacity: loading ? 0.6 : 1,
      }}
    >
      <span style={{ fontSize: 14 }}>▶</span>
      {loading ? 'loading demo...' : 'try demo'}
    </button>
  )
}
