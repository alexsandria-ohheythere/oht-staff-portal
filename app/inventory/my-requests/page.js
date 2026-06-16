'use client'
export const dynamic = 'force-dynamic'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import PortalShell from '../../../components/PortalShell'
import { createClient } from '../../../lib/supabase'
import { getMyRequests } from '../../../lib/inventory'

const STATUS_STYLE = {
  draft:                  { color:'#7a6a50', bg:'#f0ede8',   label:'Draft'                },
  submitted:              { color:'#2d5a8a', bg:'#e8f0fb',   label:'Submitted'            },
  queued:                 { color:'#5b3ea8', bg:'#f0eaff',   label:'In purchase list'     },
  rejected_by_support:    { color:'#c0392b', bg:'#fdeaea',   label:'Returned — needs edit'},
  pending_supervisor:     { color:'#a06000', bg:'#fef3e2',   label:'Awaiting CJ'          },
  approved:               { color:'#4a7a1e', bg:'#eef7e4',   label:'Approved ✓'           },
  rejected_by_supervisor: { color:'#c0392b', bg:'#fdeaea',   label:'Returned by CJ'       },
  purchased:              { color:'#0d6e5a', bg:'#e0faf4',   label:'Purchased'            },
  done:                   { color:'#7a6a50', bg:'#f0ede8',   label:'Done'                 },
}

const URGENCY = {
  low:    { color:'#aaa',     label:'Low'    },
  normal: { color:'#4a7a1e', label:'Normal' },
  high:   { color:'#c0392b', label:'Urgent' },
}

export default function MyRequestsPage() {
  const router = useRouter()
  const [requests, setRequests] = useState([])
  const [loading, setLoading]   = useState(true)
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
        const reqs = await getMyRequests(session.user.id)
        setRequests(reqs)
      } catch (e) {
        console.error(e)
        showToast('❌', 'Failed to load requests')
      } finally {
        setLoading(false)
      }
    })
  }, [])

  return (
    <PortalShell>
      {/* Top bar */}
      <div style={{ background:'white', borderBottom:'1px solid #d8cebb', padding:'0 24px', height:56, display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
        <div style={{ fontFamily:"'Montserrat',sans-serif", fontSize:17, fontWeight:700, color:'#1a1208' }}>Purchase Requests</div>
        <button
          onClick={() => router.push('/inventory/request/new')}
          style={{ background:'#EF4576', color:'white', border:'none', borderRadius:8, padding:'7px 14px', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:"'DM Sans',sans-serif" }}
        >
          + New Request
        </button>
      </div>

      {/* Content */}
      <div style={{ flex:1, overflowY:'auto', padding:'22px 24px' }}>
        {loading ? (
          <div style={{ textAlign:'center', padding:'60px', color:'#7a6a50', fontSize:13 }}>Loading…</div>
        ) : requests.length === 0 ? (
          <div style={{ textAlign:'center', padding:'60px', background:'white', border:'1px solid #d8cebb', borderRadius:13 }}>
            <div style={{ fontSize:40, marginBottom:12 }}>🛒</div>
            <div style={{ fontFamily:"'Montserrat',sans-serif", fontSize:15, fontWeight:700, color:'#1a1208', marginBottom:6 }}>No requests yet</div>
            <div style={{ fontSize:12, color:'#7a6a50', marginBottom:18 }}>Submit a purchase request and ops will review it.</div>
            <button
              onClick={() => router.push('/inventory/request/new')}
              style={{ background:'#EF4576', color:'white', border:'none', borderRadius:8, padding:'9px 20px', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:"'DM Sans',sans-serif" }}
            >
              + Submit First Request
            </button>
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {requests.map(req => {
              const st  = STATUS_STYLE[req.status] ?? STATUS_STYLE.draft
              const urg = URGENCY[req.urgency]     ?? URGENCY.normal
              return (
                <div key={req.id} style={{ background:'white', border:'1px solid #d8cebb', borderRadius:12, padding:'14px 16px', borderLeft:'4px solid #EF4576' }}>
                  <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:12 }}>
                    <div style={{ minWidth:0 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4, flexWrap:'wrap' }}>
                        <span style={{ fontSize:10, fontFamily:'monospace', color:'#aaa' }}>{req.pr_number}</span>
                        <span style={{ fontSize:10, fontWeight:700, padding:'2px 9px', borderRadius:8, background:st.bg, color:st.color }}>
                          {st.label}
                        </span>
                      </div>
                      <div style={{ fontSize:14, fontWeight:700, color:'#1a1208', marginBottom:4 }}>{req.title}</div>
                      <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                        <span style={{ fontSize:11, fontWeight:600, color:urg.color }}>● {urg.label}</span>
                        <span style={{ fontSize:11, color:'#7a6a50' }}>{req.items?.length ?? 0} item{req.items?.length !== 1 ? 's' : ''}</span>
                      </div>
                    </div>
                  </div>

                  {/* Rejection note */}
                  {(req.status === 'rejected_by_support' || req.status === 'rejected_by_supervisor') && req.support_notes && (
                    <div style={{ marginTop:10, background:'#fdeaea', border:'1px solid #f5c6c6', borderRadius:8, padding:'8px 12px', fontSize:12, color:'#c0392b' }}>
                      <span style={{ fontWeight:700 }}>Returned: </span>{req.support_notes}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div style={{ position:'fixed', bottom:22, right:22, background:'#1a1208', color:'#f5f0e8', border:'1px solid #3d3020', borderRadius:12, padding:'12px 16px', fontSize:12, fontWeight:500, display:'flex', alignItems:'center', gap:9, boxShadow:'0 8px 28px rgba(0,0,0,.2)', zIndex:1000 }}>
          <span>{toast.icon}</span><span>{toast.msg}</span>
        </div>
      )}
    </PortalShell>
  )
}
