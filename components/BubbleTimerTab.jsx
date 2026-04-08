'use client'
import { useState, useEffect } from 'react'

export default function BubbleTimerTab({ worries, onRefresh }) {
  const [graveyard, setGraveyard] = useState([])

  // Load graveyard from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('bubbleGraveyard')
    if (saved) {
      setGraveyard(JSON.parse(saved))
    }
  }, [])

  // Save to localStorage whenever graveyard changes
  useEffect(() => {
    localStorage.setItem('bubbleGraveyard', JSON.stringify(graveyard))
  }, [graveyard])

  const buryWorry = (worry) => {
    setGraveyard(prev => [...prev, { 
      ...worry, 
      buriedAt: new Date().toISOString() 
    }])
    // Refresh the worries list
    if (onRefresh) onRefresh()
  }

  return (
    <div style={{ animation: 'scaleIn 0.3s ease' }}>
      <div style={{ 
        background: 'linear-gradient(135deg, #111 0%, #0f0f0f 100%)', 
        borderRadius: 16, 
        padding: 24,
        border: '1px solid #1a1a1a',
        textAlign: 'center',
        marginBottom: 20
      }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>🫧</div>
        <h3 style={{ color: '#7F77DD', marginBottom: 8, fontSize: 18 }}>Focus Timer</h3>
        <p style={{ color: '#666', fontSize: 12, marginBottom: 16 }}>
          {worries.length} active worries
        </p>
      </div>

      {/* Active Worries */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ 
          fontSize: 11, color: '#7F77DD', marginBottom: 12, 
          textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 
        }}>
          🧠 Active Worries
        </div>
        {worries.length === 0 ? (
          <div style={{ 
            background: '#0f0f0f', borderRadius: 12, padding: 40, 
            fontSize: 13, color: '#555', textAlign: 'center', 
            border: '1px solid #1a1a1a'
          }}>
            no worries yet. start ranting.
          </div>
        ) : (
          worries.map(worry => (
            <div key={worry.id} style={{
              background: '#111',
              border: '1px solid #222',
              borderRadius: 12,
              padding: 14,
              marginBottom: 10,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              transition: 'all 0.2s'
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, color: '#ddd', marginBottom: 4 }}>
                  {worry.text}
                </div>
                <div style={{ fontSize: 10, color: '#666' }}>
                  {worry.topic || 'general'}
                </div>
              </div>
              <button
                onClick={() => buryWorry(worry)}
                style={{
                  padding: '6px 14px',
                  background: '#D4537E',
                  border: 'none',
                  borderRadius: 8,
                  color: 'white',
                  cursor: 'pointer',
                  fontSize: 11,
                  fontWeight: 600,
                  transition: 'all 0.2s',
                  marginLeft: 12
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#E5658F'
                  e.currentTarget.style.transform = 'scale(1.05)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#D4537E'
                  e.currentTarget.style.transform = 'scale(1)'
                }}
              >
                🪦 Bury
              </button>
            </div>
          ))
        )}
      </div>

      {/* Graveyard */}
      {graveyard.length > 0 && (
        <div>
          <div style={{ 
            fontSize: 11, color: '#666', marginBottom: 12, 
            textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 
          }}>
            🪦 Graveyard ({graveyard.length})
          </div>
          <div style={{ 
            background: '#0f0f0f', 
            borderRadius: 12, 
            padding: 14,
            border: '1px solid #1a1a1a'
          }}>
            {graveyard.slice(-5).reverse().map((item, i) => (
              <div key={i} style={{ 
                fontSize: 11, 
                color: '#555', 
                padding: '6px 0',
                borderBottom: i < graveyard.length - 1 ? '1px solid #1a1a1a' : 'none'
              }}>
                {item.text?.slice(0, 50)}
                {item.text?.length > 50 && '...'}
                <div style={{ fontSize: 9, color: '#444', marginTop: 2 }}>
                  buried {new Date(item.buriedAt).toLocaleDateString()}
                </div>
              </div>
            ))}
            {graveyard.length > 5 && (
              <div style={{ fontSize: 10, color: '#444', textAlign: 'center', marginTop: 8 }}>
                +{graveyard.length - 5} more
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}