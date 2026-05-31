'use client'
import { useState } from 'react'
import { createClient } from '../../lib/supabase'

export default function StaffLogin() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')

  async function handleLogin(e) {
    e.preventDefault()
    setLoading(true); setError('')
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError('Invalid email or password. Please try again.')
      setLoading(false)
    } else {
      // Hard redirect instead of router.replace
      window.location.href = '/portal'
    }
  }

  const inp = {
    width:'100%', background:'var(--surface)', border:'1px solid var(--border)',
    borderRadius:10, padding:'11px 14px', fontSize:13,
    fontFamily:"'DM Sans',sans-serif", color:'var(--text-primary)', outline:'none'
  }

  return (
    <div style={{ minHeight:'100vh', background:'#EF4576', display:'flex', alignItems:'center', justifyContent:'center', padding:24, position:'relative', overflow:'hidden' }}>
      <div style={{ position:'absolute', inset:0, opacity:.04, backgroundImage:'radial-gradient(circle, #a8d672 1px, transparent 1px)', backgroundSize:'28px 28px' }}/>
      <div style={{ background:'var(--white)', borderRadius:20, padding:'40px 36px', width:'100%', maxWidth:400, position:'relative', boxShadow:'0 32px 80px rgba(0,0,0,.3)' }}>
        <div style={{ textAlign:'center', marginBottom:32 }}>
          <div style={{ width:60, height:60, borderRadius:'50%', background:'linear-gradient(135deg,#7ab648,#4a7a1e)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 14px', fontSize:26 }}>🌿</div>
          <div style={{ fontFamily:"'Montserrat',sans-serif", fontSize:22, fontWeight:900, color:'#EF4576' }}>Oh Hey There</div>
          <div style={{ fontSize:11, color:'var(--text-muted)', letterSpacing:2, textTransform:'uppercase', marginTop:4 }}>Staff Portal</div>
        </div>
        <form onSubmit={handleLogin}>
          <div style={{ marginBottom:16 }}>
            <label style={{ display:'block', fontSize:10, fontWeight:700, letterSpacing:1.2, textTransform:'uppercase', color:'var(--text-muted)', marginBottom:6 }}>Email</label>
            <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="your@email.com" required style={inp}
              onFocus={e=>e.target.style.borderColor='#7ab648'} onBlur={e=>e.target.style.borderColor='var(--border)'}/>
          </div>
          <div style={{ marginBottom:24 }}>
            <label style={{ display:'block', fontSize:10, fontWeight:700, letterSpacing:1.2, textTransform:'uppercase', color:'var(--text-muted)', marginBottom:6 }}>Password</label>
            <input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••" required style={inp}
              onFocus={e=>e.target.style.borderColor='#7ab648'} onBlur={e=>e.target.style.borderColor='var(--border)'}/>
          </div>
          {error && <div style={{ background:'#fdeaea', border:'1px solid #f5c6c6', borderRadius:8, padding:'10px 13px', marginBottom:16, fontSize:12, color:'#c0392b' }}>{error}</div>}
          <button type="submit" disabled={loading} style={{ width:'100%', background:loading?'#aaa':'#7ab648', color:'white', border:'none', borderRadius:10, padding:13, fontSize:13, fontWeight:700, cursor:loading?'not-allowed':'pointer', fontFamily:"'DM Sans',sans-serif", transition:'background .2s' }}>
            {loading ? 'Signing in…' : 'Sign In →'}
          </button>
        </form>
        <div style={{ marginTop:20, padding:'12px 14px', background:'var(--surface)', borderRadius:9, border:'1px solid var(--border)', fontSize:11, color:'var(--text-muted)', lineHeight:1.6 }}>
          Use the email and password provided by your manager. Contact Alex or CJ if you need help logging in.
        </div>
      </div>
    </div>
  )
}
