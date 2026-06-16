'use client'
export const dynamic = 'force-dynamic'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import PortalShell from '../../../components/PortalShell'
import { createClient } from '../../../lib/supabase'

const DEPT_LABEL = { bar:'Bar', commissary:'Commissary', utility:'Utility', operations:'Operations' }
const DEPT_ICON  = { bar:'🍵', commissary:'🍳', utility:'🧹', operations:'📋' }

const STATUS_META = {
  submitted: { label:'Submitted — awaiting review', color:'#2d5a8a', bg:'#e8f0fb' },
  reviewed:  { label:'Reviewed — awaiting CEO',     color:'#92400e', bg:'#fef3c7' },
  approved:  { label:'CEO Approved ✓',              color:'#166534', bg:'#dcfce7' },
  rejected:  { label:'Sent back',                   color:'#991b1b', bg:'#fee2e2' },
}

export default function MyReportsPage() {
  const router = useRouter()
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(null)

  useEffect(() => {
    const sb = createClient()
    sb.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) return
      const { data: staff } = await sb.from('staff').select('id').eq('email', session.user.email).single()
      if (!staff) return
      const { data } = await sb.from('inventory_reports')
        .select('*, items:inventory_report_items(*)')
        .eq('submitted_by', staff.id)
        .order('created_at', { ascending: false })
        .limit(30)
      setReports(data ?? [])
      setLoading(false)
    })
  }, [])

  return (
    <PortalShell>
      <div style={{ background:'white', borderBottom:'1px solid #d8cebb', padding:'0 24px', height:56, display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
        <div style={{ fontFamily:"'Montserrat',sans-serif", fontSize:17, fontWeight:700, color:'#1a1208' }}>My Inventory Reports</div>
        <button onClick={() => router.push('/inventory/daily')}
          style={{ background:'#EF4576', color:'white', border:'none', borderRadius:8, padding:'7px 14px', fontSize:11, fontWeight:700, cursor:'pointer' }}>
          + New Report
        </button>
      </div>

      <div style={{ flex:1, overflowY:'auto', padding:'22px 24px' }}>
        {loading ? (
          <div style={{ textAlign:'center', padding:60, color:'#7a6a50', fontSize:13 }}>Loading…</div>
        ) : reports.length === 0 ? (
          <div style={{ textAlign:'center', padding:60, background:'white', border:'1px solid #d8cebb', borderRadius:13 }}>
            <div style={{ fontSize:40, marginBottom:12 }}>📋</div>
            <div style={{ fontFamily:"'Montserrat',sans-serif", fontSize:15, fontWeight:700, color:'#1a1208', marginBottom:6 }}>No reports yet</div>
            <button onClick={() => router.push('/inventory/daily')}
              style={{ background:'#EF4576', color:'white', border:'none', borderRadius:8, padding:'9px 20px', fontSize:12, fontWeight:700, cursor:'pointer', marginTop:8 }}>
              Submit first report
            </button>
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {reports.map(report => {
              const st = STATUS_META[report.status] ?? STATUS_META.submitted
              const flagged = report.items?.filter(i => i.flag !== 'ok') ?? []
              const isExpanded = expanded === report.id
              const sections = (report.items ?? []).reduce((acc, item) => {
                if (!acc[item.section]) acc[item.section] = []
                acc[item.section].push(item)
                return acc
              }, {})

              return (
                <div key={report.id} style={{ background:'white', border:'1px solid #d8cebb', borderRadius:12, overflow:'hidden', borderLeft:'4px solid #EF4576' }}>
                  <div style={{ padding:'14px 16px', cursor:'pointer', display:'flex', alignItems:'flex-start', justifyContent:'space-between' }}
                    onClick={() => setExpanded(isExpanded ? null : report.id)}>
                    <div>
                      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4, flexWrap:'wrap' }}>
                        <span style={{ fontSize:16 }}>{DEPT_ICON[report.department]}</span>
                        <span style={{ fontSize:13, fontWeight:700, color:'#1a1208' }}>{DEPT_LABEL[report.department]} — {report.shift?.toUpperCase()} Shift</span>
                        <span style={{ fontSize:10, fontWeight:700, padding:'2px 9px', borderRadius:8, background:st.bg, color:st.color }}>{st.label}</span>
                      </div>
                      <div style={{ fontSize:11, color:'#7a6a50' }}>
                        {new Date(report.report_date).toLocaleDateString('en-PH', { month:'short', day:'numeric', year:'numeric' })}
                        {flagged.length > 0 && <span style={{ marginLeft:8, fontWeight:700, color:'#92400e' }}>· 🚩 {flagged.length} flagged</span>}
                      </div>
                      {report.supervisor_notes && <div style={{ fontSize:11, color:'#6b7280', marginTop:4, fontStyle:'italic' }}>Note: {report.supervisor_notes}</div>}
                    </div>
                    <span style={{ color:'#aaa', fontSize:12 }}>{isExpanded ? '▲' : '▼'}</span>
                  </div>

                  {isExpanded && (
                    <div style={{ borderTop:'1px solid #f0ede8', padding:'12px 16px' }}>
                      {/* Flagged summary */}
                      {flagged.length > 0 && (
                        <div style={{ background:'#fef3c7', border:'1px solid #fcd34d', borderRadius:10, padding:12, marginBottom:14 }}>
                          <div style={{ fontSize:11, fontWeight:700, color:'#92400e', marginBottom:8 }}>🚩 Flagged for restocking</div>
                          {flagged.map(item => (
                            <div key={item.id} style={{ display:'flex', justifyContent:'space-between', fontSize:12, color:'#92400e', padding:'2px 0' }}>
                              <span>{item.item_name}</span>
                              <span style={{ fontWeight:700 }}>{item.flag.toUpperCase()} — {item.supervisor_corrected_qty ?? item.actual_qty} {item.unit}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Full report by section */}
                      {Object.entries(sections).map(([section, sectionItems]) => (
                        <div key={section} style={{ marginBottom:12 }}>
                          <div style={{ fontSize:10, fontWeight:700, letterSpacing:1.5, textTransform:'uppercase', color:'#7a6a50', marginBottom:6 }}>{section}</div>
                          {sectionItems.map(item => (
                            <div key={item.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'5px 0', borderBottom:'1px solid #f5f0e8', fontSize:12 }}>
                              <span style={{ color: item.flag!=='ok'?'#92400e':'#1a1208', fontWeight: item.flag!=='ok'?600:400 }}>{item.item_name}</span>
                              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                                {item.supervisor_corrected_qty != null && (
                                  <span style={{ fontSize:10, color:'#6b7280', textDecoration:'line-through' }}>{item.actual_qty}</span>
                                )}
                                <span style={{ fontWeight:600, color:'#1a1208' }}>{item.supervisor_corrected_qty ?? item.actual_qty} {item.unit}</span>
                                {item.flag !== 'ok' && (
                                  <span style={{ fontSize:10, fontWeight:700, padding:'1px 6px', borderRadius:4,
                                    background: item.flag==='rl'?'#fef3c7':'#fee2e2',
                                    color: item.flag==='rl'?'#92400e':'#991b1b' }}>
                                    {item.flag.toUpperCase()}
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </PortalShell>
  )
}
