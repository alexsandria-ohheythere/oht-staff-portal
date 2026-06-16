'use client'
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { createClient } from '../lib/supabase'

export default function PortalShell({ children }) {
  const pathname = usePathname()
  const [name, setName]               = useState('')
  const [role, setRole]               = useState('')
  const [checked, setChecked]         = useState(false)
  const [unreadCount, setUnread]      = useState(0)
  const [pendingContracts, setPending]= useState(0)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { window.location.href = '/login'; return }
      try {
        const { data } = await supabase.from('staff').select('id, first_name, nickname, role').eq('email', session.user.email).single()
        if (data) {
          setName(data.nickname || data.first_name || session.user.email.split('@')[0])
          setRole(data.role || '')
          const [{ count: notifCount }, { count: contractCount }] = await Promise.all([
            supabase.from('notifications').select('*', { count:'exact', head:true }).eq('staff_id', data.id).eq('is_read', false),
            supabase.from('contracts').select('*', { count:'exact', head:true }).eq('staff_id', data.id).eq('status', 'pending_signature'),
          ])
          setUnread(notifCount || 0)
          setPending(contractCount || 0)
        } else {
          setName(session.user.email.split('@')[0])
        }
      } catch(e) { setName(session.user.email.split('@')[0]) }
      setChecked(true)
    })
  }, [])

  async function signOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  const isCashier = role?.toLowerCase().includes('cashier')

  const NAV = [
    { type: 'section', label: 'Overview' },
    { href: '/portal',                        icon: '🏠', label: 'Dashboard' },

    { type: 'section', label: 'Daily' },
    { href: '/portal/schedule/team',          icon: '📅', label: 'Team Schedule' },
    { href: '/portal/schedule',               icon: '🗓️', label: 'My Schedule' },
    { href: '/portal/tasks',                  icon: '✔️', label: 'Daily Check-In' },
    { href: '/portal/joborders',              icon: '📋', label: 'Job Orders' },
    ...(isCashier ? [
      { href: '/portal/cashout',              icon: '🧾', label: 'Cashout Entry' },
    ] : []),

    { type: 'section', label: 'Request' },
    { href: '/inventory/my-requests',         icon: '🛒', label: 'Purchase Request' },

    { type: 'section', label: 'Forms' },
    { href: '/portal/incident',               icon: '⚠️', label: 'Incident Report' },
    { href: '/portal/wastage',                icon: '🗑️', label: 'Wastage Report' },
    { href: '/portal/leave',                  icon: '📤', label: 'Request Leave' },
    { href: '/portal/overtime',               icon: '⏰', label: 'Request Overtime' },

    { type: 'section', label: 'My Documents' },
    { href: '/portal/payslip',                icon: '💸', label: 'My Payslips' },
    { href: '/portal/contracts',              icon: '📄', label: 'My Contracts',   badge: pendingContracts },
    { href: '/portal/files',                  icon: '📁', label: 'My Files · 201' },

    { href: '/portal/notifications',          icon: '🔔', label: 'Notifications',  badge: unreadCount },
  ]

  const isActive = href => {
    if (href === '/portal') return pathname === '/portal'
    return pathname.startsWith(href)
  }

  return (
    <div style={{ display:'flex', height:'100vh', overflow:'hidden', fontFamily:"'DM Sans',sans-serif" }}>
      <div style={{ width:220, flexShrink:0, background:'#EF4576', display:'flex', flexDirection:'column' }}>

        {/* Logo */}
        <div style={{ padding:'20px 18px 14px', borderBottom:'1px solid rgba(255,255,255,.2)' }}>
          <div style={{ fontFamily:"'Montserrat',sans-serif", fontSize:14, fontWeight:900, color:'white' }}>Oh Hey There</div>
          <div style={{ fontSize:9, color:'rgba(255,255,255,.6)', letterSpacing:2, textTransform:'uppercase', marginTop:2 }}>Staff Portal</div>
        </div>

        {/* Profile chip */}
        {checked && (
          <div style={{ margin:'12px 12px 4px', background:'rgba(255,255,255,.15)', borderRadius:10, padding:'10px 12px' }}>
            <div style={{ fontSize:12, fontWeight:600, color:'white' }}>{name}</div>
            <div style={{ fontSize:9, color:'rgba(255,255,255,.6)', marginTop:1 }}>{role || 'Staff'}</div>
          </div>
        )}

        {/* Nav */}
        <nav style={{ flex:1, padding:'8px 0', overflowY:'auto' }}>
          {NAV.map((item, i) => {
            if (item.type === 'section') return (
              <div key={i} style={{ fontSize:9, fontWeight:700, letterSpacing:2, textTransform:'uppercase', color:'rgba(255,255,255,.4)', padding:'14px 18px 5px', marginTop: i === 0 ? 0 : 4 }}>
                {item.label}
              </div>
            )

            const active = isActive(item.href)
            return (
              <a key={item.href} href={item.href}
                style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 18px', fontSize:12, fontWeight:active?700:400, color:'white', opacity:active?1:0.8, borderLeft:`3px solid ${active?'white':'transparent'}`, background:active?'rgba(0,0,0,.18)':'transparent', textDecoration:'none', transition:'all .15s' }}
                onMouseEnter={e=>{ if(!active){e.currentTarget.style.opacity='1';e.currentTarget.style.background='rgba(0,0,0,.1)'} }}
                onMouseLeave={e=>{ if(!active){e.currentTarget.style.opacity='0.8';e.currentTarget.style.background='transparent'} }}>
                <span style={{ fontSize:14 }}>{item.icon}</span>
                <span style={{ flex:1 }}>{item.label}</span>
                {item.badge > 0 && (
                  <span style={{ background:'white', color:'#EF4576', borderRadius:20, padding:'1px 7px', fontSize:10, fontWeight:700 }}>
                    {item.badge}
                  </span>
                )}
              </a>
            )
          })}
        </nav>

        {/* Sign out */}
        <div style={{ padding:12, borderTop:'1px solid rgba(255,255,255,.15)' }}>
          <button onClick={signOut} style={{ width:'100%', background:'rgba(0,0,0,.15)', border:'1px solid rgba(255,255,255,.2)', color:'white', padding:8, borderRadius:8, fontSize:11, cursor:'pointer', fontFamily:"'DM Sans',sans-serif", fontWeight:500 }}>
            Sign Out
          </button>
        </div>
      </div>

      <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden', background:'#f5f0e8' }}>
        {children}
      </div>
    </div>
  )
}
