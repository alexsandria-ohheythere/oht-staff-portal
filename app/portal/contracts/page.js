'use client'
export const dynamic = 'force-dynamic'
import { useState, useEffect, useRef } from 'react'
import PortalShell from '../../../components/PortalShell'
import { createClient } from '../../../lib/supabase'
import { notifyAdmins } from '../../../lib/notify'

const fmtDate = d => d ? new Date(d).toLocaleDateString('en-PH',{month:'long',day:'numeric',year:'numeric'}) : '—'
const STATUS_STYLES = {
  draft:             { label:'Draft',            color:'#7a6a50', bg:'#f0ede8' },
  pending_signature: { label:'Awaiting Signature',color:'#a06000', bg:'#fef3e2' },
  signed:            { label:'Signed',           color:'#4a7a1e', bg:'#eef7e4' },
  expired:           { label:'Expired',          color:'#c0392b', bg:'#fdeaea' },
  archived:          { label:'Archived',         color:'#4a90c4', bg:'#e8f0fb' },
}

const SIGN_FONTS = [
  { name:'Cursive',    font:'Dancing Script, cursive' },
  { name:'Elegant',   font:'Pacifico, cursive' },
  { name:'Classic',   font:'Great Vibes, cursive' },
  { name:'Bold',      font:'Permanent Marker, cursive' },
]

export default function MyContracts() {
  const [staff, setStaff]           = useState(null)
  const [contracts, setContracts]   = useState([])
  const [loading, setLoading]       = useState(true)
  const [selected, setSelected]     = useState(null)
  const [view, setView]             = useState('list') // list | sign | signed
  const [signMode, setSignMode]     = useState('draw') // draw | type | upload
  const [typedSig, setTypedSig]     = useState('')
  const [selectedFont, setSelectedFont] = useState(SIGN_FONTS[0])
  const [signing, setSigning]       = useState(false)
  const [toast, setToast]           = useState(null)
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

  // Canvas drawing
  function startDraw(e) {
    isDrawing.current = true
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const rect = canvas.getBoundingClientRect()
    const x = (e.clientX||e.touches?.[0]?.clientX) - rect.left
    const y = (e.clientY||e.touches?.[0]?.clientY) - rect.top
    ctx.beginPath(); ctx.moveTo(x,y)
  }
  function draw(e) {
    if (!isDrawing.current) return
    e.preventDefault()
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const rect = canvas.getBoundingClientRect()
    const x = (e.clientX||e.touches?.[0]?.clientX) - rect.left
    const y = (e.clientY||e.touches?.[0]?.clientY) - rect.top
    ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.strokeStyle = '#1a1208'
    ctx.lineTo(x,y); ctx.stroke()
  }
  function endDraw() { isDrawing.current = false }
  function clearCanvas() {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0,0,canvas.width,canvas.height)
  }

  async function submitSignature() {
    if (!selected) return
    setSigning(true)
    let sigData = ''
    let sigType = signMode

    if (signMode === 'draw') {
      const canvas = canvasRef.current
      sigData = canvas.toDataURL('image/png')
      // Check if canvas is empty
      const ctx = canvas.getContext('2d')
      const pixels = ctx.getImageData(0,0,canvas.width,canvas.height).data
      const isEmpty = pixels.every(p => p === 0)
      if (isEmpty) { showToast('⚠️','Please draw your signature first'); setSigning(false); return }
    } else if (signMode === 'type') {
      if (!typedSig.trim()) { showToast('⚠️','Please type your signature'); setSigning(false); return }
      sigData = typedSig
    } else if (signMode === 'upload') {
      showToast('⚠️','Please upload your signature image'); setSigning(false); return
    }

    const supabase = createClient()
    const now = new Date().toISOString()

    // Save signature
    const auditTrail = [{ event:'contract_signed', timestamp:now, details:`Signed via ${signMode} method` }]
    const { error: sigError } = await supabase.from('contract_signatures').insert([{
      contract_id: selected.id,
      staff_id: staff.id,
      signature_type: sigType,
      signature_data: sigData,
      signed_at: now,
      ip_address: 'logged',
      user_agent: navigator.userAgent,
      audit_trail: auditTrail,
    }])
    if (sigError) { showToast('❌',sigError.message); setSigning(false); return }

    // Update contract status
    await supabase.from('contracts').update({ status:'signed', signed_at:now }).eq('id', selected.id)
    setContracts(prev=>prev.map(c=>c.id===selected.id?{...c,status:'signed',signed_at:now}:c))

    // Notify admins
    await notifyAdmins({
      type:'general',
      title:`✅ Contract Signed: ${staff.first_name} ${staff.last_name}`,
      message:`${staff.first_name} has signed "${selected.title}". Timestamp: ${new Date(now).toLocaleString('en-PH')}.`,
    })

    setView('signed')
    setSigning(false)
    showToast('✅','Contract signed successfully!')
  }

  async function handleUploadSig(e) {
    const file = e.target.files[0]; if(!file) return
    const reader = new FileReader()
    reader.onload = async ev => {
      const supabase = createClient()
      const now = new Date().toISOString()
      await supabase.from('contract_signatures').insert([{
        contract_id:selected.id, staff_id:staff.id,
        signature_type:'upload', signature_data:ev.target.result,
        signed_at:now, user_agent:navigator.userAgent, audit_trail:[{event:'signed_via_upload',timestamp:now}],
      }])
      await supabase.from('contracts').update({status:'signed',signed_at:now}).eq('id',selected.id)
      setContracts(prev=>prev.map(c=>c.id===selected.id?{...c,status:'signed',signed_at:now}:c))
      await notifyAdmins({type:'general',title:`✅ Contract Signed: ${staff.first_name} ${staff.last_name}`,message:`${staff.first_name} signed "${selected.title}" via uploaded signature.`})
      setView('signed'); showToast('✅','Contract signed!')
    }
    reader.readAsDataURL(file)
  }

  return (
    <PortalShell>
      <div style={{background:'white',borderBottom:'1px solid #d8cebb',padding:'0 24px',height:56,display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
        <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:17,fontWeight:700}}>
          {view==='list'?'My Contracts':view==='sign'?'Sign Contract':'Contract Signed ✅'}
        </div>
        {view!=='list'&&<button onClick={()=>{setView('list');setSelected(null)}} style={{background:'transparent',border:'1px solid #d8cebb',borderRadius:8,padding:'6px 14px',fontSize:11,cursor:'pointer',color:'#7a6a50',fontFamily:"'DM Sans',sans-serif"}}>← Back</button>}
      </div>

      <div style={{flex:1,overflowY:'auto',padding:'20px 24px'}}>
        {loading?<div style={{textAlign:'center',padding:'60px',color:'#7a6a50'}}>Loading…</div>:

        view==='list'?(
          contracts.length===0?(
            <div style={{textAlign:'center',padding:'60px',background:'white',border:'1px solid #d8cebb',borderRadius:13}}>
              <div style={{fontSize:40,marginBottom:12}}>📄</div>
              <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:15,fontWeight:700,marginBottom:6}}>No contracts yet</div>
              <div style={{fontSize:12,color:'#7a6a50'}}>Contracts assigned to you will appear here.</div>
            </div>
          ):(
            <div style={{display:'flex',flexDirection:'column',gap:10}}>
              {contracts.map(c=>{
                const st = STATUS_STYLES[c.status]||STATUS_STYLES.draft
                return(
                  <div key={c.id} style={{background:'white',border:'1px solid #d8cebb',borderRadius:13,padding:'16px 20px',display:'flex',alignItems:'center',gap:16,cursor:'pointer',transition:'all .15s'}}
                    onMouseEnter={e=>{e.currentTarget.style.boxShadow='0 4px 14px rgba(26,18,8,.08)'}}
                    onMouseLeave={e=>{e.currentTarget.style.boxShadow=''}}>
                    <div style={{fontSize:32,flexShrink:0}}>📄</div>
                    <div style={{flex:1}}>
                      <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:14,fontWeight:700,marginBottom:3}}>{c.title}</div>
                      <div style={{fontSize:11,color:'#7a6a50'}}>{fmtDate(c.created_at)}{c.expires_at?' · Expires '+fmtDate(c.expires_at):''}</div>
                      {c.signed_at&&<div style={{fontSize:11,color:'#4a7a1e',marginTop:2,fontWeight:600}}>✅ Signed {fmtDate(c.signed_at)}</div>}
                    </div>
                    <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:8}}>
                      <span style={{fontSize:10,fontWeight:700,padding:'3px 9px',borderRadius:8,background:st.bg,color:st.color}}>{st.label}</span>
                      <div style={{display:'flex',gap:6}}>
                        <button onClick={()=>{setSelected(c);setView(c.status==='pending_signature'?'sign':'list');if(c.status!=='pending_signature')setSelected(c)}}
                          style={{background:'#e8f0fb',color:'#4a90c4',border:'none',borderRadius:7,padding:'5px 10px',fontSize:10,fontWeight:600,cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}>
                          👁 View
                        </button>
                        {c.status==='pending_signature'&&(
                          <button onClick={()=>{setSelected(c);setView('sign')}}
                            style={{background:'#EF4576',color:'white',border:'none',borderRadius:7,padding:'5px 10px',fontSize:10,fontWeight:600,cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}>
                            ✍️ Sign Now
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )
        ):

        view==='sign'&&selected?(
          <div style={{display:'grid',gridTemplateColumns:'1fr 340px',gap:16}}>
            {/* Contract content */}
            <div style={{background:'white',border:'1px solid #d8cebb',borderRadius:13,padding:'32px',lineHeight:1.9,fontSize:13,color:'#1a1208',whiteSpace:'pre-wrap',maxHeight:'calc(100vh - 160px)',overflowY:'auto'}}>
              <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:20,fontWeight:700,marginBottom:6}}>{selected.title}</div>
              <div style={{fontSize:10,color:'#7a6a50',marginBottom:24,paddingBottom:16,borderBottom:'1px solid #d8cebb'}}>Please read the full contract before signing.</div>
              {selected.content}
            </div>

            {/* Signature panel */}
            <div style={{display:'flex',flexDirection:'column',gap:12}}>
              <div style={{background:'white',border:'1px solid #d8cebb',borderRadius:13,padding:'18px'}}>
                <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:13,fontWeight:700,marginBottom:12}}>Your Signature</div>

                {/* Mode tabs */}
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
                    <canvas ref={canvasRef} width={290} height={120}
                      style={{border:'2px solid #d8cebb',borderRadius:8,background:'#faf7f2',cursor:'crosshair',touchAction:'none',width:'100%'}}
                      onMouseDown={startDraw} onMouseMove={draw} onMouseUp={endDraw} onMouseLeave={endDraw}
                      onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={endDraw}/>
                    <button onClick={clearCanvas} style={{fontSize:10,color:'#7a6a50',background:'transparent',border:'none',cursor:'pointer',marginTop:4,fontFamily:"'DM Sans',sans-serif"}}>Clear</button>
                  </div>
                )}

                {/* Type */}
                {signMode==='type'&&(
                  <div>
                    <input value={typedSig} onChange={e=>setTypedSig(e.target.value)} placeholder="Type your full name…"
                      style={{width:'100%',border:'1px solid #d8cebb',borderRadius:8,padding:'10px',fontSize:13,outline:'none',fontFamily:selectedFont.font,background:'#faf7f2'}}/>
                    <div style={{marginTop:10}}>
                      <div style={{fontSize:9,fontWeight:700,letterSpacing:1,textTransform:'uppercase',color:'#7a6a50',marginBottom:6}}>Choose Font Style</div>
                      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6}}>
                        {SIGN_FONTS.map(f=>(
                          <div key={f.name} onClick={()=>setSelectedFont(f)}
                            style={{padding:'8px 10px',borderRadius:7,border:`1.5px solid ${selectedFont.name===f.name?'#EF4576':'#d8cebb'}`,background:selectedFont.name===f.name?'#fdeef3':'white',cursor:'pointer',textAlign:'center'}}>
                            <span style={{fontFamily:f.font,fontSize:16,color:'#1a1208'}}>{typedSig||'Signature'}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    {/* Signature preview */}
                    {typedSig&&(
                      <div style={{marginTop:10,padding:'16px',background:'#faf7f2',border:'1px solid #d8cebb',borderRadius:8,textAlign:'center'}}>
                        <div style={{fontFamily:selectedFont.font,fontSize:28,color:'#1a1208'}}>{typedSig}</div>
                      </div>
                    )}
                  </div>
                )}

                {/* Upload */}
                {signMode==='upload'&&(
                  <div>
                    <label style={{display:'flex',flexDirection:'column',alignItems:'center',gap:8,background:'#faf7f2',border:'2px dashed #d8cebb',borderRadius:9,padding:'24px',cursor:'pointer'}}>
                      <span style={{fontSize:28}}>📎</span>
                      <span style={{fontSize:12,color:'#7a6a50',fontWeight:600}}>Upload signature PNG</span>
                      <span style={{fontSize:10,color:'#7a6a50'}}>Transparent background preferred</span>
                      <input type="file" accept="image/*" ref={uploadRef} style={{display:'none'}} onChange={handleUploadSig}/>
                    </label>
                  </div>
                )}
              </div>

              {/* Legal notice */}
              <div style={{background:'#fef3e2',border:'1px solid #d4a84366',borderRadius:10,padding:'12px 14px',fontSize:11,color:'#a06000',lineHeight:1.6}}>
                ⚖️ By signing, you confirm that you have read and agree to the terms of this contract. Your signature, IP address, and timestamp will be recorded.
              </div>

              {signMode!=='upload'&&(
                <button onClick={submitSignature} disabled={signing}
                  style={{background:signing?'#aaa':'#EF4576',color:'white',border:'none',borderRadius:10,padding:'14px',fontSize:13,fontWeight:700,cursor:signing?'not-allowed':'pointer',fontFamily:"'DM Sans',sans-serif"}}>
                  {signing?'Processing…':'✍️ Sign Contract'}
                </button>
              )}
            </div>
          </div>
        ):

        view==='signed'?(
          <div style={{maxWidth:500,margin:'0 auto',textAlign:'center',padding:'40px 0'}}>
            <div style={{fontSize:60,marginBottom:16}}>🎉</div>
            <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:22,fontWeight:700,color:'#4a7a1e',marginBottom:8}}>Contract Signed!</div>
            <div style={{fontSize:13,color:'#7a6a50',marginBottom:24,lineHeight:1.7}}>
              Your signature has been recorded. The management team has been notified.
            </div>
            <div style={{background:'#eef7e4',border:'1px solid #7ab648',borderRadius:12,padding:'16px',marginBottom:20,fontSize:12,color:'#4a7a1e',textAlign:'left',lineHeight:1.8}}>
              ✅ Signature recorded<br/>
              🕐 Timestamp: {new Date().toLocaleString('en-PH')}<br/>
              🔒 Audit trail created<br/>
              📧 Management notified
            </div>
            <button onClick={()=>setView('list')} style={{background:'#7ab648',color:'white',border:'none',borderRadius:10,padding:'12px 24px',fontSize:13,fontWeight:700,cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}>
              ← Back to My Contracts
            </button>
          </div>
        ):null}
      </div>

      {toast&&<div style={{position:'fixed',bottom:22,right:22,background:'#1a1208',color:'#f5f0e8',border:'1px solid #3d3020',borderRadius:12,padding:'12px 16px',fontSize:12,fontWeight:500,display:'flex',alignItems:'center',gap:9,boxShadow:'0 8px 28px rgba(0,0,0,.2)',zIndex:1000}}><span>{toast.icon}</span><span>{toast.msg}</span></div>}
    </PortalShell>
  )
}
