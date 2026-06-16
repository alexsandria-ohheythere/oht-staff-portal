'use client'
export const dynamic = 'force-dynamic'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import PortalShell from '../../../components/PortalShell'
import { createClient } from '../../../lib/supabase'

const DEPARTMENTS = [
  { key: 'bar',         label: 'Bar',         icon: '🍵', roles: ['Senior Barista'] },
  { key: 'commissary',  label: 'Commissary',  icon: '🍳', roles: ['Executive Chef','Sous Chef','Kitchen Staff'] },
  { key: 'utility',     label: 'Utility',     icon: '🧹', roles: ['Cafe Operations Support'] },
  { key: 'operations',  label: 'Operations',  icon: '📋', roles: ['Cafe Supervisor'] },
]

const FLAG_STYLES = {
  ok:  { label: 'OK',  bg: '#f0fdf4', color: '#16a34a', border: '#86efac' },
  rl:  { label: 'RL',  bg: '#fef3c7', color: '#92400e', border: '#fcd34d' },
  '86': { label: '86', bg: '#fee2e2', color: '#991b1b', border: '#fca5a5' },
}

export default function DailyInventoryPage() {
  const router = useRouter()
  const [step, setStep]           = useState('select') // select | form | confirm
  const [staffId, setStaffId]     = useState(null)
  const [staffRole, setStaffRole] = useState('')
  const [department, setDept]     = useState(null)
  const [shift, setShift]         = useState(null)
  const [template, setTemplate]   = useState([]) // grouped sections
  const [items, setItems]         = useState([]) // flat with actual_qty, flag
  const [amReport, setAmReport]   = useState(null)
  const [loading, setLoading]     = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [toast, setToast]         = useState(null)
  const [existingReport, setExistingReport] = useState(null)

  function showToast(icon, msg) {
    setToast({ icon, msg })
    setTimeout(() => setToast(null), 3500)
  }

  useEffect(() => {
    const sb = createClient()
    sb.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) return
      const { data: staff } = await sb.from('staff').select('id, role').eq('email', session.user.email).single()
      if (staff) { setStaffId(staff.id); setStaffRole(staff.role || '') }
    })
  }, [])

  const loadTemplate = async (dept, sh) => {
    setLoading(true)
    const sb = createClient()
    const today = new Date().toISOString().split('T')[0]

    // Check if report already submitted
    const { data: existing } = await sb.from('inventory_reports')
      .select('*').eq('department', dept).eq('shift', sh).eq('report_date', today).single()
    if (existing) { setExistingReport(existing); setLoading(false); return }

    // Load AM report for reference if PM
    if (sh === 'pm') {
      const { data: am } = await sb.from('inventory_reports')
        .select('*, items:inventory_report_items(*)').eq('department', dept).eq('shift', 'am').eq('report_date', today).single()
      setAmReport(am)
    }

    // Load template
    const { data: tmpl } = await sb.from('stock_templates')
      .select('*').eq('department', dept).eq('is_active', true).order('sort_order')

    if (!tmpl || tmpl.length === 0) {
      // Empty template for utility/operations
      setItems([{ id: 'new-1', section: 'General', item_name: '', unit: 'pcs', threshold_qty: 0, actual_qty: '', flag: 'ok', isCustom: true }])
    } else {
      setItems(tmpl.map(t => ({
        ...t,
        actual_qty: '',
        flag: 'ok',
        isCustom: false,
      })))
    }
    setLoading(false)
    setStep('form')
  }

  const handleSelect = async (dept, sh) => {
    setDept(dept)
    setShift(sh)
    await loadTemplate(dept, sh)
  }

  const updateItem = (id, field, value) => {
    setItems(prev => prev.map(item => {
      if (item.id !== id) return item
      const updated = { ...item, [field]: value }
      // Auto-flag based on qty
      if (field === 'actual_qty') {
        const qty = parseFloat(value)
        if (!isNaN(qty) && updated.threshold_qty > 0) {
          updated.flag = qty <= 0 ? '86' : qty < updated.threshold_qty ? 'rl' : 'ok'
        }
      }
      return updated
    }))
  }

  const removeItem = (id) => setItems(prev => prev.filter(i => i.id !== id))

  const addCustomItem = (section) => {
    setItems(prev => [...prev, {
      id: `custom-${Date.now()}`,
      section,
      item_name: '',
      unit: 'pcs',
      threshold_qty: 0,
      actual_qty: '',
      flag: 'ok',
      isCustom: true,
    }])
  }

  const handleSubmit = async () => {
    if (items.some(i => i.item_name && i.actual_qty === '')) {
      return showToast('⚠️', 'Please enter counts for all items')
    }
    setSubmitting(true)
    const sb = createClient()
    const today = new Date().toISOString().split('T')[0]

    const { data: report, error: rErr } = await sb.from('inventory_reports').insert({
      department,
      shift,
      report_date: today,
      submitted_by: staffId,
      status: 'submitted',
      submitted_at: new Date().toISOString(),
    }).select().single()

    if (rErr) { showToast('❌', rErr.message); setSubmitting(false); return }

    const reportItems = items.filter(i => i.item_name.trim()).map(i => ({
      report_id: report.id,
      section: i.section,
      item_name: i.item_name,
      unit: i.unit,
      threshold_qty: i.threshold_qty ?? 0,
      actual_qty: parseFloat(i.actual_qty) || 0,
      flag: i.flag,
      sort_order: i.sort_order ?? 0,
    }))

    const { error: iErr } = await sb.from('inventory_report_items').insert(reportItems)
    if (iErr) { showToast('❌', iErr.message); setSubmitting(false); return }

    showToast('✅', 'Inventory report submitted!')
    setTimeout(() => router.push('/inventory/my-reports'), 1500)
    setSubmitting(false)
  }

  // Group items by section
  const sections = items.reduce((acc, item) => {
    if (!acc[item.section]) acc[item.section] = []
    acc[item.section].push(item)
    return acc
  }, {})

  const flaggedItems = items.filter(i => i.flag !== 'ok' && i.item_name)

  return (
    <PortalShell>
      <div style={{ background:'white', borderBottom:'1px solid #d8cebb', padding:'0 24px', height:56, display:'flex', alignItems:'center', gap:10, flexShrink:0 }}>
        {step !== 'select' && (
          <button onClick={() => { setStep('select'); setExistingReport(null) }}
            style={{ background:'transparent', border:'none', cursor:'pointer', fontSize:18, color:'#7a6a50', padding:'0 4px' }}>←</button>
        )}
        <div style={{ fontFamily:"'Montserrat',sans-serif", fontSize:17, fontWeight:700, color:'#1a1208' }}>
          {step === 'select' ? 'Daily Inventory' : `${DEPARTMENTS.find(d=>d.key===department)?.label} — ${shift?.toUpperCase()} Shift`}
        </div>
      </div>

      <div style={{ flex:1, overflowY:'auto', padding:'22px 24px' }}>

        {/* STEP 1: Select department + shift */}
        {step === 'select' && (
          <div>
            <p style={{ fontSize:13, color:'#7a6a50', marginBottom:20 }}>Select your department and shift to begin today's inventory count.</p>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:28 }}>
              {DEPARTMENTS.map(dept => (
                <div key={dept.key} style={{ background:'white', border:'1px solid #d8cebb', borderRadius:13, padding:20 }}>
                  <div style={{ fontSize:28, marginBottom:8 }}>{dept.icon}</div>
                  <div style={{ fontFamily:"'Montserrat',sans-serif", fontSize:14, fontWeight:700, color:'#1a1208', marginBottom:12 }}>{dept.label}</div>
                  <div style={{ display:'flex', gap:8 }}>
                    {['am','pm'].map(sh => (
                      <button key={sh} onClick={() => handleSelect(dept.key, sh)}
                        style={{ flex:1, padding:'8px', fontSize:12, fontWeight:700, border:'1px solid #d8cebb', borderRadius:8, background: sh==='am'?'#fef3e2':'#e8f0fb', color: sh==='am'?'#92400e':'#1e40af', cursor:'pointer', fontFamily:"'DM Sans',sans-serif", textTransform:'uppercase' }}>
                        {sh} Shift
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Already submitted */}
        {existingReport && (
          <div style={{ textAlign:'center', padding:60, background:'white', border:'1px solid #d8cebb', borderRadius:13 }}>
            <div style={{ fontSize:40, marginBottom:12 }}>✅</div>
            <div style={{ fontFamily:"'Montserrat',sans-serif", fontSize:15, fontWeight:700, color:'#1a1208', marginBottom:6 }}>
              Already submitted
            </div>
            <p style={{ fontSize:13, color:'#7a6a50', marginBottom:20 }}>
              The {shift?.toUpperCase()} inventory for {DEPARTMENTS.find(d=>d.key===department)?.label} was already submitted today.
            </p>
            <button onClick={() => router.push('/inventory/my-reports')}
              style={{ background:'#EF4576', color:'white', border:'none', borderRadius:8, padding:'9px 20px', fontSize:12, fontWeight:700, cursor:'pointer' }}>
              View my reports →
            </button>
          </div>
        )}

        {/* Loading */}
        {loading && <div style={{ textAlign:'center', padding:60, color:'#7a6a50', fontSize:13 }}>Loading checklist…</div>}

        {/* STEP 2: Inventory form */}
        {step === 'form' && !loading && !existingReport && (
          <>
            {/* AM reference banner for PM */}
            {shift === 'pm' && amReport && (
              <div style={{ background:'#e8f0fb', border:'1px solid #93c5fd', borderRadius:10, padding:'10px 14px', marginBottom:16, fontSize:12, color:'#1e40af' }}>
                📋 AM report submitted — counts shown as reference. Enter your own PM counts below.
              </div>
            )}
            {shift === 'pm' && !amReport && (
              <div style={{ background:'#fef3e2', border:'1px solid #fcd34d', borderRadius:10, padding:'10px 14px', marginBottom:16, fontSize:12, color:'#92400e' }}>
                ⚠️ No AM report found for today. You're submitting the first count.
              </div>
            )}

            {/* Sections */}
            {Object.entries(sections).map(([section, sectionItems]) => (
              <div key={section} style={{ marginBottom:20 }}>
                <div style={{ fontSize:10, fontWeight:700, letterSpacing:1.5, textTransform:'uppercase', color:'#7a6a50', marginBottom:10, paddingBottom:6, borderBottom:'1px solid #e8e0d5' }}>
                  {section}
                </div>
                <div style={{ background:'white', border:'1px solid #d8cebb', borderRadius:12, overflow:'hidden' }}>
                  {sectionItems.map((item, idx) => {
                    const amItem = amReport?.items?.find(a => a.item_name === item.item_name)
                    const fs = FLAG_STYLES[item.flag] ?? FLAG_STYLES.ok
                    return (
                      <div key={item.id} style={{ padding:'12px 14px', borderBottom: idx < sectionItems.length-1 ? '1px solid #f0ede8' : 'none', background: item.flag !== 'ok' ? fs.bg : 'white' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                          <div style={{ flex:1, minWidth:0 }}>
                            {item.isCustom ? (
                              <input type="text" value={item.item_name} onChange={e => updateItem(item.id, 'item_name', e.target.value)}
                                placeholder="Item name"
                                style={{ width:'100%', border:'1px solid #d8cebb', borderRadius:6, padding:'6px 10px', fontSize:13, outline:'none', boxSizing:'border-box' }} />
                            ) : (
                              <div style={{ fontSize:13, fontWeight:600, color:'#1a1208' }}>{item.item_name}</div>
                            )}
                            <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:2 }}>
                              <span style={{ fontSize:11, color:'#aaa' }}>Threshold: {item.threshold_qty} {item.unit}</span>
                              {amItem && <span style={{ fontSize:11, color:'#2d5a8a' }}>AM count: {amItem.actual_qty}</span>}
                            </div>
                          </div>

                          {/* Qty input */}
                          <div style={{ display:'flex', alignItems:'center', gap:6, flexShrink:0 }}>
                            <input type="number" min="0" value={item.actual_qty}
                              onChange={e => updateItem(item.id, 'actual_qty', e.target.value)}
                              placeholder="0"
                              style={{ width:70, border:`1px solid ${item.flag!=='ok'?fs.border:'#d8cebb'}`, borderRadius:8, padding:'6px 8px', fontSize:13, outline:'none', textAlign:'center', background:'white' }} />
                            <span style={{ fontSize:11, color:'#7a6a50', minWidth:30 }}>{item.unit}</span>
                          </div>

                          {/* Flag toggle */}
                          <div style={{ display:'flex', gap:4, flexShrink:0 }}>
                            {['ok','rl','86'].map(f => (
                              <button key={f} onClick={() => updateItem(item.id, 'flag', f)}
                                style={{ padding:'4px 8px', fontSize:10, fontWeight:700, borderRadius:6, border:`1px solid ${item.flag===f?FLAG_STYLES[f].border:'#e0d8ce'}`, background:item.flag===f?FLAG_STYLES[f].bg:'white', color:item.flag===f?FLAG_STYLES[f].color:'#aaa', cursor:'pointer' }}>
                                {f.toUpperCase()}
                              </button>
                            ))}
                          </div>

                          {/* Remove */}
                          <button onClick={() => removeItem(item.id)}
                            style={{ background:'transparent', border:'none', color:'#ddd', cursor:'pointer', fontSize:16, padding:'0 2px', flexShrink:0 }}>✕</button>
                        </div>
                      </div>
                    )
                  })}
                </div>
                <button onClick={() => addCustomItem(section)}
                  style={{ marginTop:6, background:'transparent', border:'1px dashed #d8cebb', borderRadius:8, color:'#7a6a50', padding:'6px 14px', fontSize:11, fontWeight:600, cursor:'pointer', width:'100%' }}>
                  + Add item to {section}
                </button>
              </div>
            ))}

            {/* Summary of flagged */}
            {flaggedItems.length > 0 && (
              <div style={{ background:'#fef3c7', border:'1px solid #fcd34d', borderRadius:12, padding:16, marginBottom:16 }}>
                <div style={{ fontSize:12, fontWeight:700, color:'#92400e', marginBottom:10 }}>
                  🚩 {flaggedItems.length} item{flaggedItems.length!==1?'s':''} flagged for restocking
                </div>
                {flaggedItems.map(item => (
                  <div key={item.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', fontSize:12, color:'#92400e', padding:'3px 0' }}>
                    <span>{item.item_name}</span>
                    <span style={{ fontWeight:700, padding:'1px 8px', borderRadius:6, background: FLAG_STYLES[item.flag].bg, color: FLAG_STYLES[item.flag].color, border:`1px solid ${FLAG_STYLES[item.flag].border}` }}>
                      {item.flag.toUpperCase()} — {item.actual_qty} {item.unit}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display:'flex', gap:10, paddingBottom:24 }}>
              <button onClick={() => setStep('select')}
                style={{ background:'transparent', color:'#7a6a50', border:'1px solid #d8cebb', borderRadius:8, padding:'10px 18px', fontSize:12, cursor:'pointer' }}>
                Cancel
              </button>
              <button onClick={handleSubmit} disabled={submitting}
                style={{ flex:1, background:'#EF4576', color:'white', border:'none', borderRadius:8, padding:10, fontSize:13, fontWeight:700, cursor:'pointer', opacity:submitting?0.6:1 }}>
                {submitting ? 'Submitting…' : '✓ Submit Inventory Report'}
              </button>
            </div>
          </>
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
