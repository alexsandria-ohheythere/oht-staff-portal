'use client'
export const dynamic = 'force-dynamic'
// ─────────────────────────────────────────────
// OHT Staff Portal — My Schedule
// Place at: app/portal/schedule/page.js
// ─────────────────────────────────────────────
import { useState, useEffect } from 'react'
import PortalShell from '../../../components/PortalShell'
import { createClient } from '../../../lib/supabase'

const SHIFTS = [
  { id:'am',  label:'AM',  time:'6:30AM–3:30PM', color:'#4a7a1e', bg:'#eef7e4', border:'#7ab648' },
  { id:'ops', label:'OPS', time:'8:00AM–5:00PM', color:'#7a3a8a', bg:'#f5eeff', border:'#b06af5' },
  { id:'mid', label:'MID', time:'11AM–8PM',       color:'#a06000', bg:'#fef3e2', border:'#d4a843' },
  { id:'pm',  label:'PM',  time:'3PM–11PM',       color:'#2d5a8a', bg:'#e8f0fb', border:'#4a90c4' },
]
const DAYS = ['MON','TUE','WED','THU','FRI','SAT','SUN']

function getWeekDates(offset = 0) {
  const today = new Date()
  const day = today.getDay()
  const mon = new Date(today)
  mon.setDate(today.getDate() - (day === 0 ? 6 : day - 1) + offset * 7)
  mon.setHours(0, 0, 0, 0)
  return DAYS.map((_, i) => { const d = new Date(mon); d.setDate(mon.getDate() + i); return d })
}
const toISO = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
const fmtDate = d => d.toLocaleDateString('en-PH', { month:'short', day:'numeric' })

export default function MySchedulePage() {
  const [weekOffset, setWeekOffset] = useState(0)
  const [myShifts, setMyShifts]     = useState([])
  const [loading, setLoading]       = useState(true)
  const [staffName, setStaffName]   = useState('')

  const weekDates = getWeekDates(weekOffset)
  const weekStart = toISO(weekDates[0])
  const today     = toISO(new Date())

  useEffect(() => {
    const sb = createClient()
    sb.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) return
      try {
        const { data: staff } = await sb.from('staff')
          .select('id, first_name, nickname')
          .eq('email', session.user.email)
          .single()
        if (!staff) return
        setStaffName(staff.nickname || staff.first_name || '')
        fetchShifts(staff.id)
      } catch(e) { console.error(e) }
    })
  }, [])

  useEffect(() => {
    const sb = createClient()
    sb.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) return
      const { data: staff } = await sb.from('staff').select('id').eq('email', session.user.email).single()
      if (staff) fetchShifts(staff.id)
    })
  }, [weekOffset])

  async function fetchShifts(staffId) {
    setLoading(true)
    const sb = createClient()
    const { data } = await sb.from('schedules')
      .select('*')
      .eq('staff_id', staffId)
      .eq('week_start', weekStart)
      .order('shift_date')
    setMyShifts(data || [])
    setLoading(false)
  }

  const totalHours = myShifts.reduce((sum, s) => {
    const sh = SHIFTS.find(x => x.id === s.shift_type)
    return sum + (sh ? 8 : 0)
  }, 0)

  return (
    <PortalShell>
      <div style={{ flex:1, overflowY:'auto', background:'#f5f0e8' }}>

        {/* Header */}
        <div style={{ background:'white', borderBottom:'1px solid #e5e7eb', padding:'16px 20px', display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:12 }}>
          <div>
            <div style={{ fontFamily:"'Montserrat',sans-serif", fontSize:17, fontWeight:800, color:'#1f2937' }}>My Schedule</div>
            <div style={{ fontSize:12, color:'#6b7280', marginTop:2 }}>
              {fmtDate(weekDates[0])} – {fmtDate(weekDates[6])}
            </div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:4, background:'white', border:'1px solid #e5e7eb', borderRadius:8, padding:'3px 6px' }}>
            <button onClick={() => setWeekOffset(w => w - 1)}
              style={{ width:28, height:28, border:'none', background:'transparent', cursor:'pointer', fontSize:16, color:'#6b7280', borderRadius:6 }}>‹</button>
            <button onClick={() => setWeekOffset(0)}
              style={{ fontSize:10, fontWeight:700, padding:'3px 8px', border:'1px solid #e5e7eb', borderRadius:6, background:'transparent', cursor:'pointer', color:'#6b7280' }}>Today</button>
            <button onClick={() => setWeekOffset(w => w + 1)}
              style={{ width:28, height:28, border:'none', background:'transparent', cursor:'pointer', fontSize:16, color:'#6b7280', borderRadius:6 }}>›</button>
          </div>
        </div>

        <div style={{ padding:'20px' }}>

          {/* Summary cards */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:20 }}>
            <div style={{ background:'#EF4576', borderRadius:14, padding:'16px 18px', color:'white' }}>
              <p style={{ fontSize:11, fontWeight:700, opacity:0.75, margin:0, letterSpacing:1, textTransform:'uppercase' }}>Shifts this week</p>
              <p style={{ fontSize:36, fontWeight:800, margin:'4px 0 0', fontFamily:"'Montserrat',sans-serif" }}>{myShifts.length}</p>
            </div>
            <div style={{ background:'white', borderRadius:14, padding:'16px 18px', border:'1px solid #e5e7eb' }}>
              <p style={{ fontSize:11, fontWeight:700, color:'#6b7280', margin:0, letterSpacing:1, textTransform:'uppercase' }}>Hours scheduled</p>
              <p style={{ fontSize:36, fontWeight:800, color:'#111', margin:'4px 0 0', fontFamily:"'Montserrat',sans-serif" }}>{totalHours}h</p>
            </div>
          </div>

          {/* Week grid */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:8, marginBottom:20 }}>
            {weekDates.map((date, di) => {
              const iso = toISO(date)
              const isToday = iso === today
              const dayShifts = myShifts.filter(s => s.shift_date === iso)

              return (
                <div key={di} style={{ background: isToday ? '#EF4576' : 'white', borderRadius:12, border: isToday ? 'none' : '1px solid #e5e7eb', overflow:'hidden', minHeight:90 }}>
                  <div style={{ padding:'8px 10px', borderBottom: isToday ? '1px solid rgba(255,255,255,.2)' : '1px solid #f3f4f6' }}>
                    <div style={{ fontSize:9, fontWeight:700, letterSpacing:1.5, textTransform:'uppercase', color: isToday ? 'rgba(255,255,255,.75)' : '#9ca3af' }}>{DAYS[di]}</div>
                    <div style={{ fontSize:18, fontWeight:800, color: isToday ? 'white' : '#111', fontFamily:"'Montserrat',sans-serif", lineHeight:1.1 }}>{date.getDate()}</div>
                  </div>
                  <div style={{ padding:6 }}>
                    {dayShifts.length === 0 ? (
                      <p style={{ fontSize:9, color: isToday ? 'rgba(255,255,255,.4)' : '#d1d5db', textAlign:'center', padding:'8px 0', margin:0 }}>Off</p>
                    ) : (
                      dayShifts.map(s => {
                        const sh = SHIFTS.find(x => x.id === s.shift_type)
                        if (!sh) return null
                        return (
                          <div key={s.id} style={{ background: isToday ? 'rgba(255,255,255,.2)' : sh.bg, border: isToday ? '1px solid rgba(255,255,255,.3)' : `1px solid ${sh.border}`, borderRadius:6, padding:'4px 6px', marginBottom:3 }}>
                            <p style={{ fontSize:10, fontWeight:700, color: isToday ? 'white' : sh.color, margin:0 }}>{sh.label}</p>
                            <p style={{ fontSize:8, color: isToday ? 'rgba(255,255,255,.7)' : sh.color, margin:'1px 0 0', opacity:0.8 }}>{sh.time}</p>
                          </div>
                        )
                      })
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Shift list */}
          {loading ? (
            <div style={{ textAlign:'center', padding:40, color:'#9ca3af', fontSize:13 }}>Loading…</div>
          ) : myShifts.length === 0 ? (
            <div style={{ textAlign:'center', padding:48, background:'white', borderRadius:16, border:'1px dashed #e5e7eb' }}>
              <div style={{ fontSize:32, marginBottom:8 }}>😴</div>
              <p style={{ fontSize:14, fontWeight:600, color:'#374151', margin:0 }}>No shifts this week</p>
              <p style={{ fontSize:12, color:'#9ca3af', marginTop:4 }}>Check back after the schedule is published.</p>
            </div>
          ) : (
            <div style={{ background:'white', borderRadius:16, border:'1px solid #e5e7eb', overflow:'hidden' }}>
              <div style={{ padding:'12px 18px', borderBottom:'1px solid #f3f4f6', background:'#f9fafb' }}>
                <p style={{ fontSize:11, fontWeight:700, color:'#6b7280', margin:0, letterSpacing:1, textTransform:'uppercase' }}>This week's shifts</p>
              </div>
              {myShifts.map((s, i) => {
                const sh = SHIFTS.find(x => x.id === s.shift_type)
                if (!sh) return null
                const date = new Date(s.shift_date + 'T00:00:00')
                const isToday = s.shift_date === today
                return (
                  <div key={s.id} style={{ display:'flex', alignItems:'center', gap:14, padding:'14px 18px', borderBottom: i < myShifts.length - 1 ? '1px solid #f3f4f6' : 'none', background: isToday ? '#fff8f9' : 'white' }}>
                    <div style={{ width:44, height:44, borderRadius:10, background:sh.bg, border:`2px solid ${sh.border}`, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                      <span style={{ fontSize:11, fontWeight:800, color:sh.color }}>{sh.label}</span>
                    </div>
                    <div style={{ flex:1 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <p style={{ fontSize:14, fontWeight:600, color:'#111', margin:0 }}>
                          {date.toLocaleDateString('en-PH', { weekday:'long', month:'long', day:'numeric' })}
                        </p>
                        {isToday && <span style={{ fontSize:10, background:'#EF4576', color:'white', padding:'1px 8px', borderRadius:10, fontWeight:700 }}>Today</span>}
                      </div>
                      <p style={{ fontSize:12, color:'#6b7280', margin:'2px 0 0' }}>{sh.time}</p>
                    </div>
                    {!s.published && (
                      <span style={{ fontSize:10, color:'#92400e', background:'#fef3c7', padding:'2px 8px', borderRadius:8, fontWeight:600 }}>Draft</span>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </PortalShell>
  )
}
