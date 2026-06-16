'use client'
export const dynamic = 'force-dynamic'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import PortalShell from '../../../../components/PortalShell'
import { createClient } from '../../../../lib/supabase'
import { getCatalog, createRequest } from '../../../../lib/inventory'

const CATEGORIES = ['Dairy','Coffee','Packaging','Cleaning','Food','Beverage','Equipment','Other']
const UNITS      = ['pcs','kg','g','bottle','sleeve','pack','roll','box','bag']

const iStyle = {
  width:'100%', background:'white', border:'1px solid #d8cebb',
  borderRadius:8, padding:'9px 12px', fontSize:12,
  fontFamily:"'DM Sans',sans-serif", color:'#1a1208', outline:'none',
  boxSizing:'border-box',
}

const blankLine = () => ({
  _key: Math.random().toString(36).slice(2),
  catalog_item_id: '',
  item_name: '',
  category: 'Other',
  quantity: '',
  unit: 'pcs',
  staff_notes: '',
})

const URGENCY_OPTIONS = [
  { value:'low',    label:'Can wait — next run',     color:'#7a6a50', bg:'#f0ede8' },
  { value:'normal', label:'Normal',                  color:'#2d5a8a', bg:'#e8f0fb' },
  { value:'high',   label:'Urgent — needed today',   color:'#c0392b', bg:'#fdeaea' },
]

export default function NewRequestPage() {
  const router = useRouter()
  const [staffId, setStaffId]     = useState(null)
  const [catalog, setCatalog]     = useState([])
  const [title, setTitle]         = useState('')
  const [urgency, setUrgency]     = useState('normal')
  const [notes, setNotes]         = useState('')
  const [lines, setLines]         = useState([blankLine()])
  const [submitting, setSubmitting] = useState(false)
  const [toast, setToast]         = useState(null)

  function showToast(icon, msg) {
    setToast({ icon, msg })
    setTimeout(() => setToast(null), 3500)
  }

  useEffect(() => {
    const sb = createClient()
    sb.auth.getSession().then(({ data: { session } }) => {
      if (session) setStaffId(session.user.id)
    })
    getCatalog().then(setCatalog).catch(console.error)
  }, [])

  const catalogByCategory = CATEGORIES.reduce((acc, cat) => {
    acc[cat] = catalog.filter(c => c.category === cat)
    return acc
  }, {})

  const pickCatalogItem = (key, itemId) => {
    const item = catalog.find(c => c.id === itemId)
    setLines(prev => prev.map(l =>
      l._key === key
        ? { ...l, catalog_item_id: itemId, item_name: item?.name ?? '', category: item?.category ?? 'Other', unit: item?.unit ?? 'pcs' }
        : l
    ))
  }

  const updateLine = (key, field, value) =>
    setLines(prev => prev.map(l => l._key === key ? { ...l, [field]: value } : l))

  const handleSubmit = async () => {
    if (!staffId)                                             return showToast('⚠️', 'Not signed in')
    if (!title.trim())                                        return showToast('⚠️', 'Please add a title')
    if (lines.some(l => !l.item_name.trim() || !l.quantity)) return showToast('⚠️', 'Fill in all item names and quantities')

    setSubmitting(true)
    try {
      const payload = {
        title: title.trim(),
        urgency,
        notes: notes.trim(),
        items: lines.map(l => ({
          catalog_item_id: l.catalog_item_id || undefined,
          item_name:       l.item_name.trim(),
          category:        l.category,
          quantity:        parseFloat(l.quantity),
          unit:            l.unit,
          staff_notes:     l.staff_notes.trim() || undefined,
        })),
      }
      const req = await createRequest(staffId, payload)
      showToast('✅', `${req.pr_number} submitted!`)
      setTimeout(() => router.push('/inventory/my-requests'), 1500)
    } catch (e) {
      showToast('❌', e.message ?? 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <PortalShell>
      {/* Top bar */}
      <div style={{ background:'white', borderBottom:'1px solid #d8cebb', padding:'0 24px', height:56, display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <button onClick={() => router.back()}
            style={{ background:'transparent', border:'none', cursor:'pointer', fontSize:18, color:'#7a6a50', padding:'0 4px' }}>
            ←
          </button>
          <div style={{ fontFamily:"'Montserrat',sans-serif", fontSize:17, fontWeight:700, color:'#1a1208' }}>New Purchase Request</div>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex:1, overflowY:'auto', padding:'22px 24px' }}>

        {/* Details card */}
        <div style={{ background:'white', border:'1px solid #d8cebb', borderRadius:13, padding:20, marginBottom:16 }}>
          <div style={{ fontFamily:"'Montserrat',sans-serif", fontSize:13, fontWeight:700, color:'#1a1208', marginBottom:16 }}>Details</div>

          <div style={{ marginBottom:14 }}>
            <label style={{ display:'block', fontSize:9, fontWeight:700, letterSpacing:1.2, textTransform:'uppercase', color:'#7a6a50', marginBottom:5 }}>What do you need?</label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Dairy restock for Tuesday service"
              style={iStyle} />
          </div>

          <div style={{ marginBottom:14 }}>
            <label style={{ display:'block', fontSize:9, fontWeight:700, letterSpacing:1.2, textTransform:'uppercase', color:'#7a6a50', marginBottom:8 }}>How urgent?</label>
            <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
              {URGENCY_OPTIONS.map(opt => (
                <div key={opt.value} onClick={() => setUrgency(opt.value)}
                  style={{ padding:'10px 14px', borderRadius:9, border:`1.5px solid ${urgency === opt.value ? opt.color : '#d8cebb'}`, background: urgency === opt.value ? opt.bg : '#faf7f2', cursor:'pointer', display:'flex', alignItems:'center', gap:10, transition:'all .15s' }}>
                  <div style={{ width:10, height:10, borderRadius:'50%', background: urgency === opt.value ? opt.color : '#d8cebb', flexShrink:0 }} />
                  <span style={{ fontSize:12, fontWeight:600, color: urgency === opt.value ? opt.color : '#7a6a50' }}>{opt.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <label style={{ display:'block', fontSize:9, fontWeight:700, letterSpacing:1.2, textTransform:'uppercase', color:'#7a6a50', marginBottom:5 }}>Notes for ops support (optional)</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              placeholder="Brand preferences, avoid substitutes…"
              style={{ ...iStyle, resize:'vertical', minHeight:60, lineHeight:1.5 }} />
          </div>
        </div>

        {/* Line items card */}
        <div style={{ background:'white', border:'1px solid #d8cebb', borderRadius:13, padding:20, marginBottom:16 }}>
          <div style={{ fontFamily:"'Montserrat',sans-serif", fontSize:13, fontWeight:700, color:'#1a1208', marginBottom:16 }}>Items Needed</div>

          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {lines.map((line, idx) => (
              <div key={line._key} style={{ background:'#faf7f2', border:'1px solid #e8e0d5', borderRadius:10, padding:14 }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
                  <span style={{ fontSize:10, fontWeight:700, letterSpacing:1, textTransform:'uppercase', color:'#7a6a50' }}>Item {idx + 1}</span>
                  {lines.length > 1 && (
                    <button onClick={() => setLines(prev => prev.filter(l => l._key !== line._key))}
                      style={{ background:'transparent', border:'none', color:'#aaa', cursor:'pointer', fontSize:16, padding:'0 4px' }}>✕</button>
                  )}
                </div>

                {/* Catalog picker */}
                <div style={{ marginBottom:10 }}>
                  <label style={{ display:'block', fontSize:9, fontWeight:700, letterSpacing:1.2, textTransform:'uppercase', color:'#7a6a50', marginBottom:5 }}>Pick from catalog (optional)</label>
                  <select value={line.catalog_item_id} onChange={e => pickCatalogItem(line._key, e.target.value)} style={iStyle}>
                    <option value="">— Select item —</option>
                    {CATEGORIES.map(cat => (
                      catalogByCategory[cat]?.length > 0 && (
                        <optgroup key={cat} label={cat}>
                          {catalogByCategory[cat].map(item => (
                            <option key={item.id} value={item.id}>{item.name}</option>
                          ))}
                        </optgroup>
                      )
                    ))}
                  </select>
                </div>

                {/* Name + qty + unit */}
                <div style={{ display:'grid', gridTemplateColumns:'1fr 80px 80px', gap:8, marginBottom:10 }}>
                  <div>
                    <label style={{ display:'block', fontSize:9, fontWeight:700, letterSpacing:1.2, textTransform:'uppercase', color:'#7a6a50', marginBottom:5 }}>Item name</label>
                    <input type="text" value={line.item_name} onChange={e => updateLine(line._key, 'item_name', e.target.value)}
                      placeholder="Name" style={iStyle} />
                  </div>
                  <div>
                    <label style={{ display:'block', fontSize:9, fontWeight:700, letterSpacing:1.2, textTransform:'uppercase', color:'#7a6a50', marginBottom:5 }}>Qty</label>
                    <input type="number" min="1" value={line.quantity} onChange={e => updateLine(line._key, 'quantity', e.target.value)}
                      placeholder="0" style={iStyle} />
                  </div>
                  <div>
                    <label style={{ display:'block', fontSize:9, fontWeight:700, letterSpacing:1.2, textTransform:'uppercase', color:'#7a6a50', marginBottom:5 }}>Unit</label>
                    <select value={line.unit} onChange={e => updateLine(line._key, 'unit', e.target.value)} style={iStyle}>
                      {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </div>
                </div>

                {/* Brand notes */}
                <div>
                  <label style={{ display:'block', fontSize:9, fontWeight:700, letterSpacing:1.2, textTransform:'uppercase', color:'#7a6a50', marginBottom:5 }}>Brand / notes (optional)</label>
                  <input type="text" value={line.staff_notes} onChange={e => updateLine(line._key, 'staff_notes', e.target.value)}
                    placeholder="e.g. Oatside brand only" style={iStyle} />
                </div>
              </div>
            ))}
          </div>

          <button onClick={() => setLines(prev => [...prev, blankLine()])}
            style={{ marginTop:12, background:'transparent', border:'1px dashed #d8cebb', borderRadius:8, color:'#7a6a50', padding:'9px 16px', fontSize:12, fontWeight:600, cursor:'pointer', width:'100%', fontFamily:"'DM Sans',sans-serif" }}>
            + Add another item
          </button>
        </div>

        {/* Actions */}
        <div style={{ display:'flex', gap:10 }}>
          <button onClick={() => router.back()}
            style={{ background:'transparent', color:'#7a6a50', border:'1px solid #d8cebb', borderRadius:8, padding:'10px 18px', fontSize:12, cursor:'pointer', fontFamily:"'DM Sans',sans-serif" }}>
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={submitting}
            style={{ flex:1, background:'#EF4576', color:'white', border:'none', borderRadius:8, padding:10, fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:"'DM Sans',sans-serif", opacity: submitting ? 0.6 : 1 }}>
            {submitting ? 'Submitting…' : '✓ Submit to ops support'}
          </button>
        </div>
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
