'use client'
import { useState, useEffect } from 'react'
import PortalShell from '../../../components/PortalShell'
import { createClient } from '../../../lib/supabase'

const toISO = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
const fmtTime = ts => ts?new Date(ts).toLocaleTimeString('en-PH',{hour:'2-digit',minute:'2-digit'}):''
const SHIFT_COLORS = { am:{color:'#4a7a1e',bg:'#eef7e4',border:'#7ab648'}, mid:{color:'#a06000',bg:'#fef3e2',border:'#d4a843'}, pm:{color:'#2d5a8a',bg:'#e8f0fb',border:'#4a90c4'} }

export default function MyTasks() {
  const [staffId, setStaffId] = useState(null)
  const [tasks, setTasks]     = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(null)
  const today = toISO(new Date())

  useEffect(()=>{ getStaff() },[])
  useEffect(()=>{ if(staffId) fetchTasks() },[staffId])

  async function getStaff() {
    const supabase=createClient()
    const {data:{session}}=await supabase.auth.getSession(); if(!session) return
    const {data}=await supabase.from('staff').select('id').eq('email',session.user.email).single()
    if(data) setStaffId(data.id)
  }

  async function fetchTasks() {
    setLoading(true)
    const supabase=createClient()
    const {data}=await supabase.from('shift_task_assignments').select('*, role_tasks(task_name)').eq('staff_id',staffId).eq('shift_date',today).order('completed')
    setTasks(data||[]); setLoading(false)
  }

  async function toggleTask(id, completed) {
    setSaving(id)
    const supabase=createClient()
    const {data}=await supabase.from('shift_task_assignments').update({completed,completed_at:completed?new Date().toISOString():null}).eq('id',id).select().single()
    if(data) setTasks(prev=>prev.map(t=>t.id===id?data:t))
    setSaving(null)
  }

  const done = tasks.filter(t=>t.completed).length
  const pct  = tasks.length>0?Math.round((done/tasks.length)*100):0

  // Group by shift
  const byShift = {}
  tasks.forEach(t=>{ if(!byShift[t.shift_type]) byShift[t.shift_type]=[]; byShift[t.shift_type].push(t) })

  return (
    <PortalShell>
      <div style={{background:'var(--white)',borderBottom:'1px solid var(--border)',padding:'0 24px',height:56,display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
        <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:17,fontWeight:700}}>My Tasks Today</div>
        {tasks.length>0&&<div style={{fontFamily:"'DM Mono',monospace",fontSize:12,color:'var(--matcha-dark)',fontWeight:700}}>{done}/{tasks.length} done</div>}
      </div>
      <div style={{flex:1,overflowY:'auto',padding:'22px 24px'}}>
        {loading?<div style={{textAlign:'center',padding:'40px',color:'var(--text-muted)'}}>Loading…</div>:tasks.length===0?(
          <div style={{textAlign:'center',padding:'60px',background:'var(--white)',border:'1px solid var(--border)',borderRadius:13}}>
            <div style={{fontSize:40,marginBottom:12}}>✅</div>
            <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:15,fontWeight:700,marginBottom:6}}>No tasks for today</div>
            <div style={{fontSize:12,color:'var(--text-muted)'}}>Your manager will assign tasks when your shift starts</div>
          </div>
        ):(
          <>
            {/* Progress */}
            <div style={{background:'var(--white)',border:'1px solid var(--border)',borderRadius:13,padding:'16px 20px',marginBottom:16}}>
              <div style={{display:'flex',justifyContent:'space-between',marginBottom:8}}>
                <span style={{fontSize:13,fontWeight:600}}>Today's Progress</span>
                <span style={{fontFamily:"'Montserrat',sans-serif",fontSize:18,fontWeight:700,color:pct===100?'var(--matcha-dark)':'var(--espresso)'}}>{pct}%</span>
              </div>
              <div style={{height:8,background:'var(--cream-dark)',borderRadius:4,overflow:'hidden'}}>
                <div style={{height:'100%',width:`${pct}%`,background:pct===100?'var(--matcha)':'var(--matcha-light)',borderRadius:4,transition:'width .4s'}}/>
              </div>
              {pct===100&&<div style={{fontSize:12,color:'var(--matcha-dark)',fontWeight:700,textAlign:'center',marginTop:10}}>🎉 All tasks complete! Great work!</div>}
            </div>

            {/* Tasks by shift */}
            {Object.entries(byShift).map(([shiftId, shiftTasks])=>{
              const sc = SHIFT_COLORS[shiftId]||SHIFT_COLORS.am
              return(
                <div key={shiftId} style={{background:'var(--white)',border:'1px solid var(--border)',borderRadius:13,overflow:'hidden',marginBottom:12}}>
                  <div style={{background:sc.bg,padding:'10px 16px',borderBottom:`1px solid ${sc.border}33`,fontSize:11,fontWeight:700,color:sc.color,textTransform:'uppercase',letterSpacing:1}}>
                    {shiftId==='am'?'AM Shift':shiftId==='mid'?'Mid Shift':'PM Shift'}
                  </div>
                  {shiftTasks.map(t=>(
                    <div key={t.id} style={{display:'flex',alignItems:'center',gap:12,padding:'14px 16px',borderBottom:'1px solid var(--cream-dark)',background:t.completed?'#f8fdf5':'var(--white)',transition:'background .2s'}}>
                      <button onClick={()=>toggleTask(t.id,!t.completed)} disabled={saving===t.id}
                        style={{width:26,height:26,borderRadius:'50%',border:`2px solid ${t.completed?'var(--matcha)':sc.border}`,background:t.completed?'var(--matcha)':'transparent',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',transition:'all .2s',flexShrink:0}}>
                        {t.completed&&<span style={{color:'white',fontSize:13,fontWeight:700}}>✓</span>}
                      </button>
                      <div style={{flex:1}}>
                        <div style={{fontSize:13,fontWeight:500,color:t.completed?'var(--text-muted)':'var(--espresso)',textDecoration:t.completed?'line-through':'none'}}>
                          {t.role_tasks?.task_name||'Task'}
                        </div>
                        {t.completed&&t.completed_at&&(
                          <div style={{fontSize:10,color:'var(--matcha-dark)',marginTop:2,fontFamily:"'DM Mono',monospace"}}>
                            ✓ Completed at {fmtTime(t.completed_at)}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )
            })}
          </>
        )}
      </div>
    </PortalShell>
  )
}
