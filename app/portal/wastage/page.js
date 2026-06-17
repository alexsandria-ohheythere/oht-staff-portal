'use client'
export const dynamic = 'force-dynamic'
import { useState, useEffect, useRef } from 'react'
import PortalShell from '../../../components/PortalShell'
import { createClient } from '../../../lib/supabase'
import { notifyAdmins } from '../../../lib/notify'

const DEPARTMENTS = ['Operations', 'Creatives', 'Cafe Bar', 'Commissary']
const WASTAGE_TYPES = [
  'Accidental (e.g. natapon, spilled, etc.)',
  'Natural (e.g. rotting)',
  'Customer wastage (e.g. caused by customer)',
  'Other',
]

const STATUS_STYLE = {
  pending:  { bg:'#fef3e2', color:'#a06000', label:'Pending Review' },
  reviewed: { bg:'#e8f0fb', color:'#2d5a8a', label:'Reviewed' },
  resolved: { bg:'#eef7e4', color:'#4a7a1e', label:'Resolved' },
}

const iStyle = {
  width:'100%', background:'white', border:'1px solid #d8cebb',
  borderRadius:8, padding:'9px 12px', fontSize:13,
  fontFamily:"'DM Sans',sans-serif", color:'#1a1208', outline:'none',
  boxSizing:'border-box',
}
const labelStyle = { fontSize:12, fontWeight:600, color:'#5a4a3a', marginBottom:5, display:'block' }
const requiredStar = <span style={{ color:'#EF4576' }}> *</span>

const toISO = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
const fmtDate = s => {
  if (!s) return '—'
  const d = new Date(s)
  return d.toLocaleDateString('en-PH', { month:'short', day:'numeric', year:'numeric' })
}

export default function WastageReportPage() {
  const [staff, setStaff]       = useState(null)
  const [section, setSection]   = useState(1)
  const [saving, setSaving]     = useState(false)
  const [toast, setToast]       = useState(null)
  const [myReports, setMyReports] = useState([])
  const [loading, setLoading]   = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [photoFile, setPhotoFile] = useState(null)
  const [photoPreview, setPhotoPreview] = useState(null)
  const fileRef = useRef()

  const today   = toISO(new Date())
  const nowTime = new Date().toTimeString().slice(0,5)

  const [form, setForm] = useState({
    date_of_report:   today,
    time_of_report:   nowTime,
    reported_by:      '',
    department:       '',
    type_of_wastage:  '',
    description:      '',
    wastage_breakdown:'',
    wastage_weight:   '',
    witnesses:        '',
    resolution:       '',
    declaration_name: '',
    declaration_date: today,
  })

  useEffect(() => { init() }, [])

  async function init() {
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const { data: s } = await supabase.from('staff').select('*').eq('email', session.user.email).single()
      if (s) {
        setStaff(s)
        setForm(f => ({ ...f, reported_by: `${s.first_name} ${s.last_name} — ${s.role || ''}` }))
        const { data: rpts } = await supabase
          .from('wastage_reports')
          .select('*')
          .eq('staff_id', s.id)
          .order('created_at', { ascending: false })
        setMyReports(rpts || [])
      }
    } catch(e) { console.error(e) }
    finally { setLoading(false) }
  }

  function showToast(icon, msg) { setToast({ icon, msg }); setTimeout(() => setToast(null), 3500) }
  const fv = k => e => setForm(p => ({ ...p, [k]: e.target.value }))

  function handlePhotoChange(e) {
    const file = e.target.files[0]
    if (!file) return
    setPhotoFile(file)
    const reader = new FileReader()
    reader.onload = ev => setPhotoPreview(ev.target.result)
    reader.readAsDataURL(file)
  }

  function validateSection1() {
    if (!form.date_of_report)          { showToast('⚠️', 'Date of report is required'); return false }
    if (!form.time_of_report)          { showToast('⚠️', 'Time of report is required'); return false }
    if (!form.reported_by.trim())      { showToast('⚠️', 'Reported by is required'); return false }
    if (!form.department)              { showToast('⚠️', 'Please select your department'); return false }
    if (!form.type_of_wastage)         { showToast('⚠️', 'Please select the type of wastage'); return false }
    if (!form.description.trim())      { showToast('⚠️', 'Description of the incident is required'); return false }
    if (!form.wastage_breakdown.trim()){ showToast('⚠️', 'Wastage breakdown is required'); return false }
    if (!form.wastage_weight.trim())   { showToast('⚠️', 'Wastage weight breakdown is required'); return false }
    return true
  }

  async function submitReport() {
    if (!form.declaration_name.trim()) { showToast('⚠️', 'Please provide your full name for the declaration'); return }
    if (!form.declaration_date)        { showToast('⚠️', 'Please provide the declaration date'); return }
    setSaving(true)
    try {
      const supabase = createClient()
      let photo_url = null

      if (photoFile) {
        const ext = photoFile.name.split('.').pop()
        const filename = `wastage-${Date.now()}-${staff?.id || 'anon'}.${ext}`
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('incident-photos')
          .upload(filename, photoFile, { upsert: false })
        if (uploadError) {
          showToast('⚠️', 'Photo upload failed — continuing without photo')
        } else {
          const { data: { publicUrl } } = supabase.storage.from('incident-photos').getPublicUrl(filename)
          photo_url = publicUrl
        }
      }

      const { error } = await supabase.from('wastage_reports').insert([{
        staff_id:          staff?.id || null,
        date_of_report:    form.date_of_report,
        time_of_report:    form.time_of_report,
        reported_by:       form.reported_by,
        department:        form.department,
        type_of_wastage:   form.type_of_wastage,
        description:       form.description,
        wastage_breakdown: form.wastage_breakdown,
        wastage_weight:    form.wastage_weight,
        witnesses:         form.witnesses || null,
        resolution:        form.resolution || null,
        photo_url,
        declaration_name:  form.declaration_name,
        declaration_date:  form.declaration_date,
        status:            'pending',
      }])

      if (error) { showToast('❌', error.message); setSaving(false); return }

      // Auto-file into 201
      if (staff?.id) {
        await supabase.from('staff_files').insert([{
          staff_id:     staff.id,
          file_name:    `Wastage Report — ${form.type_of_wastage} (${form.date_of_report})`,
          file_url:     photo_url || '',
          file_type:    photo_url ? 'image' : 'text/plain',
          category:     'Wastage Report',
          description:  `${form.department} · Filed by: ${form.reported_by}`,
          can_download: true,
          can_upload:   false,
          uploaded_by:  `${staff.first_name} ${staff.last_name}`,
        }])
      }

      await notifyAdmins({
        type:    'general',
        title:   `🗑️ Wastage Report: ${form.type_of_wastage}`,
        message: `${form.reported_by} filed a wastage report (${form.department}). Filed: ${form.date_of_report}.`,
      })

      await init()
      setShowForm(false)
      setSection(1)
      setPhotoFile(null)
      setPhotoPreview(null)
      const blankForm = {
        date_of_report:   today,
        time_of_report:   nowTime,
        reported_by:      staff ? `${staff.first_name} ${staff.last_name} — ${staff.role || ''}` : '',
        department:       '',
        type_of_wastage:  '',
        description:      '',
        wastage_breakdown:'',
        wastage_weight:   '',
        witnesses:        '',
        resolution:       '',
        declaration_name: '',
        declaration_date: today,
      }
      setForm(blankForm)
      showToast('✅', 'Wastage report submitted — management notified')
    } catch(e) {
      showToast('❌', 'Something went wrong. Please try again.')
    }
    setSaving(false)
  }

  return (
    <PortalShell>
      {/* Header */}
      <div style={{ background:'white', borderBottom:'1px solid #d8cebb', padding:'0 24px', height:56, display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
        <div style={{ fontFamily:"'Montserrat',sans-serif", fontSize:17, fontWeight:700 }}>Wastage Report</div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            style={{ background:'#EF4576', color:'white', border:'none', borderRadius:8, padding:'7px 14px', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:"'DM Sans',sans-serif" }}>
            + File Report
          </button>
        )}
      </div>

      <div style={{ flex:1, overflowY:'auto', padding:'22px 24px' }}>

        {/* Disclaimer */}
        {!showForm && (
          <div style={{ background:'#fef3e2', border:'1px solid #f5d78e', borderRadius:10, padding:'14px 16px', marginBottom:20 }}>
            <div style={{ fontSize:12, fontWeight:700, color:'#a06000', marginBottom:5 }}>🗑️ Wastage Report Form</div>
            <div style={{ fontSize:11, color:'#7a5500', lineHeight:1.6 }}>
              This wastage report is for internal use only and contains information based on available records at the time of reporting.
              All details are strictly confidential. The report is intended to accurately document item wastage and support internal monitoring.
              It does not determine liability or final outcomes.
            </div>
          </div>
        )}

        {/* FORM */}
        {showForm && (
          <div style={{ maxWidth:620 }}>

            {/* Section progress */}
            <div style={{ display:'flex', gap:8, marginBottom:20, alignItems:'center' }}>
              {[1,2].map(s => (
                <div key={s} style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <div style={{
                    width:28, height:28, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center',
                    fontSize:12, fontWeight:700,
                    background: section >= s ? '#EF4576' : '#e5e0d8',
                    color: section >= s ? 'white' : '#9a8a7a',
                  }}>{s}</div>
                  <span style={{ fontSize:11, fontWeight:600, color: section >= s ? '#EF4576' : '#9a8a7a' }}>
                    {s === 1 ? 'Basic Information' : 'Declaration'}
                  </span>
                  {s < 2 && <div style={{ width:30, height:2, background: section > s ? '#EF4576' : '#e5e0d8', borderRadius:2 }} />}
                </div>
              ))}
              <button
                onClick={() => { setShowForm(false); setSection(1) }}
                style={{ marginLeft:'auto', background:'transparent', border:'1px solid #d8cebb', borderRadius:7, padding:'5px 12px', fontSize:11, color:'#7a6a50', cursor:'pointer' }}>
                Cancel
              </button>
            </div>

            {/* ── SECTION 1 ── */}
            {section === 1 && (
              <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
                <div style={{ background:'white', borderRadius:12, border:'1px solid #e5e0d8', padding:'18px 20px' }}>
                  <div style={{ fontSize:13, fontWeight:700, color:'#1a1208', marginBottom:14 }}>Basic Information</div>

                  {/* Date + Time */}
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:14 }}>
                    <div>
                      <label style={labelStyle}>Date of Report{requiredStar}</label>
                      <input type="date" value={form.date_of_report} onChange={fv('date_of_report')} style={iStyle} />
                    </div>
                    <div>
                      <label style={labelStyle}>Time of Report{requiredStar}</label>
                      <input type="time" value={form.time_of_report} onChange={fv('time_of_report')} style={iStyle} />
                    </div>
                  </div>

                  {/* Reported By */}
                  <div style={{ marginBottom:14 }}>
                    <label style={labelStyle}>Reported By (Name & Position){requiredStar}</label>
                    <input type="text" value={form.reported_by} onChange={fv('reported_by')} placeholder="Full name and position" style={iStyle} />
                  </div>

                  {/* Department */}
                  <div style={{ marginBottom:14 }}>
                    <label style={labelStyle}>Department{requiredStar}</label>
                    <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
                      {DEPARTMENTS.map(d => (
                        <button key={d} type="button"
                          onClick={() => setForm(f => ({ ...f, department: d }))}
                          style={{
                            padding:'7px 14px', borderRadius:8, fontSize:12, fontWeight:600, cursor:'pointer',
                            border: form.department === d ? '2px solid #EF4576' : '1.5px solid #d8cebb',
                            background: form.department === d ? '#fde8ee' : 'white',
                            color: form.department === d ? '#EF4576' : '#5a4a3a',
                          }}>{d}</button>
                      ))}
                    </div>
                  </div>

                  {/* Type of Wastage */}
                  <div>
                    <label style={labelStyle}>Type of Wastage{requiredStar}</label>
                    <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                      {WASTAGE_TYPES.map(t => (
                        <button key={t} type="button"
                          onClick={() => setForm(f => ({ ...f, type_of_wastage: t }))}
                          style={{
                            padding:'9px 14px', borderRadius:8, fontSize:12, fontWeight:600, cursor:'pointer', textAlign:'left',
                            border: form.type_of_wastage === t ? '2px solid #EF4576' : '1.5px solid #d8cebb',
                            background: form.type_of_wastage === t ? '#fde8ee' : 'white',
                            color: form.type_of_wastage === t ? '#EF4576' : '#5a4a3a',
                          }}>{t}</button>
                      ))}
                    </div>
                  </div>
                </div>

                <div style={{ background:'white', borderRadius:12, border:'1px solid #e5e0d8', padding:'18px 20px' }}>
                  <div style={{ fontSize:13, fontWeight:700, color:'#1a1208', marginBottom:14 }}>Wastage Details</div>

                  <div style={{ marginBottom:14 }}>
                    <label style={labelStyle}>Description of the Incident{requiredStar}</label>
                    <div style={{ fontSize:11, color:'#9a8a7a', marginBottom:6 }}>Provide a detailed and factual description of what happened. Include sequence of events, actions taken, and any relevant conditions.</div>
                    <textarea value={form.description} onChange={fv('description')} rows={4}
                      placeholder="Describe what happened in detail..."
                      style={{ ...iStyle, resize:'vertical' }} />
                  </div>

                  <div style={{ marginBottom:14 }}>
                    <label style={labelStyle}>Wastage Breakdown: Please indicate the items{requiredStar}</label>
                    <div style={{ fontSize:11, color:'#9a8a7a', marginBottom:6 }}>List each wasted item (e.g. matcha latte x2, croissant x1).</div>
                    <textarea value={form.wastage_breakdown} onChange={fv('wastage_breakdown')} rows={3}
                      placeholder="e.g. Matcha latte x2, Croissant x1, Milk 500ml..."
                      style={{ ...iStyle, resize:'vertical' }} />
                  </div>

                  <div style={{ marginBottom:14 }}>
                    <label style={labelStyle}>Wastage Weight Breakdown: Please indicate the weight of each item{requiredStar}</label>
                    <div style={{ fontSize:11, color:'#9a8a7a', marginBottom:6 }}>Indicate weight or volume per item (e.g. 200g, 500ml).</div>
                    <textarea value={form.wastage_weight} onChange={fv('wastage_weight')} rows={3}
                      placeholder="e.g. Matcha latte: ~250ml x2, Croissant: ~80g x1..."
                      style={{ ...iStyle, resize:'vertical' }} />
                  </div>

                  <div style={{ marginBottom:14 }}>
                    <label style={labelStyle}>Witnesses (if any)</label>
                    <textarea value={form.witnesses} onChange={fv('witnesses')} rows={2}
                      placeholder="Names of any witnesses..."
                      style={{ ...iStyle, resize:'vertical' }} />
                  </div>

                  <div style={{ marginBottom:14 }}>
                    <label style={labelStyle}>Resolution for the Incident</label>
                    <div style={{ fontSize:11, color:'#9a8a7a', marginBottom:6 }}>Indicate "Not Resolved" if the incident has not been resolved.</div>
                    <textarea value={form.resolution} onChange={fv('resolution')} rows={3}
                      placeholder="Describe how the incident was resolved, or write 'Not Resolved'..."
                      style={{ ...iStyle, resize:'vertical' }} />
                  </div>

                  <div>
                    <label style={labelStyle}>Attach Photo</label>
                    <div
                      onClick={() => fileRef.current.click()}
                      style={{ border:'2px dashed #d8cebb', borderRadius:10, padding:'20px', textAlign:'center', cursor:'pointer', background:photoPreview?'#fde8ee':'#faf8f5' }}>
                      {photoPreview
                        ? <img src={photoPreview} alt="preview" style={{ maxHeight:180, maxWidth:'100%', borderRadius:8, objectFit:'contain' }} />
                        : <div style={{ fontSize:12, color:'#9a8a7a' }}>📎 Tap to attach a photo</div>
                      }
                    </div>
                    <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={handlePhotoChange} style={{ display:'none' }} />
                    {photoFile && (
                      <div style={{ fontSize:11, color:'#7a6a50', marginTop:6, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                        <span>📷 {photoFile.name}</span>
                        <button onClick={() => { setPhotoFile(null); setPhotoPreview(null) }}
                          style={{ background:'transparent', border:'none', color:'#EF4576', fontSize:11, cursor:'pointer', fontWeight:600 }}>Remove</button>
                      </div>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => { if (validateSection1()) setSection(2) }}
                  style={{ background:'#EF4576', color:'white', border:'none', borderRadius:10, padding:'13px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:"'DM Sans',sans-serif" }}>
                  Continue to Declaration →
                </button>
              </div>
            )}

            {/* ── SECTION 2 ── */}
            {section === 2 && (
              <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
                <div style={{ background:'#fef3e2', border:'1px solid #f5d78e', borderRadius:12, padding:'18px 20px' }}>
                  <div style={{ fontSize:13, fontWeight:700, color:'#a06000', marginBottom:10 }}>Declaration</div>
                  <p style={{ fontSize:12, color:'#7a5500', lineHeight:1.7, margin:0 }}>
                    This incident report is strictly confidential and intended for internal use only.
                    Unauthorized disclosure or distribution is prohibited. The contents of this report
                    do not constitute a final determination of fault or liability and may be subject to
                    further review.
                  </p>
                </div>

                <div style={{ background:'white', borderRadius:12, border:'1px solid #e5e0d8', padding:'18px 20px' }}>
                  <p style={{ fontSize:13, color:'#3a2a1a', lineHeight:1.7, marginBottom:16 }}>
                    I hereby declare that the information provided above is true and accurate to the best of my knowledge.
                  </p>
                  <p style={{ fontSize:12, color:'#7a6a50', marginBottom:16 }}>
                    Please indicate your <strong>FULL NAME</strong> and <strong>DATE</strong> to sign this document.
                  </p>

                  <div style={{ marginBottom:14 }}>
                    <label style={labelStyle}>Full Name{requiredStar}</label>
                    <input type="text" value={form.declaration_name} onChange={fv('declaration_name')}
                      placeholder="Your full legal name"
                      style={iStyle} />
                  </div>

                  <div>
                    <label style={labelStyle}>Date{requiredStar}</label>
                    <input type="date" value={form.declaration_date} onChange={fv('declaration_date')} style={iStyle} />
                  </div>
                </div>

                {/* Summary */}
                <div style={{ background:'white', borderRadius:12, border:'1px solid #e5e0d8', padding:'16px 20px' }}>
                  <div style={{ fontSize:12, fontWeight:700, color:'#5a4a3a', marginBottom:10 }}>🗑️ Report Summary</div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, fontSize:11, color:'#5a4a3a' }}>
                    <div><span style={{ color:'#9a8a7a' }}>Date:</span> {form.date_of_report}</div>
                    <div><span style={{ color:'#9a8a7a' }}>Time:</span> {form.time_of_report}</div>
                    <div><span style={{ color:'#9a8a7a' }}>Department:</span> {form.department}</div>
                    <div style={{ gridColumn:'1/-1' }}><span style={{ color:'#9a8a7a' }}>Type:</span> {form.type_of_wastage}</div>
                    <div style={{ gridColumn:'1/-1' }}><span style={{ color:'#9a8a7a' }}>Items:</span> {form.wastage_breakdown?.slice(0,80)}{form.wastage_breakdown?.length>80?'...':''}</div>
                  </div>
                </div>

                <div style={{ display:'flex', gap:10 }}>
                  <button onClick={() => setSection(1)}
                    style={{ flex:1, background:'white', color:'#5a4a3a', border:'1.5px solid #d8cebb', borderRadius:10, padding:'13px', fontSize:13, fontWeight:600, cursor:'pointer' }}>
                    ← Back
                  </button>
                  <button onClick={submitReport} disabled={saving}
                    style={{ flex:2, background: saving ? '#ccc' : '#EF4576', color:'white', border:'none', borderRadius:10, padding:'13px', fontSize:13, fontWeight:700, cursor: saving ? 'default' : 'pointer', fontFamily:"'DM Sans',sans-serif" }}>
                    {saving ? 'Submitting...' : '✅ Submit Wastage Report'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* MY REPORTS LIST */}
        {!showForm && (
          <div>
            <div style={{ fontSize:13, fontWeight:700, color:'#3a2a1a', marginBottom:12 }}>My Submitted Reports</div>
            {loading ? (
              <div style={{ fontSize:12, color:'#9a8a7a', padding:'20px 0' }}>Loading...</div>
            ) : myReports.length === 0 ? (
              <div style={{ background:'white', borderRadius:12, border:'1px solid #e5e0d8', padding:'32px 20px', textAlign:'center' }}>
                <div style={{ fontSize:32, marginBottom:10 }}>🗑️</div>
                <div style={{ fontSize:13, fontWeight:600, color:'#5a4a3a', marginBottom:6 }}>No reports yet</div>
                <div style={{ fontSize:11, color:'#9a8a7a' }}>Tap "+ File Report" above to submit a wastage report.</div>
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                {myReports.map(r => {
                  const st = STATUS_STYLE[r.status] || STATUS_STYLE.pending
                  return (
                    <div key={r.id} style={{ background:'white', borderRadius:12, border:'1px solid #e5e0d8', padding:'14px 16px' }}>
                      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:10, marginBottom:8 }}>
                        <div>
                          <div style={{ fontSize:13, fontWeight:700, color:'#1a1208' }}>{r.type_of_wastage}</div>
                          <div style={{ fontSize:11, color:'#9a8a7a', marginTop:2 }}>
                            {fmtDate(r.date_of_report)} · {r.department}
                          </div>
                        </div>
                        <span style={{ background:st.bg, color:st.color, borderRadius:20, padding:'3px 10px', fontSize:10, fontWeight:700, flexShrink:0 }}>
                          {st.label}
                        </span>
                      </div>
                      <div style={{ fontSize:11, color:'#5a4a3a', lineHeight:1.5, borderTop:'1px solid #f0ede8', paddingTop:8 }}>
                        <strong>Items:</strong> {r.wastage_breakdown?.slice(0,120)}{r.wastage_breakdown?.length>120?'...':''}
                      </div>
                      {r.admin_notes && (
                        <div style={{ marginTop:8, background:'#eef7e4', borderRadius:7, padding:'8px 10px', fontSize:11, color:'#4a7a1e' }}>
                          <strong>Admin note:</strong> {r.admin_notes}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div style={{ position:'fixed', bottom:80, left:'50%', transform:'translateX(-50%)', background:'#1a1208', color:'white', borderRadius:10, padding:'10px 18px', fontSize:12, fontWeight:600, zIndex:999, display:'flex', gap:8, alignItems:'center', whiteSpace:'nowrap', boxShadow:'0 4px 20px rgba(0,0,0,.3)' }}>
          <span>{toast.icon}</span><span>{toast.msg}</span>
        </div>
      )}
    </PortalShell>
  )
}
