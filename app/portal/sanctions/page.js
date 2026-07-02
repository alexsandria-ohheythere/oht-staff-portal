'use client'
export const dynamic = 'force-dynamic'
import { useState, useEffect } from 'react'
import PortalShell from '../../../components/PortalShell'
import { createClient } from '../../../lib/supabase'

// Due process (the chance to explain) now happens earlier, during the Investigation
// stage of the related incident report — see Incident Report > Reports Involving Me.
// By the time a record lands here, it's a finalized outcome, not a step in an ongoing
// process. Only Appealed/Lifted are shown as distinct statuses; everything else is
// just "Final".
const STATUS_STYLE = {
  'Appealed': { bg:'#f5eeff', color:'#7a3a8a', label:'Under Appeal' },
  'Lifted':   { bg:'#f0f0f0', color:'#666',    label:'Lifted' },
}
const DEFAULT_STATUS_STYLE = { bg:'#eef7e4', color:'#4a7a1e', label:'Final' }

const SEV_STYLE = {
  Minor:    { bg:'#eef7e4', color:'#4a7a1e' },
  Moderate: { bg:'#fef3e2', color:'#a06000' },
  Major:    { bg:'#fde8ee', color:'#c0392b' },
  Grave:    { bg:'#2d0a0a', color:'#ff6b6b' },
}

const fmtDate = s => s ? new Date(s + 'T00:00:00').toLocaleDateString('en-PH', { month:'long', day:'numeric', year:'numeric' }) : '—'
const fmtDT   = s => s ? new Date(s).toLocaleDateString('en-PH', { month:'short', day:'numeric', year:'numeric', hour:'numeric', minute:'2-digit' }) : '—'

export default function MyFinalSanctionsPage() {
  const [sanctions, setSanctions] = useState([])
  const [loading, setLoading]     = useState(true)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) return
      const { data: staffData } = await supabase.from('staff').select('id').eq('email', session.user.email).single()
      if (!staffData) return setLoading(false)
      const { data } = await supabase.from('sanctions').select('*').eq('staff_id', staffData.id).order('created_at', { ascending: false })
      setSanctions(data || [])
      setLoading(false)
    })
  }, [])

  function SanctionCard({ s }) {
    const st = STATUS_STYLE[s.status] || DEFAULT_STATUS_STYLE
    const sv = SEV_STYLE[s.severity] || { bg:'#eee', color:'#333' }
    return (
      <div style={{ background:'white', border:'1px solid #d8cebb', borderRadius:13, padding:'14px 16px', marginBottom:10 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:10, marginBottom:8 }}>
          <div>
            <span style={{ fontSize:11, fontWeight:700, color:'#9a8a7a', fontFamily:"'DM Mono',monospace" }}>{s.violation_code}</span>
            <div style={{ fontSize:14, fontWeight:700, color:'#1a1208', marginTop:2 }}>{s.violation_title}</div>
            <div style={{ fontSize:12, color:'#7a6a50', marginTop:2 }}>{s.category} · {s.offense_number}{['st','nd','rd','th','th'][s.offense_number-1]} Offense</div>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:5, alignItems:'flex-end', flexShrink:0 }}>
            <span style={{ background:sv.bg, color:sv.color, borderRadius:20, padding:'2px 10px', fontSize:10, fontWeight:700, whiteSpace:'nowrap' }}>{s.severity}</span>
            <span style={{ background:st.bg, color:st.color, borderRadius:20, padding:'2px 10px', fontSize:10, fontWeight:700, whiteSpace:'nowrap' }}>{st.label}</span>
          </div>
        </div>

        <div style={{ background:'#fde8ee', borderRadius:8, padding:'10px 12px', marginBottom: s.admin_notes ? 8 : 0 }}>
          <div style={{ fontSize:11, fontWeight:700, color:'#c0392b', marginBottom:2 }}>Final Sanction Issued</div>
          <div style={{ fontSize:12, color:'#1a1208' }}>{s.sanction_type}</div>
          {s.suspension_days && (
            <div style={{ fontSize:11, color:'#c0392b', marginTop:4 }}>
              🚫 {s.suspension_days}-day suspension
              {s.suspension_start ? ` · Starts ${fmtDate(s.suspension_start)}` : ''}
              {s.suspension_end ? ` · Ends ${fmtDate(s.suspension_end)}` : ''}
            </div>
          )}
        </div>

        {s.admin_notes && (
          <div style={{ background:'#f5f0e8', borderRadius:8, padding:'9px 12px', fontSize:11, color:'#5a4a3a', lineHeight:1.5, marginBottom:8 }}>
            <strong>Notes:</strong> {s.admin_notes}
          </div>
        )}

        <div style={{ fontSize:10, color:'#9a8a7a' }}>Issued {fmtDT(s.created_at)}</div>
      </div>
    )
  }

  return (
    <PortalShell>
      <div style={{ background:'white', borderBottom:'1px solid #d8cebb', padding:'0 24px', height:56, display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
        <div>
          <div style={{ fontFamily:"'Montserrat',sans-serif", fontSize:17, fontWeight:700 }}>⚖️ My Final Sanctions</div>
          <div style={{ fontSize:11, color:'#7a6a50', marginTop:1 }}>{sanctions.length} on record</div>
        </div>
      </div>

      <div style={{ flex:1, overflow:'auto', padding:'16px 20px' }}>
        <div style={{ background:'#e8f0fb', border:'1px solid #b8cff5', borderRadius:8, padding:'10px 12px', fontSize:11, color:'#2d5a8a', lineHeight:1.5, marginBottom:14 }}>
          Your chance to explain happens during the related incident report's Investigation stage — see Incident Report → Reports Involving Me. What's shown here are finalized outcomes only.
        </div>

        {loading ? (
          <div style={{ textAlign:'center', padding:'60px', color:'#7a6a50' }}>Loading…</div>
        ) : sanctions.length === 0 ? (
          <div style={{ textAlign:'center', padding:'60px', background:'white', border:'1px solid #d8cebb', borderRadius:13 }}>
            <div style={{ fontSize:40, marginBottom:12 }}>✅</div>
            <div style={{ fontFamily:"'Montserrat',sans-serif", fontSize:15, fontWeight:700, marginBottom:6 }}>Clean record</div>
            <div style={{ fontSize:12, color:'#7a6a50' }}>No sanctions on file. Keep it up! 💚</div>
          </div>
        ) : (
          sanctions.map(s => <SanctionCard key={s.id} s={s} />)
        )}
      </div>
    </PortalShell>
  )
}
