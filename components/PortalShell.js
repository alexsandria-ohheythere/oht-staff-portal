'use client'
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { createClient } from '../lib/supabase'

export default function PortalShell({ children }) {
  const pathname = usePathname()
  const [ready, setReady]             = useState(false)
  const [displayName, setDisplayName] = useState('')
  const [role, setRole]               = useState('')

  useEffect(() => {
    async function init() {
      try {
        const supabase = createClient()
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) { window.location.href = '/login'; return }
        // Try to get staff profile
        const { data: staff } = await supabase
          .from('staff')
          .select('first_name, last_name, nickname, role')
          .eq('email', session.user.email)
          .single()
        if (staff) {
          setDisplayName(staff.nickname || staff.first_name || session.user.email.split('@')[0])
          setRole(staff.role || '')
        } else {
          setDisplayName(session.user.email.split('@')[0])
        }
      } catch(e) {
        console.error('PortalShell error:', e)
      }
      setReady(true)
    }
    init()
  }, [])

  async function signOut() {
    try {
      const supabase = createClient()
      await supabase.auth.signOut()
    } catch(e) { console.error(e) }
    window.location.href = '/login'
  }

  const NAV = [
    { href:'/portal',          icon:'🏠', label:'My Dashboard'  },
    { href:'/portal/schedule', icon:'📅', label:'My Schedule'   },
    { href:'/portal/tasks',    icon:'✅', label:'My Tasks'      },
    { href:'/portal/payslip',  icon:'💸', label:'My Payslip'    },
    { href:'/portal/leave',    icon:'🗓️', label:'Request Leave' },
  ]

  return (
    <div style={{ display:'flex', height:'100vh', overflow:'hidden', fontFamily:"'DM Sans',sans-serif" }}>
      {/* Sidebar */}
      <div style={{ width:220, flexShrink:0, background:'#EF4576', display:'flex', flexDirection:'column' }}>
        <div style={{ padding:'20px 18px 14px', borderBottom:'1px solid rgba(255,255,255,.2)' }}>
          <div style={{ fontFamily:"'Montserrat',sans-serif", fontSize:14, fontWeight:900, color:'white' }}>Oh Hey There</div>
          <div style={{ fontSize:9, color:'rgba(255,255,255,.6)', letterSpacing:2, textTransform:'uppercase', marginTop:2 }}>Staff Portal</div>
        </div>

        {ready && (
          <div style={{ margin:'12px 12px 4px', background:'rgba(255,255,255,.15)', borderRadius:10, padding:'10px 12px' }}>
            <div style={{ fontSize:12, fontWeight:600, color:'white' }}>{displayName}</div>
            <div style={{ fontSize:9, color:'rgba(255,255,255,.6)', marginTop:1 }}>{role || 'Staff'}</div>
          </div>
        )}

        <nav style={{ flex:1, padding:'8px 0' }}>
          {NAV.map(link => {
            const active = pathname === link.href
            return (
              <a key={link.href} href={link.href} style={{
                display:'flex', alignItems:'center', gap:10,
                padding:'10px 18px', fontSize:12,
                fontWeight: active ? 700 : 500,
                color: active ? 'white' : 'rgba(255,255,255,.65)',
                borderLeft: `3px solid ${active ? 'white' : 'transparent'}`,
                background: active ? 'rgba(255,255,255,.15)' : 'transparent',
                textDecoration:'none', transition:'all .15s'
              }}>
                <span style={{ fontSize:14 }}>{link.icon}</span>
                {link.label}
              </a>
            )
          })}
        </nav>

        <div style={{ padding:12, borderTop:'1px solid rgba(255,255,255,.15)' }}>
          <button onClick={signOut} style={{
            width:'100%', background:'rgba(255,255,255,.15)',
            border:'1px solid rgba(255,255,255,.25)', color:'white',
            padding:8, borderRadius:8, fontSize:11, cursor:'pointer',
            fontFamily:"'DM Sans',sans-serif", fontWeight:600
          }}>Sign Out</button>
        </div>
      </div>

      {/* Main content */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden', background:'#f5f0e8' }}>
        {children}
      </div>
    </div>
  )
}
