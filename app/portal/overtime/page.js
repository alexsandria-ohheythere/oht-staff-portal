'use client'
export const dynamic = 'force-dynamic'
// ─────────────────────────────────────────────
// OHT Staff Portal — Overtime
// Place at: app/portal/overtime/page.js
//
// Management-initiated flow:
//   1. Management requests overtime from a staff member (Command Center)
//   2. Staff Accepts or Declines here — decline is a dead end, no auto-retry
//   3. Once accepted, staff submits the OFFICIAL period actually worked
//      (may differ from what management asked for)
//   4. Management approves or rejects the submitted period (Command Center) —
//      reject is a dead end. Approval reflects pay into the SAME payroll
//      cutoff the shift belongs to.
// ─────────────────────────────────────────────
import { useState, useEffect } from 'react'
import PortalShell from '../../../components/PortalShell'
import { createClient } from '../../../lib/supabase'
import { notifyAdmins } from '../../../lib/notify'

const SHIFT_LABELS = { am: 'AM · 6:30AM–3:30PM', ops: 'OPS · 8:00AM–5:00PM', mid: 'MID · 11AM–8PM', pm: 'PM · 3PM–11PM' }
const fmtDate = iso => new Date(iso + 'T00:00:00').toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric' })
const peso = n => '₱' + (parseFloat(n) || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// Duration between two HH:MM 24hr times, in decimal hours. Handles crossing midnight
// (unusual for overtime, but a late-closing shift could run past 12am).
function hoursBetween(timeIn, timeOut) {
  const [inH, inM] = timeIn.split(':').map(Number)
  const [outH, outM] = timeOut.split(':').map(Number)
  let mins = (outH * 60 + outM) - (inH * 60 + inM)
  if (mins <= 0) mins += 24 * 60
  return Math.round((mins / 60) * 100) / 100
}

export default function OvertimePage() {
  const [staffId, setStaffId]         = useState(null)
  const [firstName, setFirstName]     = useState('')
  const [myRequests, setMyRequests]   = useState([])
  const [loading, setLoading]         = useState(true)
  const [busy, setBusy]               = useState(null) // request id currently being acted on
  const [toast, setToast]             = useState(null)

  const [declineNotes, setDeclineNotes] = useState({}) // by request id
  const [submitForms, setSubmitForms]   = useState({}) // by request id: { timeIn, timeOut, note }

  useEffect(() => {
    const sb = createClient()
    sb.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) return
      try {
        const { data: staff } = await sb.from('staff').select('id, first_name').eq('email', session.user.email).single()
        if (!staff) return
        setStaffId(staff.id)
        setFirstName(staff.first_name || '')
        const { data: requests } = await sb.from('overtime_requests').select('*').eq('staff_id', staff.id).order('created_at', { ascending: false })
        setMyRequests(requests || [])
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    })
  }, [])

  function showToast(icon, msg) { setToast({ icon, msg }); setTimeout(() => setToast(null), 3500) }
  function patchLocal(id, patch) { setMyRequests(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r)) }

  async function respond(req, accept) {
    setBusy(req.id)
    const sb = createClient()
    const patch = accept
      ? { status: 'accepted', responded_at: new Date().toISOString() }
      : { status: 'declined', responded_at: new Date().toISOString(), decline_note: (declineNotes[req.id] || '').trim() || null }
    const { error } = await sb.from('overtime_requests').update(patch).eq('id', req.id)
    setBusy(null)
    if (error) { showToast('❌', error.message); return }
    patchLocal(req.id, patch)
    showToast(accept ? '✅' : '👍', accept ? "Accepted — now submit the actual period you worked" : 'Declined')
    notifyAdmins({
      type: accept ? 'general' : 'general',
      title: accept ? `⏰ ${firstName} accepted overtime` : `⏰ ${firstName} declined overtime`,
      message: accept
        ? `${firstName} accepted the ${req.requested_hours}h overtime request for ${fmtDate(req.shift_date)} (${req.cutoff_label}) and will submit the actual period worked.`
        : `${firstName} declined the overtime request for ${fmtDate(req.shift_date)} (${req.cutoff_label}).${patch.decline_note ? ' Reason: ' + patch.decline_note : ''}`,
    }).catch(() => {})
  }

  function setSubmitField(id, field, val) {
    setSubmitForms(prev => ({ ...prev, [id]: { ...(prev[id] || {}), [field]: val } }))
  }

  async function submitPeriod(req) {
    const form = submitForms[req.id] || {}
    if (!form.timeIn || !form.timeOut) { showToast('⚠️', 'Enter both the start and end time you actually worked'); return }
    const actualHours = hoursBetween(form.timeIn, form.timeOut)
    setBusy(req.id)
    const sb = createClient()
    const patch = {
      status: 'submitted',
      actual_time_in: form.timeIn,
      actual_time_out: form.timeOut,
      actual_hours: actualHours,
      submitted_at: new Date().toISOString(),
    }
    const { error } = await sb.from('overtime_requests').update(patch).eq('id', req.id)
    setBusy(null)
    if (error) { showToast('❌', error.message); return }
    patchLocal(req.id, patch)
    showToast('✅', 'Submitted — waiting on management to approve')
    notifyAdmins({
      type: 'general',
      title: `⏰ ${firstName} submitted overtime period`,
      message: `${firstName} submitted ${actualHours}h actually worked (${form.timeIn}–${form.timeOut}) for ${fmtDate(req.shift_date)} (${req.cutoff_label}) — requested was ${req.requested_hours}h.`,
    }).catch(() => {})
  }

  const needsResponse   = myRequests.filter(r => r.status === 'requested')
  const needsSubmission = myRequests.filter(r => r.status === 'accepted')
  const history         = myRequests.filter(r => !['requested', 'accepted'].includes(r.status))

  function StatusPill({ req }) {
    if (req.status === 'declined') return <span style={pillStyle('#f3f4f6', '#6b7280')}>👍 You declined</span>
    if (req.status === 'cancelled') return <span style={pillStyle('#f3f4f6', '#6b7280')}>🗑️ Cancelled by management</span>
    if (req.status === 'submitted') return <span style={pillStyle('#fef3e2', '#a06000')}>⏳ Awaiting approval</span>
    if (req.status === 'rejected') return <span style={pillStyle('#fdeaea', '#c0392b')}>✗ Rejected</span>
    if (req.status === 'approved') {
      const amt = req.amount != null ? peso(req.amount) : null
      return req.applied
        ? <span style={pillStyle('#eef7e4', '#4a7a1e')}>✓ {amt || 'Approved'} added to {req.cutoff_label}</span>
        : <span style={pillStyle('#eef7e4', '#4a7a1e')}>✓ Approved{amt ? ` — ${amt}` : ''} · {req.cutoff_label} payroll</span>
    }
    return null
  }
  const pillStyle = (bg, color) => ({ fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 10, background: bg, color })

  const cardStyle = { background: 'white', borderRadius: 16, border: '1px solid #e5e7eb', overflow: 'hidden', marginBottom: 20 }
  const cardHeadStyle = { padding: '12px 18px', borderBottom: '1px solid #f3f4f6', background: '#f9fafb' }
  const cardHeadLabel = { fontSize: 11, fontWeight: 700, color: '#6b7280', margin: 0, letterSpacing: 1, textTransform: 'uppercase' }

  return (
    <PortalShell>
      <div style={{ flex: 1, overflowY: 'auto', background: '#f5f0e8' }}>

        {/* Header */}
        <div style={{ background: 'white', borderBottom: '1px solid #e5e7eb', padding: '16px 20px' }}>
          <div style={{ fontFamily: "'Montserrat',sans-serif", fontSize: 17, fontWeight: 800, color: '#1f2937' }}>Overtime</div>
          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>Management requests overtime here — you accept or decline, then submit the actual time you worked for approval.</div>
        </div>

        <div style={{ padding: 20, maxWidth: 640 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af', fontSize: 13 }}>Loading…</div>
          ) : (
            <>
              {/* Needs response */}
              {needsResponse.length > 0 && (
                <div style={cardStyle}>
                  <div style={cardHeadStyle}><p style={cardHeadLabel}>Needs Your Response</p></div>
                  <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {needsResponse.map(r => (
                      <div key={r.id} style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 14, background: '#fafafa' }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#111' }}>{fmtDate(r.shift_date)} · {SHIFT_LABELS[r.shift_type] || r.shift_type || ''}</div>
                        <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>{r.cutoff_label} · management is asking for {r.requested_hours}h overtime</div>
                        {r.requested_note && <div style={{ fontSize: 11, color: '#6b7280', marginTop: 8, fontStyle: 'italic' }}>"{r.requested_note}"</div>}
                        <input value={declineNotes[r.id] || ''} onChange={e => setDeclineNotes(prev => ({ ...prev, [r.id]: e.target.value }))}
                          placeholder="Reason if declining (optional)" style={{ ...inputStyle, marginTop: 10 }} />
                        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                          <button onClick={() => respond(r, false)} disabled={busy === r.id}
                            style={{ flex: 1, background: 'white', border: '1px solid #e5e7eb', color: '#6b7280', borderRadius: 9, padding: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif" }}>Decline</button>
                          <button onClick={() => respond(r, true)} disabled={busy === r.id}
                            style={{ flex: 1, background: '#EF4576', border: 'none', color: 'white', borderRadius: 9, padding: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif" }}>{busy === r.id ? '…' : 'Accept'}</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Needs submission */}
              {needsSubmission.length > 0 && (
                <div style={cardStyle}>
                  <div style={cardHeadStyle}><p style={cardHeadLabel}>Submit Your Overtime Period</p></div>
                  <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {needsSubmission.map(r => {
                      const form = submitForms[r.id] || {}
                      return (
                        <div key={r.id} style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 14, background: '#fafafa' }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: '#111' }}>{fmtDate(r.shift_date)} · {SHIFT_LABELS[r.shift_type] || r.shift_type || ''}</div>
                          <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>{r.cutoff_label} · requested {r.requested_hours}h — enter what you actually worked</div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
                            <div>
                              <label style={labelStyle}>Started at</label>
                              <input type="time" value={form.timeIn || ''} onChange={e => setSubmitField(r.id, 'timeIn', e.target.value)} style={inputStyle} />
                            </div>
                            <div>
                              <label style={labelStyle}>Ended at</label>
                              <input type="time" value={form.timeOut || ''} onChange={e => setSubmitField(r.id, 'timeOut', e.target.value)} style={inputStyle} />
                            </div>
                          </div>
                          {form.timeIn && form.timeOut && (
                            <div style={{ fontSize: 11, color: '#4a7a1e', marginTop: 6, fontWeight: 600 }}>= {hoursBetween(form.timeIn, form.timeOut)}h</div>
                          )}
                          <button onClick={() => submitPeriod(r)} disabled={busy === r.id}
                            style={{ width: '100%', marginTop: 10, background: '#EF4576', color: 'white', border: 'none', borderRadius: 9, padding: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif" }}>
                            {busy === r.id ? 'Submitting…' : 'Submit for Approval'}
                          </button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* History */}
              <div style={cardStyle}>
                <div style={cardHeadStyle}><p style={cardHeadLabel}>History</p></div>
                {history.length === 0 ? (
                  <div style={{ padding: 30, textAlign: 'center', color: '#9ca3af', fontSize: 12 }}>Nothing here yet.</div>
                ) : (
                  history.map((r, i) => (
                    <div key={r.id} style={{ padding: '14px 18px', borderBottom: i < history.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: '#111' }}>{fmtDate(r.shift_date)} · {SHIFT_LABELS[r.shift_type] || r.shift_type || ''}</div>
                          <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>
                            {r.cutoff_label} · requested {r.requested_hours}h{r.actual_hours != null ? ` · worked ${r.actual_hours}h` : ''}
                          </div>
                        </div>
                        <StatusPill req={r} />
                      </div>
                      {r.requested_note && <div style={{ fontSize: 11, color: '#6b7280', marginTop: 8, fontStyle: 'italic' }}>"{r.requested_note}"</div>}
                      {r.status === 'declined' && r.decline_note && <div style={{ fontSize: 11, color: '#6b7280', marginTop: 6 }}>You said: {r.decline_note}</div>}
                      {r.status === 'rejected' && r.review_note && <div style={{ fontSize: 11, color: '#c0392b', marginTop: 6 }}>Management note: {r.review_note}</div>}
                      {r.status === 'approved' && r.review_note && <div style={{ fontSize: 11, color: '#4a7a1e', marginTop: 6 }}>Management note: {r.review_note}</div>}
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {toast && (
        <div style={{ position: 'fixed', bottom: 22, right: 22, background: '#1f2937', color: 'white', borderRadius: 12, padding: '12px 16px', fontSize: 12, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 9, boxShadow: '0 8px 28px rgba(0,0,0,.2)', zIndex: 1000 }}>
          <span>{toast.icon}</span><span>{toast.msg}</span>
        </div>
      )}
    </PortalShell>
  )
}

const labelStyle = { display: 'block', fontSize: 11, fontWeight: 700, color: '#374151', marginBottom: 6, marginTop: 4 }
const inputStyle = { width: '100%', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 9, padding: '9px 12px', fontSize: 13, outline: 'none', fontFamily: "'DM Sans',sans-serif", color: '#111', boxSizing: 'border-box' }
