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
  const [drawerOpen, setDrawerOpen]   = useState(false)

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
    { href: '/portal',                    icon: '🏠', label: 'Dashboard' },

    { type: 'section', label: 'Daily' },
    { href: '/portal/team',               icon: '📅', label: 'Team Schedule' },
    { href: '/portal/schedule',           icon: '🗓️', label: 'My Schedule' },
    { href: '/portal/tasks',              icon: '✔️', label: 'Daily Check-In' },
    { href: '/portal/joborders',          icon: '📋', label: 'Job Orders' },
    ...(isCashier ? [
      { href: '/portal/cashout',          icon: '🧾', label: 'Cashout Entry' },
    ] : []),

    { type: 'section', label: 'Inventory' },
    { href: '/inventory/my-requests', icon: '🚩', label: 'Running Low Request' },
    { href: '/inventory/daily',       icon: '📋', label: 'Daily Inventory' },
    { href: '/inventory/my-reports',  icon: '📊', label: 'My Reports' },
    { href: '/portal/recipes',        icon: '📒', label: 'Recipes' },
    
    { type: 'section', label: 'Forms' },
    { href: '/portal/incident',           icon: '⚠️', label: 'Incident Report' },
    { href: '/portal/wastage',            icon: '🗑️', label: 'Wastage Report' },
    { href: '/portal/leave',              icon: '📤', label: 'Request Leave' },
    { href: '/portal/overtime',           icon: '⏰', label: 'Request Overtime' },

    { type: 'section', label: 'My Documents' },
    { href: '/portal/profile',            icon: '👤', label: 'My Profile' },
    { href: '/portal/payslip',            icon: '💸', label: 'My Payslips' },
    { href: '/portal/contracts',          icon: '📄', label: 'My Contracts', badge: pendingContracts },
    { href: '/portal/files',              icon: '📁', label: 'My Files · 201' },
    { href: '/portal/sanctions',          icon: '⚖️', label: 'My Sanctions' },
    { href: '/portal/handbook',           icon: '📖', label: 'Handbook' },

    { href: '/portal/notifications',      icon: '🔔', label: 'Notifications', badge: unreadCount },
  ]

  const BOTTOM_NAV = [
    { href: '/portal',           icon: '🏠', label: 'Home' },
    { href: '/portal/tasks',     icon: '✔️', label: 'Check-In' },
    { href: '/portal/team',      icon: '📅', label: 'Schedule' },
    { href: '/portal/notifications', icon: '🔔', label: 'Alerts', badge: unreadCount },
  ]

  const isActive = href => {
    if (href === '/portal') return pathname === '/portal'
    return pathname.startsWith(href)
  }

  const SidebarContent = () => (
    <div style={{ width:'100%', background:'#EF4576', display:'flex', flexDirection:'column', height:'100%' }}>
      <div style={{ padding:'20px 18px 14px', borderBottom:'1px solid rgba(255,255,255,.2)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div>
          <div style={{ fontFamily:"'Montserrat',sans-serif", fontSize:14, fontWeight:900, color:'white' }}>Oh Hey There</div>
          <div style={{ fontSize:9, color:'rgba(255,255,255,.6)', letterSpacing:2, textTransform:'uppercase', marginTop:2 }}>Staff Portal</div>
        </div>
        <button onClick={() => setDrawerOpen(false)}
          style={{ background:'rgba(0,0,0,.2)', border:'none', color:'white', width:30, height:30, borderRadius:8, cursor:'pointer', fontSize:16, display:'flex', alignItems:'center', justifyContent:'center' }}>
          ✕
        </button>
      </div>

      {checked && (
        <div style={{ margin:'12px 12px 4px', background:'rgba(255,255,255,.15)', borderRadius:10, padding:'10px 12px' }}>
          <div style={{ fontSize:12, fontWeight:600, color:'white' }}>{name}</div>
          <div style={{ fontSize:9, color:'rgba(255,255,255,.6)', marginTop:1 }}>{role || 'Staff'}</div>
          <a href="/portal/profile"
            onClick={() => setDrawerOpen(false)}
            style={{ display:'inline-block', marginTop:8, fontSize:10, fontWeight:700, color:'#EF4576', background:'white', borderRadius:6, padding:'4px 10px', textDecoration:'none', letterSpacing:0.3 }}>
            View My Profile →
          </a>
        </div>
      )}

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
              onClick={() => setDrawerOpen(false)}
              style={{ display:'flex', alignItems:'center', gap:10, padding:'11px 18px', fontSize:13, fontWeight:active?700:400, color:'white', opacity:active?1:0.8, borderLeft:`3px solid ${active?'white':'transparent'}`, background:active?'rgba(0,0,0,.18)':'transparent', textDecoration:'none', transition:'all .15s' }}>
              <span style={{ fontSize:16 }}>{item.icon}</span>
              <span style={{ flex:1 }}>{item.label}</span>
              {item.badge > 0 && (
                <span style={{ background:'white', color:'#EF4576', borderRadius:20, padding:'1px 7px', fontSize:10, fontWeight:700 }}>{item.badge}</span>
              )}
            </a>
          )
        })}
      </nav>

      <div style={{ padding:12, borderTop:'1px solid rgba(255,255,255,.15)' }}>
        <button onClick={signOut} style={{ width:'100%', background:'rgba(0,0,0,.15)', border:'1px solid rgba(255,255,255,.2)', color:'white', padding:10, borderRadius:8, fontSize:12, cursor:'pointer', fontFamily:"'DM Sans',sans-serif", fontWeight:500 }}>
          Sign Out
        </button>
      </div>
    </div>
  )

  return (
    <>
      <style>{`
        .ps-desktop-sidebar { display: flex; }
        .ps-mobile-topbar   { display: none; }
        .ps-bottom-nav      { display: none; }
        .ps-content         { padding-bottom: 0; }
        @media (max-width: 768px) {
          .ps-desktop-sidebar { display: none; }
          .ps-mobile-topbar   { display: flex; }
          .ps-bottom-nav      { display: flex; }
          .ps-content         { padding-bottom: 64px; }
        }
      `}</style>

      <div style={{ display:'flex', height:'100vh', overflow:'hidden', fontFamily:"'DM Sans',sans-serif" }}>

        {/* Desktop sidebar */}
        <div className="ps-desktop-sidebar" style={{ width:220, flexShrink:0, flexDirection:'column' }}>
          <SidebarContent />
        </div>

        {/* Mobile drawer */}
        {drawerOpen && (
          <div onClick={() => setDrawerOpen(false)}
            style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', zIndex:200, display:'flex' }}>
            <div onClick={e => e.stopPropagation()}
              style={{ width:260, height:'100%', display:'flex', flexDirection:'column', boxShadow:'4px 0 24px rgba(0,0,0,.25)' }}>
              <SidebarContent />
            </div>
          </div>
        )}

        {/* Main area */}
        <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden', background:'#f5f0e8' }}>

          {/* Mobile top bar */}
          <div className="ps-mobile-topbar"
            style={{ alignItems:'center', justifyContent:'space-between', padding:'10px 16px', background:'#EF4576', flexShrink:0 }}>
            <button onClick={() => setDrawerOpen(true)}
              style={{ background:'rgba(0,0,0,.2)', border:'none', color:'white', width:36, height:36, borderRadius:10, cursor:'pointer', fontSize:20, display:'flex', alignItems:'center', justifyContent:'center' }}>
              ☰
            </button>
            <div style={{ fontFamily:"'Montserrat',sans-serif", fontSize:14, fontWeight:900, color:'white' }}>Oh Hey There</div>
            <a href="/portal/notifications" style={{ position:'relative', textDecoration:'none' }}>
              <div style={{ background:'rgba(0,0,0,.2)', width:36, height:36, borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18 }}>🔔</div>
              {unreadCount > 0 && (
                <span style={{ position:'absolute', top:-3, right:-3, background:'white', color:'#EF4576', borderRadius:20, padding:'1px 5px', fontSize:9, fontWeight:700 }}>{unreadCount}</span>
              )}
            </a>
          </div>

          <div className="ps-content" style={{ flex:1, overflow:'auto', display:'flex', flexDirection:'column' }}>
            {children}
          </div>
        </div>
      </div>

      {/* Mobile bottom nav */}
      <div className="ps-bottom-nav"
        style={{ position:'fixed', bottom:0, left:0, right:0, background:'white', borderTop:'1px solid #e5e7eb', zIndex:100, paddingBottom:'env(safe-area-inset-bottom)', alignItems:'stretch' }}>
        {BOTTOM_NAV.map(item => {
          const active = isActive(item.href)
          return (
            <a key={item.href} href={item.href}
              style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'8px 4px 6px', textDecoration:'none', color: active ? '#EF4576' : '#9ca3af', position:'relative', gap:3, borderTop: active ? '2px solid #EF4576' : '2px solid transparent' }}>
              <span style={{ fontSize:20, lineHeight:1 }}>{item.icon}</span>
              <span style={{ fontSize:10, fontWeight: active ? 700 : 400, lineHeight:1 }}>{item.label}</span>
              {item.badge > 0 && (
                <span style={{ position:'absolute', top:6, right:'20%', background:'#EF4576', color:'white', borderRadius:20, padding:'1px 5px', fontSize:9, fontWeight:700 }}>{item.badge}</span>
              )}
            </a>
          )
        })}
        <button onClick={() => setDrawerOpen(true)}
          style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'8px 4px 6px', border:'none', borderTop:'2px solid transparent', background:'white', color:'#9ca3af', cursor:'pointer', gap:3 }}>
          <span style={{ fontSize:20, lineHeight:1 }}>☰</span>
          <span style={{ fontSize:10, lineHeight:1 }}>More</span>
        </button>
      </div>
    </>
  )
}
