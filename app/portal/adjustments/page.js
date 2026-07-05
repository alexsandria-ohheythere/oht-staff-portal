'use client'
export const dynamic = 'force-dynamic'
// ─────────────────────────────────────────────
// OHT Staff Portal — Timesheet Adjustment
// Place at: app/portal/adjustments/page.js
// ─────────────────────────────────────────────
import { useState, useEffect, useMemo } from 'react'
import PortalShell from '../../../components/PortalShell'
import { createClient } from '../../../lib/supabase'

// Kept in sync with CUTOFF_PERIODS in the Command Center's lib/payroll.js —
// cutoff_id here must match exactly since the Command Center joins on it.
const CUTOFF_PERIODS = [
  { id: 1,  label: 'Mar 31 – Apr 14', start: '2026-03-31', end: '2026-04-14' },
  { id: 2,  label: 'Apr 15 – Apr 30', start: '2026-04-15', end: '2026-04-30' },
  { id: 3,  label: 'May 1 – May 14',  start: '2026-05-01', end: '2026-05-14' },
  { id: 4,  label: 'May 15 – May 30', start: '2026-05-15', end: '2026-05-30' },
  { id: 5,  label: 'May 31 – Jun 14', start: '2026-05-31', end: '2026-06-14' },
  { id: 6,  label: 'Jun 15 – Jun 29', start: '2026-06-15', end: '2026-06-29' },
  { id: 7,  label: 'Jun 30 – Jul 14', start: '2026-06-30', end: '2026-07-14' },
  { id: 8,  label: 'Jul 15 – Jul 30', start: '2026-07-15', end: '2026-07-30' },
  { id: 9,  label: 'Jul 31 – Aug 14', start: '2026-07-31', end: '2026-08-14' },
  { id: 10, label: 'Aug 15 – Aug 29', start: '2026-08-15', end: '2026-08-29' },
  { id: 11, label: 'Aug 30 – Sep 14', start: '2026-08-30', end: '2026-09-14' },
  { id: 12, label: 'Sep 15 – Sep 29', start: '2026-09-15', end: '2026-09-29' },
  { id: 13, label: 'Sep 30 – Oct 14', start: '2026-09-30', end: '2026-10-14' },
  { id: 14, label: 'Oct 15 – Oct 30', start: '2026-10-15', end: '2026-10-30' },
  { id: 15, label: 'Oct 31 – Nov 14', start: '2026-10-31', end: '2026-11-14' },
  { id: 16, label: 'Nov 15 – Nov 29', start: '2026-11-15', end: '2026-11-29' },
  { id: 17, label: 'Nov 30 – Dec 14', start: '2026-11-30', end: '2026-12-14' },
  { id: 18, label: 'Dec 15 – Dec 30', start: '2026-12-15', end: '2026-12-30' },
]
const cutoffForDate = iso => CUTOFF_PERIODS.find(p => iso >= p.start && iso <= p.end)

const SHIFT_LABELS = { am: 'AM · 6:30AM–3:30PM', ops: 'OPS · 8:00AM–5:00PM', mid: 'MID · 11AM–8PM', pm: 'PM · 3PM–11PM' }
const ISSUE_OPTIONS = [
  { value: 'no_time_in',      label: "Couldn't clock in",        hint: 'Time-in is missing from the timesheet' },
  { value: 'no_time_out',     label: "Couldn't clock out",       hint: 'Time-out is missing from the timesheet' },
  { value: 'wrong_time',      label: 'Wrong time recorded',      hint: 'Time-in or time-out on file is incorrect' },
  { value: 'missed_entirely', label: 'Entire shift missing',     hint: "Shift doesn't appear on the timesheet at all" },
]
const todayISO = () => new Date().toISOString().split('T')[0]
const fmtDate = iso => new Date(iso + 'T00:00:00').toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric' })

export default function TimesheetAdjustmentPage() {
  const [staffId, setStaffId]         = useState(null)
  const [myShifts, setMyShifts]       = useState([])
  const [myRequests, setMyRequests]   = useState([])
  const [loading, setLoading]         = useState(true)
  const [submitting, setSubmitting]   = useState(false)
  const [toast, setToast]             = useState(null)

  const [shiftKey, setShiftKey]       = useState('')   // "date|shiftType"
  const [issueType, setIssueType]     = useState('')
  const [timeIn, setTimeIn]           = useState('')
  const [timeOut, setTimeOut]         = useState('')
  const [reason, setReason]           = useState('')

  useEffect(() => {
    const sb = createClient()
    sb.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) return
      try {
        const { data: staff } = await sb.from('staff').select('id').eq('email', session.user.email).single()
        if (!staff) return
        setStaffId(staff.id)

        // Only allow filing against the current cutoff and the one before it —
        // keeps this to "I couldn't clock in recently", not old disputes.
        const current = cutoffForDate(todayISO())
        const prev = current ? CUTOFF_PERIODS.find(p => p.id === current.id - 1) : null
        const windowStart = prev ? prev.start : (current ? current.start : todayISO())
        const windowEnd = current ? current.end : todayISO()

        const [{ data: shifts }, { data: requests }] = await Promise.all([
          sb.from('schedules').select('shift_date,shift_type').eq('staff_id', staff.id).eq('published', true)
            .gte('shift_date', windowStart).lte('shift_date', windowEnd).order('shift_date', { ascending: false }),
          sb.from('timesheet_adjustments').select('*').eq('staff_id', staff.id).order('created_at', { ascending: false }),
        ])
        setMyShifts(shifts || [])
        setMyRequests(requests || [])
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    })
  }, [])

  function showToast(icon, msg) { setToast({ icon, msg }); setTimeout(() => setToast(null), 3500) }

  const alreadyFiledKeys = useMemo(() =>
    new Set(myRequests.filter(r => r.status !== 'rejected').map(r => `${r.shift_date}|${r.shift_type}`)),
    [myRequests]
  )
  const availableShifts = myShifts.filter(s => !alreadyFiledKeys.has(`${s.shift_date}|${s.shift_type}`))

  function resetForm() {
    setShiftKey(''); setIssueType(''); setTimeIn(''); setTimeOut(''); setReason('')
  }

  async function submitRequest() {
    if (!shiftKey || !issueType || !timeIn || !timeOut) { showToast('⚠️', 'Fill in the shift, issue, and both times'); return }
    const [shiftDate, shiftType] = shiftKey.split('|')
    const cutoff = cutoffForDate(shiftDate)
    if (!cutoff) { showToast('❌', "Couldn't match this date to a payroll cutoff — contact HR directly"); return }
    setSubmitting(true)
    const sb = createClient()
    const { data, error } = await sb.from('timesheet_adjustments').insert([{
      staff_id: staffId,
      cutoff_id: cutoff.id,
      cutoff_label: cutoff.label,
      shift_date: shiftDate,
      shift_type: shiftType,
      issue_type: issueType,
      claimed_time_in: timeIn,
      claimed_time_out: timeOut,
      reason: reason.trim() || null,
      status: 'pending',
    }]).select().single()
    setSubmitting(false)
    if (error) { showToast('❌', error.message); return }
    setMyRequests(prev => [data, ...prev])
    resetForm()
    showToast('✅', 'Adjustment request sent for review')
  }

  function StatusPill({ req }) {
    if (req.status === 'pending') return <span style={pillStyle('#fef3e2', '#a06000')}>⏳ Pending review</span>
    if (req.status === 'rejected') return <span style={pillStyle('#fdeaea', '#c0392b')}>✗ Rejected</span>
    if (req.resolution === 'timesheet_correction') {
      return req.applied
        ? <span style={pillStyle('#eef7e4', '#4a7a1e')}>✓ Timesheet corrected</span>
        : <span style={pillStyle('#eef7e4', '#4a7a1e')}>✓ Approved — will be corrected</span>
    }
    if (req.resolution === 'refund') {
      const amt = '₱' + Math.round(req.refund_amount || 0).toLocaleString('en-PH')
      return req.applied
        ? <span style={pillStyle('#eef7e4', '#4a7a1e')}>✓ {amt} refunded</span>
        : <span style={pillStyle('#eef7e4', '#4a7a1e')}>✓ {amt} refund — next payslip</span>
    }
    return <span style={pillStyle('#f3f4f6', '#6b7280')}>Approved</span>
  }
  const pillStyle = (bg, color) => ({ fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 10, background: bg, color })

  return (
    <PortalShell>
      <div style={{ flex: 1, overflowY: 'auto', background: '#f5f0e8' }}>

        {/* Header */}
        <div style={{ background: 'white', borderBottom: '1px solid #e5e7eb', padding: '16px 20px' }}>
          <div style={{ fontFamily: "'Montserrat',sans-serif", fontSize: 17, fontWeight: 800, color: '#1f2937' }}>Timesheet Adjustment</div>
          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>Couldn't clock in or out? File it here and HR will review it.</div>
        </div>

        <div style={{ padding: 20, maxWidth: 640 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af', fontSize: 13 }}>Loading…</div>
          ) : (
            <>
              {/* Filing form */}
              <div style={{ background: 'white', borderRadius: 16, border: '1px solid #e5e7eb', padding: 18, marginBottom: 20 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#111', marginBottom: 14 }}>File a request</div>

                {availableShifts.length === 0 ? (
                  <div style={{ fontSize: 12, color: '#9ca3af', background: '#f9fafb', borderRadius: 10, padding: '14px 16px', textAlign: 'center' }}>
                    No eligible shifts to file for right now — either nothing's published for this cutoff yet, or you've already filed for all of them.
                  </div>
                ) : (
                  <>
                    <label style={labelStyle}>Which shift?</label>
                    <select value={shiftKey} onChange={e => setShiftKey(e.target.value)} style={inputStyle}>
                      <option value="">Select a shift…</option>
                      {availableShifts.map(s => (
                        <option key={`${s.shift_date}|${s.shift_type}`} value={`${s.shift_date}|${s.shift_type}`}>
                          {fmtDate(s.shift_date)} · {SHIFT_LABELS[s.shift_type] || s.shift_type}
                        </option>
                      ))}
                    </select>

                    <label style={labelStyle}>What went wrong?</label>
                    <select value={issueType} onChange={e => setIssueType(e.target.value)} style={inputStyle}>
                      <option value="">Select an issue…</option>
                      {ISSUE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                    {issueType && <div style={{ fontSize: 10, color: '#9ca3af', marginTop: -8, marginBottom: 12 }}>{ISSUE_OPTIONS.find(o => o.value === issueType)?.hint}</div>}

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <div>
                        <label style={labelStyle}>What time did you actually clock in?</label>
                        <input type="time" value={timeIn} onChange={e => setTimeIn(e.target.value)} style={inputStyle} />
                      </div>
                      <div>
                        <label style={labelStyle}>What time did you actually clock out?</label>
                        <input type="time" value={timeOut} onChange={e => setTimeOut(e.target.value)} style={inputStyle} />
                      </div>
                    </div>

                    <label style={labelStyle}>Anything HR should know? (optional)</label>
                    <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3}
                      placeholder="e.g. Timesheet kiosk was down when I arrived"
                      style={{ ...inputStyle, resize: 'vertical', fontFamily: "'DM Sans',sans-serif" }} />

                    <button onClick={submitRequest} disabled={submitting}
                      style={{ width: '100%', marginTop: 6, background: '#EF4576', color: 'white', border: 'none', borderRadius: 10, padding: 12, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif" }}>
                      {submitting ? 'Sending…' : 'Submit for Review'}
                    </button>
                  </>
                )}
              </div>

              {/* History */}
              <div style={{ background: 'white', borderRadius: 16, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
                <div style={{ padding: '12px 18px', borderBottom: '1px solid #f3f4f6', background: '#f9fafb' }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', margin: 0, letterSpacing: 1, textTransform: 'uppercase' }}>My Requests</p>
                </div>
                {myRequests.length === 0 ? (
                  <div style={{ padding: 30, textAlign: 'center', color: '#9ca3af', fontSize: 12 }}>You haven't filed any adjustment requests.</div>
                ) : (
                  myRequests.map((r, i) => (
                    <div key={r.id} style={{ padding: '14px 18px', borderBottom: i < myRequests.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: '#111' }}>{fmtDate(r.shift_date)} · {SHIFT_LABELS[r.shift_type] || r.shift_type}</div>
                          <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>{r.cutoff_label} · {ISSUE_OPTIONS.find(o => o.value === r.issue_type)?.label || r.issue_type}</div>
                        </div>
                        <StatusPill req={r} />
                      </div>
                      {r.reason && <div style={{ fontSize: 11, color: '#6b7280', marginTop: 8, fontStyle: 'italic' }}>"{r.reason}"</div>}
                      {r.status === 'rejected' && r.review_note && <div style={{ fontSize: 11, color: '#c0392b', marginTop: 6 }}>HR note: {r.review_note}</div>}
                      {r.resolution === 'refund' && r.calc_hourly_rate != null && (
                        <div style={{ marginTop: 8, background: '#f6faf3', border: '1px solid #d9ecc7', borderRadius: 10, padding: '10px 12px' }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: '#4a7a1e' }}>How this amount was worked out</div>
                          <div style={{ fontSize: 11, color: '#4b5563', marginTop: 4 }}>
                            You were originally paid for {r.calc_original_paid_hours}h ({r.calc_original_late_mins}m marked late) on this shift. Once corrected, it's {r.calc_corrected_paid_hours}h ({r.calc_corrected_late_mins}m late), at ₱{r.calc_hourly_rate}/hr.
                          </div>
                          <div style={{ fontSize: 11, color: '#4b5563', marginTop: 4 }}>
                            Late deduction adjusted: ₱{Math.round(r.calc_recorded_late_deduction)} → ₱{Math.round(r.calc_supposed_late_deduction)} (₱{Math.round(r.calc_late_refund)} back)
                          </div>
                          <div style={{ fontSize: 11, color: '#4b5563', marginTop: 2 }}>
                            Extra hours credited: ₱{Math.round(r.calc_extra_hours_credit)}
                          </div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: '#4a7a1e', marginTop: 6 }}>
                            Total: ₱{Math.round(r.refund_amount).toLocaleString('en-PH')}
                          </div>
                        </div>
                      )}
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

const labelStyle = { display: 'block', fontSize: 11, fontWeight: 700, color: '#374151', marginBottom: 6, marginTop: 12 }
const inputStyle = { width: '100%', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 9, padding: '9px 12px', fontSize: 13, outline: 'none', fontFamily: "'DM Sans',sans-serif", color: '#111', boxSizing: 'border-box' }
