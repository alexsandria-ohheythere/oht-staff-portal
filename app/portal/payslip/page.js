'use client'
export const dynamic = 'force-dynamic'
import { useState, useEffect } from 'react'
import PortalShell from '../../../components/PortalShell'
import { createClient } from '../../../lib/supabase'

const peso = n => '₱'+(parseFloat(n)||0).toLocaleString('en-PH',{minimumFractionDigits:2,maximumFractionDigits:2})

export default function MyPayslip() {
  const [staff, setStaff]       = useState(null)
  const [payRuns, setPayRuns]   = useState([])
  const [selected, setSelected] = useState(null)
  const [loading, setLoading]   = useState(true)

  useEffect(()=>{ fetchData() },[])

  async function fetchData() {
    const supabase=createClient()
    const {data:{session}}=await supabase.auth.getSession(); if(!session) return
    const {data:s}=await supabase.from('staff').select('*').eq('email',session.user.email).single()
    if(!s){setLoading(false);return}
    setStaff(s)
    const {data:runs}=await supabase.from('payroll_runs').select('*').eq('staff_id',s.id).order('cutoff_start',{ascending:false})
    setPayRuns(runs||[])
    if(runs&&runs.length>0) setSelected(runs[0])
    setLoading(false)
  }

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
                  <div style={{textAlign:'right'}}>
                    <div style={{fontSize:9,fontWeight:700,letterSpacing:1.5,textTransform:'uppercase',color:'var(--text-muted)'}}>Oh Hey There</div>
                    <div style={{fontSize:10,color:'var(--text-muted)',marginTop:1}}>Filipino-owned Matcha Cafe</div>
                  </div>
                </div>

                {/* Employee info */}
                <div style={{background:'var(--surface)',borderRadius:10,padding:'14px 16px',marginBottom:16,display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,fontSize:12}}>
                  <div><span style={{color:'var(--text-muted)'}}>Name: </span><strong>{staff?.first_name} {staff?.last_name}</strong></div>
                  <div><span style={{color:'var(--text-muted)'}}>Role: </span><strong>{staff?.role}</strong></div>
                  <div><span style={{color:'var(--text-muted)'}}>Type: </span><strong>{staff?.employment_type||'Full-time'}</strong></div>
                  <div><span style={{color:'var(--text-muted)'}}>Days Worked: </span><strong>{selected.days_worked}</strong></div>
                </div>

                {/* Pay computation */}
                <Row label="Gross Pay" value={peso(selected.gross)} bold />
                <div style={{fontSize:9,fontWeight:700,letterSpacing:1,textTransform:'uppercase',color:'var(--text-muted)',margin:'10px 0 4px'}}>Deductions</div>
                {selected.late_deduction>0&&<Row label={`Late Deduction (${selected.total_late_mins} mins)`} value={`-${peso(selected.late_deduction)}`} red />}
                {selected.sss>0&&<Row label="SSS" value={`-${peso(selected.sss)}`} red />}
                {selected.philhealth>0&&<Row label="PhilHealth" value={`-${peso(selected.philhealth)}`} red />}
                {selected.pagibig>0&&<Row label="Pag-IBIG" value={`-${peso(selected.pagibig)}`} red />}
                {selected.tax>0&&<Row label="Withholding Tax" value={`-${peso(selected.tax)}`} red />}
                <div style={{borderTop:'2px solid var(--border)',marginTop:12,paddingTop:12}}>
                  <Row label="NET PAY" value={peso(selected.net_pay)} bold big />
                </div>

                {/* GDrive payslip link */}
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
