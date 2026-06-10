'use client'
import { useState } from 'react'
import { createClient } from '../../lib/supabase'

export default function ResetPassword() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm]   = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [success, setSuccess]   = useState(false)

  async function handleReset(e) {
    e.preventDefault()
    if (password !== confirm) { setError('Passwords do not match'); return }
    if (password.length < 8)  { setError('Password must be at least 8 characters'); return }
    setLoading(true); setError('')
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password })
    if (error) { setError(error.message); setLoading(false) }
    else { setSuccess(true); setLoading(false) }
  }

  const inp = { width:'100%', background:'#faf7f2', border:'1px solid #d8cebb', borderRadius:10, padding:'11px 14px', fontSize:13, fontFamily:"'DM Sans',sans-serif", color:'#1a1208', outline:'none' }

  return (
    <div style={{ minHeight:'100vh', background:'#EF4576', display:'flex', alignItems:'center', justifyContent:'center', padding:24 }}>
      <div style={{ background:'white', borderRadius:20, padding:'40px 36px', width:'100%', maxWidth:400, boxShadow:'0 32px 80px rgba(0,0,0,.3)' }}>
        <div style={{ textAlign:'center', marginBottom:32 }}>
          <div style={{ width:60, height:60, borderRadius:'50%', background:'linear-gradient(135deg,#7ab648,#4a7a1e)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 14px', fontSize:26 }}>🌿</div>
          <div style={{ fontFamily:"'Montserrat',sans-serif", fontSize:22, fontWeight:900, color:'#EF4576' }}>Oh Hey There</div>
          <div style={{ fontSize:11, color:'#7a6a50', letterSpacing:2, textTransform:'uppercase', marginTop:4 }}>Staff Portal · Set New Password</div>
        </div>
        {success ? (
          <div style={{ textAlign:'center' }}>
            <div style={{ background:'#eef7e4', border:'1px solid #7ab648', borderRadius:10, padding:'20px', marginBottom:20 }}>
              <div style={{ fontSize:28, marginBottom:8 }}>✅</div>
              <div style={{ fontSize:13, fontWeight:700, color:'#4a7a1e' }}>Password updated!</div>
            </div>
            <a href="/login" style={{ display:'block', background:'#7ab648', color:'white', borderRadius:10, padding:13, fontSize:13, fontWeight:700, textDecoration:'none', textAlign:'center' }}>Sign In →</a>
          </div>
        ) : (
          <form onSubmit={handleReset}>
            <div style={{ marginBottom:16 }}>
              <label style={{ display:'block', fontSize:10, fontWeight:700, letterSpacing:1.2, textTransform:'uppercase', color:'#7a6a50', marginBottom:6 }}>New Password</label>
              <input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Min. 8 characters" required style={inp}/>
            </div>
            <div style={{ marginBottom:20 }}>
              <label style={{ display:'block', fontSize:10, fontWeight:700, letterSpacing:1.2, textTransform:'uppercase', color:'#7a6a50', marginBottom:6 }}>Confirm Password</label>
              <input type="password" value={confirm} onChange={e=>setConfirm(e.target.value)} placeholder="Repeat password" required style={inp}/>
            </div>
            {error && <div style={{ background:'#fdeaea', border:'1px solid #f5c6c6', borderRadius:8, padding:'10px 13px', marginBottom:16, fontSize:12, color:'#c0392b' }}>{error}</div>}
            <button type="submit" disabled={loading}
              style={{ width:'100%', background:loading?'#aaa':'#7ab648', color:'white', border:'none', borderRadius:10, padding:13, fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:"'DM Sans',sans-serif" }}>
              {loading ? 'Updating…' : '✓ Set New Password'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
