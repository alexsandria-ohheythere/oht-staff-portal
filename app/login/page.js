'use client'
import { useState, useEffect } from 'react'
import { createClient } from '../../lib/supabase'

export default function StaffLogin() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [status, setStatus]     = useState('')

  // If already logged in, redirect immediately
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setStatus('Already logged in, redirecting...')
        window.location.replace('/portal')
      }
    })
  }, [])

  async function handleLogin(e) {
    e.preventDefault()
    setLoading(true); setError(''); setStatus('Signing in...')

    try {
      const supabase = createClient()
      setStatus('Calling Supabase...')
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })

      if (error) {
        setError('Invalid email or password: ' + error.message)
        setLoading(false)
        setStatus('')
        return
      }

      setStatus('Login successful! Redirecting...')
      // Multiple redirect attempts
      setTimeout(() => {
        window.location.replace('/portal')
      }, 500)

    } catch (err) {
      setError('Error: ' + err.message)
      setLoading(false)
      setStatus('')
    }
  }

  const inp = {
    width:'100%', background:'#faf7f2', border:'1px solid #d8cebb',
    borderRadius:10, padding:'11px 14px', fontSize:13,
    fontFamily:"'DM Sans',sans-serif", color:'#1a1208', outline:'none'
  }

  return (
    <div style={{ minHeight:'100vh', background:'#EF4576', display:'flex', alignItems:'center', justifyContent:'center', padding:24 }}>
      <div style={{ background:'white', borderRadius:20, padding:'40px 36px', width:'100%', maxWidth:400, boxShadow:'0 32px 80px rgba(0,0,0,.3)' }}>
        <div style={{ textAlign:'center', marginBottom:32 }}>
          <div style={{ width:60, height:60, borderRadius:'50%', background:'linear-gradient(135deg,#7ab648,#4a7a1e)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 14px', fontSize:26 }}>🌿</div>
          <div style={{ fontFamily:"'Montserrat',sans-serif", fontSize:22, fontWeight:900, color:'#EF4576' }}>Oh Hey There</div>
          <div style={{ fontSize:11, color:'#7a6a50', letterSpacing:2, textTransform:'uppercase', marginTop:4 }}>Staff Portal</div>
        </div>

        <form onSubmit={handleLogin}>
          <div style={{ marginBottom:16 }}>
            <label style={{ display:'block', fontSize:10, fontWeight:700, letterSpacing:1.2, textTransform:'uppercase', color:'#7a6a50', marginBottom:6 }}>Email</label>
            <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="your@email.com" required style={inp}/>
          </div>
          <div style={{ marginBottom:24 }}>
            <label style={{ display:'block', fontSize:10, fontWeight:700, letterSpacing:1.2, textTransform:'uppercase', color:'#7a6a50', marginBottom:6 }}>Password</label>
            <input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••" required style={inp}/>
          </div>

          {error && (
            <div style={{ background:'#fdeaea', border:'1px solid #f5c6c6', borderRadius:8, padding:'10px 13px', marginBottom:16, fontSize:12, color:'#c0392b' }}>
              {error}
            </div>
          )}

          {status && (
            <div style={{ background:'#eef7e4', border:'1px solid #7ab648', borderRadius:8, padding:'10px 13px', marginBottom:16, fontSize:12, color:'#4a7a1e' }}>
              {status}
            </div>
          )}

          <button type="submit" disabled={loading}
            style={{ width:'100%', background:loading?'#aaa':'#7ab648', color:'white', border:'none', borderRadius:10, padding:13, fontSize:13, fontWeight:700, cursor:loading?'not-allowed':'pointer', fontFamily:"'DM Sans',sans-serif" }}>
            {loading ? 'Signing in…' : 'Sign In →'}
          </button>
        </form>

        {/* Manual redirect button — appears after login */}
        {status.includes('successful') && (
          <a href="/portal" style={{ display:'block', marginTop:16, background:'#4a7a1e', color:'white', borderRadius:10, padding:13, fontSize:13, fontWeight:700, textAlign:'center', textDecoration:'none' }}>
            → Go to Portal
          </a>
        )}

        <div style={{ marginTop:20, padding:'12px 14px', background:'#faf7f2', borderRadius:9, border:'1px solid #d8cebb', fontSize:11, color:'#7a6a50', lineHeight:1.6 }}>
          Use the email and password provided by your manager.
        </div>
      </div>
    </div>
  )
}
