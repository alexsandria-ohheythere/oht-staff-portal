'use client'
export const dynamic = 'force-dynamic'
import { useState, useEffect } from 'react'
import PortalShell from '../../../components/PortalShell'
import { createClient } from '../../../lib/supabase'
import { generatePayslipPDF, buildPayslipRun } from '../../../lib/payslipPdf'

// ── Inlined rate logic (mirrors Command Center lib/payroll.js) so the portal
//    has no cross-file dependency on lib/payroll. Reads Settings overrides too.
const RATES = {
  'Full-time': {
    'Senior Barista':{monthly:17000},'Executive Chef':{monthly:17000},
    'Junior Barista - Milk Station':{monthly:14000},'Junior Barista - Cashier':{monthly:14000},
    'Sous Chef':{monthly:15000},
  },
  'Part-time': {
    'Senior Barista':{daily:850},'Executive Chef':{daily:850},
    'Junior Barista - Milk Station':{daily:700},'Junior Barista - Cashier':{daily:700},
    'Sous Chef':{daily:700},'Kitchen Staff':{daily:700},
  },
  'Freelancer': {
    'Cafe Supervisor':{daily:1150},'Cafe Operations Support':{daily:750},
    'Senior Barista':{daily:850},'Executive Chef':{daily:850},
    'Junior Barista - Milk Station':{daily:700},'Junior Barista - Cashier':{daily:700},
    'Sous Chef':{daily:700},'Kitchen Staff':{daily:700},
  },
}
function getBaseRate(employment_type, role, overrideRates=null){
  const source = overrideRates || RATES
  const entry = source[employment_type]?.[role]
  if(!entry) return null
  if(entry.type==='monthly') return {monthly:entry.amount}
  if(entry.type==='daily')   return {daily:entry.amount}
  return entry
}
function getDailyRate(employment_type, role, overrideRates=null){
  const rate = getBaseRate(employment_type, role, overrideRates)
  if(!rate) return 0
  if(rate.daily) return rate.daily
  if(rate.monthly) return Math.round(rate.monthly/26)
  return 0
}

const peso = n => '₱'+(parseFloat(n)||0).toLocaleString('en-PH',{minimumFractionDigits:2,maximumFractionDigits:2})

export default function MyPayslip() {
  const [staff, setStaff]       = useState(null)
  const [payRuns, setPayRuns]   = useState([])
  const [selected, setSelected] = useState(null)
  const [schedules, setSchedules] = useState([])
  const [leaves, setLeaves]     = useState([])
  const [dayOffs, setDayOffs]   = useState([])
  const [rateOverrides, setRateOverrides] = useState(null)
  const [loading, setLoading]   = useState(true)

  useEffect(()=>{ fetchData() },[])

  async function fetchData() {
    const supabase=createClient()
    const {data:{session}}=await supabase.auth.getSession(); if(!session) return
    // Self-scope: only this staff member's own record and runs
    const {data:s}=await supabase.from('staff').select('*').eq('email',session.user.email).single()
    if(!s){setLoading(false);return}
    setStaff(s)
    const {data:runs}=await supabase.from('payroll_runs').select('*').eq('staff_id',s.id).order('cutoff_start',{ascending:false})
    setPayRuns(runs||[])
    if(runs&&runs.length>0) setSelected(runs[0])
    // Attendance refs (own rows only). Degrades gracefully if RLS blocks.
    try {
      const {data:sch}=await supabase.from('schedules').select('staff_id,shift_date,published').eq('staff_id',s.id).eq('published',true)
      setSchedules(sch||[])
      const {data:lv}=await supabase.from('leave_requests').select('staff_id,date_from,date_to').eq('staff_id',s.id).eq('status','approved')
      setLeaves(lv||[])
      const {data:doff}=await supabase.from('day_offs').select('staff_id,date_from,date_to').eq('staff_id',s.id)
      setDayOffs(doff||[])
    } catch(e) {}
    // Rate overrides from Settings (same source the Command Center uses)
    try {
      const {data:rt}=await supabase.from('settings').select('value').eq('key','payroll_rates').single()
      if(rt?.value){ try{ setRateOverrides(JSON.parse(rt.value)) }catch(_){} }
    } catch(e) {}
    setLoading(false)
  }

  // Absence (no-show days) for a given cutoff window, using published schedule vs worked days.
  // Staff Portal has no raw timesheet; we approximate worked days from days_worked is NOT date-specific,
  // so we count scheduled days in window minus days_worked, then subtract excused.
  function absenceDaysFor(run) {
    if(!run.cutoff_start||!run.cutoff_end) return 0
    const inWindow = d => d>=run.cutoff_start && d<=run.cutoff_end
    const scheduled = schedules.filter(s=>inWindow(s.shift_date)).map(s=>s.shift_date)
    const distinct = [...new Set(scheduled)]
    if(distinct.length===0) return 0
    const excused = distinct.filter(d =>
      leaves.some(l=>d>=l.date_from&&d<=l.date_to) || dayOffs.some(o=>d>=o.date_from&&d<=o.date_to)
    ).length
    const expected = distinct.length - excused
    const missed = Math.max(0, expected - (run.days_worked||0))
    return missed
  }

  function rateFor() {
    if(!staff) return {daily:0,hourly:0}
    const isFT=(staff.employment_type||'Full-time')==='Full-time'
    const reqd = parseInt(selected?.required_days)||0
    const monthly = staff.monthly_pay || getBaseRate(staff.employment_type||'Full-time', staff.role, rateOverrides)?.monthly || 0
    let daily
    if(isFT && reqd>0 && monthly>0) daily = Math.round((monthly/2)/reqd)
    else daily = getDailyRate(staff.employment_type||'Full-time',staff.role,rateOverrides)
    return {daily, hourly:Math.round(daily/8)}
  }

  async function downloadPDF() {
    if(!selected||!staff) return
    const rate=rateFor()
    // Absence is already reflected in saved gross (rate × days worked); not subtracted again.
    const run=buildPayslipRun({ saved:selected, dailyRate:rate.daily, absenceDays:0, periodLabel:selected.cutoff_label })
    try { await generatePayslipPDF({ staff, run, periodStart:selected.cutoff_start, periodEnd:selected.cutoff_end }) }
    catch(e){ alert('PDF failed: '+e.message) }
  }

  const rate=rateFor()
  const absDays = selected ? absenceDaysFor(selected) : 0
  const incentives = parseFloat(selected?.incentives)||0
  const refund = parseFloat(selected?.refund)||0
  const undertime = parseFloat(selected?.undertime)||0
  const grossPay = selected ? (parseFloat(selected.gross)||0)+incentives+refund : 0
  const govDed = selected ? (parseFloat(selected.sss)||0)+(parseFloat(selected.philhealth)||0)+(parseFloat(selected.pagibig)||0)+(parseFloat(selected.tax)||0) : 0
  const late = parseFloat(selected?.late_deduction)||0
  // Full-time: missed days already unpaid in gross — do not subtract absence again.
  const netPay = Math.max(0, grossPay - govDed - late - undertime)

  return (
    <PortalShell>
      <div style={{background:'var(--white)',borderBottom:'1px solid var(--border)',padding:'0 24px',height:56,display:'flex',alignItems:'center',flexShrink:0}}>
        <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:17,fontWeight:700}}>My Payslip</div>
      </div>
      <div style={{flex:1,overflowY:'auto',padding:'22px 24px'}}>
        {loading?<div style={{textAlign:'center',padding:'40px',color:'var(--text-muted)'}}>Loading…</div>:payRuns.length===0?(
          <div style={{textAlign:'center',padding:'60px',background:'var(--white)',border:'1px solid var(--border)',borderRadius:13}}>
            <div style={{fontSize:40,marginBottom:12}}>💸</div>
            <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:15,fontWeight:700,marginBottom:6}}>No payslips yet</div>
            <div style={{fontSize:12,color:'var(--text-muted)'}}>Your payslip will appear here after payroll is processed</div>
          </div>
        ):(
          <div style={{display:'grid',gridTemplateColumns:'200px 1fr',gap:16}}>
            {/* Period list */}
            <div style={{background:'var(--white)',border:'1px solid var(--border)',borderRadius:13,overflow:'hidden',alignSelf:'start'}}>
              <div style={{padding:'11px 14px',fontSize:9,fontWeight:700,letterSpacing:1.5,textTransform:'uppercase',color:'var(--text-muted)',borderBottom:'1px solid var(--border)'}}>Pay Periods</div>
              {payRuns.map(r=>(
                <div key={r.id} onClick={()=>setSelected(r)}
                  style={{padding:'11px 14px',cursor:'pointer',borderBottom:'1px solid var(--cream-dark)',background:selected?.id===r.id?'var(--matcha-pale)':'transparent',borderLeft:`3px solid ${selected?.id===r.id?'var(--matcha)':'transparent'}`}}>
                  <div style={{fontSize:12,fontWeight:600,color:selected?.id===r.id?'var(--matcha-dark)':'var(--espresso)'}}>{r.cutoff_label}</div>
                  <div style={{fontFamily:"'DM Mono',monospace",fontSize:11,color:'var(--matcha-dark)',fontWeight:700,marginTop:2}}>{peso(r.net_pay)}</div>
                </div>
              ))}
            </div>

            {/* Payslip detail */}
            {selected&&(
              <div style={{background:'var(--white)',border:'1px solid var(--border)',borderRadius:13,padding:'24px'}}>
                <div style={{display:'flex',justifyContent:'space-between',marginBottom:20}}>
                  <div>
                    <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:16,fontWeight:700}}>Payslip</div>
                    <div style={{fontSize:11,color:'var(--text-muted)',marginTop:2}}>{selected.cutoff_label}</div>
                  </div>
                  <button onClick={downloadPDF} style={{background:'var(--matcha)',color:'white',border:'none',borderRadius:8,padding:'8px 14px',fontSize:12,fontWeight:700,cursor:'pointer',fontFamily:"'DM Sans',sans-serif",alignSelf:'start'}}>↓ Download PDF</button>
                </div>

                {/* Employee info */}
                <div style={{background:'var(--surface)',borderRadius:10,padding:'14px 16px',marginBottom:16,display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,fontSize:12}}>
                  <div><span style={{color:'var(--text-muted)'}}>Name: </span><strong>{staff?.first_name} {staff?.last_name}</strong></div>
                  <div><span style={{color:'var(--text-muted)'}}>Role: </span><strong>{staff?.role}</strong></div>
                  <div><span style={{color:'var(--text-muted)'}}>Type: </span><strong>{staff?.employment_type||'Full-time'}</strong></div>
                  <div><span style={{color:'var(--text-muted)'}}>Days Worked: </span><strong>{selected.days_worked}</strong></div>
                  <div><span style={{color:'var(--text-muted)'}}>Rate: </span><strong>{peso(rate.daily)}/day · {peso(rate.hourly)}/hr</strong></div>
                  {(staff?.bank_name||staff?.bank_account_no)&&<div><span style={{color:'var(--text-muted)'}}>Deposit to: </span><strong>{staff?.bank_name||''} {staff?.bank_account_no||''}</strong></div>}
                </div>

                {/* Earnings */}
                <div style={{fontSize:9,fontWeight:700,letterSpacing:1,textTransform:'uppercase',color:'var(--text-muted)',margin:'4px 0 4px'}}>Earnings</div>
                <Row label="Basic" value={peso(selected.gross)} />
                {incentives>0&&<Row label="Incentives/Overtime" value={peso(incentives)} />}
                {refund>0&&<Row label="Refund" value={peso(refund)} />}
                <Row label="Gross Pay" value={peso(grossPay)} bold />

                {/* Deductions */}
                <div style={{fontSize:9,fontWeight:700,letterSpacing:1,textTransform:'uppercase',color:'var(--text-muted)',margin:'10px 0 4px'}}>Deductions</div>
                {selected.sss>0&&<Row label="SSS" value={`-${peso(selected.sss)}`} red />}
                {selected.philhealth>0&&<Row label="PhilHealth" value={`-${peso(selected.philhealth)}`} red />}
                {selected.pagibig>0&&<Row label="Pag-IBIG (HDMF)" value={`-${peso(selected.pagibig)}`} red />}
                {selected.tax>0&&<Row label="Withholding Tax" value={`-${peso(selected.tax)}`} red />}

                {/* Attendance Deductions */}
                <div style={{fontSize:9,fontWeight:700,letterSpacing:1,textTransform:'uppercase',color:'var(--text-muted)',margin:'10px 0 4px'}}>Attendance Deductions</div>
                <Row label={`Late${selected.total_late_mins?` (${selected.total_late_mins} mins)`:''}`} value={`-${peso(late)}`} red />
                {undertime>0&&<Row label="Undertime" value={`-${peso(undertime)}`} red />}
                {absDays>0&&<Row label={`Unpaid absences (${absDays}d)`} value="not paid" />}

                <div style={{borderTop:'2px solid var(--border)',marginTop:12,paddingTop:12}}>
                  <Row label="NET PAY" value={peso(netPay)} bold big />
                </div>

                {/* GDrive payslip link (kept) */}
                {staff?.gdrive&&(
                  <a href={staff.gdrive} target="_blank" rel="noreferrer"
                    style={{display:'flex',alignItems:'center',gap:8,marginTop:16,background:'#e8f4f8',border:'1px solid #1a73e855',borderRadius:9,padding:'10px 14px',fontSize:12,color:'#1a73e8',fontWeight:600,textDecoration:'none'}}>
                    📁 View Payslip Documents on Google Drive
                  </a>
                )}

                {/* Service charge */}
                <div style={{marginTop:12,background:selected.service_charge_eligible?'var(--matcha-pale)':'#fdeaea',borderRadius:9,padding:'10px 14px',fontSize:12,fontWeight:600,color:selected.service_charge_eligible?'var(--matcha-dark)':'#c0392b',textAlign:'center'}}>
                  {selected.service_charge_eligible?'✅ Eligible for Service Charge this period':'❌ Not eligible for Service Charge'}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </PortalShell>
  )
}
function Row({label,value,bold,big,red}){
  return(
    <div style={{display:'flex',justifyContent:'space-between',padding:'5px 0',borderBottom:'1px solid var(--cream-dark)',fontSize:big?14:12}}>
      <span style={{color:'var(--text-muted)',fontWeight:bold?700:400}}>{label}</span>
      <span style={{fontWeight:bold?700:500,color:red?'#c0392b':bold?'var(--espresso)':'var(--text-primary)',fontFamily:"'DM Mono',monospace"}}>{value}</span>
    </div>
  )
}
