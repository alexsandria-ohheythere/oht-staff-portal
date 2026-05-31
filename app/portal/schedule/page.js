'use client'
import { useState, useEffect } from 'react'
import PortalShell from '../../../components/PortalShell'
import { createClient } from '../../../lib/supabase'

const DAYS = ['MON','TUE','WED','THU','FRI','SAT','SUN']
const SHIFT_BADGE = {
  am:  { label:'AM',  bg:'#eef7e4', color:'#4a7a1e', border:'#7ab648', time:'6:30AM–3:30PM'  },
  mid: { label:'MID', bg:'#fef3e2', color:'#a06000',  border:'#d4a843', time:'11:00AM–8:00PM' },
  pm:  { label:'PM',  bg:'#e8f0fb', color:'#2d5a8a',  border:'#4a90c4', time:'3:00PM–11:00PM' },
}
const toISO = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
function getWeekDates(offset=0) {
  const today=new Date(); const day=today.getDay()
  const mon=new Date(today); mon.setDate(today.getDate()-(day===0?6:day-1)+offset*7); mon.setHours(0,0,0,0)
  return DAYS.map((_,i)=>{ const d=new Date(mon); d.setDate(mon.getDate()+i); return d })
}

export default function MySchedule() {
  const [staffId, setStaffId]   = useState(null)
  const [weekOffset, setWeekOffset] = useState(0)
  const [shifts, setShifts]     = useState([])
  const [loading, setLoading]   = useState(true)
  const weekDates = getWeekDates(weekOffset)
  const weekStart = toISO(weekDates[0])
  const weekEnd   = toISO(weekDates[6])

  useEffect(()=>{ getStaff() },[])
  useEffect(()=>{ if(staffId) fetchShifts() },[staffId, weekOffset])

  async function getStaff() {
    const supabase=createClient()
    const {data:{session}}=await supabase.auth.getSession(); if(!session) return
    const {data}=await supabase.from('staff').select('id').eq('email',session.user.email).single()
    if(data) setStaffId(data.id)
  }

  async function fetchShifts() {
    setLoading(true)
    const supabase=createClient()
    const {data}=await supabase.from('schedules').select('*').eq('staff_id',staffId).gte('shift_date',weekStart).lte('shift_date',weekEnd)
    setShifts(data||[]); setLoading(false)
  }

  const totalHours = shifts.reduce((a,s)=>a+(s.shift_type==='pm'?7:8),0)

  return (
    <PortalShell>
      <div style={{background:'var(--white)',borderBottom:'1px solid var(--border)',padding:'0 24px',height:56,display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
        <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:17,fontWeight:700}}>My Schedule</div>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <button onClick={()=>setWeekOffset(w=>w-1)} style={{width:28,height:28,borderRadius:7,border:'1px solid var(--border)',background:'var(--surface)',cursor:'pointer',fontSize:14,color:'var(--text-muted)'}}>‹</button>
          <span style={{fontFamily:"'DM Mono',monospace",fontSize:11,color:'var(--text-muted)',minWidth:140,textAlign:'center'}}>
            {weekDates[0].toLocaleDateString('en-PH',{month:'short',day:'numeric'})} – {weekDates[6].toLocaleDateString('en-PH',{month:'short',day:'numeric'})}
          </span>
          <button onClick={()=>setWeekOffset(w=>w+1)} style={{width:28,height:28,borderRadius:7,border:'1px solid var(--border)',background:'var(--surface)',cursor:'pointer',fontSize:14,color:'var(--text-muted)'}}>›</button>
          <button onClick={()=>setWeekOffset(0)} style={{fontSize:9,fontWeight:700,padding:'4px 8px',borderRadius:5,border:'1px solid var(--border)',background:'transparent',cursor:'pointer',color:'var(--text-muted)',fontFamily:"'DM Sans',sans-serif"}}>TODAY</button>
        </div>
      </div>
      <div style={{flex:1,overflowY:'auto',padding:'22px 24px'}}>
        {loading?<div style={{textAlign:'center',padding:'40px',color:'var(--text-muted)'}}>Loading…</div>:(
          <>
            {shifts.length>0&&(
              <div style={{background:'var(--matcha-pale)',border:'1px solid var(--matcha)',borderRadius:10,padding:'11px 16px',marginBottom:16,display:'flex',alignItems:'center',gap:10}}>
                <span style={{fontSize:16}}>📅</span>
                <span style={{fontSize:13,fontWeight:600,color:'var(--matcha-dark)'}}>{shifts.length} shift{shifts.length!==1?'s':''} this week · {totalHours} paid hours</span>
              </div>
            )}
            <div style={{display:'flex',flexDirection:'column',gap:10}}>
              {weekDates.map((d,i)=>{
                const dateStr=toISO(d)
                const dayShifts=shifts.filter(s=>s.shift_date===dateStr)
                const isToday=d.toDateString()===new Date().toDateString()
                return(
                  <div key={i} style={{background:'var(--white)',border:`1px solid ${isToday?'var(--matcha)':'var(--border)'}`,borderRadius:12,padding:'14px 16px',display:'flex',alignItems:'center',gap:14}}>
                    <div style={{textAlign:'center',minWidth:44}}>
                      <div style={{fontSize:9,fontWeight:700,letterSpacing:1.5,textTransform:'uppercase',color:isToday?'var(--matcha-dark)':'var(--text-muted)'}}>{DAYS[i]}</div>
                      <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:22,fontWeight:700,color:isToday?'var(--matcha-dark)':'var(--espresso)',lineHeight:1,marginTop:2}}>{d.getDate()}</div>
                    </div>
                    <div style={{flex:1}}>
                      {dayShifts.length===0?(
                        <span style={{fontSize:12,color:'var(--border)'}}>Rest day</span>
                      ):dayShifts.map(s=>{
                        const badge=SHIFT_BADGE[s.shift_type]
                        return(
                          <div key={s.id} style={{display:'inline-flex',alignItems:'center',gap:8,background:badge.bg,border:`1.5px solid ${badge.border}`,borderRadius:8,padding:'6px 12px',marginRight:8}}>
                            <span style={{fontWeight:700,color:badge.color,fontSize:11}}>{badge.label}</span>
                            <span style={{fontSize:11,color:badge.color,opacity:.8}}>{badge.time}</span>
                          </div>
                        )
                      })}
                    </div>
                    {isToday&&<span style={{fontSize:10,fontWeight:700,color:'var(--matcha-dark)',background:'var(--matcha-pale)',padding:'3px 8px',borderRadius:6}}>TODAY</span>}
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
    </PortalShell>
  )
}
