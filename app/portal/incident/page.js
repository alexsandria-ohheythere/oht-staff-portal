'use client'
export const dynamic = 'force-dynamic'
import { useState, useEffect, useRef } from 'react'
import PortalShell from '../../../components/PortalShell'
import { createClient } from '../../../lib/supabase'
import { notifyAdmins } from '../../../lib/notify'

const DEPARTMENTS = ['Operations', 'Creatives', 'Cafe Bar', 'Commissary']
const INCIDENT_TYPES = [
  'Injury/Accident',
  'Property Damage',
  'Customer Complaint',
  'Employee Misconduct',
  'Safety Hazard',
  'Abuse',
  'Other',
]
const VIOLATION_CATEGORIES = ['Attendance','Shift Coverage','Conduct','Dress Code','Anti-Discrimination','Workplace Conduct','Operations','Food Safety','Confidentiality','Health & Safety','Negligence']

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
const fmtDatetime = s => {
  if (!s) return '—'
  const d = new Date(s)
  return d.toLocaleDateString('en-PH', { month:'short', day:'numeric', year:'numeric' })
}


function StaffPicker({ allStaff, selected, onChange, currentStaffId, placeholder }) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')

  const filtered = allStaff.filter(s => {
    if (search.trim()) {
      const q = search.toLowerCase()
      return `${s.first_name} ${s.last_name} ${s.role || ''}`.toLowerCase().includes(q)
    }
    return true
  })

  function toggle(id) {
    onChange(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  function remove(id) { onChange(prev => prev.filter(x => x !== id)) }

  const selectedStaff = allStaff.filter(s => selected.includes(s.id))

  return (
    <div style={{ position:'relative' }}>
      {/* Selected pills */}
      {selectedStaff.length > 0 && (
        <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:8 }}>
          {selectedStaff.map(s => (
            <div key={s.id} style={{ display:'flex', alignItems:'center', gap:5, background:'#fde8ee', border:'1px solid #f5b8ca', borderRadius:20, padding:'4px 10px 4px 10px', fontSize:11, fontWeight:600, color:'#c0392b' }}>
              <span>{s.first_name} {s.last_name}</span>
              <button type="button" onClick={() => remove(s.id)}
                style={{ background:'transparent', border:'none', color:'#c0392b', cursor:'pointer', fontSize:13, lineHeight:1, padding:0, marginLeft:2 }}>×</button>
            </div>
          ))}
        </div>
      )}

      {/* Trigger */}
      <button type="button" onClick={() => setOpen(o => !o)}
        style={{ width:'100%', background:'white', border:'1px solid #d8cebb', borderRadius:8, padding:'9px 12px', fontSize:12, fontFamily:"'DM Sans',sans-serif", color: selectedStaff.length ? '#1a1208' : '#9a8a7a', textAlign:'left', cursor:'pointer', display:'flex', justifyContent:'space-between', alignItems:'center', boxSizing:'border-box' }}>
        <span>{selectedStaff.length === 0 ? (placeholder || 'Select staff...') : `${selectedStaff.length} selected`}</span>
        <span style={{ fontSize:10 }}>{open ? '▲' : '▼'}</span>
      </button>

      {/* Dropdown */}
      {open && (
        <div style={{ position:'absolute', top:'100%', left:0, right:0, zIndex:200, background:'white', border:'1px solid #d8cebb', borderRadius:10, boxShadow:'0 8px 24px rgba(0,0,0,.12)', marginTop:4, overflow:'hidden' }}>
          <div style={{ padding:'8px 10px', borderBottom:'1px solid #f0ede8' }}>
            <input
              autoFocus
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search name or role..."
              style={{ width:'100%', border:'1px solid #d8cebb', borderRadius:7, padding:'7px 10px', fontSize:12, outline:'none', boxSizing:'border-box', fontFamily:"'DM Sans',sans-serif" }}
            />
          </div>
          <div style={{ maxHeight:200, overflowY:'auto' }}>
            {filtered.length === 0 ? (
              <div style={{ padding:'12px 14px', fontSize:12, color:'#9a8a7a', textAlign:'center' }}>No staff found</div>
            ) : filtered.map(s => {
              const isSelected = selected.includes(s.id)
              const isSelf = currentStaffId && s.id === currentStaffId
              return (
                <div key={s.id} onClick={() => toggle(s.id)}
                  style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 14px', cursor:'pointer', background: isSelected ? '#fde8ee' : 'white', borderBottom:'1px solid #f8f5f0' }}
                  onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background='#faf8f5' }}
                  onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background='white' }}>
                  <div style={{ width:18, height:18, borderRadius:4, border:`2px solid ${isSelected ? '#EF4576' : '#d8cebb'}`, background: isSelected ? '#EF4576' : 'white', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                    {isSelected && <span style={{ color:'white', fontSize:11, fontWeight:700 }}>✓</span>}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:12, fontWeight:600, color:'#1a1208' }}>
                      {s.first_name} {s.last_name}{isSelf ? ' (You)' : ''}
                    </div>
                    <div style={{ fontSize:10, color:'#9a8a7a' }}>{s.role || 'Staff'}</div>
                  </div>
                </div>
              )
            })}
          </div>
          <div style={{ padding:'8px 10px', borderTop:'1px solid #f0ede8', display:'flex', justifyContent:'flex-end' }}>
            <button type="button" onClick={() => setOpen(false)}
              style={{ background:'#EF4576', color:'white', border:'none', borderRadius:7, padding:'6px 14px', fontSize:11, fontWeight:700, cursor:'pointer' }}>
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function IncidentReportPage() {
  const [staff, setStaff]         = useState(null)
  const [allStaff, setAllStaff]     = useState([])
  const [violations, setViolations] = useState([])
  const [personsSelected, setPersonsSelected] = useState([])
  const [witnessSelected, setWitnessSelected]  = useState([])
  const [section, setSection]     = useState(1)   // 1 or 2
  const [saving, setSaving]       = useState(false)
  const [toast, setToast]         = useState(null)
  const [myReports, setMyReports] = useState([])
  const [loading, setLoading]     = useState(true)
  const [showForm, setShowForm]   = useState(false)
  const [photoFile, setPhotoFile] = useState(null)
  const [photoPreview, setPhotoPreview] = useState(null)
  const fileRef = useRef()

  const today = toISO(new Date())
  const nowTime = new Date().toTimeString().slice(0,5)

  const [form, setForm] = useState({
    date_of_report: today,
    time_of_report: nowTime,
    reported_by: '',
    department: '',
    incident_type: '',
    violation_code: '',
    description: '',
    persons_involved: '',
    witnesses: '',
    resolution: '',
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
      const { data: allS } = await supabase.from('staff').select('id, first_name, last_name, role').order('first_name')
      setAllStaff(allS || [])
      const { data: viols } = await supabase.from('handbook_entries').select('id,violation_code,title,category,severity').eq('is_active', true).order('violation_code')
      setViolations(viols || [])
      if (s) {
        setStaff(s)
        setForm(f => ({ ...f, reported_by: `${s.first_name} ${s.last_name} — ${s.role || ''}` }))
        const { data: rpts } = await supabase
          .from('incident_reports')
          .select('*')
          .eq('staff_id', s.id)
          .order('created_at', { ascending: false })
        setMyReports(rpts || [])
      }
    } catch(e) { console.error(e) }
    setLoading(false)
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
    if (!form.date_of_report) { showToast('⚠️', 'Date of report is required'); return false }
    if (!form.time_of_report) { showToast('⚠️', 'Time of report is required'); return false }
    if (!form.reported_by.trim()) { showToast('⚠️', 'Reported by is required'); return false }
    if (!form.department) { showToast('⚠️', 'Please select your department'); return false }
    if (!form.incident_type) { showToast('⚠️', 'Please select incident type'); return false }
    if (!form.description.trim()) { showToast('⚠️', 'Incident description is required'); return false }
    if (personsSelected.length === 0) { showToast('⚠️', 'Please select at least one person involved'); return false }
    return true
  }

  async function submitReport() {
    if (!form.declaration_name.trim()) { showToast('⚠️', 'Please provide your full name for the declaration'); return }
    if (!form.declaration_date) { showToast('⚠️', 'Please provide the declaration date'); return }
    setSaving(true)
    try {
      const supabase = createClient()
      let photo_url = null

      // Upload photo if provided
      if (photoFile) {
        const ext = photoFile.name.split('.').pop()
        const filename = `${Date.now()}-${staff?.id || 'anon'}.${ext}`
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

      // Build name strings from selected IDs
      const personsStr = personsSelected.map(id => { const s = allStaff.find(x => x.id === id); return s ? `${s.first_name} ${s.last_name} (${s.role || 'Staff'})` : id }).join(', ')
      const witnessStr = witnessSelected.map(id => { const s = allStaff.find(x => x.id === id); return s ? `${s.first_name} ${s.last_name} (${s.role || 'Staff'})` : id }).join(', ')

      const { error } = await supabase.from('incident_reports').insert([{
        staff_id: staff?.id || null,
        date_of_report: form.date_of_report,
        time_of_report: form.time_of_report,
        reported_by: form.reported_by,
        department: form.department,
        incident_type: form.incident_type,
        violation_code: form.violation_code || null,
        description: form.description,
        persons_involved: personsStr,
        witnesses: witnessStr || null,
        resolution: form.resolution || null,
        photo_url,
        declaration_name: form.declaration_name,
        declaration_date: form.declaration_date,
        status: 'pending',
      }])

      if (error) { showToast('❌', error.message); setSaving(false); return }

      // Auto-file into the employee's 201
      if (staff?.id) {
        const reportDate = form.date_of_report
        const fileName = `Incident Report — ${form.incident_type} (${reportDate})`
        const description = `${form.department} · Filed by: ${form.reported_by}`
        // Insert a record pointing to the photo if one was uploaded, otherwise use a placeholder URL
        // The file_url links to the photo; if no photo, we use a data URI placeholder
        const fileEntry = {
          staff_id: staff.id,
          file_name: fileName,
          file_url: photo_url || '',
          file_type: photo_url ? 'image' : 'text/plain',
          category: 'Incident Report',
          description,
          can_download: true,
          can_upload: false,
          uploaded_by: `${staff.first_name} ${staff.last_name}`,
        }
        await supabase.from('staff_files').insert([fileEntry])
      }

      // Notify admins
      await notifyAdmins({
        type: 'general',
        title: `⚠️ Incident Report: ${form.incident_type}`,
        message: `${form.reported_by} filed an incident report (${form.department}). Type: ${form.incident_type}. Filed: ${form.date_of_report}.`,
      })

      await init()
      setShowForm(false)
      setSection(1)
      setPhotoFile(null)
      setPhotoPreview(null)
      setPersonsSelected([])
      setWitnessSelected([])
      setForm({
        date_of_report: today,
        time_of_report: nowTime,
        reported_by: staff ? `${staff.first_name} ${staff.last_name} — ${staff.role || ''}` : '',
        department: '',
        incident_type: '',
        violation_code: '',
        description: '',
        persons_involved: '',
        witnesses: '',
        resolution: '',
        declaration_name: '',
        declaration_date: today,
      })
      showToast('✅', 'Incident report submitted — management notified')
    } catch(e) {
      showToast('❌', 'Something went wrong. Please try again.')
    }
    setSaving(false)
  }

  return (
    <PortalShell>
      {/* Header */}
      <div style={{ background:'white', borderBottom:'1px solid #d8cebb', padding:'0 24px', height:56, display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
        <div style={{ fontFamily:"'Montserrat',sans-serif", fontSize:17, fontWeight:700 }}>Incident Report</div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            style={{ background:'#EF4576', color:'white', border:'none', borderRadius:8, padding:'7px 14px', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:"'DM Sans',sans-serif" }}>
            + File Report
          </button>
        )}
      </div>

      <div style={{ flex:1, overflowY:'auto', padding:'22px 24px' }}>

        {/* Disclaimer banner */}
        {!showForm && (
          <div style={{ background:'#fef3e2', border:'1px solid #f5d78e', borderRadius:10, padding:'14px 16px', marginBottom:20 }}>
            <div style={{ fontSize:12, fontWeight:700, color:'#a06000', marginBottom:5 }}>📋 Incident Report Form</div>
            <div style={{ fontSize:11, color:'#7a5500', lineHeight:1.6 }}>
              This is a formal document for internal use only. All information is strictly confidential and intended to document incidents accurately.
              It does not constitute a final determination of liability or fault.
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
                    <label style={labelStyle}>Your Department{requiredStar}</label>
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

                  {/* Incident Type */}
                  <div style={{ marginBottom:14 }}>
                    <label style={labelStyle}>Type of Incident{requiredStar}</label>
                    <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
                      {INCIDENT_TYPES.map(t => (
                        <button key={t} type="button"
                          onClick={() => setForm(f => ({ ...f, incident_type: t }))}
                          style={{
                            padding:'7px 14px', borderRadius:8, fontSize:12, fontWeight:600, cursor:'pointer',
                            border: form.incident_type === t ? '2px solid #EF4576' : '1.5px solid #d8cebb',
                            background: form.incident_type === t ? '#fde8ee' : 'white',
                            color: form.incident_type === t ? '#EF4576' : '#5a4a3a',
                          }}>{t}</button>
                      ))}
                    </div>
                  </div>
                </div>

                <div style={{ background:'white', borderRadius:12, border:'1px solid #e5e0d8', padding:'18px 20px' }}>
                  <div style={{ fontSize:13, fontWeight:700, color:'#1a1208', marginBottom:4 }}>Handbook Violation</div>
                  <div style={{ fontSize:11, color:'#9a8a7a', marginBottom:14 }}>If this incident involves a policy violation, select the applicable code. This will be used if a sanction is issued.</div>

                  <div style={{ marginBottom:4 }}>
                    <label style={labelStyle}>Violation Code <span style={{ color:'#9a8a7a', fontWeight:400 }}>(optional)</span></label>
                    <select
                      value={form.violation_code}
                      onChange={e => setForm(f => ({ ...f, violation_code: e.target.value }))}
                      style={iStyle}
                    >
                      <option value="">— None / Not applicable —</option>
                      {VIOLATION_CATEGORIES.map(cat => {
                        const items = violations.filter(v => v.category === cat)
                        if (!items.length) return null
                        return (
                          <optgroup key={cat} label={cat}>
                            {items.map(v => (
                              <option key={v.id} value={v.violation_code}>
                                {v.violation_code} — {v.title}
                              </option>
                            ))}
                          </optgroup>
                        )
                      })}
                    </select>
                  </div>
                  {form.violation_code && (() => {
                    const v = violations.find(x => x.violation_code === form.violation_code)
                    if (!v) return null
                    const sevColors = { Minor:'#4a7a1e', Moderate:'#a06000', Major:'#c0392b', Grave:'#ff6b6b' }
                    return (
                      <div style={{ marginTop:8, background:'#f5f0e8', borderRadius:8, padding:'8px 12px', fontSize:12 }}>
                        <span style={{ fontWeight:700, color: sevColors[v.severity] || '#333' }}>{v.severity}</span>
                        <span style={{ color:'#888', marginLeft:8 }}>{v.category}</span>
                      </div>
                    )
                  })()}
                </div>

                <div style={{ background:'white', borderRadius:12, border:'1px solid #e5e0d8', padding:'18px 20px' }}>
                  <div style={{ fontSize:13, fontWeight:700, color:'#1a1208', marginBottom:14 }}>Incident Details</div>

                  <div style={{ marginBottom:14 }}>
                    <label style={labelStyle}>Description of the Incident{requiredStar}</label>
                    <div style={{ fontSize:11, color:'#9a8a7a', marginBottom:6 }}>Provide a detailed and factual description of what happened. Include sequence of events, actions taken, and any relevant conditions.</div>
                    <textarea value={form.description} onChange={fv('description')} rows={5}
                      placeholder="Describe what happened in detail..."
                      style={{ ...iStyle, resize:'vertical' }} />
                  </div>

                  <div style={{ marginBottom:14 }}>
                    <label style={labelStyle}>Persons Involved{requiredStar}</label>
                    <StaffPicker
                      allStaff={allStaff}
                      selected={personsSelected}
                      onChange={setPersonsSelected}
                      currentStaffId={staff?.id}
                      placeholder="Select staff members involved..."
                    />
                  </div>

                  <div style={{ marginBottom:14 }}>
                    <label style={labelStyle}>Witnesses (if any)</label>
                    <StaffPicker
                      allStaff={allStaff}
                      selected={witnessSelected}
                      onChange={setWitnessSelected}
                      placeholder="Select witnesses..."
                    />
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

                {/* Summary card */}
                <div style={{ background:'white', borderRadius:12, border:'1px solid #e5e0d8', padding:'16px 20px' }}>
                  <div style={{ fontSize:12, fontWeight:700, color:'#5a4a3a', marginBottom:10 }}>📋 Report Summary</div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, fontSize:11, color:'#5a4a3a' }}>
                    <div><span style={{ color:'#9a8a7a' }}>Date:</span> {form.date_of_report}</div>
                    <div><span style={{ color:'#9a8a7a' }}>Time:</span> {form.time_of_report}</div>
                    <div><span style={{ color:'#9a8a7a' }}>Department:</span> {form.department}</div>
                    <div><span style={{ color:'#9a8a7a' }}>Type:</span> {form.incident_type}</div>
                  </div>
                </div>

                <div style={{ display:'flex', gap:10 }}>
                  <button onClick={() => setSection(1)}
                    style={{ flex:1, background:'white', color:'#5a4a3a', border:'1.5px solid #d8cebb', borderRadius:10, padding:'13px', fontSize:13, fontWeight:600, cursor:'pointer' }}>
                    ← Back
                  </button>
                  <button onClick={submitReport} disabled={saving}
                    style={{ flex:2, background: saving ? '#ccc' : '#EF4576', color:'white', border:'none', borderRadius:10, padding:'13px', fontSize:13, fontWeight:700, cursor: saving ? 'default' : 'pointer', fontFamily:"'DM Sans',sans-serif" }}>
                    {saving ? 'Submitting...' : '✅ Submit Incident Report'}
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
                <div style={{ fontSize:32, marginBottom:10 }}>📋</div>
                <div style={{ fontSize:13, fontWeight:600, color:'#5a4a3a', marginBottom:6 }}>No reports yet</div>
                <div style={{ fontSize:11, color:'#9a8a7a' }}>Tap "+ File Report" above to submit an incident report.</div>
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                {myReports.map(r => {
                  const st = STATUS_STYLE[r.status] || STATUS_STYLE.pending
                  return (
                    <div key={r.id} style={{ background:'white', borderRadius:12, border:'1px solid #e5e0d8', padding:'14px 16px' }}>
                      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:10, marginBottom:8 }}>
                        <div>
                          <div style={{ fontSize:13, fontWeight:700, color:'#1a1208' }}>{r.incident_type}</div>
                          <div style={{ fontSize:11, color:'#9a8a7a', marginTop:2 }}>
                            {fmtDatetime(r.date_of_report)} · {r.department}
                          </div>
                        </div>
                        <span style={{ background:st.bg, color:st.color, borderRadius:20, padding:'3px 10px', fontSize:10, fontWeight:700, flexShrink:0 }}>
                          {st.label}
                        </span>
                      </div>
                      <div style={{ fontSize:11, color:'#5a4a3a', lineHeight:1.5, borderTop:'1px solid #f0ede8', paddingTop:8 }}>
                        {r.description?.slice(0, 140)}{r.description?.length > 140 ? '...' : ''}
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
