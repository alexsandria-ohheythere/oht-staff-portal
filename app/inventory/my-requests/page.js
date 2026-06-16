'use client'
export const dynamic = 'force-dynamic'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import PortalShell from '../../../components/PortalShell'
import { createClient } from '../../../lib/supabase'
import { getMyRequests } from '../../../lib/inventory'

const STEPS = [
  { key: 'submitted',           label: 'Submitted'    },
  { key: 'queued',              label: 'Ops Reviewed' },
  { key: 'pending_supervisor',  label: 'Sent to CJ'  },
  { key: 'approved',            label: 'CJ Approved'  },
  { key: 'purchased',           label: 'Purchased ✓'  },
]

function stepIndex(status) {
  const map = {
    submitted:              0,
    rejected_by_support:    0,
    queued:                 1,
    pending_supervisor:     2,
    approved:               3,
    rejected_by_supervisor: 3,
    purchased:              4,
    done:                   4,
  }
  return map[status] ?? 0
}

const STATUS_META = {
  submitted:              { label:'Submitted',              color:'#2d5a8a', bg:'#e8f0fb' },
  queued:                 { label:'In purchase list',       color:'#5b3ea8', bg:'#f0eaff' },
  rejected_by_support:    { label:'Returned — edit needed', color:'#c0392b', bg:'#fdeaea' },
  pending_supervisor:     { label:'Awaiting CJ',            color:'#a06000', bg:'#fef3e2' },
  approved:               { label:'CJ Approved ✓',          color:'#4a7a1e', bg:'#eef7e4' },
  rejected_by_supervisor: { label:'Returned by CJ',         color:'#c0392b', bg:'#fdeaea' },
  purchased:              { label:'Purchased ✓',            color:'#0d6e5a', bg:'#e0faf4' },
  done:                   { label:'Done',                   color:'#7a6a50', bg:'#f0ede8'  },
}

function TicketCard({ req }) {
  const [expanded, setExpanded] = useState(false)
  const st  = STATUS_META[req.status] ?? STATUS_META.submitted
  const idx = stepIndex(req.status)
  const isRejected = req.status === 'rejected_by_support' || req.status === 'rejected_by_supervisor'

  return (
    <div style={{ background:'white', border:`1px solid ${isRejected ? '#f5c6c6' : '#d8cebb'}`, borderRadius:12, overflow:'hidden', borderLeft:`4px solid ${isRejected ? '#c0392b' : '#EF4576'}` }}>
      <div style={{ padding:'14px 16px', cursor:'pointer', display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:12 }}
        onClick={() => setExpanded(v => !v)}>
        <div style={{ minWidth:0, flex:1 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4, flexWrap:'wrap' }}>
            <span style={{ fontSize:10, fontFamily:'monospace', color:'#aaa' }}>{req.pr_number}</span>
            <span style={{ fontSize:10, fontWeight:700, padding:'2px 9px', borderRadius:8, background:st.bg, color:st.color }}>{st.label}</span>
            {req.urgency === 'high' && <span style={{ fontSize:10, fontWeight:700, padding:'2px 9px', borderRadius:8, background:'#fdeaea', color:'#c0392b' }}>🔴 Urgent</span>}
          </div>
          <div style={{ fontSize:14, fontWeight:700, color:'#1a1208', marginBottom:3 }}>{req.title}</div>
          <div style={{ fontSize:11, color:'#7a6a50' }}>{req.items?.length ?? 0} item{req.items?.length !== 1 ? 's' : ''}</div>
        </div>
        <span style={{ color:'#aaa', fontSize:12, flexShrink:0, marginTop:2 }}>{expanded ? '▲' : '▼'}</span>
      </div>

      {/* Progress track */}
      <div style={{ padding:'0 16px 14px' }}>
        <div style={{ display:'flex', alignItems:'flex-start' }}>
          {STEPS.map((step, i) => {
            const done    = i <= idx && !isRejected
            const current = i === idx
            const rejected = isRejected && i === idx
            const dotColor = rejected ? '#c0392b' : done ? '#EF4576' : '#e0d8ce'
            const lineColor = i < idx && !isRejected ? '#EF4576' : '#e0d8ce'
            return (
              <div key={step.key} style={{ display:'flex', alignItems:'flex-start', flex: i < STEPS.length - 1 ? 1 : 0 }}>
                <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:4 }}>
                  <div style={{ width:20, height:20, borderRadius:'50%', background:dotColor, display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, color:'white', fontWeight:700, flexShrink:0 }}>
                    {rejected ? '✕' : done ? '✓' : ''}
                  </div>
                  <span style={{ fontSize:9, color: done || rejected ? '#1a1208' : '#aaa', fontWeight: current ? 700 : 400, whiteSpace:'nowrap', textAlign:'center', maxWidth:56 }}>{step.label}</span>
                </div>
                {i < STEPS.length - 1 && (
                  <div style={{ flex:1, height:2, background:lineColor, margin:'9px 4px 0' }} />
                )}
              </div>
            )
          })}
        </div>
      </div>

      {isRejected && req.support_notes && (
        <div style={{ margin:'0 16px 14px', background:'#fdeaea', border:'1px solid #f5c6c6', borderRadius:8, padding:'8px 12px', fontSize:12, color:'#c0392b' }}>
          <span style={{ fontWeight:700 }}>Returned: </span>{req.support_notes}
        </div>
      )}

      {expanded && (
        <div style={{ borderTop:'1px solid #f0ede8', padding:'12px 16px' }}>
          {req.notes && (
            <div style={{ background:'#faf7f2', borderRadius:8, padding:'8px 12px', fontSize:12, color:'#7a6a50', fontStyle:'italic', marginBottom:10 }}>
              "{req.notes}"
            </div>
          )}
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            {req.items?.map(item => (
              <div key={item.id} style={{ background:'#faf7f2', borderRadius:8, padding:'10px 12px', display:'flex', alignItems:'center', justifyContent:'space-between', gap:8 }}>
                <div>
                  <div style={{ fontSize:13, fontWeight:600, color:'#1a1208' }}>{item.item_name}</div>
                  <div style={{ fontSize:11, color:'#7a6a50', marginTop:1 }}>{item.quantity} {item.unit}{item.staff_notes ? ` · ${item.staff_notes}` : ''}</div>
                </div>
                <span style={{ fontSize:10, color:'#aaa', background:'#e8e0d5', padding:'2px 8px', borderRadius:6, flexShrink:0 }}>{item.category}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default function MyRequestsPage() {
  const router = useRouter()
  const [requests, setRequests] = useState([])
  const [loading, setLoading]   = useState(true)
  const [filter, setFilter]     = useState('active')
  const [toast, setToast]       = useState(null)

  function showToast(icon, msg) {
    setToast({ icon, msg })
    setTimeout(() => setToast(null), 3000)
  }

  useEffect(() => {
    const sb = createClient()
    sb.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) return
      try {
        const { data: staff } = await sb.from('staff').select('id').eq('email', session.user.email).single()
        if (!staff) return
        const reqs = await getMyRequests(staff.id)
        setRequests(reqs)
      } catch (e) {
        console.error(e)
        showToast('❌', 'Failed to load requests')
      } finally {
        setLoading(false)
      }
    })
  }, [])

  const active = requests.filter(r => !['purchased','done'].includes(r.status))
  const done   = requests.filter(r =>  ['purchased','done'].includes(r.status))
  const shown  = filter === 'active' ? active : done

  return (
    <PortalShell>
      <div style={{ background:'white', borderBottom:'1px solid #d8cebb', padding:'0 24px', height:56, display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
        <div style={{ fontFamily:"'Montserrat',sans-serif", fontSize:17, fontWeight:700, color:'#1a1208' }}>My Purchase Requests</div>
        <button onClick={() => router.push('/inventory/request/new')}
          style={{ background:'#EF4576', color:'white', border:'none', borderRadius:8, padding:'7px 14px', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:"'DM Sans',sans-serif" }}>
          + New Request
        </button>
      </div>

      <div style={{ flex:1, overflowY:'auto', padding:'22px 24px' }}>
        <div style={{ display:'flex', gap:8, marginBottom:20 }}>
          {[
            { key:'active', label:`Active (${active.length})` },
            { key:'done',   label:`Completed (${done.length})` },
          ].map(tab => (
            <button key={tab.key} onClick={() => setFilter(tab.key)}
              style={{ padding:'7px 16px', fontSize:12, fontWeight:600, borderRadius:8, border:'none', cursor:'pointer', fontFamily:"'DM Sans',sans-serif",
                background: filter === tab.key ? '#EF4576' : 'white',
                color:      filter === tab.key ? 'white'   : '#7a6a50',
                boxShadow:  filter === tab.key ? 'none' : '0 0 0 1px #d8cebb',
              }}>
              {tab.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ textAlign:'center', padding:'60px', color:'#7a6a50', fontSize:13 }}>Loading…</div>
        ) : shown.length === 0 ? (
          <div style={{ textAlign:'center', padding:'60px', background:'white', border:'1px solid #d8cebb', borderRadius:13 }}>
            <div style={{ fontSize:40, marginBottom:12 }}>🛒</div>
            <div style={{ fontFamily:"'Montserrat',sans-serif", fontSize:15, fontWeight:700, color:'#1a1208', marginBottom:6 }}>
              {filter === 'active' ? 'No active requests' : 'No completed requests yet'}
            </div>
            {filter === 'active' && (
              <button onClick={() => router.push('/inventory/request/new')}
                style={{ background:'#EF4576', color:'white', border:'none', borderRadius:8, padding:'9px 20px', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:"'DM Sans',sans-serif", marginTop:8 }}>
                + Submit a Request
              </button>
            )}
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {shown.map(req => <TicketCard key={req.id} req={req} />)}
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
