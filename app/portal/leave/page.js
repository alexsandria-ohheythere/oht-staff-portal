'use client'
export const dynamic = 'force-dynamic'
import { useState, useEffect } from 'react'
import PortalShell from '../../../components/PortalShell'
import { createClient } from '../../../lib/supabase'

const toISO = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
const fmtDate = d => d?new Date(d+'T00:00:00').toLocaleDateString('en-PH',{month:'short',day:'numeric',year:'numeric'}):'—'

const LEAVE_TYPES = [
  { id:'unavailable',     label:'Unavailable',             icon:'🚫', color:'#7a6a50', bg:'#f0ede8' },
  { id:'vacation_paid',   label:'Vacation Leave (Paid)',   icon:'🌴', color:'#4a7a1e', bg:'#eef7e4' },
  { id:'vacation_unpaid', label:'Vacation Leave (Unpaid)', icon:'🌴', color:'#2d5a8a', bg:'#e8f0fb' },
  { id:'sick_paid',       label:'Sick Leave (Paid)',       icon:'🤒', color:'#a06000', bg:'#fef3e2' },
  { id:'sick_unpaid',     label:'Sick Leave (Unpaid)',     icon:'🤒', color:'#8e44ad', bg:'#f5eeff' },
]

const STATUS_STYLES = {
  pending:  { color:'#a06000', bg:'#fef3e2', label:'Pending'  },
  approved: { color:'#4a7a1e', bg:'#eef7e4', label:'Approved' },
  rejected: { color:'#c0392b', bg:'#fdeaea', label:'Rejected' },
}

const iStyle = {width:'100%',background:'var(--surface)',border:'1px solid var(--border)',borderRadius:8,padding:'9px 12px',fontSize:12,fontFamily:"'DM Sans',sans-serif",color:'var(--text-primary)',outline:'none'}

export default function LeaveRequest() {
  const [staffId, setStaffId]   = useState(null)
  const [requests, setRequests] = useState([])
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({leave_type:'unavailable',date_from:toISO(new Date()),date_to:toISO(new Date()),shifts:['all'],reason:''})
  const [toast, setToast]       = useState(null)

  useEffect(()=>{ getStaff() },[])
  useEffect(()=>{ if(staffId) fetchRequests() },[staffId])

  async function getStaff() {
    const supabase=createClient()
    const {data:{session}}=await supabase.auth.getSession(); if(!session) return
    const {data}=await supabase.from('staff').select('id').eq('email',session.user.email).single()
    if(data) setStaffId(data.id)
  }

  async function fetchRequests() {
    setLoading(true)
    const supabase=createClient()
    const {data}=await supabase.from('leave_requests').select('*').eq('staff_id',staffId).order('created_at',{ascending:false})
    setRequests(data||[]); setLoading(false)
  }

  function showToast(icon,msg){setToast({icon,msg});setTimeout(()=>setToast(null),3000)}
  const fv = k => e => setForm(p=>({...p,[k]:e.target.value}))

  async function submitRequest() {
    if(!form.date_from||!form.date_to){showToast('⚠️','Please set dates');return}
    setSaving(true)
    const supabase=createClient()
    const {error}=await supabase.from('leave_requests').insert([{
      staff_id:staffId, leave_type:form.leave_type,
      date_from:form.date_from, date_to:form.date_to,
      shifts:form.shifts.includes('all')?['am','mid','pm']:form.shifts,
      reason:form.reason, submitted_by:'staff', status:'pending'
    }])
    if(error){showToast('❌',error.message);setSaving(false);return}
    await fetchRequests(); setShowForm(false)
    setForm({leave_type:'unavailable',date_from:toISO(new Date()),date_to:toISO(new Date()),shifts:['all'],reason:''})
    showToast('✅','Request submitted — pending approval'); setSaving(false)
  }

  const SHIFT_OPTIONS = [
    {id:'all',label:'All Shifts',icon:'📅'},{id:'am',label:'AM',icon:'🌅'},{id:'mid',label:'Mid',icon:'☀️'},{id:'pm',label:'PM',icon:'🌙'}
  ]

  return (
    <PortalShell>
      <div style={{background:'var(--white)',borderBottom:'1px solid var(--border)',padding:'0 24px',height:56,display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
        <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:17,fontWeight:700}}>Leave & Unavailability</div>
        <button onClick={()=>setShowForm(!showForm)} style={{background:'var(--matcha)',color:'white',border:'none',borderRadius:8,padding:'7px 14px',fontSize:11,fontWeight:700,cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}>+ New Request</button>
      </div>
      <div style={{flex:1,overflowY:'auto',padding:'22px 24px'}}>
        {/* Form */}
        {showForm&&(
          <div style={{background:'var(--white)',border:'1px solid var(--border)',borderRadius:13,padding:'20px',marginBottom:16}}>
            <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:14,fontWeight:700,marginBottom:16}}>Submit Request</div>
            <div style={{marginBottom:14}}>
              <div style={{fontSize:9,fontWeight:700,letterSpacing:1.2,textTransform:'uppercase',color:'var(--text-muted)',marginBottom:8}}>Type</div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:7}}>
                {LEAVE_TYPES.map(lt=>(
                  <div key={lt.id} onClick={()=>setForm(p=>({...p,leave_type:lt.id}))}
                    style={{padding:'9px 12px',borderRadius:9,border:`1.5px solid ${form.leave_type===lt.id?lt.color:'var(--border)'}`,background:form.leave_type===lt.id?lt.bg:'var(--surface)',cursor:'pointer',display:'flex',alignItems:'center',gap:8,transition:'all .15s'}}>
                    <span>{lt.icon}</span>
                    <span style={{fontSize:11,fontWeight:600,color:form.leave_type===lt.id?lt.color:'var(--text-muted)'}}>{lt.label}</span>
                  </div>
                ))}
              </div>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:14}}>
              <div><label style={{display:'block',fontSize:9,fontWeight:700,letterSpacing:1.2,textTransform:'uppercase',color:'var(--text-muted)',marginBottom:5}}>From</label><input style={iStyle} type="date" value={form.date_from} onChange={fv('date_from')}/></div>
              <div><label style={{display:'block',fontSize:9,fontWeight:700,letterSpacing:1.2,textTransform:'uppercase',color:'var(--text-muted)',marginBottom:5}}>To</label><input style={iStyle} type="date" value={form.date_to} onChange={fv('date_to')}/></div>
            </div>
            <div style={{marginBottom:14}}>
              <div style={{fontSize:9,fontWeight:700,letterSpacing:1.2,textTransform:'uppercase',color:'var(--text-muted)',marginBottom:8}}>Affected Shifts</div>
              <div style={{display:'flex',gap:7}}>
                {SHIFT_OPTIONS.map(sh=>{
                  const active=sh.id==='all'?form.shifts.includes('all'):(!form.shifts.includes('all')&&form.shifts.includes(sh.id))
                  return(
                    <div key={sh.id} onClick={()=>{
                      if(sh.id==='all'){setForm(p=>({...p,shifts:['all']}))}
                      else{setForm(p=>{const cur=p.shifts.filter(x=>x!=='all');const next=cur.includes(sh.id)?cur.filter(x=>x!==sh.id):[...cur,sh.id];return{...p,shifts:next.length===0?['all']:next}})}
                    }} style={{flex:1,padding:'8px',borderRadius:8,border:`1.5px solid ${active?'var(--espresso)':'var(--border)'}`,background:active?'var(--espresso)':'var(--surface)',cursor:'pointer',textAlign:'center',transition:'all .15s'}}>
                      <div style={{fontSize:14}}>{sh.icon}</div>
                      <div style={{fontSize:9,fontWeight:700,color:active?'var(--cream)':'var(--text-muted)',marginTop:2}}>{sh.label}</div>
                    </div>
                  )
                })}
              </div>
            </div>
            <div style={{marginBottom:14}}>
              <label style={{display:'block',fontSize:9,fontWeight:700,letterSpacing:1.2,textTransform:'uppercase',color:'var(--text-muted)',marginBottom:5}}>Reason (optional)</label>
              <textarea style={{...iStyle,resize:'vertical',minHeight:60,lineHeight:1.5}} placeholder="Medical reason, personal note…" value={form.reason} onChange={fv('reason')}/>
            </div>
            <div style={{display:'flex',gap:8}}>
              <button onClick={()=>setShowForm(false)} style={{background:'transparent',color:'var(--text-muted)',border:'1px solid var(--border)',borderRadius:8,padding:'9px 14px',fontSize:12,cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}>Cancel</button>
              <button onClick={submitRequest} disabled={saving} style={{flex:1,background:'var(--matcha)',color:'white',border:'none',borderRadius:8,padding:9,fontSize:12,fontWeight:700,cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}>
                {saving?'Submitting…':'✓ Submit Request'}
              </button>
            </div>
          </div>
        )}

        {/* Request list */}
        {loading?<div style={{textAlign:'center',padding:'40px',color:'var(--text-muted)'}}>Loading…</div>:requests.length===0&&!showForm?(
          <div style={{textAlign:'center',padding:'60px',background:'var(--white)',border:'1px solid var(--border)',borderRadius:13}}>
            <div style={{fontSize:40,marginBottom:12}}>🗓️</div>
            <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:15,fontWeight:700,marginBottom:6}}>No requests yet</div>
            <button onClick={()=>setShowForm(true)} style={{background:'var(--matcha)',color:'white',border:'none',borderRadius:8,padding:'9px 18px',fontSize:12,fontWeight:700,cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}>+ Submit First Request</button>
          </div>
        ):(
          <div style={{display:'flex',flexDirection:'column',gap:10}}>
            {requests.map(r=>{
              const lt=LEAVE_TYPES.find(x=>x.id===r.leave_type)||LEAVE_TYPES[0]
              const ss=STATUS_STYLES[r.status]||STATUS_STYLES.pending
              return(
                <div key={r.id} style={{background:'var(--white)',border:'1px solid var(--border)',borderRadius:12,padding:'14px 16px',borderLeft:`4px solid ${lt.color}`}}>
                  <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:12}}>
                    <div>
                      <div style={{display:'flex',alignItems:'center',gap:7,marginBottom:4}}>
                        <span style={{fontSize:16}}>{lt.icon}</span>
                        <span style={{fontSize:13,fontWeight:700,color:lt.color}}>{lt.label}</span>
                      </div>
                      <div style={{fontSize:12,fontWeight:600,color:'var(--espresso)'}}>
                        {fmtDate(r.date_from)}{r.date_from!==r.date_to?` → ${fmtDate(r.date_to)}`:''} 
                      </div>
                      {r.reason&&<div style={{fontSize:11,color:'var(--text-muted)',marginTop:3}}>{r.reason}</div>}
                      {r.approved_by&&<div style={{fontSize:10,color:'var(--text-muted)',marginTop:3}}>{r.status==='approved'?'Approved':'Rejected'} by {r.approved_by==='alex'?'Alex':'CJ'}</div>}
                    </div>
                    <span style={{fontSize:10,fontWeight:700,padding:'3px 9px',borderRadius:8,background:ss.bg,color:ss.color,flexShrink:0}}>{ss.label}</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
      {toast&&<div style={{position:'fixed',bottom:22,right:22,background:'#1a1208',color:'#f5f0e8',border:'1px solid #3d3020',borderRadius:12,padding:'12px 16px',fontSize:12,fontWeight:500,display:'flex',alignItems:'center',gap:9,boxShadow:'0 8px 28px rgba(0,0,0,.2)',zIndex:1000}}><span>{toast.icon}</span><span>{toast.msg}</span></div>}
    </PortalShell>
  )
}
