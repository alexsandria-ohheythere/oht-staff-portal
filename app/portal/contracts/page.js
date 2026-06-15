'use client'
export const dynamic = 'force-dynamic'
import { useState, useEffect, useRef } from 'react'
import PortalShell from '../../../components/PortalShell'
import { createClient } from '../../../lib/supabase'
import { notifyAdmins } from '../../../lib/notify'

const fmtDate = d => d ? new Date(d).toLocaleDateString('en-PH',{month:'long',day:'numeric',year:'numeric'}) : '—'
const fmtDateTime = d => d ? new Date(d).toLocaleString('en-PH',{month:'short',day:'numeric',year:'numeric',hour:'2-digit',minute:'2-digit'}) : '—'

const STATUS_STYLES = {
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
  const [staff, setStaff]           = useState(null)
  const [contracts, setContracts]   = useState([])
  const [loading, setLoading]       = useState(true)
  const [selected, setSelected]     = useState(null)
  const [view, setView]             = useState('list') // list | read | sign | done
  const [signMode, setSignMode]     = useState('draw')
  const [typedSig, setTypedSig]     = useState('')
  const [selectedFont, setSelectedFont] = useState(SIGN_FONTS[0])
  const [signing, setSigning]       = useState(false)
  const [toast, setToast]           = useState(null)
  const canvasRef   = useRef(null)
  const isDrawing   = useRef(false)
  const uploadRef   = useRef()

  useEffect(() => { init() }, [])

  async function init() {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    const { data: s } = await supabase.from('staff').select('*').eq('email', session.user.email).single()
    if (!s) { setLoading(false); return }
    setStaff(s)
    const { data: c } = await supabase.from('contracts').select('*').eq('staff_id', s.id).order('created_at',{ascending:false})
    setContracts(c || [])
    setLoading(false)
  }

  function showToast(icon, msg) { setToast({icon,msg}); setTimeout(()=>setToast(null),4000) }

  // Canvas drawing
  function startDraw(e) {
    isDrawing.current = true
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    const x = ((e.clientX||e.touches?.[0]?.clientX) - rect.left) * scaleX
    const y = ((e.clientY||e.touches?.[0]?.clientY) - rect.top) * scaleY
    ctx.beginPath(); ctx.moveTo(x, y)
  }
  function draw(e) {
    if (!isDrawing.current) return
    e.preventDefault()
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    const x = ((e.clientX||e.touches?.[0]?.clientX) - rect.left) * scaleX
    const y = ((e.clientY||e.touches?.[0]?.clientY) - rect.top) * scaleY
    ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.strokeStyle = '#1a1208'
    ctx.lineTo(x, y); ctx.stroke()
  }
  function endDraw() { isDrawing.current = false }
  function clearCanvas() {
    const canvas = canvasRef.current
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height)
  }

  async function submitSignature() {
    if (!selected) return
    setSigning(true)
    let sigData = ''

    if (signMode === 'draw') {
      const canvas = canvasRef.current
      const ctx = canvas.getContext('2d')
      const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data
      const isEmpty = !pixels.some(p => p !== 0)
      if (isEmpty) { showToast('⚠️','Please draw your signature first'); setSigning(false); return }
      sigData = canvas.toDataURL('image/png')
    } else if (signMode === 'type') {
      if (!typedSig.trim()) { showToast('⚠️','Please type your signature'); setSigning(false); return }
      sigData = typedSig
    }

    const supabase = createClient()
    const now = new Date().toISOString()

    const { error: sigError } = await supabase.from('contract_signatures').insert([{
      contract_id: selected.id,
      staff_id: staff.id,
      signature_type: signMode,
      signature_data: sigData,
      signed_at: now,
      signatory_type: 'employee',
      user_agent: navigator.userAgent,
      audit_trail: [{ event:'employee_signed', timestamp:now, method:signMode }],
    }])
    if (sigError) { showToast('❌', sigError.message); setSigning(false); return }

    // Update contract — employee signed, now awaiting management countersign
    await supabase.from('contracts').update({
      signed_at: now,
      status: 'pending_signature', // stays pending until mgmt countersigns
    }).eq('id', selected.id)

    setContracts(prev => prev.map(c => c.id===selected.id ? {...c, signed_at:now} : c))

    // Notify admins
    await notifyAdmins({
      type: 'general',
      title: `✍️ Contract Signed: ${staff.first_name} ${staff.last_name}`,
      message: `${staff.first_name} has signed "${selected.title}" and is awaiting your countersignature.`,
    })

    setView('done')
    setSigning(false)
  }

  async function handleUploadSig(e) {
    const file = e.target.files[0]; if (!file) return
    const reader = new FileReader()
    reader.onload = async ev => {
      const supabase = createClient()
      const now = new Date().toISOString()
      await supabase.from('contract_signatures').insert([{
        contract_id: selected.id,
        staff_id: staff.id,
        signature_type: 'upload',
        signature_data: ev.target.result,
        signed_at: now,
        signatory_type: 'employee',
        user_agent: navigator.userAgent,
        audit_trail: [{ event:'employee_signed_upload', timestamp:now }],
      }])
      await supabase.from('contracts').update({ signed_at:now, status:'pending_signature' }).eq('id', selected.id)
      setContracts(prev => prev.map(c => c.id===selected.id ? {...c, signed_at:now} : c))
      await notifyAdmins({
        type:'general',
        title:`✍️ Contract Signed: ${staff.first_name} ${staff.last_name}`,
        message:`${staff.first_name} signed "${selected.title}" and is awaiting your countersignature.`,
      })
      setView('done')
    }
    reader.readAsDataURL(file)
  }

  const pendingCount  = contracts.filter(c => c.status==='pending_signature' && !c.signed_at).length
  const awaitingMgmt  = contracts.filter(c => c.signed_at && !c.management_signed_at).length

  return (
    <PortalShell>
      {/* Header */}
      <div style={{background:'white',borderBottom:'1px solid #d8cebb',padding:'0 24px',height:56,display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
        <div>
          <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:17,fontWeight:700}}>
            {view==='list'?'My Contracts':view==='read'?selected?.title:view==='sign'?'Sign Contract':'✅ Signed!'}
          </div>
          {view==='list'&&<div style={{fontSize:11,color:'#7a6a50',marginTop:1}}>{contracts.length} contract{contracts.length!==1?'s':''}</div>}
          {view==='read'&&<div style={{fontSize:11,color:'#7a6a50',marginTop:1}}>Read carefully before signing</div>}
        </div>
        {view!=='list'&&(
          <button onClick={()=>{setView('list');setSelected(null);setTypedSig('');clearCanvas?.()}}
            style={{background:'transparent',border:'1px solid #d8cebb',borderRadius:8,padding:'6px 14px',fontSize:11,cursor:'pointer',color:'#7a6a50',fontFamily:"'DM Sans',sans-serif"}}>
            ← Back
          </button>
        )}
      </div>

      <div style={{flex:1,overflowY:'auto',padding:'20px 24px'}}>
        {loading ? (
          <div style={{textAlign:'center',padding:'60px',color:'#7a6a50'}}>Loading…</div>

        ) : view==='list' ? (
          <>
            {/* Banners */}
            {pendingCount > 0 && (
              <div style={{background:'#fef3e2',border:'1px solid #d4a84366',borderRadius:10,padding:'12px 16px',marginBottom:12,display:'flex',alignItems:'center',gap:10}}>
                <span style={{fontSize:20}}>📝</span>
                <span style={{fontSize:13,fontWeight:600,color:'#a06000'}}>{pendingCount} contract{pendingCount!==1?'s':''} awaiting your signature</span>
              </div>
            )}
            {awaitingMgmt > 0 && (
              <div style={{background:'#eef7e4',border:'1px solid #7ab64866',borderRadius:10,padding:'12px 16px',marginBottom:12,display:'flex',alignItems:'center',gap:10}}>
                <span style={{fontSize:20}}>⏳</span>
                <span style={{fontSize:13,fontWeight:600,color:'#4a7a1e'}}>{awaitingMgmt} contract{awaitingMgmt!==1?'s':''} awaiting management countersignature</span>
              </div>
            )}

            {contracts.length === 0 ? (
              <div style={{textAlign:'center',padding:'60px',background:'white',border:'1px solid #d8cebb',borderRadius:13}}>
                <div style={{fontSize:40,marginBottom:12}}>📄</div>
                <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:15,fontWeight:700,marginBottom:6}}>No contracts yet</div>
                <div style={{fontSize:12,color:'#7a6a50'}}>Contracts assigned to you will appear here.</div>
              </div>
            ) : (
              <div style={{display:'flex',flexDirection:'column',gap:10}}>
                {contracts.map(c => {
                  const st = STATUS_STYLES[c.status] || STATUS_STYLES.draft
                  const employeeSigned  = !!c.signed_at
                  const mgmtSigned      = !!c.management_signed_at
                  const needsMySign     = c.status==='pending_signature' && !employeeSigned
                  const awaitingCounter = employeeSigned && !mgmtSigned
                  const fullyDone       = employeeSigned && mgmtSigned

                  return (
                    <div key={c.id}
                      style={{background:'white',border:`1px solid ${needsMySign?'#EF4576':fullyDone?'#7ab648':'#d8cebb'}`,borderRadius:13,padding:'16px 20px',transition:'all .15s'}}
                      onMouseEnter={e=>e.currentTarget.style.boxShadow='0 4px 14px rgba(26,18,8,.08)'}
                      onMouseLeave={e=>e.currentTarget.style.boxShadow=''}>
                      <div style={{display:'flex',alignItems:'flex-start',gap:14}}>
                        <div style={{fontSize:32,flexShrink:0}}>{fullyDone?'✅':'📄'}</div>
                        <div style={{flex:1}}>
                          <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:14,fontWeight:700,marginBottom:4}}>{c.title}</div>
                          <div style={{fontSize:11,color:'#7a6a50',marginBottom:8}}>{fmtDate(c.created_at)}{c.expires_at?' · Expires '+fmtDate(c.expires_at):''}</div>

                          {/* Signature progress */}
                          <div style={{display:'flex',gap:8,marginBottom:10,flexWrap:'wrap'}}>
                            <div style={{display:'flex',alignItems:'center',gap:5,fontSize:11,padding:'4px 10px',borderRadius:20,background:employeeSigned?'#eef7e4':'#fef3e2',border:`1px solid ${employeeSigned?'#7ab64866':'#d4a84366'}`}}>
                              <span>{employeeSigned?'✅':'⏳'}</span>
                              <span style={{color:employeeSigned?'#4a7a1e':'#a06000',fontWeight:600}}>Your signature</span>
                            </div>
                            <div style={{display:'flex',alignItems:'center',gap:5,fontSize:11,padding:'4px 10px',borderRadius:20,background:mgmtSigned?'#eef7e4':'#f0ede8',border:`1px solid ${mgmtSigned?'#7ab64866':'#d8cebb'}`}}>
                              <span>{mgmtSigned?'✅':'⏳'}</span>
                              <span style={{color:mgmtSigned?'#4a7a1e':'#7a6a50',fontWeight:600}}>
                                {mgmtSigned?`${c.management_signed_by==='alex'?'Alex':'CJ'} countersigned`:'Mgmt countersign'}
                              </span>
                            </div>
                          </div>

                          {awaitingCounter && (
                            <div style={{fontSize:11,color:'#4a7a1e',fontWeight:500}}>✍️ You've signed — waiting for management to countersign.</div>
                          )}
                          {fullyDone && (
                            <div style={{fontSize:11,color:'#4a7a1e',fontWeight:600}}>🎉 Fully executed on {fmtDate(c.management_signed_at)}</div>
                          )}
                        </div>

                        <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:8,flexShrink:0}}>
                          <span style={{fontSize:10,fontWeight:700,padding:'3px 9px',borderRadius:8,background:st.bg,color:st.color}}>{st.label}</span>
                          <div style={{display:'flex',gap:6}}>
                            <button onClick={()=>{setSelected(c);setView('read')}}
                              style={{background:'#e8f0fb',color:'#4a90c4',border:'none',borderRadius:7,padding:'5px 10px',fontSize:10,fontWeight:600,cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}>
                              👁 Read
                            </button>
                            {needsMySign && (
                              <button onClick={()=>{setSelected(c);setView('sign')}}
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

        ) : view==='read' && selected ? (
          <div style={{display:'grid',gridTemplateColumns:'1fr 260px',gap:16}}>
            {/* Contract content */}
            <div style={{background:'white',border:'1px solid #d8cebb',borderRadius:13,padding:'36px',lineHeight:1.9,fontSize:13,color:'#1a1208',whiteSpace:'pre-wrap',fontFamily:"'DM Sans',sans-serif",maxHeight:'calc(100vh - 160px)',overflowY:'auto'}}>
              {selected.content}
            </div>

            {/* Actions panel */}
            <div style={{display:'flex',flexDirection:'column',gap:12}}>
              <div style={{background:'white',border:'1px solid #d8cebb',borderRadius:13,padding:'16px'}}>
                <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:13,fontWeight:700,marginBottom:12}}>Signature Status</div>
                <div style={{display:'flex',flexDirection:'column',gap:8}}>
                  <div style={{padding:'10px',borderRadius:8,background:selected.signed_at?'#eef7e4':'#fef3e2',border:`1px solid ${selected.signed_at?'#7ab64866':'#d4a84366'}`,fontSize:11}}>
                    <div style={{fontWeight:700,color:selected.signed_at?'#4a7a1e':'#a06000',marginBottom:2}}>
                      {selected.signed_at?'✅ You signed':'⏳ Your signature needed'}
                    </div>
                    {selected.signed_at&&<div style={{color:'#7a6a50',fontSize:10,fontFamily:"'DM Mono',monospace"}}>{fmtDateTime(selected.signed_at)}</div>}
                  </div>
                  <div style={{padding:'10px',borderRadius:8,background:selected.management_signed_at?'#eef7e4':'#f0ede8',border:'1px solid #d8cebb',fontSize:11}}>
                    <div style={{fontWeight:700,color:selected.management_signed_at?'#4a7a1e':'#7a6a50',marginBottom:2}}>
                      {selected.management_signed_at?`✅ ${selected.management_signed_by==='alex'?'Alex':'CJ'} countersigned`:'⏳ Mgmt countersign'}
                    </div>
                    {selected.management_signed_at&&<div style={{color:'#7a6a50',fontSize:10,fontFamily:"'DM Mono',monospace"}}>{fmtDateTime(selected.management_signed_at)}</div>}
                  </div>
                </div>
              </div>

              {!selected.signed_at && selected.status==='pending_signature' && (
                <button onClick={()=>setView('sign')}
                  style={{background:'#EF4576',color:'white',border:'none',borderRadius:10,padding:'13px',fontSize:13,fontWeight:700,cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}>
                  ✍️ Sign This Contract
                </button>
              )}

              <div style={{background:'#fef3e2',border:'1px solid #d4a84366',borderRadius:10,padding:'12px 14px',fontSize:11,color:'#a06000',lineHeight:1.6}}>
                ⚖️ Please read the full contract carefully before signing. Your digital signature is legally binding.
              </div>
            </div>
          </div>

        ) : view==='sign' && selected ? (
          <div style={{display:'grid',gridTemplateColumns:'1fr 360px',gap:16}}>
            {/* Contract to sign */}
            <div style={{background:'white',border:'1px solid #d8cebb',borderRadius:13,padding:'36px',lineHeight:1.9,fontSize:13,color:'#1a1208',whiteSpace:'pre-wrap',fontFamily:"'DM Sans',sans-serif",maxHeight:'calc(100vh - 160px)',overflowY:'auto'}}>
              <div style={{background:'#fef3e2',border:'1px solid #d4a84366',borderRadius:8,padding:'10px 14px',marginBottom:20,fontSize:11,color:'#a06000'}}>
                📖 Please read the full contract before signing below.
              </div>
              {selected.content}
            </div>

            {/* Signature panel */}
            <div style={{display:'flex',flexDirection:'column',gap:12}}>
              <div style={{background:'white',border:'1px solid #d8cebb',borderRadius:13,padding:'18px'}}>
                <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:14,fontWeight:700,marginBottom:4}}>Your Signature</div>
                <div style={{fontSize:11,color:'#7a6a50',marginBottom:14}}>Signing as: <strong>{staff?.first_name} {staff?.last_name}</strong></div>

                {/* Method tabs */}
                <div style={{display:'flex',gap:6,marginBottom:14}}>
                  {[['draw','✍️ Draw'],['type','⌨️ Type'],['upload','📎 Upload']].map(([m,l])=>(
                    <button key={m} onClick={()=>setSignMode(m)}
                      style={{flex:1,padding:'7px 4px',borderRadius:7,border:`1.5px solid ${signMode===m?'#EF4576':'#d8cebb'}`,background:signMode===m?'#fdeef3':'transparent',color:signMode===m?'#EF4576':'#7a6a50',fontSize:10,fontWeight:600,cursor:'pointer',fontFamily:"'DM Sans',sans-serif",transition:'all .15s'}}>
                      {l}
                    </button>
                  ))}
                </div>

                {/* Draw */}
                {signMode==='draw' && (
                  <div>
                    <canvas ref={canvasRef} width={580} height={160}
                      style={{border:'2px solid #d8cebb',borderRadius:8,background:'#faf7f2',cursor:'crosshair',touchAction:'none',width:'100%',display:'block'}}
                      onMouseDown={startDraw} onMouseMove={draw} onMouseUp={endDraw} onMouseLeave={endDraw}
                      onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={endDraw}/>
                    <button onClick={clearCanvas} style={{fontSize:10,color:'#7a6a50',background:'transparent',border:'none',cursor:'pointer',marginTop:5,fontFamily:"'DM Sans',sans-serif"}}>Clear</button>
                  </div>
                )}

                {/* Type */}
                {signMode==='type' && (
                  <div>
                    <input value={typedSig} onChange={e=>setTypedSig(e.target.value)}
                      placeholder="Type your full name…"
                      style={{width:'100%',border:'1px solid #d8cebb',borderRadius:8,padding:'10px',fontSize:14,outline:'none',fontFamily:selectedFont.font,background:'#faf7f2',color:'#1a1208'}}/>
                    <div style={{marginTop:10}}>
                      <div style={{fontSize:9,fontWeight:700,letterSpacing:1,textTransform:'uppercase',color:'#7a6a50',marginBottom:7}}>Choose Style</div>
                      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6}}>
                        {SIGN_FONTS.map(f=>(
                          <div key={f.name} onClick={()=>setSelectedFont(f)}
                            style={{padding:'8px',borderRadius:7,border:`1.5px solid ${selectedFont.name===f.name?'#EF4576':'#d8cebb'}`,background:selectedFont.name===f.name?'#fdeef3':'white',cursor:'pointer',textAlign:'center',transition:'all .15s'}}>
                            <span style={{fontFamily:f.font,fontSize:18,color:'#1a1208'}}>{typedSig||'Signature'}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    {typedSig && (
                      <div style={{marginTop:10,padding:'16px',background:'#faf7f2',border:'2px solid #d8cebb',borderRadius:8,textAlign:'center'}}>
                        <span style={{fontFamily:selectedFont.font,fontSize:30,color:'#1a1208'}}>{typedSig}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Upload */}
                {signMode==='upload' && (
                  <label style={{display:'flex',flexDirection:'column',alignItems:'center',gap:8,background:'#faf7f2',border:'2px dashed #d8cebb',borderRadius:9,padding:'28px',cursor:'pointer'}}>
                    <span style={{fontSize:32}}>📎</span>
                    <span style={{fontSize:12,color:'#7a6a50',fontWeight:600}}>Upload PNG signature</span>
                    <span style={{fontSize:10,color:'#7a6a50'}}>Transparent background recommended</span>
                    <input type="file" accept="image/*" ref={uploadRef} style={{display:'none'}} onChange={handleUploadSig}/>
                  </label>
                )}
              </div>

              {/* Legal notice */}
              <div style={{background:'#fef3e2',border:'1px solid #d4a84366',borderRadius:10,padding:'12px 14px',fontSize:11,color:'#a06000',lineHeight:1.6}}>
                ⚖️ By signing, you confirm you have read and agree to all terms. Your signature, timestamp, and IP address will be recorded. Management will countersign after you.
              </div>

              {/* Sign button */}
              {signMode !== 'upload' && (
                <button onClick={submitSignature} disabled={signing}
                  style={{background:signing?'#aaa':'#EF4576',color:'white',border:'none',borderRadius:10,padding:'14px',fontSize:14,fontWeight:700,cursor:signing?'not-allowed':'pointer',fontFamily:"'DM Sans',sans-serif",transition:'all .2s'}}>
                  {signing ? 'Processing…' : '✍️ Sign Contract'}
                </button>
              )}
            </div>
          </div>

        ) : view==='done' ? (
          <div style={{maxWidth:520,margin:'0 auto',textAlign:'center',padding:'50px 20px'}}>
            <div style={{fontSize:64,marginBottom:16}}>🎉</div>
            <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:24,fontWeight:700,color:'#4a7a1e',marginBottom:8}}>You've Signed!</div>
            <div style={{fontSize:13,color:'#7a6a50',marginBottom:24,lineHeight:1.7}}>
              Your signature has been recorded. The management team has been notified and will countersign shortly.
            </div>
            <div style={{background:'#eef7e4',border:'1px solid #7ab648',borderRadius:13,padding:'20px',marginBottom:24,textAlign:'left',lineHeight:2}}>
              <div style={{fontSize:12,color:'#4a7a1e'}}>
                ✅ Your signature recorded<br/>
                🕐 Timestamp: {new Date().toLocaleString('en-PH')}<br/>
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
        ) : null}
      </div>

      {toast && (
        <div style={{position:'fixed',bottom:22,right:22,background:'#1a1208',color:'#f5f0e8',border:'1px solid #3d3020',borderRadius:12,padding:'12px 16px',fontSize:12,fontWeight:500,display:'flex',alignItems:'center',gap:9,boxShadow:'0 8px 28px rgba(0,0,0,.2)',zIndex:1000}}>
          <span>{toast.icon}</span><span>{toast.msg}</span>
        </div>
      )}
    </PortalShell>
  )
}
