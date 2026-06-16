'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import PortalShell from '../../components/PortalShell'
import { createClient } from '../../lib/supabase'

const toISO = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
const DAYS = ['MON','TUE','WED','THU','FRI','SAT','SUN']
const SHIFT_BADGE = {
  am:  { label:'AM',  bg:'#eef7e4', color:'#4a7a1e', border:'#7ab648', time:'6:30AM–3:30PM'  },
  mid: { label:'MID', bg:'#fef3e2', color:'#a06000',  border:'#d4a843', time:'11AM–8PM'       },
  pm:  { label:'PM',  bg:'#e8f0fb', color:'#2d5a8a',  border:'#4a90c4', time:'3PM–11PM'       },
}

function getWeekDates() {
  const today = new Date()
  const day = today.getDay()
  const mon = new Date(today)
  mon.setDate(today.getDate() - (day === 0 ? 6 : day - 1))
  mon.setHours(0,0,0,0)
  return DAYS.map((_, i) => {
    const d = new Date(mon)
    d.setDate(mon.getDate() + i)
    return d
  })
}

export default function StaffDashboard() {
  const [staffProfile, setStaffProfile] = useState(null)
  const [weekShifts, setWeekShifts]     = useState([])
  const [todayTasks, setTodayTasks]     = useState([])
  const [leaveRequests, setLeaveRequests] = useState([])
  const [loading, setLoading]           = useState(true)
  const weekDates = getWeekDates()
  const today = toISO(new Date())
  const weekStart = toISO(weekDates[0])
  const weekEnd   = toISO(weekDates[6])

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setLoading(false); return }
      const { data: staff } = await supabase.from('staff').select('*').eq('email', session.user.email).single()
      if (!staff) { setLoading(false); return }
      setStaffProfile(staff)
      const [{ data: shifts }, { data: tasks }, { data: leaves }] = await Promise.all([
        supabase.from('schedules').select('*').eq('staff_id', staff.id).gte('shift_date', weekStart).lte('shift_date', weekEnd),
        supabase.from('shift_task_assignments').select('*, role_tasks(task_name)').eq('staff_id', staff.id).eq('shift_date', today),
        supabase.from('leave_requests').select('*').eq('staff_id', staff.id).in('status',['pending','approved']).gte('date_to', today),
      ])
      setWeekShifts(shifts || [])
      setTodayTasks(tasks || [])
      setLeaveRequests(leaves || [])
    } catch(e) { console.error(e) }
    setLoading(false)
  }

  const completedTasks = todayTasks.filter(t => t.completed).length
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening'
  const totalWeekHours = weekShifts.reduce((a, s) => a + (s.shift_type === 'pm' ? 7 : 8), 0)

  // Check if a date has approved leave
  function hasLeave(dateStr) {
    return leaveRequests.some(l => dateStr >= l.date_from && dateStr <= l.date_to)
  }

  return (
    <PortalShell>
      {/* Header */}
      <div style={{ background:'white', borderBottom:'1px solid #d8cebb', padding:'0 24px', height:56, display:'flex', alignItems:'center', flexShrink:0 }}>
        <div>
          <div style={{ fontFamily:"'Montserrat',sans-serif", fontSize:17, fontWeight:700, color:'#1a1208' }}>
            Good {greeting}{staffProfile?.nickname ? `, ${staffProfile.nickname}` : ''}! ☀️
          </div>
          <div style={{ fontSize:11, color:'#7a6a50', marginTop:1 }}>
            {new Date().toLocaleDateString('en-PH',{weekday:'long',month:'long',day:'numeric',year:'numeric'})}
          </div>
        </div>
      </div>

      <div style={{ flex:1, overflowY:'auto', padding:'20px 24px' }}>
        {loading ? (
          <div style={{ textAlign:'center', padding:'60px', color:'#7a6a50' }}>Loading…</div>
        ) : (
          <>
            {/* ── WEEKLY CALENDAR ── */}
            <div style={{ marginBottom:20 }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
                <div style={{ fontSize:10, fontWeight:700, letterSpacing:1.5, textTransform:'uppercase', color:'#7a6a50' }}>
                  This Week · {weekDates[0].toLocaleDateString('en-PH',{month:'short',day:'numeric'})} – {weekDates[6].toLocaleDateString('en-PH',{month:'short',day:'numeric'})}
                </div>
                {totalWeekHours > 0 && (
                  <div style={{ fontSize:11, fontWeight:700, color:'#4a7a1e', background:'#eef7e4', padding:'3px 10px', borderRadius:20 }}>
                    {totalWeekHours} paid hrs this week
                  </div>
                )}
              </div>

              <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:6 }}>
                {weekDates.map((d, i) => {
                  const dateStr = toISO(d)
                  const dayShifts = weekShifts.filter(s => s.shift_date === dateStr)
                  const isToday = dateStr === today
                  const onLeave = hasLeave(dateStr)
                  const isPast  = d < new Date() && !isToday

                  return (
                    <div key={i} style={{
                      background: isToday ? '#EF4576' : 'white',
                      border: `1.5px solid ${isToday ? '#EF4576' : dayShifts.length > 0 ? '#7ab648' : '#d8cebb'}`,
                      borderRadius: 12,
                      padding: '10px 8px',
                      textAlign: 'center',
                      opacity: isPast && dayShifts.length === 0 ? 0.5 : 1,
                      transition: 'all .15s',
                    }}>
                      {/* Day name */}
                      <div style={{ fontSize:9, fontWeight:700, letterSpacing:1.5, textTransform:'uppercase', color: isToday ? 'rgba(255,255,255,.8)' : '#7a6a50', marginBottom:3 }}>
                        {DAYS[i]}
                      </div>
                      {/* Date number */}
                      <div style={{ fontFamily:"'Montserrat',sans-serif", fontSize:18, fontWeight:700, color: isToday ? 'white' : '#1a1208', lineHeight:1, marginBottom:6 }}>
                        {d.getDate()}
                      </div>

                      {/* Shift badges */}
                      {onLeave && !dayShifts.length ? (
                        <div style={{ fontSize:9, fontWeight:700, color:'#a06000', background:'#fef3e2', borderRadius:6, padding:'3px 4px' }}>On Leave</div>
                      ) : dayShifts.length === 0 ? (
                        <div style={{ fontSize:9, color: isToday ? 'rgba(255,255,255,.5)' : '#d8cebb' }}>—</div>
                      } : dayShifts.map(s => {
                        const badge = SHIFT_BADGE[s.shift_type] || SHIFT_BADGE['am']
                        return (
                          <div key={s.id} style={{ background: isToday ? 'rgba(255,255,255,.2)' : badge.bg, border: `1px solid ${isToday ? 'rgba(255,255,255,.3)' : badge.border}`, borderRadius:6, padding:'3px 4px', marginBottom:3 }}>
                            <div style={{ fontSize:10, fontWeight:700, color: isToday ? 'white' : badge.color }}>{badge.label}</div>
                            <div style={{ fontSize:8, color: isToday ? 'rgba(255,255,255,.7)' : badge.color, opacity:.8, lineHeight:1.2, marginTop:1 }}>{badge.time}</div>
                          </div>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* ── TODAY'S TASKS ── */}
            {todayTasks.length > 0 && (
              <div style={{ marginBottom:16 }}>
                <div style={{ fontSize:10, fontWeight:700, letterSpacing:1.5, textTransform:'uppercase', color:'#7a6a50', marginBottom:10 }}>Today's Tasks</div>
                <div style={{ background:'white', border:'1px solid #d8cebb', borderRadius:13, padding:'16px 18px' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8 }}>
                    <span style={{ fontSize:13, fontWeight:600 }}>{completedTasks} of {todayTasks.length} completed</span>
                    <span style={{ fontSize:12, color:'#4a7a1e', fontWeight:700 }}>{Math.round((completedTasks/todayTasks.length)*100)}%</span>
                  </div>
                  <div style={{ height:7, background:'#e8e0d0', borderRadius:4, overflow:'hidden', marginBottom:12 }}>
                    <div style={{ height:'100%', width:`${Math.round((completedTasks/todayTasks.length)*100)}%`, background: completedTasks===todayTasks.length?'#7ab648':'#a8d672', borderRadius:4, transition:'width .4s' }}/>
                  </div>
                  {todayTasks.slice(0,4).map(t => (
                    <div key={t.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'6px 0', borderBottom:'1px solid #f0ede8', fontSize:12 }}>
                      <div style={{ width:18, height:18, borderRadius:'50%', background:t.completed?'#7ab648':'transparent', border:`2px solid ${t.completed?'#7ab648':'#d8cebb'}`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                        {t.completed && <span style={{ color:'white', fontSize:10 }}>✓</span>}
                      </div>
                      <span style={{ textDecoration:t.completed?'line-through':'none', color:t.completed?'#7a6a50':'#1a1208' }}>{t.role_tasks?.task_name}</span>
                    </div>
                  ))}
                  {todayTasks.length > 4 && <a href="/portal/tasks" style={{ fontSize:11, color:'#4a7a1e', textDecoration:'none', fontWeight:600, display:'block', marginTop:8 }}>View all {todayTasks.length} tasks →</a>}
                  {todayTasks.length <= 4 && <a href="/portal/tasks" style={{ fontSize:11, color:'#4a7a1e', textDecoration:'none', fontWeight:600, display:'block', marginTop:8 }}>Open task checklist →</a>}
                </div>
              </div>
            )}

            {/* ── QUICK LINKS ── */}
            <div style={{ fontSize:10, fontWeight:700, letterSpacing:1.5, textTransform:'uppercase', color:'#7a6a50', marginBottom:10 }}>Quick Access</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
              {[
                { href:'/portal/schedule',      icon:'📅', label:'Full Schedule',  desc:'See all your shifts',       color:'#7ab648' },
                { href:'/portal/tasks',         icon:'✅', label:'My Tasks',       desc:"Check off today's tasks",   color:'#4a90c4' },
                { href:'/portal/payslip',       icon:'💸', label:'My Payslip',     desc:'View your latest payslip',  color:'#d4a843' },
                { href:'/portal/leave',         icon:'🗓️', label:'Request Leave',  desc:'Submit unavailability',     color:'#8e44ad' },
              ].map(item => (
                <a key={item.href} href={item.href} style={{ textDecoration:'none' }}>
                  <div style={{ background:'white', border:'1px solid #d8cebb', borderRadius:13, padding:'14px 16px', borderTop:`3px solid ${item.color}`, transition:'all .2s' }}
                    onMouseEnter={e=>{ e.currentTarget.style.transform='translateY(-2px)'; e.currentTarget.style.boxShadow='0 6px 18px rgba(26,18,8,.08)' }}
                    onMouseLeave={e=>{ e.currentTarget.style.transform=''; e.currentTarget.style.boxShadow='' }}>
                    <div style={{ fontSize:22, marginBottom:7 }}>{item.icon}</div>
                    <div style={{ fontFamily:"'Montserrat',sans-serif", fontSize:13, fontWeight:700, marginBottom:3 }}>{item.label}</div>
                    <div style={{ fontSize:11, color:'#7a6a50' }}>{item.desc}</div>
                  </div>
                </a>
              ))}
            </div>
          </>
        )}
      </div>
    </PortalShell>
  )
}
