'use client'
export const dynamic = 'force-dynamic'
import { useState, useEffect } from 'react'
import PortalShell from '../../../components/PortalShell'
import { createClient } from '../../../lib/supabase'

const fmtDate = d => d ? new Date(d+'T00:00:00').toLocaleDateString('en-PH',{month:'short',day:'numeric'}) : '—'

const PRIORITIES = [
  { id:'urgent', label:'Urgent', color:'#c0392b', bg:'#fdeaea' },
  { id:'high',   label:'High',   color:'#e8845a', bg:'#fef3ee' },
  { id:'normal', label:'Normal', color:'#4a90c4', bg:'#e8f0fb' },
  { id:'low',    label:'Low',    color:'#7a6a50', bg:'#f0ede8' },
]

const COLUMNS = [
  { id:'todo',       label:'To Do',       color:'#7a6a50', bg:'#f5f0e8', border:'#c8bfb0' },
  { id:'inprogress', label:'In Progress', color:'#a06000', bg:'#fef3e2', border:'#d4a843' },
  { id:'done',       label:'Done',        color:'#4a7a1e', bg:'#eef7e4', border:'#7ab648' },
]

export default function JobOrdersPage() {
  const [staffId, setStaffId]   = useState(null)
  const [tasks, setTasks]       = useState([])
  const [loading, setLoading]   = useState(true)
  const [dragTask, setDragTask] = useState(null)
  const [dragOver, setDragOver] = useState(null)
  const [toast, setToast]       = useState(null)

  useEffect(() => { init() }, [])

  async function init() {
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const { data: staff } = await supabase.from('staff').select('id').eq('email', session.user.email).single()
      if (!staff) { setLoading(false); return }
      setStaffId(staff.id)
      const { data: t } = await supabase.from('tasks').select('*').eq('assigned_to', staff.id).order('created_at', { ascending:false })
      setTasks(t || [])
    } catch(e) { console.error(e) }
    setLoading(false)
  }

  function showToast(icon,msg){setToast({icon,msg});setTimeout(()=>setToast(null),3000)}

  async function moveTask(taskId, newStatus) {
    const supabase = createClient()
    const { error } = await supabase.from('tasks').update({ status: newStatus }).eq('id', taskId)
    if (error) { showToast('❌', error.message); return }
    setTasks(prev => prev.map(t => t.id===taskId ? {...t, status:newStatus} : t))
    const col = COLUMNS.find(c=>c.id===newStatus)
    showToast(newStatus==='done'?'✅':'📋', `Moved to ${col?.label}`)
  }

  const getColTasks = colId => tasks.filter(t => (t.status||'todo') === colId)
  const pri = id => PRIORITIES.find(p => p.id===id) || PRIORITIES[2]
  const totalDone = tasks.filter(t=>t.status==='done').length

  return (
    <PortalShell>
      <div style={{ background:'white', borderBottom:'1px solid #d8cebb', padding:'0 24px', height:56, display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
        <div>
          <div style={{ fontFamily:"'Montserrat',sans-serif", fontSize:17, fontWeight:700 }}>My Job Orders</div>
          <div style={{ fontSize:11, color:'#7a6a50', marginTop:1 }}>{tasks.length} assigned · {totalDone} completed</div>
        </div>
        {tasks.length > 0 && (
          <div style={{ fontFamily:"'DM Mono',monospace", fontSize:12, color:'#4a7a1e', fontWeight:700, background:'#eef7e4', padding:'5px 12px', borderRadius:20 }}>
            {Math.round((totalDone/tasks.length)*100)}% done
          </div>
        )}
      </div>

      <div style={{ flex:1, overflow:'hidden', padding:'16px 20px' }}>
        {loading ? (
          <div style={{ textAlign:'center', padding:'60px', color:'#7a6a50' }}>Loading…</div>
        ) : tasks.length === 0 ? (
          <div style={{ textAlign:'center', padding:'60px', background:'white', border:'1px solid #d8cebb', borderRadius:13 }}>
            <div style={{ fontSize:40, marginBottom:12 }}>📋</div>
            <div style={{ fontFamily:"'Montserrat',sans-serif", fontSize:15, fontWeight:700, marginBottom:6 }}>No job orders yet</div>
            <div style={{ fontSize:12, color:'#7a6a50' }}>Job orders assigned to you will appear here.</div>
          </div>
        ) : (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, height:'100%' }}>
            {COLUMNS.map(col => {
              const colTasks = getColTasks(col.id)
              return (
                <div key={col.id}
                  onDragOver={e => { e.preventDefault(); setDragOver(col.id) }}
                  onDragLeave={() => setDragOver(null)}
                  onDrop={e => {
                    e.preventDefault()
                    if (dragTask && dragTask.status !== col.id) moveTask(dragTask.id, col.id)
                    setDragTask(null); setDragOver(null)
                  }}
                  style={{ background: dragOver===col.id ? col.bg : '#faf7f2', border:`2px dashed ${dragOver===col.id ? col.color : 'transparent'}`, borderRadius:13, display:'flex', flexDirection:'column', overflow:'hidden', transition:'all .2s' }}>

                  {/* Column header */}
                  <div style={{ padding:'13px 16px', background:col.bg, borderBottom:`1px solid ${col.border}44`, display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <div style={{ width:9, height:9, borderRadius:'50%', background:col.color }}/>
                      <span style={{ fontFamily:"'Montserrat',sans-serif", fontSize:12, fontWeight:700, color:col.color }}>{col.label}</span>
                    </div>
                    <span style={{ fontSize:11, fontWeight:700, color:col.color, background:'white', padding:'2px 8px', borderRadius:20 }}>{colTasks.length}</span>
                  </div>

                  {/* Cards */}
                  <div style={{ flex:1, overflowY:'auto', padding:'10px' }}>
                    {colTasks.length === 0 && (
                      <div style={{ textAlign:'center', padding:'24px 10px', color:'#d8cebb', fontSize:12, border:'2px dashed #e8e0d0', borderRadius:10, marginTop:4 }}>
                        Drag here
                      </div>
                    )}
                    {colTasks.map(task => {
                      const p = pri(task.priority)
                      const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'done'
                      return (
                        <div key={task.id}
                          draggable
                          onDragStart={() => setDragTask(task)}
                          onDragEnd={() => setDragTask(null)}
                          style={{ background:'white', border:`1px solid ${isOverdue?'#f5c6c6':'#d8cebb'}`, borderRadius:10, padding:'12px 13px', marginBottom:8, cursor:'grab', borderLeft:`3px solid ${p.color}`, opacity:dragTask?.id===task.id?.4:1, transition:'all .15s' }}
                          onMouseEnter={e=>{ e.currentTarget.style.boxShadow='0 4px 14px rgba(26,18,8,.08)'; e.currentTarget.style.transform='translateY(-1px)' }}
                          onMouseLeave={e=>{ e.currentTarget.style.boxShadow=''; e.currentTarget.style.transform='' }}>

                          {/* Priority */}
                          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:7 }}>
                            <span style={{ fontSize:9, fontWeight:700, padding:'2px 7px', borderRadius:20, background:p.bg, color:p.color }}>{p.label}</span>
                            {isOverdue && <span style={{ fontSize:9, fontWeight:700, color:'#c0392b', background:'#fdeaea', padding:'2px 7px', borderRadius:20 }}>⚠️ Overdue</span>}
                          </div>

                          {/* Title */}
                          <div style={{ fontSize:13, fontWeight:600, color:'#1a1208', marginBottom:4, lineHeight:1.4 }}>{task.title}</div>

                          {/* Description */}
                          {task.description && (
                            <div style={{ fontSize:11, color:'#7a6a50', lineHeight:1.5, marginBottom:8, display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>
                              {task.description}
                            </div>
                          )}

                          {/* Due date */}
                          {task.due_date && (
                            <div style={{ fontSize:10, color:isOverdue?'#c0392b':'#7a6a50', fontFamily:"'DM Mono',monospace", marginBottom:8 }}>
                              📅 Due {fmtDate(task.due_date)}
                            </div>
                          )}

                          {/* Move buttons */}
                          <div style={{ display:'flex', gap:5, marginTop:6 }}>
                            {COLUMNS.filter(c => c.id !== col.id).map(c => (
                              <button key={c.id} onClick={() => moveTask(task.id, c.id)}
                                style={{ flex:1, background:c.bg, border:`1px solid ${c.border}66`, color:c.color, borderRadius:6, padding:'5px 6px', fontSize:9, fontWeight:700, cursor:'pointer', fontFamily:"'DM Sans',sans-serif", textAlign:'center', transition:'all .15s' }}>
                                {c.id==='done'?'✓ Done':c.id==='inprogress'?'▶ Start':'↩ Reopen'}
                              </button>
                            ))}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {toast && (
        <div style={{ position:'fixed', bottom:22, right:22, background:'#1a1208', color:'#f5f0e8', border:'1px solid #3d3020', borderRadius:12, padding:'12px 16px', fontSize:12, fontWeight:500, display:'flex', alignItems:'center', gap:9, boxShadow:'0 8px 28px rgba(0,0,0,.2)', zIndex:1000 }}>
          <span>{toast.icon}</span><span>{toast.msg}</span>
        </div>
      )}
    </PortalShell>
  )
}

