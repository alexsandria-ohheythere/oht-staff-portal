'use client'
export const dynamic = 'force-dynamic'
import { useState, useEffect } from 'react'
import PortalShell from '../../../components/PortalShell'
import { createClient } from '../../../lib/supabase'

const CATEGORIES = ['Attendance','Shift Coverage','Conduct','Dress Code','Anti-Discrimination','Workplace Conduct','Operations','Food Safety','Confidentiality','Health & Safety','Negligence']

const SEV_STYLE = {
  Minor:    { bg:'#eef7e4', color:'#4a7a1e' },
  Moderate: { bg:'#fef3e2', color:'#a06000' },
  Major:    { bg:'#fde8ee', color:'#c0392b' },
  Grave:    { bg:'#2d0a0a', color:'#ff6b6b' },
}

const CAT_ICONS = {
  'Attendance':          '🕐',
  'Shift Coverage':      '🔄',
  'Conduct':             '💬',
  'Dress Code':          '👕',
  'Anti-Discrimination': '🏳️‍🌈',
  'Workplace Conduct':   '🏢',
  'Operations':          '⚙️',
  'Food Safety':         '🧼',
  'Confidentiality':     '🔒',
  'Health & Safety':     '🩺',
  'Negligence':          '⚠️',
}

export default function StaffHandbookPage() {
  const [entries, setEntries]     = useState([])
  const [loading, setLoading]     = useState(true)
  const [staffRole, setStaffRole] = useState(null)
  const [search, setSearch]       = useState('')
  const [catFilter, setCat]       = useState('all')
  const [sevFilter, setSev]       = useState('all')
  const [expanded, setExpanded]   = useState({})

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) return
      const { data: staffData } = await supabase.from('staff').select('role').eq('email', session.user.email).single()
      setStaffRole(staffData?.role || null)

      const { data } = await supabase.from('handbook_entries').select('*').eq('is_active', true).order('violation_code')
      setEntries(data || [])
      setLoading(false)
    })
  }, [])

  function toggleExpand(id) { setExpanded(e => ({ ...e, [id]: !e[id] })) }

  const filtered = entries.filter(e => {
    if (catFilter !== 'all' && e.category !== catFilter) return false
    if (sevFilter !== 'all' && e.severity !== sevFilter) return false
    if (search.trim()) {
      const q = search.toLowerCase()
      if (!e.title.toLowerCase().includes(q) && !e.violation_code.toLowerCase().includes(q) && !(e.description||'').toLowerCase().includes(q)) return false
    }
    // Role filter — if applies_to is empty, show to all
    if (staffRole && e.applies_to && e.applies_to.length > 0) {
      if (!e.applies_to.includes(staffRole)) return false
    }
    return true
  })

  const grouped = CATEGORIES.reduce((acc, cat) => {
    const items = filtered.filter(e => e.category === cat)
    if (items.length) acc[cat] = items
    return acc
  }, {})

  const iStyle = { width:'100%', background:'white', border:'1px solid #d8cebb', borderRadius:8, padding:'9px 12px', fontSize:13, fontFamily:"'DM Sans',sans-serif", color:'#1a1208', outline:'none', boxSizing:'border-box' }

  return (
    <PortalShell>
      <div style={{ padding:'24px 20px', fontFamily:"'DM Sans',sans-serif", maxWidth:700, margin:'0 auto' }}>

        {/* Header */}
        <div style={{ marginBottom:24 }}>
          <h1 style={{ margin:0, fontSize:20, fontWeight:800, color:'#1a1208' }}>📖 Company Handbook</h1>
          <p style={{ margin:'6px 0 0', fontSize:13, color:'#888' }}>
            OHT policies and violation guidelines — Version 2026. Know the rules, protect the vibe.
          </p>
        </div>

        {/* Quick-reference severity guide */}
        <div style={{ background:'white', border:'1px solid #e8ddd0', borderRadius:12, padding:16, marginBottom:20 }}>
          <div style={{ fontSize:12, fontWeight:700, color:'#5a4a3a', marginBottom:10 }}>OFFENSE SEVERITY GUIDE</div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:8, fontSize:12 }}>
            {[
              { s:'Minor', desc:'Verbal → Written → Final Warning + 3-day Susp → Termination' },
              { s:'Moderate', desc:'Verbal/Written → Final Warning → NTE + 3-day Susp → Termination' },
              { s:'Major', desc:'Verbal Warning → IR + Final Warning/Susp → Termination' },
              { s:'Grave', desc:'Immediate Termination' },
            ].map(({ s, desc }) => {
              const st = SEV_STYLE[s]
              return (
                <div key={s} style={{ background:st.bg, borderRadius:8, padding:'8px 12px' }}>
                  <div style={{ fontWeight:700, color:st.color, marginBottom:2 }}>{s}</div>
                  <div style={{ color:st.color, opacity:0.8, fontSize:11 }}>{desc}</div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Filters */}
        <div style={{ display:'flex', gap:10, flexWrap:'wrap', marginBottom:16 }}>
          <input style={{ ...iStyle, maxWidth:240 }} placeholder="🔍 Search violations…" value={search} onChange={e => setSearch(e.target.value)} />
          <select style={{ ...iStyle, maxWidth:180 }} value={catFilter} onChange={e => setCat(e.target.value)}>
            <option value="all">All Categories</option>
            {CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>
          <select style={{ ...iStyle, maxWidth:150 }} value={sevFilter} onChange={e => setSev(e.target.value)}>
            <option value="all">All Severities</option>
            {['Minor','Moderate','Major','Grave'].map(s => <option key={s}>{s}</option>)}
          </select>
        </div>

        <div style={{ fontSize:12, color:'#888', marginBottom:16 }}>{filtered.length} violation{filtered.length !== 1 ? 's' : ''} shown</div>

        {loading ? (
          <div style={{ textAlign:'center', padding:60, color:'#888' }}>Loading handbook…</div>
        ) : Object.keys(grouped).length === 0 ? (
          <div style={{ textAlign:'center', padding:60, color:'#888' }}>No violations found.</div>
        ) : (
          Object.entries(grouped).map(([cat, items]) => (
            <div key={cat} style={{ marginBottom:24 }}>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
                <span style={{ fontSize:16 }}>{CAT_ICONS[cat] || '📋'}</span>
                <span style={{ fontSize:13, fontWeight:700, color:'#1a1208' }}>{cat}</span>
                <span style={{ fontSize:11, color:'#888', background:'#f0ebe3', borderRadius:20, padding:'1px 8px' }}>{items.length}</span>
              </div>
              <div style={{ background:'white', borderRadius:12, border:'1px solid #e8ddd0', overflow:'hidden' }}>
                {items.map((e, i) => {
                  const st = SEV_STYLE[e.severity]
                  const isOpen = expanded[e.id]
                  const sanctions = [e.sanction_1st, e.sanction_2nd, e.sanction_3rd, e.sanction_4th, e.sanction_5th].filter(Boolean)
                  return (
                    <div key={e.id} style={{ borderBottom: i < items.length-1 ? '1px solid #f0ebe3':'none' }}>
                      <div onClick={() => toggleExpand(e.id)} style={{ display:'flex', alignItems:'flex-start', gap:12, padding:'14px 16px', cursor:'pointer' }}>
                        <span style={{ fontSize:11, fontWeight:700, color:'#bbb', fontFamily:'monospace', minWidth:48, marginTop:2 }}>{e.violation_code}</span>
                        <div style={{ flex:1 }}>
                          <div style={{ fontSize:13, fontWeight:600, color:'#1a1208' }}>{e.title}</div>
                          <div style={{ fontSize:11, color:'#888', marginTop:3 }}>
                            {sanctions.map((s, si) => <span key={si} style={{ marginRight:4 }}>{si>0?'→':''}{s}</span>)}
                          </div>
                        </div>
                        <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                          <span style={{ background:st.bg, color:st.color, borderRadius:20, padding:'2px 10px', fontSize:10, fontWeight:700 }}>{e.severity}</span>
                          <span style={{ color:'#888', fontSize:13 }}>{isOpen ? '▲' : '▼'}</span>
                        </div>
                      </div>
                      {isOpen && (
                        <div style={{ padding:'0 16px 16px 76px' }}>
                          {e.description && (
                            <div style={{ fontSize:13, color:'#5a4a3a', marginBottom:12, lineHeight:1.6 }}>{e.description}</div>
                          )}
                          <div style={{ fontSize:12, fontWeight:700, color:'#5a4a3a', marginBottom:6 }}>SANCTION PROGRESSION</div>
                          <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                            {sanctions.map((s, si) => (
                              <div key={si} style={{ display:'flex', alignItems:'center', gap:10 }}>
                                <span style={{ fontSize:11, fontWeight:700, color:'#888', minWidth:60 }}>{si+1}{['st','nd','rd','th','th'][si]} Offense</span>
                                <span style={{ flex:1, height:1, background:'#e8ddd0' }} />
                                <span style={{ fontSize:12, fontWeight:600, color:'#1a1208' }}>{s}</span>
                              </div>
                            ))}
                          </div>
                          {e.applies_to && e.applies_to.length > 0 && (
                            <div style={{ marginTop:10, fontSize:11, color:'#888' }}>
                              Applies to: {e.applies_to.join(', ')}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))
        )}

        <div style={{ marginTop:32, background:'#fde8ee', border:'1px solid #f5b8ca', borderRadius:12, padding:16, fontSize:12, color:'#c0392b', lineHeight:1.6 }}>
          <strong>Important:</strong> All disciplinary actions follow the twin-notice rule — you will receive a Notice to Explain (NTE) before any decision is made. You have 5 calendar days to respond. A Notice of Decision (NOD) will be issued after your explanation is reviewed. If you have questions about any policy, speak with HR or Management.
        </div>
      </div>
    </PortalShell>
  )
}
