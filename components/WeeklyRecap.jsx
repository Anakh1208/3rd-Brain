'use client'
import { useState } from 'react'

export default function WeeklyRecap({ userId }) {
  const [recap, setRecap] = useState(null)
  const [loading, setLoading] = useState(false)

  async function fetchRecap() {
    setLoading(true)
    try {
      const res = await fetch(`/api/weekly-recap?user_id=${userId || 'demo'}`)
      const data = await res.json()
      setRecap(data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  if (!recap) {
    return (
      <button
        onClick={fetchRecap}
        disabled={loading}
        style={{
          width: '100%', padding: '11px', background: loading ? '#222' : '#1a1535',
          border: '0.5px solid #534AB7', borderRadius: 10, color: '#AFA9EC',
          fontSize: 13, fontWeight: 500, cursor: 'pointer',
        }}
      >
        {loading ? 'generating recap...' : '📊 get weekly recap'}
      </button>
    )
  }

  const rateColor = recap.action_rate > 0.6 ? '#5DCAA5' : recap.action_rate > 0.3 ? '#FAC775' : '#F09595'

  return (
    <div style={{ background: '#111', border: '0.5px solid #2a2a2a', borderRadius: 14, padding: 16, marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontSize: 12, fontWeight: 500, color: '#888', textTransform: 'uppercase', letterSpacing: '0.06em' }}>weekly recap</span>
        <button onClick={() => setRecap(null)} style={{ background: 'none', border: 'none', color: '#444', cursor: 'pointer', fontSize: 12 }}>refresh</button>
      </div>

      {/* Action rate big number */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
        <div style={{ flex: 1, background: '#0a0a0a', borderRadius: 10, padding: '10px 12px', textAlign: 'center' }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: rateColor }}>{Math.round(recap.action_rate * 100)}%</div>
          <div style={{ fontSize: 10, color: '#444', marginTop: 2 }}>action rate</div>
        </div>
        <div style={{ flex: 1, background: '#0a0a0a', borderRadius: 10, padding: '10px 12px', textAlign: 'center' }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: recap.top_issue === 'execution gap' ? '#F09595' : '#5DCAA5' }}>{recap.top_issue}</div>
          <div style={{ fontSize: 10, color: '#444', marginTop: 2 }}>status</div>
        </div>
      </div>

      {/* Summary */}
      <div style={{ fontSize: 13, color: '#bbb', marginBottom: 10, lineHeight: 1.5 }}>{recap.summary}</div>

      {/* AI insight */}
      {recap.insight && (
        <div style={{ background: '#1a1535', borderRadius: 8, padding: '10px 12px', fontSize: 13, color: '#AFA9EC', lineHeight: 1.6, marginBottom: 10 }}>
          {recap.insight}
        </div>
      )}

      {/* Topic pills */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {recap.most_common_topic && (
          <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: '#1a0505', color: '#F09595' }}>
            most worried: {recap.most_common_topic}
          </span>
        )}
        {recap.neglected_topic && (
          <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: '#0a1a0a', color: '#5DCAA5' }}>
            most neglected: {recap.neglected_topic}
          </span>
        )}
      </div>
    </div>
  )
}
