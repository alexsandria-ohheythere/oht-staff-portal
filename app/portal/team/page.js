'use client'
export const dynamic = 'force-dynamic'
// ─────────────────────────────────────────────
// OHT Staff Portal — Team Schedule
// Place at: app/portal/schedule/team/page.js
// ─────────────────────────────────────────────
import { useState, useEffect } from 'react'
import PortalShell from '../../../components/PortalShell'
import { createClient } from '../../../lib/supabase'

const SHIFTS = [
  { id:'am',  label:'AM',  time:'6:30AM–3:30PM',  color:'#4a7a1e', bg:'#eef7e4', border:'#7ab648' },
  { id:'ops', label:'OPS', time:'8:00AM–5:00PM',  color:'#7a3a8a', bg:'#f5eeff', border:'#b06af5' },
  { id:'mid', label:'MID', time:'11AM–8PM',        color:'#a06000', bg:'#fef3e2', border:'#d4a843' },
  { id:'pm',  label:'PM',  time:'3PM–11PM',        color:'#2d5a8a', bg:'#e8f0fb', border:'#4a90c4' },
]

const DAYS = ['MON','TUE','WED','THU','FRI','SAT','SUN']

const ROLE_COLORS = {
  'Cafe Supervisor':              '#b06af5',
  'Cafe Operations Support':      '#4a90c4',
  'Senior Barista':               '#7ab648',
  'Junior Barista - Milk Station':'#d4a843',
  'Junior Barista - Cashier':     '#e8845a',
  'Executive Chef':               '#c0392b',
  'Sous Chef':                    '#2d7a6a',
  'Kitchen Staff':                '#5c3d1e',
}
const getRoleColor = r => {
  if (!r) return '#7a6a50'
  if (r.startsWith('Junior Barista')) return '#e8845a'
  return ROLE_COLORS[r] || '#7a6a50'
}
const initials = (f, l) => ((f||'')[0]||'').toUpperCase() + ((l||'')[0]||'').toUpperCase()

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
const fmtFull = d => d.toLocaleDateString('en-PH', { weekday:'long', month:'long', day:'numeric' })

export default function TeamSchedulePage() {
  const [weekOffset, setWeekOffset] = useState(0)
  const [schedules, setSchedules]   = useState([])
  const [staff, setStaff]           = useState([])
  const [loading, setLoading]       = useState(true)
  const [viewMode, setViewMode]     = useState('week') // 'week' | 'day'
  const [selectedDay, setSelectedDay] = useState(0)
  const [myStaffId, setMyStaffId]   = useState(null)
  const [isPublished, setIsPublished] = useState(false)

  const weekDates = getWeekDates(weekOffset)
  const weekStart = toISO(weekDates[0])

  useEffect(() => {
    const sb = createClient()
    sb.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) return
      const { data } = await sb.from('staff').select('id').eq('email', session.user.email).single()
      if (data) setMyStaffId(data.id)
    })
    fetchStaff()
  }, [])

  useEffect(() => { if (staff.length) fetchSchedules() }, [weekOffset, staff])

  async function fetchStaff() {
    const sb = createClient()
    const { data } = await sb.from('staff').select('id, first_name, last_name, nickname, role').order('last_name')
    setStaff(data || [])
  }

  async function fetchSchedules() {
    setLoading(true)
    const sb = createClient()
    const { data } = await sb.from('schedules').select('*').eq('week_start', weekStart)
    const rows = data || []
    setSchedules(rows)
    setIsPublished(rows.length > 0 && rows.every(s => s.published))
    setLoading(false)
  }

  // Group schedules: date → shift → [staffIds]
  function getShiftStaff(dayIdx, shiftId) {
    const date = toISO(weekDates[dayIdx])
    const ids = schedules
      .filter(s => s.shift_date === date && s.shift_type === shiftId)
      .map(s => s.staff_id)
    return ids.map(id => staff.find(s => s.id === id)).filter(Boolean)
  }

  function isMyShift(dayIdx, shiftId) {
    if (!myStaffId) return false
    const date = toISO(weekDates[dayIdx])
    return schedules.some(s => s.shift_date === date && s.shift_type === shiftId && s.staff_id === myStaffId)
  }

  function getMyShiftsThisWeek() {
    if (!myStaffId) return []
    return schedules
      .filter(s => s.staff_id === myStaffId)
      .map(s => ({ ...s, shift: SHIFTS.find(sh => sh.id === s.shift_type) }))
      .sort((a, b) => a.shift_date.localeCompare(b.shift_date))
  }

  const myShifts = getMyShiftsThisWeek()
  const today = toISO(new Date())

  return (
    <PortalShell>
      <div style={{ flex:1, overflowY:'auto', background:'#f5f0e8' }}>

        {/* Header */}
        <div style={{ background:'white', borderBottom:'1px solid #e5e7eb', padding:'16px 20px', display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:12 }}>
          <div>
            <div style={{ fontFamily:"'Montserrat',sans-serif", fontSize:17, fontWeight:800, color:'#1f2937' }}>Team Schedule</div>
            <div style={{ fontSize:12, color:'#6b7280', marginTop:2 }}>
              {fmtDate(weekDates[0])} – {fmtDate(weekDates[6])}
              {isPublished
                ? <span style={{ marginLeft:8, background:'#dcfce7', color:'#166534', fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:20 }}>Published</span>
                : <span style={{ marginLeft:8, background:'#fef3c7', color:'#92400e', fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:20 }}>Draft</span>
              }
            </div>
          </div>

          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            {/* View toggle */}
            <div style={{ display:'flex', background:'#f3f4f6', borderRadius:8, padding:3, gap:2 }}>
              {['week','day'].map(v => (
                <button key={v} onClick={() => setViewMode(v)}
                  style={{ padding:'5px 12px', fontSize:11, fontWeight:600, borderRadius:6, border:'none', cursor:'pointer', background: viewMode===v ? 'white' : 'transparent', color: viewMode===v ? '#111' : '#6b7280', boxShadow: viewMode===v ? '0 1px 3px rgba(0,0,0,.1)' : 'none' }}>
                  {v.charAt(0).toUpperCase() + v.slice(1)}
                </button>
              ))}
            </div>

            {/* Week nav */}
            <div style={{ display:'flex', alignItems:'center', gap:4, background:'white', border:'1px solid #e5e7eb', borderRadius:8, padding:'3px 6px' }}>
              <button onClick={() => setWeekOffset(w => w - 1)}
                style={{ width:28, height:28, border:'none', background:'transparent', cursor:'pointer', fontSize:16, color:'#6b7280', display:'flex', alignItems:'center', justifyContent:'center', borderRadius:6 }}>‹</button>
              <button onClick={() => setWeekOffset(0)}
                style={{ fontSize:10, fontWeight:700, padding:'3px 8px', border:'1px solid #e5e7eb', borderRadius:6, background:'transparent', cursor:'pointer', color:'#6b7280' }}>Today</button>
              <button onClick={() => setWeekOffset(w => w + 1)}
                style={{ width:28, height:28, border:'none', background:'transparent', cursor:'pointer', fontSize:16, color:'#6b7280', display:'flex', alignItems:'center', justifyContent:'center', borderRadius:6 }}>›</button>
            </div>
          </div>
        </div>

        {/* My shifts this week — banner */}
        {myShifts.length > 0 && (
          <div style={{ margin:'16px 20px 0', background:'#EF4576', borderRadius:12, padding:'12px 16px' }}>
            <p style={{ fontSize:11, fontWeight:700, color:'rgba(255,255,255,.7)', letterSpacing:1.5, textTransform:'uppercase', margin:'0 0 8px' }}>My shifts this week</p>
            <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
              {myShifts.map((s, i) => {
                const d = new Date(s.shift_date + 'T00:00:00')
                const isToday = s.shift_date === today
                return (
                  <div key={i} style={{ background: isToday ? 'white' : 'rgba(255,255,255,.2)', borderRadius:8, padding:'6px 12px', display:'flex', alignItems:'center', gap:8 }}>
                    <div>
                      <div style={{ fontSize:11, fontWeight:700, color: isToday ? '#EF4576' : 'white' }}>
                        {d.toLocaleDateString('en-PH', { weekday:'short', month:'short', day:'numeric' })}
                        {isToday && <span style={{ marginLeft:6, fontSize:9, background:'#EF4576', color:'white', padding:'1px 6px', borderRadius:10 }}>Today</span>}
                      </div>
                      <div style={{ fontSize:10, color: isToday ? '#6b7280' : 'rgba(255,255,255,.7)', marginTop:1 }}>
                        {s.shift?.label} · {s.shift?.time}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        <div style={{ padding:'16px 20px' }}>

          {loading ? (
            <div style={{ textAlign:'center', padding:60, color:'#9ca3af', fontSize:13 }}>Loading schedule…</div>
          ) : schedules.length === 0 ? (
            <div style={{ textAlign:'center', padding:60, background:'white', borderRadius:16, border:'1px dashed #e5e7eb' }}>
              <div style={{ fontSize:32, marginBottom:8 }}>📅</div>
              <p style={{ fontSize:14, fontWeight:600, color:'#374151' }}>No schedule yet</p>
              <p style={{ fontSize:12, color:'#9ca3af', marginTop:4 }}>The schedule for this week hasn't been published yet.</p>
            </div>
          ) : viewMode === 'week' ? (

            // ── WEEK VIEW ─────────────────────────────
            <div>
              {/* Day columns */}
              <div style={{ display:'grid', gridTemplateColumns:'repeat(7, 1fr)', gap:10 }}>
                {weekDates.map((date, di) => {
                  const isToday = toISO(date) === today
                  const dayShifts = SHIFTS.filter(sh => getShiftStaff(di, sh.id).length > 0)

                  return (
                    <div key={di}
                      onClick={() => { setSelectedDay(di); setViewMode('day') }}
                      style={{ background:'white', borderRadius:12, border: isToday ? '2px solid #EF4576' : '1px solid #e5e7eb', cursor:'pointer', overflow:'hidden', transition:'box-shadow .15s' }}
                      onMouseEnter={e => e.currentTarget.style.boxShadow='0 4px 12px rgba(0,0,0,.08)'}
                      onMouseLeave={e => e.currentTarget.style.boxShadow='none'}>

                      {/* Day header */}
                      <div style={{ padding:'10px 12px', background: isToday ? '#EF4576' : '#f9fafb', borderBottom:'1px solid #f3f4f6' }}>
                        <div style={{ fontSize:9, fontWeight:700, letterSpacing:1.5, textTransform:'uppercase', color: isToday ? 'rgba(255,255,255,.8)' : '#9ca3af' }}>{DAYS[di]}</div>
                        <div style={{ fontSize:20, fontWeight:800, color: isToday ? 'white' : '#111', fontFamily:"'Montserrat',sans-serif", lineHeight:1.1 }}>{date.getDate()}</div>
                        <div style={{ fontSize:9, color: isToday ? 'rgba(255,255,255,.7)' : '#9ca3af', marginTop:1 }}>{fmtDate(date)}</div>
                      </div>

                      {/* Shifts */}
                      <div style={{ padding:8 }}>
                        {dayShifts.length === 0 ? (
                          <p style={{ fontSize:10, color:'#d1d5db', textAlign:'center', padding:'12px 0' }}>No shifts</p>
                        ) : (
                          dayShifts.map(shift => {
                            const members = getShiftStaff(di, shift.id)
                            const isMine = isMyShift(di, shift.id)
                            return (
                              <div key={shift.id} style={{ marginBottom:6, background: isMine ? shift.bg : '#f9fafb', border: `1px solid ${isMine ? shift.border : '#f3f4f6'}`, borderRadius:8, padding:'6px 8px' }}>
                                <div style={{ fontSize:9, fontWeight:700, color: shift.color, letterSpacing:1, textTransform:'uppercase', marginBottom:4 }}>
                                  {shift.label} {isMine && '✓'}
                                </div>
                                <div style={{ display:'flex', flexWrap:'wrap', gap:3 }}>
                                  {members.map(m => {
                                    const isMe = m.id === myStaffId
                                    return (
                                      <div key={m.id} title={`${m.first_name} ${m.last_name} · ${m.role}`}
                                        style={{ width:22, height:22, borderRadius:'50%', background: getRoleColor(m.role), display:'flex', alignItems:'center', justifyContent:'center', fontSize:8, fontWeight:700, color:'white', border: isMe ? '2px solid #EF4576' : '2px solid white', flexShrink:0 }}>
                                        {initials(m.first_name, m.last_name)}
                                      </div>
                                    )
                                  })}
                                </div>
                              </div>
                            )
                          })
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Legend */}
              <div style={{ marginTop:16, display:'flex', gap:12, flexWrap:'wrap', alignItems:'center' }}>
                <span style={{ fontSize:11, color:'#9ca3af', fontWeight:600 }}>Shifts:</span>
                {SHIFTS.map(sh => (
                  <div key={sh.id} style={{ display:'flex', alignItems:'center', gap:5 }}>
                    <div style={{ width:10, height:10, borderRadius:3, background:sh.bg, border:`1.5px solid ${sh.border}` }} />
                    <span style={{ fontSize:11, color:'#6b7280' }}>{sh.label} · {sh.time}</span>
                  </div>
                ))}
                <div style={{ display:'flex', alignItems:'center', gap:5, marginLeft:8 }}>
                  <div style={{ width:14, height:14, borderRadius:'50%', border:'2px solid #EF4576', background:'#f9fafb' }} />
                  <span style={{ fontSize:11, color:'#6b7280' }}>You</span>
                </div>
              </div>
            </div>

          ) : (

            // ── DAY VIEW ──────────────────────────────
            <div>
              {/* Day selector */}
              <div style={{ display:'flex', gap:6, marginBottom:16, overflowX:'auto', paddingBottom:4 }}>
                {weekDates.map((date, di) => {
                  const isToday = toISO(date) === today
                  const active = di === selectedDay
                  return (
                    <button key={di} onClick={() => setSelectedDay(di)}
                      style={{ flexShrink:0, padding:'8px 14px', borderRadius:10, border: active ? 'none' : '1px solid #e5e7eb', background: active ? '#EF4576' : isToday ? '#fff0f4' : 'white', color: active ? 'white' : isToday ? '#EF4576' : '#374151', cursor:'pointer', textAlign:'center', minWidth:60 }}>
                      <div style={{ fontSize:9, fontWeight:700, letterSpacing:1, textTransform:'uppercase', opacity: active ? 0.8 : 0.6 }}>{DAYS[di]}</div>
                      <div style={{ fontSize:18, fontWeight:800, fontFamily:"'Montserrat',sans-serif", lineHeight:1.1 }}>{date.getDate()}</div>
                    </button>
                  )
                })}
              </div>

              {/* Selected day detail */}
              <div style={{ background:'white', borderRadius:16, border:'1px solid #e5e7eb', overflow:'hidden' }}>
                <div style={{ padding:'14px 18px', borderBottom:'1px solid #f3f4f6', background:'#f9fafb' }}>
                  <p style={{ fontSize:13, fontWeight:700, color:'#111', margin:0 }}>{fmtFull(weekDates[selectedDay])}</p>
                </div>

                {SHIFTS.map(shift => {
                  const members = getShiftStaff(selectedDay, shift.id)
                  if (members.length === 0) return null
                  const isMine = isMyShift(selectedDay, shift.id)

                  return (
                    <div key={shift.id} style={{ borderBottom:'1px solid #f3f4f6' }}>
                      {/* Shift header */}
                      <div style={{ padding:'10px 18px', background: shift.bg, borderBottom:`1px solid ${shift.border}44`, display:'flex', alignItems:'center', gap:10 }}>
                        <div style={{ background: shift.border, color:'white', borderRadius:6, padding:'2px 10px', fontSize:11, fontWeight:700 }}>{shift.label}</div>
                        <span style={{ fontSize:12, color: shift.color, fontWeight:600 }}>{shift.time}</span>
                        {isMine && <span style={{ marginLeft:'auto', fontSize:11, fontWeight:700, color: shift.color }}>✓ Your shift</span>}
                      </div>

                      {/* Staff list */}
                      <div style={{ padding:'10px 18px', display:'flex', flexDirection:'column', gap:8 }}>
                        {members.map(m => {
                          const isMe = m.id === myStaffId
                          return (
                            <div key={m.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 12px', borderRadius:10, background: isMe ? '#fff0f4' : '#f9fafb', border: isMe ? '1px solid #fda4af' : '1px solid #f3f4f6' }}>
                              <div style={{ width:36, height:36, borderRadius:'50%', background: getRoleColor(m.role), display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700, color:'white', flexShrink:0, border: isMe ? '2px solid #EF4576' : 'none' }}>
                                {initials(m.first_name, m.last_name)}
                              </div>
                              <div style={{ flex:1, minWidth:0 }}>
                                <div style={{ fontSize:13, fontWeight:600, color:'#111' }}>
                                  {m.nickname || m.first_name} {m.last_name}
                                  {isMe && <span style={{ marginLeft:6, fontSize:10, background:'#EF4576', color:'white', padding:'1px 7px', borderRadius:10 }}>You</span>}
                                </div>
                                <div style={{ fontSize:11, color:'#6b7280', marginTop:1 }}>{m.role}</div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}

                {SHIFTS.every(sh => getShiftStaff(selectedDay, sh.id).length === 0) && (
                  <div style={{ textAlign:'center', padding:40 }}>
                    <p style={{ fontSize:13, color:'#9ca3af' }}>No shifts scheduled for this day</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </PortalShell>
  )
}
