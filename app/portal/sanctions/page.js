'use client'
export const dynamic = 'force-dynamic'
import { useState, useEffect } from 'react'
import PortalShell from '../../../components/PortalShell'
import { createClient } from '../../../lib/supabase'

const STATUS_STYLE = {
  'Pending':              { bg:'#fef3e2', color:'#a06000', label:'Pending' },
  'NTE Issued':           { bg:'#fde8ee', color:'#c0392b', label:'NTE Issued — Response Required' },
  'Explanation Received': { bg:'#e8f0fb', color:'#2d5a8a', label:'Explanation Received' },
  'NOD Issued':           { bg:'#fff0e0', color:'#b06000', label:'Decision Issued' },
  'Served':               { bg:'#eef7e4', color:'#4a7a1e', label:'Served' },
  'Appealed':             { bg:'#f5eeff', color:'#7a3a8a', label:'Under Appeal' },
  'Lifted':               { bg:'#f0f0f0', color:'#666', label:'Lifted' },
}

const SEV_STYLE = {
  Minor:    { bg:'#eef7e4', color:'#4a7a1e' },
  Moderate: { bg:'#fef3e2', color:'#a06000' },
  Major:    { bg:'#fde8ee', color:'#c0392b' },
  Grave:    { bg:'#2d0a0a', color:'#ff6b6b' },
}

const fmtDate = s => s ? new Date(s + 'T00:00:00').toLocaleDateString('en-PH', { month:'long', day:'numeric', year:'numeric' }) : '—'
const fmtDT   = s => s ? new Date(s).toLocaleDateString('en-PH', { month:'short', day:'numeric', year:'numeric', hour:'numeric', minute:'2-digit' }) : '—'

export default function MySanctionsPage() {
  const [sanctions, setSanctions] = useState([])
  const [loading, setLoading]     = useState(true)
  const [selected, setSelected]   = useState(null)
  const [staffId, setStaffId]     = useState(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) return
      const { data: staffData } = await supabase.from('staff').select('id').eq('email', session.user.email).single()
      if (!staffData) return setLoading(false)
      setStaffId(staffData.id)
      const { data } = await supabase.from('sanctions').select('*').eq('staff_id', staffData.id).order('created_at', { ascending: false })
      setSanctions(data || [])
      setLoading(false)
    })
  }, [])

  const active  = sanctions.filter(s => !['Served','Lifted'].includes(s.status))
  const closed  = sanctions.filter(s => ['Served','Lifted'].includes(s.status))

  function SanctionCard({ s }) {
    const st = STATUS_STYLE[s.status] || { bg:'#eee', color:'#333', label:s.status }
    const sv = SEV_STYLE[s.severity] || { bg:'#eee', color:'#333' }
    const isNTE = s.status === 'NTE Issued'
    return (
      <div onClick={() => setSelected(s)} style={{ background:'white', border:`1.5px solid ${isNTE ? '#f5b8ca' : '#e8ddd0'}`, borderRadius:12, padding:16, cursor:'pointer', marginBottom:12, transition:'box-shadow 0.15s', boxShadow: selected?.id === s.id ? '0 4px 16px rgba(0,0,0,0.1)' : 'none' }}>
        {isNTE && (
          <div style={{ background:'#fde8ee', border:'1px solid #f5b8ca', borderRadius:8, padding:'8px 12px', marginBottom:12, fontSize:12, color:'#c0392b', fontWeight:600 }}>
            ⚠️ Action Required — You must respond to this NTE within 5 calendar days.
          </div>
        )}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:10, marginBottom:8 }}>
          <div>
            <span style={{ fontSize:11, fontWeight:700, color:'#bbb', fontFamily:'monospace' }}>{s.violation_code}</span>
            <div style={{ fontSize:14, fontWeight:700, color:'#1a1208', marginTop:2 }}>{s.violation_title}</div>
            <div style={{ fontSize:12, color:'#888', marginTop:2 }}>{s.category} · {s.offense_number}{['st','nd','rd','th','th'][s.offense_number-1]} Offense</div>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:5, alignItems:'flex-end' }}>
            <span style={{ background:sv.bg, color:sv.color, borderRadius:20, padding:'2px 10px', fontSize:10, fontWeight:700, whiteSpace:'nowrap' }}>{s.severity}</span>
            <span style={{ background:st.bg, color:st.color, borderRadius:20, padding:'2px 10px', fontSize:10, fontWeight:700, whiteSpace:'nowrap' }}>{st.label}</span>
          </div>
        </div>
        <div style={{ background:'#f5f0e8', borderRadius:8, padding:'8px 12px', fontSize:12 }}>
          <span style={{ fontWeight:700, color:'#5a4a3a' }}>Sanction: </span>
          <span style={{ color:'#1a1208' }}>{s.sanction_type}</span>
        </div>
        {s.suspension_days && (
          <div style={{ marginTop:8, fontSize:12, color:'#c0392b' }}>
            🚫 {s.suspension_days}-day suspension
            {s.suspension_start ? ` · ${fmtDate(s.suspension_start)}` : ''}
            {s.suspension_end ? ` → ${fmtDate(s.suspension_end)}` : ''}
          </div>
        )}
        <div style={{ marginTop:8, fontSize:11, color:'#bbb' }}>Issued {fmtDT(s.created_at)}</div>
      </div>
    )
  }

  return (
    <PortalShell>
      <div style={{ padding:'24px 20px', fontFamily:"'DM Sans',sans-serif", maxWidth:640, margin:'0 auto' }}>

        <div style={{ marginBottom:24 }}>
          <h1 style={{ margin:0, fontSize:20, fontWeight:800, color:'#1a1208' }}>⚖️ My Sanctions</h1>
          <p style={{ margin:'6px 0 0', fontSize:13, color:'#888' }}>Your disciplinary record. All actions follow due process — NTE first, then NOD.</p>
        </div>

        {loading ? (
          <div style={{ textAlign:'center', padding:60, color:'#888' }}>Loading…</div>
        ) : sanctions.length === 0 ? (
          <div style={{ textAlign:'center', padding:60 }}>
            <div style={{ fontSize:40, marginBottom:12 }}>✅</div>
            <div style={{ fontSize:15, fontWeight:700, color:'#1a1208', marginBottom:6 }}>Clean record</div>
            <div style={{ fontSize:13, color:'#888' }}>No sanctions on file. Keep it up! 💚</div>
          </div>
        ) : (
          <>
            {active.length > 0 && (
              <div style={{ marginBottom:28 }}>
                <div style={{ fontSize:12, fontWeight:700, color:'#c0392b', marginBottom:12, textTransform:'uppercase', letterSpacing:1 }}>Active ({active.length})</div>
                {active.map(s => <SanctionCard key={s.id} s={s} />)}
              </div>
            )}

            {closed.length > 0 && (
              <div>
                <div style={{ fontSize:12, fontWeight:700, color:'#888', marginBottom:12, textTransform:'uppercase', letterSpacing:1 }}>Closed ({closed.length})</div>
                {closed.map(s => <SanctionCard key={s.id} s={s} />)}
              </div>
            )}
          </>
        )}

        {/* Detail drawer */}
        {selected && (
          <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:1000, display:'flex', alignItems:'flex-end', justifyContent:'center' }}>
            <div style={{ background:'#fffdf9', borderRadius:'16px 16px 0 0', width:'100%', maxWidth:640, maxHeight:'85vh', overflowY:'auto', padding:24 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
                <h2 style={{ margin:0, fontSize:16, fontWeight:700, color:'#1a1208' }}>Sanction Detail</h2>
                <button onClick={() => setSelected(null)} style={{ background:'none', border:'none', fontSize:20, cursor:'pointer', color:'#888' }}>×</button>
              </div>

              <div style={{ fontSize:11, fontWeight:700, color:'#bbb', fontFamily:'monospace', marginBottom:4 }}>{selected.violation_code}</div>
              <div style={{ fontSize:15, fontWeight:700, color:'#1a1208', marginBottom:4 }}>{selected.violation_title}</div>
              <div style={{ fontSize:12, color:'#888', marginBottom:16 }}>{selected.category} · {selected.severity} · {selected.offense_number}{['st','nd','rd','th','th'][selected.offense_number-1]} Offense</div>

              {/* Status */}
              {(() => {
                const st = STATUS_STYLE[selected.status] || { bg:'#eee', color:'#333', label:selected.status }
                return <div style={{ background:st.bg, color:st.color, borderRadius:8, padding:'10px 14px', fontSize:13, fontWeight:600, marginBottom:16 }}>{st.label}</div>
              })()}

              {/* Twin-notice timeline */}
              <div style={{ background:'#f5f0e8', borderRadius:10, padding:14, marginBottom:16 }}>
                <div style={{ fontSize:12, fontWeight:700, color:'#5a4a3a', marginBottom:10 }}>DUE PROCESS TIMELINE</div>
                {[
                  { label:'Sanction Created', date:selected.created_at, done:true },
                  { label:'Notice to Explain (NTE)', date:selected.nte_issued_at, done:!!selected.nte_issued_at, note:'You have 5 calendar days to respond' },
                  { label:'Your Explanation', date:null, done:!!selected.explanation_text, note: selected.explanation_text ? 'Received' : 'Not yet submitted' },
                  { label:'Notice of Decision (NOD)', date:selected.nod_issued_at, done:!!selected.nod_issued_at },
                  { label:'Sanction Served', date:selected.notified_at, done:selected.status === 'Served' },
                ].map((step, i) => (
                  <div key={i} style={{ display:'flex', gap:10, marginBottom:8, alignItems:'flex-start' }}>
                    <span style={{ fontSize:14, minWidth:20 }}>{step.done ? '✅' : '⬜'}</span>
                    <div>
                      <div style={{ fontSize:12, fontWeight:600, color: step.done ? '#1a1208' : '#aaa' }}>{step.label}</div>
                      {step.date && <div style={{ fontSize:11, color:'#888' }}>{fmtDT(step.date)}</div>}
                      {step.note && <div style={{ fontSize:11, color: step.done ? '#4a7a1e' : '#a06000' }}>{step.note}</div>}
                    </div>
                  </div>
                ))}
              </div>

              {selected.sanction_type && (
                <div style={{ background:'#fde8ee', borderRadius:8, padding:12, marginBottom:16, fontSize:13 }}>
                  <div style={{ fontWeight:700, color:'#c0392b', marginBottom:2 }}>Your Sanction</div>
                  <div style={{ color:'#1a1208' }}>{selected.sanction_type}</div>
                  {selected.suspension_days && (
                    <div style={{ fontSize:12, color:'#c0392b', marginTop:4 }}>
                      {selected.suspension_days}-day suspension
                      {selected.suspension_start ? ` · Starts ${fmtDate(selected.suspension_start)}` : ''}
                      {selected.suspension_end ? ` · Ends ${fmtDate(selected.suspension_end)}` : ''}
                    </div>
                  )}
                </div>
              )}

              <div style={{ background:'#e8f0fb', border:'1px solid #b8cff5', borderRadius:8, padding:12, fontSize:12, color:'#2d5a8a', lineHeight:1.6 }}>
                If you believe this sanction was issued in error, speak directly with HR or Management. All concerns are handled confidentially.
              </div>
            </div>
          </div>
        )}
      </div>
    </PortalShell>
  )
}
