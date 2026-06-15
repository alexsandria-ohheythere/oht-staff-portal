'use client'
export const dynamic = 'force-dynamic'
import { useState, useEffect, useRef } from 'react'
import PortalShell from '../../../components/PortalShell'
import { createClient } from '../../../lib/supabase'
import { notifyAdmins } from '../../../lib/notify'

const fmtDate = d => d ? new Date(d).toLocaleDateString('en-PH',{month:'long',day:'numeric',year:'numeric'}) : '—'
const fmtDT   = d => d ? new Date(d).toLocaleString('en-PH',{month:'short',day:'numeric',year:'numeric',hour:'2-digit',minute:'2-digit'}) : '—'

const STATUS = {
  draft:             { label:'Draft',              color:'#7a6a50', bg:'#f0ede8' },
  pending_signature: { label:'Awaiting Signature', color:'#a06000', bg:'#fef3e2' },
  signed:            { label:'Fully Signed',       color:'#4a7a1e', bg:'#eef7e4' },
  expired:           { label:'Expired',            color:'#c0392b', bg:'#fdeaea' },
  archived:          { label:'Archived',           color:'#4a90c4', bg:'#e8f0fb' },
}

const SIGN_FONTS = [
  { name:'Cursive',  font:'Dancing Script, cursive' },
  { name:'Elegant',  font:'Pacifico, cursive' },
  { name:'Classic',  font:'Great Vibes, cursive' },
  { name:'Bold',     font:'Permanent Marker, cursive' },
]

export default function MyContracts() {
  const [staff, setStaff]         = useState(null)
  const [contracts, setContracts] = useState([])
  const [loading, setLoading]     = useState(true)
  const [selected, setSelected]   = useState(null)
  const [selectedSigs, setSelectedSigs] = useState([])
  const [view, setView]           = useState('list')
  const [signMode, setSignMode]   = useState('draw')
  const [typedSig, setTypedSig]   = useState('')
  const [selectedFont, setSelectedFont] = useState(SIGN_FONTS[0])
  const [signing, setSigning]     = useState(false)
  const [toast, setToast]         = useState(null)
  const canvasRef = useRef(null)
  const isDrawing = useRef(false)
  const uploadRef = useRef()

  useEffect(() => { init() }, [])

  async function init() {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    const { data: s } = await supabase.from('staff').select('*').eq('email', session.user.email).single()
    if (!s) { setLoading(false); return }
    setStaff(s)
    const { data: c } = await supabase.from('contracts').select('*').eq('staff_id', s.id).order('created_at',{ascending:false})
    setContracts(c||[])
    setLoading(false)
  }

  function showToast(icon,msg){setToast({icon,msg});setTimeout(()=>setToast(null),4000)}

  async function openContract(c) {
    setSelected(c)
    const supabase = createClient()
    const { data: sigs } = await supabase.from('contract_signatures').select('*').eq('contract_id',c.id).order('signed_at')
    setSelectedSigs(sigs||[])
    setView(c.status==='pending_signature'&&!c.employee_signed_at?'sign':'read')
  }

  // Canvas drawing
  function startDraw(e) {
    isDrawing.current = true
    const canvas = canvasRef.current, ctx = canvas.getContext('2d')
    const rect = canvas.getBoundingClientRect()
    const sx = canvas.width/rect.width, sy = canvas.height/rect.height
    const x = ((e.clientX||e.touches?.[0]?.clientX)-rect.left)*sx
    const y = ((e.clientY||e.touches?.[0]?.clientY)-rect.top)*sy
    ctx.beginPath(); ctx.moveTo(x,y)
  }
  function draw(e) {
    if (!isDrawing.current) return; e.preventDefault()
    const canvas = canvasRef.current, ctx = canvas.getContext('2d')
    const rect = canvas.getBoundingClientRect()
    const sx = canvas.width/rect.width, sy = canvas.height/rect.height
    const x = ((e.clientX||e.touches?.[0]?.clientX)-rect.left)*sx
    const y = ((e.clientY||e.touches?.[0]?.clientY)-rect.top)*sy
    ctx.lineWidth=2.5; ctx.lineCap='round'; ctx.strokeStyle='#1a1208'
    ctx.lineTo(x,y); ctx.stroke()
  }
  function endDraw() { isDrawing.current=false }
  function clearCanvas() { canvasRef.current?.getContext('2d').clearRect(0,0,580,160) }

  async function submitSignature() {
    if (!selected||!staff) return
    setSigning(true)
    let sigData=''
    if (signMode==='draw') {
      const canvas=canvasRef.current
      const pixels=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data
      if(!pixels.some(p=>p!==0)){showToast('⚠️','Please draw your signature first');setSigning(false);return}
      sigData=canvas.toDataURL('image/png')
    } else {
      if(!typedSig.trim()){showToast('⚠️','Please type your signature');setSigning(false);return}
      sigData=typedSig
    }
    const supabase=createClient()
    const now=new Date().toISOString()
    await supabase.from('contract_signatures').insert([{
      contract_id:selected.id, staff_id:staff.id,
      signatory_type:'employee', signature_type:signMode,
      signature_data:sigData, signed_at:now,
      user_agent:navigator.userAgent,
      audit_trail:[{event:'employee_signed',timestamp:now,method:signMode}],
    }])
    await supabase.from('contracts').update({
      employee_signed_at:now,
      employee_signature:sigData,
      employee_signature_type:signMode,
      updated_at:now,
    }).eq('id',selected.id)
    setContracts(prev=>prev.map(c=>c.id===selected.id?{...c,employee_signed_at:now}:c))
    await notifyAdmins({
      type:'general',
      title:`✍️ Contract Signed: ${staff.first_name} ${staff.last_name}`,
      message:`${staff.first_name} signed "${selected.title}". Please review and countersign to complete execution.`,
    })
    setView('done')
    setSigning(false)
  }

  async function handleUploadSig(e) {
    const file=e.target.files[0]; if(!file) return
    const reader=new FileReader()
    reader.onload=async ev=>{
      const supabase=createClient()
      const now=new Date().toISOString()
      await supabase.from('contract_signatures').insert([{
        contract_id:selected.id, staff_id:staff.id,
        signatory_type:'employee', signature_type:'upload',
        signature_data:ev.target.result, signed_at:now,
        user_agent:navigator.userAgent,
        audit_trail:[{event:'employee_signed_upload',timestamp:now}],
      }])
      await supabase.from('contracts').update({
        employee_signed_at:now, employee_signature:ev.target.result,
        employee_signature_type:'upload', updated_at:now,
      }).eq('id',selected.id)
      setContracts(prev=>prev.map(c=>c.id===selected.id?{...c,employee_signed_at:now}:c))
      await notifyAdmins({
        type:'general',
        title:`✍️ Contract Signed: ${staff.first_name} ${staff.last_name}`,
        message:`${staff.first_name} signed "${selected.title}" via uploaded signature.`,
      })
      setView('done')
    }
    reader.readAsDataURL(file)
  }

  function downloadContract() {
    if (!selected) return
    const empSig = selectedSigs.find(s=>s.signatory_type==='employee')
    const mgmtSig = selectedSigs.find(s=>s.signatory_type==='management')
    const empSigHtml = empSig
      ? empSig.signature_type==='draw'
        ? `<img src="${empSig.signature_data}" style="max-height:60px;max-width:200px;"/>`
        : `<span style="font-family:cursive;font-size:28px;">${empSig.signature_data}</span>`
      : '<div style="border-bottom:1px solid #1a1208;min-height:60px;"></div>'
    const mgmtSigHtml = mgmtSig
      ? mgmtSig.signature_type==='draw'
        ? `<img src="${mgmtSig.signature_data}" style="max-height:60px;max-width:200px;"/>`
        : `<span style="font-family:cursive;font-size:28px;">${mgmtSig.signature_data}</span>`
      : '<div style="border-bottom:1px solid #1a1208;min-height:60px;"></div>'
    const today=new Date().toLocaleDateString('en-PH',{month:'long',day:'numeric',year:'numeric'})
    const w=window.open('','_blank')
    w.document.write(`<!DOCTYPE html><html><head><title>${selected.title}</title>
    <style>body{font-family:'Helvetica Neue',sans-serif;font-size:13px;line-height:1.9;color:#1a1208;margin:0;padding:48px 56px;}
    .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:32px;padding-bottom:20px;border-bottom:3px solid #EF4576;}
    .brand{font-size:20px;font-weight:900;color:#EF4576;margin-bottom:4px;}
    .logo{background:#EF4576;border-radius:10px;padding:10px 16px;text-align:right;}
    .logo-t{font-size:13px;font-weight:900;color:white;letter-spacing:1px;}
    .logo-s{font-size:9px;color:rgba(255,255,255,.8);letter-spacing:2px;text-transform:uppercase;}
    .sig-grid{display:grid;grid-template-columns:1fr 1fr;gap:48px;margin-top:48px;padding-top:24px;border-top:1px solid #d8cebb;}
    .sig-label{font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#7a6a50;margin-bottom:12px;}
    .sig-name{font-size:11px;font-weight:600;border-top:1px solid #1a1208;padding-top:6px;margin-top:8px;}
    .sig-role{font-size:10px;color:#7a6a50;}
    @media print{body{padding:32px 40px;}}</style></head><body>
    <div class="header">
      <div><div class="brand">OHT Cafe</div><div style="font-size:11px;color:#7a6a50;">Unit A 156 A. Aguirre Ave.<br/>Barangay BF Homes, Parañaque City</div></div>
      <div class="logo"><div class="logo-t">OH HEY THERE</div><div class="logo-s">MATCHA CAFE</div></div>
    </div>
    <div style="text-align:center;font-size:18px;font-weight:700;margin-bottom:6px;">${selected.title}</div>
    <div style="text-align:center;font-size:12px;color:#7a6a50;margin-bottom:28px;">${today}</div>
    ${staff?`<div style="margin-bottom:20px;"><strong>${staff.first_name} ${staff.last_name}</strong><br/><span style="color:#7a6a50;font-size:12px;">${staff.role}</span></div>`:''}
    <p>Dear ${staff?.first_name||'Employee'},</p>
    <p>We are pleased to inform you of your <strong>${selected.employment_type||'full-time'}</strong> engagement with OHT Cafe.</p>
    ${selected.content_html}
    <div class="sig-grid">
      <div><div class="sig-label">Employee</div>${empSigHtml}<div class="sig-name">${staff?`${staff.first_name} ${staff.last_name}`:'Employee'}</div><div class="sig-role">Signature Over Printed Name</div>${empSig?`<div style="font-size:9px;color:#7a6a50;margin-top:4px;font-family:monospace;">${fmtDT(empSig.signed_at)}</div>`:''}</div>
      <div><div class="sig-label">Noted By</div>${mgmtSigHtml}<div class="sig-name">${mgmtSig?(mgmtSig.audit_trail?.[0]?.signer==='alex'?'Agnes Alexsandria S. Lalog':'CJ'):'Agnes Alexsandria S. Lalog'}</div><div class="sig-role">Managing Director & Co-founder</div>${mgmtSig?`<div style="font-size:9px;color:#7a6a50;margin-top:4px;font-family:monospace;">${fmtDT(mgmtSig.signed_at)}</div>`:''}</div>
    </div>
    <script>window.onload=()=>window.print();</script></body></html>`)
    w.document.close()
  }

  const pendingCount = contracts.filter(c=>c.status==='pending_signature'&&!c.employee_signed_at).length
  const awaitingMgmt = contracts.filter(c=>c.employee_signed_at&&!c.management_signed_at).length

  return (
    <PortalShell>
      <div style={{background:'white',borderBottom:'1px solid #d8cebb',padding:'0 24px',height:56,display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
        <div>
          <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:17,fontWeight:700}}>
            {view==='list'?'My Contracts':view==='sign'?'Sign Contract':view==='read'?selected?.title:'✅ Signed!'}
          </div>
          {view==='list'&&<div style={{fontSize:11,color:'#7a6a50',marginTop:1}}>{contracts.length} contract{contracts.length!==1?'s':''}</div>}
        </div>
        <div style={{display:'flex',gap:8}}>
          {view==='read'&&selected?.status==='signed'&&(
            <button onClick={downloadContract}
              style={{background:'#eef7e4',color:'#4a7a1e',border:'1px solid #7ab64866',borderRadius:8,padding:'6px 14px',fontSize:11,fontWeight:700,cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}>
              ↓ Download PDF
            </button>
          )}
          {view!=='list'&&(
            <button onClick={()=>{setView('list');setSelected(null);setSelectedSigs([]);setTypedSig('');clearCanvas()}}
              style={{background:'transparent',border:'1px solid #d8cebb',borderRadius:8,padding:'6px 14px',fontSize:11,cursor:'pointer',color:'#7a6a50',fontFamily:"'DM Sans',sans-serif"}}>
              ← Back
            </button>
          )}
        </div>
      </div>

      <div style={{flex:1,overflowY:'auto',padding:'20px 24px'}}>
        {loading?<div style={{textAlign:'center',padding:'60px',color:'#7a6a50'}}>Loading…</div>:

        view==='list'?(
          <>
            {pendingCount>0&&(
              <div style={{background:'#fef3e2',border:'1px solid #d4a84366',borderRadius:10,padding:'12px 16px',marginBottom:12,display:'flex',alignItems:'center',gap:10}}>
                <span style={{fontSize:20}}>📝</span>
                <span style={{fontSize:13,fontWeight:600,color:'#a06000'}}>{pendingCount} contract{pendingCount!==1?'s':''} awaiting your signature</span>
              </div>
            )}
            {awaitingMgmt>0&&(
              <div style={{background:'#eef7e4',border:'1px solid #7ab64866',borderRadius:10,padding:'12px 16px',marginBottom:12,display:'flex',alignItems:'center',gap:10}}>
                <span style={{fontSize:20}}>⏳</span>
                <span style={{fontSize:13,fontWeight:600,color:'#4a7a1e'}}>{awaitingMgmt} awaiting management countersignature</span>
              </div>
            )}
            {contracts.length===0?(
              <div style={{textAlign:'center',padding:'60px',background:'white',border:'1px solid #d8cebb',borderRadius:13}}>
                <div style={{fontSize:40,marginBottom:12}}>📄</div>
                <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:15,fontWeight:700,marginBottom:6}}>No contracts yet</div>
                <div style={{fontSize:12,color:'#7a6a50'}}>Contracts assigned to you will appear here.</div>
              </div>
            ):(
              <div style={{display:'flex',flexDirection:'column',gap:10}}>
                {contracts.map(c=>{
                  const st=STATUS[c.status]||STATUS.draft
                  const needsSign=c.status==='pending_signature'&&!c.employee_signed_at
                  const awaitCounter=c.employee_signed_at&&!c.management_signed_at
                  const fullyDone=c.employee_signed_at&&c.management_signed_at
                  return(
                    <div key={c.id}
                      style={{background:'white',border:`1.5px solid ${needsSign?'#EF4576':fullyDone?'#7ab648':'#d8cebb'}`,borderRadius:13,padding:'16px 20px',transition:'all .15s'}}
                      onMouseEnter={e=>e.currentTarget.style.boxShadow='0 4px 14px rgba(26,18,8,.08)'}
                      onMouseLeave={e=>e.currentTarget.style.boxShadow=''}>
                      <div style={{display:'flex',alignItems:'flex-start',gap:14}}>
                        <div style={{fontSize:32,flexShrink:0}}>{fullyDone?'✅':'📄'}</div>
                        <div style={{flex:1}}>
                          <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:14,fontWeight:700,marginBottom:3}}>{c.title}</div>
                          <div style={{fontSize:11,color:'#7a6a50',marginBottom:8}}>
                            {c.employment_type}{c.salary?` · ${c.salary}`:''} · {fmtDate(c.created_at)}
                          </div>
                          <div style={{display:'flex',gap:7,flexWrap:'wrap'}}>
                            <div style={{display:'flex',alignItems:'center',gap:5,fontSize:10,padding:'3px 9px',borderRadius:20,background:c.employee_signed_at?'#eef7e4':'#fef3e2',border:`1px solid ${c.employee_signed_at?'#7ab64866':'#d4a84366'}`}}>
                              <span>{c.employee_signed_at?'✅':'⏳'}</span>
                              <span style={{color:c.employee_signed_at?'#4a7a1e':'#a06000',fontWeight:600}}>Your signature</span>
                            </div>
                            <div style={{display:'flex',alignItems:'center',gap:5,fontSize:10,padding:'3px 9px',borderRadius:20,background:c.management_signed_at?'#eef7e4':'#f0ede8',border:'1px solid #d8cebb'}}>
                              <span>{c.management_signed_at?'✅':'⏳'}</span>
                              <span style={{color:c.management_signed_at?'#4a7a1e':'#7a6a50',fontWeight:600}}>
                                {c.management_signed_at?`${c.management_signed_by==='alex'?'Alex':'CJ'} countersigned`:'Mgmt countersign'}
                              </span>
                            </div>
                          </div>
                          {fullyDone&&<div style={{fontSize:11,color:'#4a7a1e',fontWeight:600,marginTop:6}}>🎉 Fully executed · {fmtDate(c.management_signed_at)}</div>}
                        </div>
                        <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:8,flexShrink:0}}>
                          <span style={{fontSize:10,fontWeight:700,padding:'3px 9px',borderRadius:8,background:st.bg,color:st.color}}>{st.label}</span>
                          <div style={{display:'flex',gap:6}}>
                            <button onClick={()=>openContract(c)}
                              style={{background:'#e8f0fb',color:'#4a90c4',border:'none',borderRadius:7,padding:'5px 10px',fontSize:10,fontWeight:600,cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}>
                              👁 Read
                            </button>
                            {needsSign&&(
                              <button onClick={()=>openContract(c)}
                                style={{background:'#EF4576',color:'white',border:'none',borderRadius:7,padding:'5px 10px',fontSize:10,fontWeight:700,cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}>
                                ✍️ Sign Now
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </>

        ):view==='read'&&selected?(
          <div style={{display:'grid',gridTemplateColumns:'1fr 260px',gap:16}}>
            {/* Contract content */}
            <div style={{background:'white',border:'1px solid #d8cebb',borderRadius:13,overflow:'hidden'}}>
              {/* Contract header */}
              <div style={{padding:'32px 40px',borderBottom:'1px solid #d8cebb'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:24,paddingBottom:20,borderBottom:'2px solid #EF4576'}}>
                  <div>
                    <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:18,fontWeight:900,color:'#EF4576',marginBottom:3}}>OHT Cafe</div>
                    <div style={{fontSize:11,color:'#7a6a50',lineHeight:1.6}}>Unit A 156 A. Aguirre Ave.<br/>Barangay BF Homes, Parañaque City</div>
                  </div>
                  <div style={{background:'#EF4576',borderRadius:9,padding:'9px 14px',textAlign:'right'}}>
                    <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:12,fontWeight:900,color:'white',letterSpacing:1}}>OH HEY THERE</div>
                    <div style={{fontSize:8,color:'rgba(255,255,255,.8)',letterSpacing:2,textTransform:'uppercase',marginTop:2}}>MATCHA CAFE</div>
                  </div>
                </div>
                <div style={{textAlign:'center',marginBottom:20}}>
                  <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:17,fontWeight:700,marginBottom:4}}>{selected.title}</div>
                  <div style={{fontSize:11,color:'#7a6a50'}}>{fmtDate(selected.created_at)}</div>
                </div>
                {staff&&<div style={{marginBottom:14}}>
                  <div style={{fontWeight:700,fontSize:13}}>{staff.first_name} {staff.last_name}</div>
                  <div style={{fontSize:11,color:'#7a6a50'}}>{staff.role}</div>
                </div>}
                <p style={{fontSize:13,marginBottom:8}}>Dear {staff?.first_name||'Employee'},</p>
                <p style={{fontSize:13,color:'#7a6a50'}}>We are pleased to inform you of your <strong>{selected.employment_type||'full-time'}</strong> engagement with OHT Cafe on the terms set out below:</p>
              </div>
              {/* Content */}
              <div style={{padding:'24px 40px',fontSize:13,lineHeight:1.9,color:'#1a1208'}} dangerouslySetInnerHTML={{__html:selected.content_html}}/>
              {/* Signature area */}
              <div style={{padding:'24px 40px',borderTop:'1px solid #d8cebb'}}>
                <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:13,fontWeight:700,marginBottom:8}}>IN WITNESS WHEREOF</div>
                <p style={{fontSize:12,color:'#7a6a50',marginBottom:24}}>The parties have executed this Employment Contract as of the date first written above.</p>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:40}}>
                  <div>
                    <div style={{fontSize:10,fontWeight:700,letterSpacing:1,textTransform:'uppercase',color:'#7a6a50',marginBottom:10}}>Employee</div>
                    {selected.employee_signed_at?(
                      <div style={{marginBottom:8,minHeight:60,display:'flex',alignItems:'flex-end'}}>
                        {selectedSigs.find(s=>s.signatory_type==='employee')?.signature_type==='draw'?(
                          <img src={selectedSigs.find(s=>s.signatory_type==='employee')?.signature_data} alt="sig" style={{maxHeight:60,maxWidth:180}}/>
                        ):(
                          <span style={{fontFamily:'cursive',fontSize:26,color:'#1a1208'}}>{selectedSigs.find(s=>s.signatory_type==='employee')?.signature_data}</span>
                        )}
                      </div>
                    ):<div style={{minHeight:60,borderBottom:'1px solid #1a1208',marginBottom:8}}/>}
                    <div style={{fontSize:11,fontWeight:600,borderTop:'1px solid #1a1208',paddingTop:5,marginBottom:2}}>{staff?.first_name} {staff?.last_name}</div>
                    <div style={{fontSize:10,color:'#7a6a50'}}>Signature Over Printed Name</div>
                    {selected.employee_signed_at&&<div style={{fontSize:9,color:'#7a6a50',marginTop:3,fontFamily:'monospace'}}>{fmtDT(selected.employee_signed_at)}</div>}
                  </div>
                  <div>
                    <div style={{fontSize:10,fontWeight:700,letterSpacing:1,textTransform:'uppercase',color:'#7a6a50',marginBottom:10}}>Noted By</div>
                    {selected.management_signed_at?(
                      <div style={{marginBottom:8,minHeight:60,display:'flex',alignItems:'flex-end'}}>
                        {selected.management_signature_type==='draw'?(
                          <img src={selected.management_signature} alt="sig" style={{maxHeight:60,maxWidth:180}}/>
                        ):(
                          <span style={{fontFamily:'cursive',fontSize:26,color:'#1a1208'}}>{selected.management_signature}</span>
                        )}
                      </div>
                    ):<div style={{minHeight:60,borderBottom:'1px solid #1a1208',marginBottom:8}}/>}
                    <div style={{fontSize:11,fontWeight:600,borderTop:'1px solid #1a1208',paddingTop:5,marginBottom:2}}>
                      {selected.management_signed_by==='alex'?'Agnes Alexsandria S. Lalog':'CJ'}
                    </div>
                    <div style={{fontSize:10,color:'#7a6a50'}}>Managing Director & Co-founder</div>
                    {selected.management_signed_at&&<div style={{fontSize:9,color:'#7a6a50',marginTop:3,fontFamily:'monospace'}}>{fmtDT(selected.management_signed_at)}</div>}
                  </div>
                </div>
              </div>
            </div>

            {/* Actions panel */}
            <div style={{display:'flex',flexDirection:'column',gap:12}}>
              <div style={{background:'white',border:'1px solid #d8cebb',borderRadius:13,padding:'16px'}}>
                <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:13,fontWeight:700,marginBottom:12}}>Signature Status</div>
                <div style={{display:'flex',flexDirection:'column',gap:8}}>
                  <div style={{padding:'10px',borderRadius:8,background:selected.employee_signed_at?'#eef7e4':'#fef3e2',border:`1px solid ${selected.employee_signed_at?'#7ab64866':'#d4a84366'}`}}>
                    <div style={{fontWeight:700,color:selected.employee_signed_at?'#4a7a1e':'#a06000',fontSize:11,marginBottom:2}}>{selected.employee_signed_at?'✅ You signed':'⏳ Your signature needed'}</div>
                    {selected.employee_signed_at&&<div style={{fontSize:9,color:'#7a6a50',fontFamily:'monospace'}}>{fmtDT(selected.employee_signed_at)}</div>}
                  </div>
                  <div style={{padding:'10px',borderRadius:8,background:selected.management_signed_at?'#eef7e4':'#f0ede8',border:'1px solid #d8cebb'}}>
                    <div style={{fontWeight:700,color:selected.management_signed_at?'#4a7a1e':'#7a6a50',fontSize:11,marginBottom:2}}>
                      {selected.management_signed_at?`✅ ${selected.management_signed_by==='alex'?'Alex':'CJ'} countersigned`:'⏳ Awaiting management'}
                    </div>
                    {selected.management_signed_at&&<div style={{fontSize:9,color:'#7a6a50',fontFamily:'monospace'}}>{fmtDT(selected.management_signed_at)}</div>}
                  </div>
                </div>
              </div>
              {!selected.employee_signed_at&&selected.status==='pending_signature'&&(
                <button onClick={()=>setView('sign')}
                  style={{background:'#EF4576',color:'white',border:'none',borderRadius:10,padding:'13px',fontSize:13,fontWeight:700,cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}>
                  ✍️ Sign This Contract
                </button>
              )}
              {selected.status==='signed'&&(
                <button onClick={downloadContract}
                  style={{background:'#eef7e4',color:'#4a7a1e',border:'1px solid #7ab64866',borderRadius:10,padding:'12px',fontSize:12,fontWeight:700,cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}>
                  ↓ Download PDF
                </button>
              )}
              <div style={{background:'#fef3e2',border:'1px solid #d4a84366',borderRadius:10,padding:'12px 14px',fontSize:11,color:'#a06000',lineHeight:1.6}}>
                ⚖️ Read the full contract before signing. Your digital signature is legally binding.
              </div>
            </div>
          </div>

        ):view==='sign'&&selected?(
          <div style={{display:'grid',gridTemplateColumns:'1fr 360px',gap:16}}>
            {/* Contract */}
            <div style={{background:'white',border:'1px solid #d8cebb',borderRadius:13,padding:'32px 40px',maxHeight:'calc(100vh - 160px)',overflowY:'auto'}}>
              <div style={{background:'#fef3e2',border:'1px solid #d4a84366',borderRadius:8,padding:'10px 14px',marginBottom:20,fontSize:11,color:'#a06000'}}>
                📖 Please read the full contract carefully before signing.
              </div>
              <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:17,fontWeight:700,marginBottom:4,textAlign:'center'}}>{selected.title}</div>
              <div style={{fontSize:11,color:'#7a6a50',textAlign:'center',marginBottom:20}}>{fmtDate(selected.created_at)}</div>
              <div style={{fontSize:13,lineHeight:1.9,color:'#1a1208'}} dangerouslySetInnerHTML={{__html:selected.content_html}}/>
            </div>

            {/* Signature panel */}
            <div style={{display:'flex',flexDirection:'column',gap:12}}>
              <div style={{background:'white',border:'1px solid #d8cebb',borderRadius:13,padding:'18px'}}>
                <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:14,fontWeight:700,marginBottom:4}}>Your Signature</div>
                <div style={{fontSize:11,color:'#7a6a50',marginBottom:14}}>Signing as: <strong>{staff?.first_name} {staff?.last_name}</strong></div>
                {/* Tabs */}
                <div style={{display:'flex',gap:6,marginBottom:14}}>
                  {[['draw','✍️ Draw'],['type','⌨️ Type'],['upload','📎 Upload']].map(([m,l])=>(
                    <button key={m} onClick={()=>setSignMode(m)}
                      style={{flex:1,padding:'7px 4px',borderRadius:7,border:`1.5px solid ${signMode===m?'#EF4576':'#d8cebb'}`,background:signMode===m?'#fdeef3':'transparent',color:signMode===m?'#EF4576':'#7a6a50',fontSize:10,fontWeight:600,cursor:'pointer',fontFamily:"'DM Sans',sans-serif",transition:'all .15s'}}>
                      {l}
                    </button>
                  ))}
                </div>
                {/* Draw */}
                {signMode==='draw'&&(
                  <div>
                    <canvas ref={canvasRef} width={580} height={160}
                      style={{border:'2px solid #d8cebb',borderRadius:8,background:'#faf7f2',cursor:'crosshair',touchAction:'none',width:'100%',display:'block'}}
                      onMouseDown={startDraw} onMouseMove={draw} onMouseUp={endDraw} onMouseLeave={endDraw}
                      onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={endDraw}/>
                    <button onClick={clearCanvas} style={{fontSize:10,color:'#7a6a50',background:'transparent',border:'none',cursor:'pointer',marginTop:5,fontFamily:"'DM Sans',sans-serif"}}>Clear</button>
                  </div>
                )}
                {/* Type */}
                {signMode==='type'&&(
                  <div>
                    <input value={typedSig} onChange={e=>setTypedSig(e.target.value)} placeholder="Type your full name…"
                      style={{width:'100%',border:'1px solid #d8cebb',borderRadius:8,padding:'10px',fontSize:14,outline:'none',fontFamily:selectedFont.font,background:'#faf7f2',color:'#1a1208'}}/>
                    <div style={{marginTop:10}}>
                      <div style={{fontSize:9,fontWeight:700,letterSpacing:1,textTransform:'uppercase',color:'#7a6a50',marginBottom:7}}>Choose Style</div>
                      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6}}>
                        {SIGN_FONTS.map(f=>(
                          <div key={f.name} onClick={()=>setSelectedFont(f)}
                            style={{padding:'8px',borderRadius:7,border:`1.5px solid ${selectedFont.name===f.name?'#EF4576':'#d8cebb'}`,background:selectedFont.name===f.name?'#fdeef3':'white',cursor:'pointer',textAlign:'center',transition:'all .15s'}}>
                            <span style={{fontFamily:f.font,fontSize:18,color:'#1a1208'}}>{typedSig||'Preview'}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    {typedSig&&(
                      <div style={{marginTop:10,padding:'16px',background:'#faf7f2',border:'2px solid #d8cebb',borderRadius:8,textAlign:'center'}}>
                        <span style={{fontFamily:selectedFont.font,fontSize:30,color:'#1a1208'}}>{typedSig}</span>
                      </div>
                    )}
                  </div>
                )}
                {/* Upload */}
                {signMode==='upload'&&(
                  <label style={{display:'flex',flexDirection:'column',alignItems:'center',gap:8,background:'#faf7f2',border:'2px dashed #d8cebb',borderRadius:9,padding:'28px',cursor:'pointer'}}>
                    <span style={{fontSize:32}}>📎</span>
                    <span style={{fontSize:12,color:'#7a6a50',fontWeight:600}}>Upload PNG signature</span>
                    <span style={{fontSize:10,color:'#7a6a50'}}>Transparent background recommended</span>
                    <input type="file" accept="image/*" ref={uploadRef} style={{display:'none'}} onChange={handleUploadSig}/>
                  </label>
                )}
              </div>
              <div style={{background:'#fef3e2',border:'1px solid #d4a84366',borderRadius:10,padding:'12px 14px',fontSize:11,color:'#a06000',lineHeight:1.6}}>
                ⚖️ By signing, you confirm you have read and agree to all terms. Your signature, timestamp, and device info will be recorded. Management will countersign after you.
              </div>
              {signMode!=='upload'&&(
                <button onClick={submitSignature} disabled={signing}
                  style={{background:signing?'#aaa':'#EF4576',color:'white',border:'none',borderRadius:10,padding:'14px',fontSize:14,fontWeight:700,cursor:signing?'not-allowed':'pointer',fontFamily:"'DM Sans',sans-serif"}}>
                  {signing?'Processing…':'✍️ Sign Contract'}
                </button>
              )}
            </div>
          </div>

        ):view==='done'?(
          <div style={{maxWidth:520,margin:'0 auto',textAlign:'center',padding:'50px 20px'}}>
            <div style={{fontSize:64,marginBottom:16}}>✍️</div>
            <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:24,fontWeight:700,color:'#4a7a1e',marginBottom:8}}>You've Signed!</div>
            <div style={{fontSize:13,color:'#7a6a50',marginBottom:24,lineHeight:1.8}}>Your signature has been recorded and management has been notified to countersign.</div>
            <div style={{background:'#eef7e4',border:'1px solid #7ab648',borderRadius:13,padding:'20px',marginBottom:24,textAlign:'left',lineHeight:2.2}}>
              <div style={{fontSize:12,color:'#4a7a1e'}}>
                ✅ Your signature recorded<br/>
                🕐 {new Date().toLocaleString('en-PH')}<br/>
                🔒 Audit trail created<br/>
                📬 Management notified to countersign<br/>
                ⏳ Awaiting management countersignature
              </div>
            </div>
            <button onClick={()=>{setView('list');init()}}
              style={{background:'#7ab648',color:'white',border:'none',borderRadius:10,padding:'12px 28px',fontSize:13,fontWeight:700,cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}>
              ← Back to My Contracts
            </button>
          </div>
        ):null}
      </div>

      {toast&&(
        <div style={{position:'fixed',bottom:22,right:22,background:'#1a1208',color:'#f5f0e8',border:'1px solid #3d3020',borderRadius:12,padding:'12px 16px',fontSize:12,fontWeight:500,display:'flex',alignItems:'center',gap:9,boxShadow:'0 8px 28px rgba(0,0,0,.2)',zIndex:1000}}>
          <span>{toast.icon}</span><span>{toast.msg}</span>
        </div>
      )}
    </PortalShell>
  )
}
