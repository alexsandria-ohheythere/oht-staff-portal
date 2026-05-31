'use client'
import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '../lib/supabase'

const toISO = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`

export default function PortalShell({ children }) {
  const router   = useRouter()
  const pathname = usePathname()
  const [user, setUser]       = useState(null)
  const [staffProfile, setStaffProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.replace('/login'); return }
      setUser(session.user)
      // Fetch staff profile by email
      const { data } = await supabase.from('staff').select('*').eq('email', session.user.email).single()
      setStaffProfile(data || null)
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!session) router.replace('/login')
    })
    return () => subscription.unsubscribe()
  }, [router])

  async function signOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.replace('/login')
  }

  if (loading) return (
    <div style={{ height:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'var(--cream)' }}>
      <div style={{ textAlign:'center' }}>
        <div style={{ fontSize:28, marginBottom:10 }}>🌿</div>
        <div style={{ fontFamily:"'Montserrat',sans-serif", fontSize:16, color:'var(--text-primary)' }}>Oh Hey There</div>
        <div style={{ fontSize:10, color:'var(--text-muted)', marginTop:4, letterSpacing:2 }}>LOADING...</div>
      </div>
    </div>
  )

  const initials = staffProfile
    ? ((staffProfile.first_name||'')[0]||'').toUpperCase() + ((staffProfile.last_name||'')[0]||'').toUpperCase()
    : (user?.email||'U')[0].toUpperCase()

  const displayName = staffProfile
    ? `${staffProfile.first_name} ${staffProfile.last_name}`
    : user?.email

  const ROLE_COLORS = {
    'Cafe Supervisor':'#b06af5','Cafe Operations Support':'#4a90c4',
    'Senior Barista':'#7ab648','Junior Barista - Milk Station':'#d4a843',
    'Junior Barista - Cashier':'#e8845a','Executive Chef':'#c0392b',
    'Sous Chef':'#2d7a6a','Kitchen Staff':'#5c3d1e',
  }
  const avatarColor = ROLE_COLORS[staffProfile?.role] || 'var(--matcha)'

  const NAV = [
    { href:'/portal',         icon:'🏠', label:'My Dashboard' },
    { href:'/portal/schedule',icon:'📅', label:'My Schedule'  },
    { href:'/portal/tasks',   icon:'✅', label:'My Tasks'     },
    { href:'/portal/payslip', icon:'💸', label:'My Payslip'   },
    { href:'/portal/leave',   icon:'🗓️', label:'Request Leave' },
  ]

  return (
    <div style={{ display:'flex', height:'100vh', overflow:'hidden' }}>
      {/* Sidebar */}
      <div style={{ width:220, flexShrink:0, background:'var(--espresso)', display:'flex', flexDirection:'column' }}>
        <div style={{ padding:'20px 18px 14px', borderBottom:'1px solid rgba(255,255,255,.1)' }}>
          <div style={{ fontFamily:"'Montserrat',sans-serif", fontSize:14, fontWeight:900, color:'var(--white)' }}>Oh Hey There</div>
          <div style={{ fontSize:9, color:'rgba(255,255,255,.5)', letterSpacing:2, textTransform:'uppercase', marginTop:2 }}>Staff Portal</div>
        </div>

        {/* Profile */}
        <div style={{ margin:'12px 12px 4px', background:'rgba(255,255,255,.08)', borderRadius:10, padding:'10px 12px', display:'flex', alignItems:'center', gap:9 }}>
          <div style={{ width:32, height:32, borderRadius:'50%', background:avatarColor, display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700, color:'white', flexShrink:0 }}>{initials}</div>
          <div>
            <div style={{ fontSize:12, fontWeight:600, color:'var(--white)' }}>{staffProfile?.nickname || displayName?.split(' ')[0]}</div>
            <div style={{ fontSize:9, color:'rgba(255,255,255,.5)', marginTop:1 }}>{staffProfile?.role || 'Staff'}</div>
          </div>
        </div>

        <nav style={{ flex:1, padding:'8px 0', overflowY:'auto' }}>
          {NAV.map(link => (
            <a key={link.href} href={link.href}
              style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 18px', fontSize:12, fontWeight:pathname===link.href?700:500, color:pathname===link.href?'var(--matcha-light)':'rgba(255,255,255,.55)', borderLeft:`3px solid ${pathname===link.href?'var(--matcha)':'transparent'}`, background:pathname===link.href?'rgba(255,255,255,.06)':'transparent', textDecoration:'none', transition:'all .15s' }}>
              <span style={{ fontSize:14, width:16, textAlign:'center' }}>{link.icon}</span>
              {link.label}
            </a>
          ))}
        </nav>

        <div style={{ padding:12, borderTop:'1px solid rgba(255,255,255,.08)' }}>
          <button onClick={signOut} style={{ width:'100%', background:'transparent', border:'1px solid rgba(255,255,255,.15)', color:'rgba(255,255,255,.5)', padding:8, borderRadius:8, fontSize:11, cursor:'pointer', fontFamily:"'DM Sans',sans-serif" }}>
            Sign Out
          </button>
        </div>
      </div>

      {/* Main */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
        {children}
      </div>
    </div>
  )
}
