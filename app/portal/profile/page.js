'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import PortalShell from '../../../components/PortalShell'
import { createClient } from '../../../lib/supabase'
import { getDailyRate } from '../../../lib/payroll'

const peso = n => n != null && n > 0 ? `₱ ${Number(n).toLocaleString('en-PH', { minimumFractionDigits: 2 })}` : '—'
const ROLE_COLORS = {
  'Cafe Supervisor':'#b06af5','Cafe Operations Support':'#4a90c4','Senior Barista':'#7ab648',
  'Junior Barista - Milk Station':'#d4a843','Junior Barista - Cashier':'#e8845a',
  'Executive Chef':'#c0392b','Sous Chef':'#2d7a6a','Kitchen Staff':'#5c3d1e'
}
const getRoleColor = r => ROLE_COLORS[r] || '#7a6a50'
const initials = (f, l) => ((f||'')[0]||'').toUpperCase() + ((l||'')[0]||'').toUpperCase()

const TABS = [
  { id: 'overview',   label: 'Overview' },
  { id: 'payroll',    label: 'Payslips' },
  { id: 'contracts',  label: 'Contracts' },
]

function Field({ label, value }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: '#7a6a50', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 500, color: value && value !== '—' ? '#EF4576' : '#bbb' }}>{value || '—'}</div>
    </div>
  )
}

export default function MyProfilePage() {
  const [staff, setStaff]           = useState(null)
  const [payroll, setPayroll]       = useState([])
  const [contracts, setContracts]   = useState([])
  const [rateOverrides, setRateOverrides] = useState(null)
  const [loading, setLoading]       = useState(true)
  const [activeTab, setActiveTab]   = useState('overview')

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setLoading(false); return }

      const { data: s } = await supabase.from('staff').select('*').eq('email', session.user.email).single()
      if (!s) { setLoading(false); return }
      setStaff(s)

      const [{ data: p }, { data: c }, { data: r }] = await Promise.all([
        supabase.from('payroll_runs').select('*').eq('staff_id', s.id).order('cutoff_start', { ascending: false }).limit(12),
        supabase.from('contracts').select('*').eq('staff_id', s.id).order('created_at', { ascending: false }),
        supabase.from('settings').select('value').eq('key', 'payroll_rates').single(),
      ])
      setPayroll(p || [])
      setContracts(c || [])
      if (r?.value) { try { setRateOverrides(JSON.parse(r.value)) } catch(e) {} }
    } catch(e) { console.error(e) }
    setLoading(false)
  }

  if (loading) return (
    <PortalShell>
      <div style={{ padding: 40, textAlign: 'center', color: '#7a6a50' }}>Loading…</div>
    </PortalShell>
  )

  if (!staff) return (
    <PortalShell>
      <div style={{ padding: 40, textAlign: 'center', color: '#7a6a50' }}>Profile not found.</div>
    </PortalShell>
  )

  const isPartTimeOrFreelance = staff.employment_type === 'Part-time' || staff.employment_type === 'Freelancer'
  const computedDailyRate = getDailyRate(staff.employment_type, staff.role, rateOverrides)
  const computedMonthlyRate = rateOverrides?.[staff.employment_type]?.[staff.role]?.amount || staff.monthly_pay || 0
  const latestPayslip = payroll[0]

  return (
    <PortalShell>
      {/* Header */}
      <div style={{ background: 'white', borderBottom: '1px solid #d8cebb', padding: '0 20px', height: 52, display: 'flex', alignItems: 'center', gap: 10 }}>
        <a href="/portal" style={{ fontSize: 12, color: '#7a6a50', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>← Home</a>
        <span style={{ color: '#d8cebb' }}>/</span>
        <span style={{ fontSize: 12, fontWeight: 600, color: '#EF4576' }}>My Profile</span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>

        {/* Profile hero card */}
        <div style={{ background: 'white', border: '1px solid #e8e0d5', borderRadius: 16, padding: '20px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 60, height: 60, borderRadius: '50%', background: getRoleColor(staff.role), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 700, color: 'white', flexShrink: 0 }}>
            {initials(staff.first_name, staff.last_name)}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: "'Montserrat',sans-serif", fontSize: 18, fontWeight: 800, color: '#1a1208' }}>
              {staff.first_name} {staff.last_name}
              {staff.nickname && <span style={{ fontSize: 13, fontWeight: 400, color: '#7a6a50', marginLeft: 8 }}>"{staff.nickname}"</span>}
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 6, background: getRoleColor(staff.role) + '22', color: getRoleColor(staff.role) }}>{staff.role}</span>
              <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 6, background: '#f0ede8', color: '#7a6a50' }}>{staff.employment_type || 'Full-time'}</span>
              <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 6, background: '#eef7e4', color: '#4a7a1e', fontWeight: 600 }}>{staff.status || 'active'}</span>
            </div>
          </div>
        </div>

        {/* Summary chips */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 16 }}>
          {[
            { label: 'Latest Net Pay', value: latestPayslip ? `₱ ${Math.round(latestPayslip.net_pay).toLocaleString('en-PH')}` : '—', color: '#4a7a1e', bg: '#eef7e4' },
            { label: 'Pending Contracts', value: contracts.filter(c => c.status === 'pending').length, color: contracts.filter(c => c.status === 'pending').length > 0 ? '#c0392b' : '#7a6a50', bg: contracts.filter(c => c.status === 'pending').length > 0 ? '#fdeaea' : '#f0ede8' },
          ].map(k => (
            <div key={k.label} style={{ background: k.bg, border: `1px solid ${k.color}33`, borderRadius: 12, padding: '14px 16px' }}>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: '#7a6a50', marginBottom: 4 }}>{k.label}</div>
              <div style={{ fontFamily: "'Montserrat',sans-serif", fontSize: 22, fontWeight: 800, color: k.color }}>{k.value}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 14, background: '#f0ede8', borderRadius: 10, padding: 4 }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              style={{ flex: 1, padding: '8px 0', fontSize: 11, fontWeight: 700, border: 'none', borderRadius: 8, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif", transition: 'all .15s',
                background: activeTab === t.id ? 'white' : 'transparent',
                color: activeTab === t.id ? '#EF4576' : '#7a6a50',
                boxShadow: activeTab === t.id ? '0 1px 4px rgba(0,0,0,.08)' : 'none',
              }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ── OVERVIEW TAB ── */}
        {activeTab === 'overview' && (
          <>
            {/* Employment */}
            <div style={{ background: 'white', border: '1px solid #e8e0d5', borderRadius: 14, padding: '16px 18px', marginBottom: 12 }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: '#7a6a50', marginBottom: 14, paddingBottom: 8, borderBottom: '1px solid #f0ede8' }}>Employment</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                <Field label="Role" value={staff.role} />
                <Field label="Employment Type" value={staff.employment_type} />
                <Field label="Status" value={staff.status || 'active'} />
                <Field label="Min Shifts / Week" value={staff.min_shifts_per_week > 0 ? `${staff.min_shifts_per_week} shifts` : null} />
              </div>
            </div>

            {/* Compensation */}
            <div style={{ background: 'white', border: '1px solid #e8e0d5', borderRadius: 14, padding: '16px 18px', marginBottom: 12 }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: '#7a6a50', marginBottom: 14, paddingBottom: 8, borderBottom: '1px solid #f0ede8' }}>Compensation</div>
              {isPartTimeOrFreelance ? (
                <Field label="Daily Rate" value={computedDailyRate > 0 ? `₱ ${computedDailyRate.toLocaleString('en-PH')}` : null} />
              ) : (
                <Field label="Monthly Pay" value={computedMonthlyRate > 0 ? `₱ ${computedMonthlyRate.toLocaleString('en-PH')}` : null} />
              )}
              <Field label="Service Charge Eligible" value={staff.service_charge_eligible ? 'Yes' : 'No'} />
            </div>

            {/* Contact */}
            <div style={{ background: 'white', border: '1px solid #e8e0d5', borderRadius: 14, padding: '16px 18px' }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: '#7a6a50', marginBottom: 14, paddingBottom: 8, borderBottom: '1px solid #f0ede8' }}>Contact</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                <Field label="Email" value={staff.email} />
                <Field label="Phone" value={staff.phone} />
              </div>
            </div>
          </>
        )}

        {/* ── PAYSLIPS TAB ── */}
        {activeTab === 'payroll' && (
          <div style={{ background: 'white', border: '1px solid #e8e0d5', borderRadius: 14, overflow: 'hidden' }}>
            {payroll.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#7a6a50', fontSize: 13 }}>No payslip records yet.</div>
            ) : payroll.map((p, i) => (
              <div key={p.id} style={{ padding: '14px 18px', borderBottom: i < payroll.length - 1 ? '1px solid #f0ede8' : 'none' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#1a1208' }}>{p.cutoff_label}</div>
                    <div style={{ fontSize: 10, color: '#7a6a50', marginTop: 2 }}>{p.days_worked} days · {p.paid_hours}h paid</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 15, fontWeight: 800, color: '#4a7a1e', fontFamily: "'DM Mono',monospace" }}>
                      ₱ {Math.round(p.net_pay).toLocaleString('en-PH')}
                    </div>
                    <div style={{ fontSize: 9, color: '#7a6a50', marginTop: 1 }}>net pay</div>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginTop: 10 }}>
                  {[
                    { label: 'Gross', value: `₱ ${Math.round(p.gross).toLocaleString('en-PH')}`, color: '#1a1208' },
                    { label: 'Deductions', value: `-₱ ${Math.round(p.total_deductions).toLocaleString('en-PH')}`, color: '#c0392b' },
                    { label: 'Late', value: p.total_late_mins > 0 ? `${p.total_late_mins} min` : '—', color: p.total_late_mins > 0 ? '#c0392b' : '#bbb' },
                  ].map(x => (
                    <div key={x.label} style={{ background: '#f8f5f0', borderRadius: 8, padding: '8px 10px' }}>
                      <div style={{ fontSize: 9, color: '#7a6a50', marginBottom: 2 }}>{x.label}</div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: x.color, fontFamily: "'DM Mono',monospace" }}>{x.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── CONTRACTS TAB ── */}
        {activeTab === 'contracts' && (
          <div style={{ background: 'white', border: '1px solid #e8e0d5', borderRadius: 14, overflow: 'hidden' }}>
            {contracts.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#7a6a50', fontSize: 13 }}>No contracts on file.</div>
            ) : contracts.map((c, i) => {
              const statusColor = c.status === 'signed' ? '#4a7a1e' : c.status === 'pending' ? '#c0392b' : '#7a6a50'
              const statusBg    = c.status === 'signed' ? '#eef7e4' : c.status === 'pending' ? '#fdeaea' : '#f0ede8'
              return (
                <div key={c.id} style={{ padding: '14px 18px', borderBottom: i < contracts.length - 1 ? '1px solid #f0ede8' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#1a1208' }}>{c.title || 'Contract'}</div>
                    <div style={{ fontSize: 10, color: '#7a6a50', marginTop: 2 }}>
                      {c.created_at ? new Date(c.created_at).toLocaleDateString('en-PH', { year:'numeric', month:'short', day:'numeric' }) : ''}
                    </div>
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 20, background: statusBg, color: statusColor }}>
                    {c.status || 'draft'}
                  </span>
                </div>
              )
            })}
          </div>
        )}

      </div>
    </PortalShell>
  )
}
