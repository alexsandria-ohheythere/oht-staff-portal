'use client'
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { createClient } from '../lib/supabase'

const ROLE_COLORS = {
  'Cafe Supervisor':'#b06af5','Cafe Operations Support':'#4a90c4',
  'Senior Barista':'#7ab648','Junior Barista - Milk Station':'#d4a843',
  'Junior Barista - Cashier':'#e8845a','Executive Chef':'#c0392b',
  'Sous Chef':'#2d7a6a','Kitchen Staff':'#5c3d1e',
}

export default function PortalShell({ children }) {
  const pathname = usePathname()
  const [user, setUser]               = useState(null)
  const [staffProfile, setStaffProfile] = useState(null)
  const [loading, setLoading]         = useState(true)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { window.location.href = '/login'; return }
      setUser(session.user)
      const { data } = await supabase.from('staff').select('*').eq('email', session.user.email).single()
      setStaffProfile(data || null)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!session) window.location.href = '/login'
    })
    return () => subscription.unsubscribe()
  }, [])

  async function signOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  if (loading) return (
    <div style={{ height:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'var(--cream)' }}>
      <div style={{ textAlign:'center' }}>
        <div style={{ fontSize:28, marginBottom:10 }}>🌿</div>
        <div style={{ fontFamily:"'Montserrat',sans-serif", fontSize:16, color:'#EF4576' }}>Oh Hey There</div>
        <div style={{ fontSize:10, color:'var(--text-muted)', marginTop:4, letterSpacing:2 }}>LOADING...</div>
      </div>
    </div>
  )

  const initials = staffProfile
    ? ((staffProfile.first_name||'')[0]||'').toUpperCase() + ((staffProfile.last_name||'')[0]||'').toUpperCase()
    : (user?.email||'U')[0].toUpperCase()

  const displayName = staffProfile
    ? (staffProfile.nickname || staffProfile.first_name)
    : user?.email?.split('@')[0]

  const avatarColor = ROLE_COLORS[staffProfile?.role] || '#7ab648'

  const NAV = [
    { href:'/portal',          icon:'🏠', label:'My Dashboard'  },
    { href:'/portal/schedule', icon:'📅', label:'My Schedule'   },
    { href:'/portal/tasks',    icon:'✅', label:'My Tasks'      },
    { href:'/portal/payslip',  icon:'💸', label:'My Payslip'    },
    { href:'/portal/leave',    icon:'🗓️', label:'Request Leave' },
  ]

  return (
    <div style={{ display:'flex', height:'100vh', overflow:'hidden' }}>
      {/* Sidebar */}
      <div style={{ width:220, flexShrink:0, background:'#EF4576', display:'flex', flexDirection:'column' }}>
        <div style={{ padding:'20px 18px 14px', borderBottom:'1px solid rgba(255,255,255,.2)' }}>
          <div style={{ fontFamily:"'Montserrat',sans-serif", fontSize:14, fontWeight:900, color:'white' }}>Oh Hey There</div>
          <div style={{ fontSize:9, color:'rgba(255,255,255,.6)', letterSpacing:2, textTransform:'uppercase', marginTop:2 }}>Staff Portal</div>
        </div>

        {/* Profile */}
        <div style={{ margin:'12px 12px 4px', background:'rgba(255,255,255,.15)', borderRadius:10, padding:'10px 12px', display:'flex', alignItems:'center', gap:9 }}>
          <div style={{ width:32, height:32, borderRadius:'50%', background:avatarColor, display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700, color:'white', flexShrink:0, border:'2px solid rgba(255,255,255,.3)' }}>{initials}</div>
          <div>
            <div style={{ fontSize:12, fontWeight:600, color:'white' }}>{displayName}</div>
            <div style={{ fontSize:9, color:'rgba(255,255,255,.6)', marginTop:1 }}>{staffProfile?.role || 'Staff'}</div>
          </div>
        </div>

        <nav style={{ flex:1, padding:'8px 0', overflowY:'auto' }}>
          {NAV.map(link => {
            const active = pathname === link.href
            return (
              <a key={link.href} href={link.href}
                style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 18px', fontSize:12, fontWeight:active?700:500, color:active?'white':'rgba(255,255,255,.65)', borderLeft:`3px solid ${active?'white':'transparent'}`, background:active?'rgba(255,255,255,.15)':'transparent', textDecoration:'none', transition:'all .15s' }}>
                <span style={{ fontSize:14, width:16, textAlign:'center' }}>{link.icon}</span>
                {link.label}
              </a>
            )
          })}
        </nav>

        <div style={{ padding:12, borderTop:'1px solid rgba(255,255,255,.15)' }}>
          <button onClick={signOut} style={{ width:'100%', background:'rgba(255,255,255,.15)', border:'1px solid rgba(255,255,255,.25)', color:'white', padding:8, borderRadius:8, fontSize:11, cursor:'pointer', fontFamily:"'DM Sans',sans-serif", fontWeight:600 }}>
            Sign Out
          </button>
        </div>
      </div>

      {/* Main */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden', background:'var(--cream)' }}>
        {children}
      </div>
    </div>
  )
}
