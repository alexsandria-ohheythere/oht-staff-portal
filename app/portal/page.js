'use client'
import { useState, useEffect } from 'react'
import PortalShell from '../../components/PortalShell'
import { createClient } from '../../lib/supabase'

const toISO = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
const SHIFT_BADGE = {
  am:  { label:'AM',  bg:'#eef7e4', color:'#4a7a1e', time:'6:30AM–3:30PM'  },
  mid: { label:'MID', bg:'#fef3e2', color:'#a06000',  time:'11:00AM–8:00PM' },
  pm:  { label:'PM',  bg:'#e8f0fb', color:'#2d5a8a',  time:'3:00PM–11:00PM' },
}

export default function StaffDashboard() {
  const supabase = createClient()
  const today = toISO(new Date())
  const [staffProfile, setStaffProfile] = useState(null)
  const [todayShifts, setTodayShifts]   = useState([])
  const [myTasks, setMyTasks]           = useState([])
  const [pendingLeave, setPendingLeave] = useState([])
  const [loading, setLoading]           = useState(true)

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    const { data: staff } = await supabase.from('staff').select('*').eq('email', session.user.email).single()
    if (!staff) { setLoading(false); return }
    setStaffProfile(staff)
    const [{ data: shifts }, { data: tasks }, { data: leaves }] = await Promise.all([
      supabase.from('schedules').select('*').eq('staff_id', staff.id).eq('shift_date', today),
      supabase.from('shift_task_assignments').select('*, role_tasks(task_name)').eq('staff_id', staff.id).eq('shift_date', today),
      supabase.from('leave_requests').select('*').eq('staff_id', staff.id).order('created_at', { ascending:false }).limit(3),
    ])
    setTodayShifts(shifts||[])
    setMyTasks(tasks||[])
    setPendingLeave(leaves||[])
    setLoading(false)
  }

  const completedTasks = myTasks.filter(t=>t.completed).length
  const todayDate = new Date().toLocaleDateString('en-PH',{weekday:'long',month:'long',day:'numeric',year:'numeric'})

  return (
    <PortalShell>
      {/* Header */}
      <div style={{ background:'var(--white)', borderBottom:'1px solid var(--border)', padding:'0 24px', height:56, display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
        <div>
          <div style={{ fontFamily:"'Montserrat',sans-serif", fontSize:17, fontWeight:700 }}>
            Good {new Date().getHours()<12?'morning':new Date().getHours()<18?'afternoon':'evening'}{staffProfile?.nickname?`, ${staffProfile.nickname}`:''}! ☀️
          </div>
          <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:1 }}>{todayDate}</div>
        </div>
      </div>

      <div style={{ flex:1, overflowY:'auto', padding:'22px 24px' }}>
        {/* Today's shift */}
        <div style={{ marginBottom:16 }}>
          <div style={{ fontFamily:"'Montserrat',sans-serif", fontSize:13, fontWeight:700, marginBottom:10, textTransform:'uppercase', letterSpacing:1, color:'var(--text-muted)' }}>Today's Shift</div>
          {todayShifts.length === 0 ? (
            <div style={{ background:'var(--white)', border:'1px solid var(--border)', borderRadius:13, padding:'24px', textAlign:'center' }}>
              <div style={{ fontSize:28, marginBottom:8 }}>😴</div>
              <div style={{ fontSize:13, fontWeight:600, color:'var(--text-muted)' }}>No shift scheduled today</div>
              <a href="/portal/schedule" style={{ fontSize:11, color:'var(--matcha-dark)', textDecoration:'none', fontWeight:600, display:'block', marginTop:8 }}>View your weekly schedule →</a>
            </div>
          ) : (
            todayShifts.map(s => {
              const badge = SHIFT_BADGE[s.shift_type]
              return (
                <div key={s.id} style={{ background:'var(--white)', border:'1px solid var(--border)', borderRadius:13, padding:'18px 20px', borderLeft:`4px solid ${badge.color}`, display:'flex', alignItems:'center', gap:16 }}>
                  <div style={{ background:badge.bg, borderRadius:10, padding:'10px 14px', textAlign:'center' }}>
                    <div style={{ fontFamily:"'Montserrat',sans-serif", fontSize:18, fontWeight:700, color:badge.color }}>{badge.label}</div>
                    <div style={{ fontSize:10, color:badge.color, opacity:.8 }}>Shift</div>
                  </div>
                  <div>
                    <div style={{ fontFamily:"'Montserrat',sans-serif", fontSize:15, fontWeight:700 }}>{badge.time}</div>
                    <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:3 }}>8 paid hours · 1 hr unpaid break</div>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Task progress */}
        {myTasks.length > 0 && (
          <div style={{ marginBottom:16 }}>
            <div style={{ fontFamily:"'Montserrat',sans-serif", fontSize:13, fontWeight:700, marginBottom:10, textTransform:'uppercase', letterSpacing:1, color:'var(--text-muted)' }}>Today's Tasks</div>
            <div style={{ background:'var(--white)', border:'1px solid var(--border)', borderRadius:13, padding:'18px 20px' }}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:10 }}>
                <span style={{ fontSize:13, fontWeight:600 }}>{completedTasks} of {myTasks.length} completed</span>
                <span style={{ fontSize:12, color:'var(--matcha-dark)', fontWeight:700 }}>{Math.round((completedTasks/myTasks.length)*100)}%</span>
              </div>
              <div style={{ height:8, background:'var(--cream-dark)', borderRadius:4, overflow:'hidden', marginBottom:14 }}>
                <div style={{ height:'100%', width:`${Math.round((completedTasks/myTasks.length)*100)}%`, background:completedTasks===myTasks.length?'var(--matcha)':'var(--matcha-light)', borderRadius:4, transition:'width .4s' }}/>
              </div>
              {myTasks.slice(0,3).map(t=>(
                <div key={t.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'6px 0', borderBottom:'1px solid var(--cream-dark)', fontSize:12 }}>
                  <div style={{ width:18, height:18, borderRadius:'50%', background:t.completed?'var(--matcha)':'transparent', border:`2px solid ${t.completed?'var(--matcha)':'var(--border)'}`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                    {t.completed && <span style={{ color:'white', fontSize:10 }}>✓</span>}
                  </div>
                  <span style={{ textDecoration:t.completed?'line-through':'none', color:t.completed?'var(--text-muted)':'var(--espresso)' }}>{t.role_tasks?.task_name}</span>
                </div>
              ))}
              <a href="/portal/tasks" style={{ fontSize:11, color:'var(--matcha-dark)', textDecoration:'none', fontWeight:600, display:'block', marginTop:10 }}>View all tasks →</a>
            </div>
          </div>
        )}

        {/* Quick links */}
        <div style={{ fontFamily:"'Montserrat',sans-serif", fontSize:13, fontWeight:700, marginBottom:10, textTransform:'uppercase', letterSpacing:1, color:'var(--text-muted)' }}>Quick Access</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
          {[
            { href:'/portal/schedule', icon:'📅', label:'My Schedule',  desc:'View your weekly shifts',    color:'var(--matcha)'  },
            { href:'/portal/tasks',    icon:'✅', label:'My Tasks',     desc:'Check off today\'s tasks',   color:'var(--sky)'     },
            { href:'/portal/payslip',  icon:'💸', label:'My Payslip',  desc:'View your latest payslip',   color:'var(--gold)'    },
            { href:'/portal/leave',    icon:'🗓️', label:'Request Leave',desc:'Submit unavailability',     color:'#8e44ad'        },
          ].map(item=>(
            <a key={item.href} href={item.href} style={{ textDecoration:'none' }}>
              <div style={{ background:'var(--white)', border:'1px solid var(--border)', borderRadius:13, padding:'16px', cursor:'pointer', transition:'all .2s', borderTop:`3px solid ${item.color}` }}
                onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-2px)';e.currentTarget.style.boxShadow='0 6px 18px rgba(26,18,8,.08)'}}
                onMouseLeave={e=>{e.currentTarget.style.transform='';e.currentTarget.style.boxShadow=''}}>
                <div style={{ fontSize:24, marginBottom:8 }}>{item.icon}</div>
                <div style={{ fontFamily:"'Montserrat',sans-serif", fontSize:13, fontWeight:700, marginBottom:4 }}>{item.label}</div>
                <div style={{ fontSize:11, color:'var(--text-muted)' }}>{item.desc}</div>
              </div>
            </a>
          ))}
        </div>
      </div>
    </PortalShell>
  )
}
