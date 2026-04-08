'use client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function LoginPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleLogin = () => {
    setLoading(true)

    setTimeout(() => {
      router.push('/') // 👉 goes to http://localhost:3000/
    }, 500)
  }

  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#0a0a0a'
    }}>
      <div style={{
        width: 320,
        background: '#111',
        border: '1px solid #222',
        borderRadius: 16,
        padding: 24,
        boxShadow: '0 10px 40px rgba(0,0,0,0.5)'
      }}>
        <h2 style={{
          color: '#fff',
          marginBottom: 20,
          textAlign: 'center'
        }}>
          3rd Brain Login
        </h2>

        <input
          placeholder="Email"
          style={{
            width: '100%',
            marginBottom: 10,
            padding: 10,
            borderRadius: 8,
            background: '#1a1a1a',
            border: '1px solid #333',
            color: '#fff',
            outline: 'none'
          }}
        />

        <input
          placeholder="Password"
          type="password"
          style={{
            width: '100%',
            marginBottom: 16,
            padding: 10,
            borderRadius: 8,
            background: '#1a1a1a',
            border: '1px solid #333',
            color: '#fff',
            outline: 'none'
          }}
        />

        <button
          onClick={handleLogin}
          style={{
            width: '100%',
            padding: 12,
            background: '#7F77DD',
            border: 'none',
            borderRadius: 10,
            color: '#fff',
            fontSize: 14,
            cursor: 'pointer',
            transition: '0.2s'
          }}
        >
          {loading ? 'Logging in...' : 'Login'}
        </button>
      </div>
    </div>
  )
}