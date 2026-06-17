'use client'
export const dynamic = 'force-dynamic'
import { useState, useEffect } from 'react'
import PortalShell from '../../../components/PortalShell'
import { createClient } from '../../../lib/supabase'

const toISO = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
const fmtTime = ts => ts ? new Date(ts).toLocaleTimeString('en-PH',{hour:'2-digit',minute:'2-digit'}) : ''

const SHIFT_STYLES = {
  am:  { label:'AM Shift',  time:'6:30AM – 3:30PM',  color:'#4a7a1e', bg:'#eef7e4', border:'#7ab648', emoji:'🌅' },
  ops: { label:'OPS Shift', time:'8:00AM – 5:00PM',  color:'#7a3a8a', bg:'#f5eeff', border:'#b06af5', emoji:'🏢' },
  mid: { label:'Mid Shift', time:'11:00AM – 8:00PM', color:'#a06000', bg:'#fef3e2', border:'#d4a843', emoji:'☀️'  },
  pm:  { label:'PM Shift',  time:'3:00PM – 11:00PM', color:'#2d5a8a', bg:'#e8f0fb', border:'#4a90c4', emoji:'🌙' },
}

function ScoreRing({ pct, color, size=64 }) {
  const r = (size - 8) / 2
  const circ = 2 * Math.PI * r
  const offset = circ - (pct / 100) * circ
  return (
    <svg width={size} height={size} style={{ transform:'rotate(-90deg)', flexShrink:0 }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#f0ede8" strokeWidth={6}/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={pct===100?'#7ab648':color} strokeWidth={6}
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
        style={{ transition:'stroke-dashoffset .5s ease' }}/>
      <text x={size/2} y={size/2} textAnchor="middle" dominantBaseline="middle"
        style={{ fontSize: size > 60 ? 14 : 11, fontWeight:700, fill: pct===100?'#4a7a1e':color, fontFamily:"'Montserrat',sans-serif", transform:`rotate(90deg)`, transformOrigin:`${size/2}px ${size/2}px` }}>
        {pct}%
      </text>
    </svg>
  )
}

export default function MyTasks() {
  const [staff, setStaff]     = useState(null)
  const [tasks, setTasks]     = useState([])
  const [shifts, setShifts]   = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(null)
  const [error, setError]     = useState(null)
  const today = toISO(new Date())
  const todayLabel = new Date().toLocaleDateString('en-PH',{weekday:'long',month:'long',day:'numeric',year:'numeric'})

  useEffect(() => {
    init()
  }, [])

  useEffect(() => {
    if (!staff) return
    const supabase = createClient()
    const channel = supabase
      .channel(`staff-checkin-realtime-${staff.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shift_task_assignments', filter: `staff_id=eq.${staff.id}` }, () => {
        const s2 = createClient()
        loadData(s2, staff.id)
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [staff?.id])

  async function init() {
    try {
      const supabase = createClient()

      // Get session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      if (sessionError || !session) { setError('No session'); setLoading(false); return }

      const authEmail = session.user.email

      // Find staff by email
      const { data: s, error: staffError } = await supabase
        .from('staff')
        .select('*')
        .eq('email', authEmail)
        .single()

      if (staffError || !s) {
        // Try by user id as fallback
        const { data: s2, error: s2Error } = await supabase
          .from('staff')
          .select('*')
          .eq('email', authEmail)
        
        if (!s2 || s2.length === 0) {
          setError(`No staff record found for ${authEmail}`)
          setLoading(false)
          return
        }
        setStaff(s2[0])
        await loadData(supabase, s2[0].id)
        return
      }

      setStaff(s)
      await loadData(supabase, s.id)

    } catch(e) {
      setError(e.message)
      setLoading(false)
    }
  }

  async function loadData(supabase, staffId) {
    try {
      const [{ data: t, error: tErr }, { data: sh, error: shErr }] = await Promise.all([
        supabase
          .from('shift_task_assignments')
          .select('*, role_tasks!shift_task_assignments_task_id_fkey(task_name, category)')
          .eq('staff_id', staffId)
          .eq('shift_date', today)
          .order('created_at'),
        supabase
          .from('schedules')
          .select('*')
          .eq('staff_id', staffId)
          .eq('shift_date', today),
      ])

      if (tErr) setError(`Tasks error: ${tErr.message}`)
      if (shErr) setError(`Schedule error: ${shErr.message}`)

      setTasks(t || [])
      setShifts(sh || [])
    } catch(e) {
      setError(e.message)
    }
    setLoading(false)
  }

  async function toggleTask(id, completed) {
    setSaving(id)
    const supabase = createClient()
    const completed_at = completed ? new Date().toISOString() : null
    const { data } = await supabase.from('shift_task_assignments').update({ completed, completed_at }).eq('id', id).select().single()
    if (data) setTasks(prev => prev.map(t => t.id === id ? data : t))
    setSaving(null)
  }

  async function completeAllShift(shiftId) {
    const pending = tasks.filter(t => t.shift_type === shiftId && !t.completed)
    if (!pending.length) return
    const supabase = createClient()
    const now = new Date().toISOString()
    await Promise.all(pending.map(t => supabase.from('shift_task_assignments').update({ completed:true, completed_at:now }).eq('id', t.id)))
    setTasks(prev => prev.map(t => t.shift_type === shiftId && !t.completed ? { ...t, completed:true, completed_at:now } : t))
  }

  const byShift = {}
  tasks.forEach(t => {
    const sh = t.shift_type || 'am'
    if (!byShift[sh]) byShift[sh] = []
    byShift[sh].push(t)
  })

  const shiftScores = Object.entries(byShift).map(([shiftId, shiftTasks]) => {
    const total = shiftTasks.length
    const done  = shiftTasks.filter(t => t.completed).length
    const pct   = total > 0 ? Math.round((done / total) * 100) : 0
    return { shiftId, total, done, pct, tasks: shiftTasks }
  })

  const totalTasks = tasks.length
  const totalDone  = tasks.filter(t => t.completed).length
  const overallPct = totalTasks > 0 ? Math.round((totalDone / totalTasks) * 100) : 0
  const allDone    = totalTasks > 0 && totalDone === totalTasks

  return (
    <PortalShell>
      <div style={{ background:'white', borderBottom:'1px solid #d8cebb', padding:'0 24px', height:56, display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
        <div>
          <div style={{ fontFamily:"'Montserrat',sans-serif", fontSize:17, fontWeight:700 }}>Daily Check-In</div>
          <div style={{ fontSize:11, color:'#7a6a50', marginTop:1 }}>{todayLabel}</div>
        </div>
        {totalTasks > 0 && !allDone && (
          <button onClick={() => Object.keys(byShift).forEach(sid => completeAllShift(sid))}
            style={{ background:'#7ab648', color:'white', border:'none', borderRadius:9, padding:'8px 16px', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:"'DM Sans',sans-serif" }}>
            ✓ Complete All
          </button>
        )}
      </div>

      <div style={{ flex:1, overflowY:'auto', padding:'20px 24px' }}>

        {/* Debug error display */}
        {error && (
          <div style={{ background:'#fee2e2', border:'1px solid #fca5a5', borderRadius:10, padding:'12px 16px', marginBottom:16, fontSize:12, color:'#991b1b' }}>
            ⚠️ {error}
          </div>
        )}

        {loading ? (
          <div style={{ textAlign:'center', padding:'60px', color:'#7a6a50' }}>Loading…</div>

        ) : shifts.length === 0 ? (
          <div style={{ textAlign:'center', padding:'60px', background:'white', border:'1px solid #d8cebb', borderRadius:13 }}>
            <div style={{ fontSize:40, marginBottom:12 }}>😴</div>
            <div style={{ fontFamily:"'Montserrat',sans-serif", fontSize:15, fontWeight:700, marginBottom:6 }}>No shift today</div>
            <div style={{ fontSize:12, color:'#7a6a50' }}>Enjoy your rest! ☕</div>
            {staff && <div style={{ fontSize:11, color:'#9ca3af', marginTop:8 }}>Logged in as: {staff.email}</div>}
          </div>

        ) : totalTasks === 0 ? (
          <div style={{ textAlign:'center', padding:'60px', background:'white', border:'1px solid #d8cebb', borderRadius:13 }}>
            <div style={{ fontSize:40, marginBottom:12 }}>📋</div>
            <div style={{ fontFamily:"'Montserrat',sans-serif", fontSize:15, fontWeight:700, marginBottom:6 }}>No tasks assigned yet</div>
            <div style={{ fontSize:12, color:'#7a6a50' }}>Your manager will assign tasks for today's shift.</div>
          </div>

        ) : (
          <>
            <div style={{ background:'white', border:'1px solid #d8cebb', borderRadius:14, padding:'18px 20px', marginBottom:16 }}>
              <div style={{ fontSize:10, fontWeight:700, letterSpacing:1.5, textTransform:'uppercase', color:'#7a6a50', marginBottom:14 }}>
                Shift Task Score Tracker
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:20, flexWrap:'wrap' }}>
                <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:6, minWidth:80 }}>
                  <ScoreRing pct={overallPct} color='#EF4576' size={72}/>
                  <div style={{ fontSize:10, fontWeight:700, color:'#7a6a50', textAlign:'center' }}>Overall</div>
                  <div style={{ fontSize:9, color:'#7a6a50' }}>{totalDone}/{totalTasks} tasks</div>
                </div>
                <div style={{ width:1, height:70, background:'#f0ede8', flexShrink:0 }}/>
                <div style={{ display:'flex', gap:16, flex:1, flexWrap:'wrap' }}>
                  {shiftScores.map(({ shiftId, total, done, pct }) => {
                    const ss = SHIFT_STYLES[shiftId] || SHIFT_STYLES.am
                    return (
                      <div key={shiftId} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:6, minWidth:70 }}>
                        <ScoreRing pct={pct} color={ss.color} size={60}/>
                        <div style={{ textAlign:'center' }}>
                          <div style={{ fontSize:10, fontWeight:700, color:ss.color }}>{ss.emoji} {ss.label.split(' ')[0]}</div>
                          <div style={{ fontSize:9, color:'#7a6a50' }}>{done}/{total}</div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
              <div style={{ marginTop:16 }}>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, marginBottom:5 }}>
                  <span style={{ color:'#7a6a50' }}>Daily Progress</span>
                  <span style={{ fontWeight:700, color: allDone?'#4a7a1e':'#EF4576' }}>{overallPct}%</span>
                </div>
                <div style={{ height:8, background:'#f0ede8', borderRadius:6, overflow:'hidden' }}>
                  <div style={{ height:'100%', width:`${overallPct}%`, background: allDone?'#7ab648':'#EF4576', borderRadius:6, transition:'width .5s ease' }}/>
                </div>
              </div>
            </div>

            {shiftScores.map(({ shiftId, pct, tasks: shiftTasks }) => {
              const ss = SHIFT_STYLES[shiftId] || SHIFT_STYLES.am
              const shiftDone = shiftTasks.filter(t => t.completed).length
              const shiftComplete = shiftDone === shiftTasks.length
              return (
                <div key={shiftId} style={{ background:'white', border:`1px solid ${shiftComplete?'#7ab648':'#d8cebb'}`, borderRadius:13, overflow:'hidden', marginBottom:12 }}>
                  <div style={{ background: shiftComplete?'#eef7e4':ss.bg, padding:'12px 18px', borderBottom:`1px solid ${shiftComplete?'#7ab64844':ss.border+'44'}`, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                      <span style={{ fontSize:18 }}>{ss.emoji}</span>
                      <div>
                        <div style={{ fontSize:12, fontWeight:700, color: shiftComplete?'#4a7a1e':ss.color }}>{ss.label}</div>
                        <div style={{ fontSize:10, color: shiftComplete?'#4a7a1e':ss.color, opacity:.7 }}>{ss.time}</div>
                      </div>
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                      <div style={{ background: shiftComplete?'#7ab648':ss.color, color:'white', borderRadius:20, padding:'4px 12px', fontSize:12, fontWeight:700 }}>
                        {pct}%
                      </div>
                      {!shiftComplete && (
                        <button onClick={() => completeAllShift(shiftId)}
                          style={{ background:'transparent', border:`1px solid ${ss.border}`, color:ss.color, borderRadius:7, padding:'4px 10px', fontSize:10, fontWeight:700, cursor:'pointer', fontFamily:"'DM Sans',sans-serif" }}>
                          Complete All
                        </button>
                      )}
                      {shiftComplete && <span style={{ fontSize:16 }}>✅</span>}
                    </div>
                  </div>
                  {(() => {
                    const grouped = {}
                    shiftTasks.forEach(t => {
                      const cat = t.role_tasks?.category || 'General'
                      if (!grouped[cat]) grouped[cat] = []
                      grouped[cat].push(t)
                    })
                    return Object.entries(grouped).map(([cat, catTasks]) => (
                      <div key={cat}>
                        <div style={{ padding:'6px 18px', background:'#f7f4f0', borderBottom:'1px solid #f0ede8', display:'flex', alignItems:'center', gap:8 }}>
                          <div style={{ width:3, height:12, borderRadius:2, background:ss.border }}></div>
                          <span style={{ fontSize:9, fontWeight:700, letterSpacing:1.2, textTransform:'uppercase', color:ss.color }}>{cat}</span>
                          <span style={{ fontSize:9, color:'#7a6a50', marginLeft:2 }}>{catTasks.filter(t=>t.completed).length}/{catTasks.length}</span>
                        </div>
                        {catTasks.map((t, idx) => (
                          <div key={t.id}
                            onClick={() => saving !== t.id && toggleTask(t.id, !t.completed)}
                            style={{ display:'flex', alignItems:'center', gap:14, padding:'14px 18px', borderBottom: idx < catTasks.length-1 ? '1px solid #f0ede8' : 'none', background: t.completed?'#f8fdf5':'white', cursor:'pointer', transition:'background .15s', userSelect:'none' }}
                            onMouseEnter={e=>{ if(!t.completed) e.currentTarget.style.background='#fafafa' }}
                            onMouseLeave={e=>{ e.currentTarget.style.background = t.completed?'#f8fdf5':'white' }}>
                            <div style={{ width:26, height:26, borderRadius:'50%', border:`2.5px solid ${t.completed?'#7ab648':ss.border}`, background:t.completed?'#7ab648':'transparent', display:'flex', alignItems:'center', justifyContent:'center', transition:'all .2s', flexShrink:0, opacity:saving===t.id?.5:1 }}>
                              {t.completed && <span style={{ color:'white', fontSize:13, fontWeight:700 }}>✓</span>}
                            </div>
                            <div style={{ flex:1 }}>
                              <div style={{ fontSize:13, fontWeight:t.completed?400:600, color:t.completed?'#7a6a50':'#1a1208', textDecoration:t.completed?'line-through':'none', transition:'all .2s' }}>
                                {t.role_tasks?.task_name || 'Task'}
                              </div>
                              {t.completed && t.completed_at && (
                                <div style={{ fontSize:10, color:'#4a7a1e', marginTop:2, fontFamily:"'DM Mono',monospace", fontWeight:600 }}>
                                  ✓ Done at {fmtTime(t.completed_at)}
                                </div>
                              )}
                            </div>
                            {!t.completed && <div style={{ fontSize:10, color:'#d8cebb' }}>tap</div>}
                          </div>
                        ))}
                      </div>
                    ))
                  })()}
                </div>
              )
            })}

            {allDone && (
              <div style={{ background:'#eef7e4', border:'2px solid #7ab648', borderRadius:13, padding:'22px', textAlign:'center' }}>
                <div style={{ fontSize:40, marginBottom:8 }}>🎉</div>
                <div style={{ fontFamily:"'Montserrat',sans-serif", fontSize:16, fontWeight:700, color:'#4a7a1e', marginBottom:4 }}>100% Complete!</div>
                <div style={{ fontSize:12, color:'#7a6a50' }}>Amazing work today, {staff?.nickname || staff?.first_name}! ☕🌿</div>
              </div>
            )}
          </>
        )}
      </div>
    </PortalShell>
  )
}
