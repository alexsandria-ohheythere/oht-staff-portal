'use client'
export const dynamic = 'force-dynamic'
import { useState, useEffect, useRef } from 'react'
import PortalShell from '../../../components/PortalShell'
import { createClient } from '../../../lib/supabase'
import { notifyAdmins } from '../../../lib/notify'

const CATEGORIES = ['All','Contract','NDA','Government Forms','Performance Reviews','Training Materials','Incident Report','General']
const CAT_COLORS = {'Contract':'#4a7a1e','NDA':'#c0392b','Government Forms':'#2d5a8a','Performance Reviews':'#8e44ad','Training Materials':'#a06000','General':'#7a6a50','Incident Report':'#c0392b'}
const fmtDate = d => d ? new Date(d).toLocaleDateString('en-PH',{month:'short',day:'numeric',year:'numeric'}) : '—'

export default function MyFiles() {
  const [staff, setStaff]     = useState(null)
  const [files, setFiles]     = useState([])
  const [loading, setLoading] = useState(true)
  const [catFilter, setCatFilter] = useState('All')
  const [search, setSearch]   = useState('')
  const [uploading, setUploading] = useState(false)
  const [toast, setToast]     = useState(null)
  const uploadRef = useRef()

  useEffect(() => { init() }, [])

  async function init() {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    const { data: s } = await supabase.from('staff').select('*').eq('email', session.user.email).single()
    if (!s) { setLoading(false); return }
    setStaff(s)
    const { data: f } = await supabase.from('staff_files').select('*').eq('staff_id', s.id).order('created_at',{ascending:false})
    setFiles(f||[])
    setLoading(false)
  }

  function showToast(icon,msg){setToast({icon,msg});setTimeout(()=>setToast(null),3500)}

  async function uploadFile(e) {
    const file = e.target.files[0]; if(!file) return
    // Check if employee has upload permission
    const canUpload = files.some(f=>f.can_upload)
    if (!canUpload && files.length > 0) { showToast('⚠️','You need permission to upload files. Contact your manager.'); return }
    setUploading(true)
    const supabase = createClient()
    const path = `${staff.id}/${Date.now()}_${file.name}`
    const { error: upErr } = await supabase.storage.from('staff-files').upload(path, file)
    if (upErr) { showToast('❌',upErr.message); setUploading(false); return }
    const { data: { publicUrl } } = supabase.storage.from('staff-files').getPublicUrl(path)
    const { error: dbErr } = await supabase.from('staff_files').insert([{
      staff_id: staff.id, file_name: file.name, file_url: publicUrl,
      file_size: file.size, file_type: file.type, category:'General',
      storage_path: path, uploaded_by: staff.first_name, can_download:true
    }])
    if (dbErr) { showToast('❌',dbErr.message); setUploading(false); return }
    await notifyAdmins({
      type:'general',
      title:`📁 File Uploaded: ${staff.first_name} ${staff.last_name}`,
      message:`${staff.first_name} uploaded "${file.name}" to their 201 file.`,
    })
    await init()
    showToast('✅','File uploaded & managers notified')
    setUploading(false)
    e.target.value=''
  }

  const canUpload = files.some(f=>f.can_upload)
  const filtered = files.filter(f => {
    if (catFilter!=='All' && f.category!==catFilter) return false
    if (search && !`${f.file_name} ${f.description||''}`.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  // Group by category
  const byCategory = {}
  filtered.forEach(f => {
    if (!byCategory[f.category]) byCategory[f.category]=[]
    byCategory[f.category].push(f)
  })

  return (
    <PortalShell>
      <div style={{background:'white',borderBottom:'1px solid #d8cebb',padding:'0 24px',height:56,display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
        <div>
          <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:17,fontWeight:700}}>My Files · 201</div>
          <div style={{fontSize:11,color:'#7a6a50',marginTop:1}}>{files.length} files</div>
        </div>
        <div style={{display:'flex',gap:9,alignItems:'center'}}>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search files…"
            style={{background:'#faf7f2',border:'1px solid #d8cebb',borderRadius:8,padding:'7px 12px',fontSize:12,fontFamily:"'DM Sans',sans-serif",outline:'none',width:180}}/>
          {canUpload&&(
            <label style={{display:'flex',alignItems:'center',gap:6,background:'#eef7e4',border:'1px solid #7ab64866',borderRadius:8,padding:'7px 14px',fontSize:11,fontWeight:700,color:'#4a7a1e',cursor:'pointer'}}>
              {uploading?'Uploading…':'📁 Upload File'}
              <input type="file" ref={uploadRef} style={{display:'none'}} onChange={uploadFile} disabled={uploading}/>
            </label>
          )}
        </div>
      </div>

      <div style={{flex:1,overflowY:'auto',padding:'20px 24px'}}>
        {/* Category filter */}
        <div style={{display:'flex',gap:6,marginBottom:16,flexWrap:'wrap'}}>
          {CATEGORIES.map(c=>(
            <button key={c} onClick={()=>setCatFilter(c)}
              style={{padding:'5px 12px',borderRadius:20,border:`1.5px solid ${catFilter===c?(CAT_COLORS[c]||'#EF4576'):'#d8cebb'}`,background:catFilter===c?(CAT_COLORS[c]||'#EF4576')+'22':'transparent',color:catFilter===c?(CAT_COLORS[c]||'#EF4576'):'#7a6a50',fontSize:10,fontWeight:600,cursor:'pointer',fontFamily:"'DM Sans',sans-serif",transition:'all .15s'}}>
              {c}
            </button>
          ))}
        </div>

        {loading?<div style={{textAlign:'center',padding:'60px',color:'#7a6a50'}}>Loading…</div>:files.length===0?(
          <div style={{textAlign:'center',padding:'60px',background:'white',border:'1px solid #d8cebb',borderRadius:13}}>
            <div style={{fontSize:40,marginBottom:12}}>📁</div>
            <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:15,fontWeight:700,marginBottom:6}}>No files yet</div>
            <div style={{fontSize:12,color:'#7a6a50'}}>Files assigned to you by management will appear here.</div>
          </div>
        ):(
          <div style={{display:'flex',flexDirection:'column',gap:16}}>
            {Object.entries(byCategory).map(([cat,catFiles])=>{
              const color = CAT_COLORS[cat]||'#7a6a50'
              return(
                <div key={cat} style={{background:'white',border:'1px solid #d8cebb',borderRadius:13,overflow:'hidden'}}>
                  <div style={{background:color+'22',padding:'11px 16px',borderBottom:`1px solid ${color}44`,display:'flex',alignItems:'center',gap:8}}>
                    <div style={{width:8,height:8,borderRadius:'50%',background:color}}/>
                    <span style={{fontFamily:"'Montserrat',sans-serif",fontSize:12,fontWeight:700,color}}>{cat}</span>
                    <span style={{fontSize:10,color,opacity:.7}}>· {catFiles.length} file{catFiles.length!==1?'s':''}</span>
                  </div>
                  <div style={{padding:'12px 16px',display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))',gap:10}}>
                    {catFiles.map(f=>{
                      const isPDF = f.file_type?.includes('pdf')||f.file_name?.endsWith('.pdf')
                      const isImg = f.file_type?.includes('image')
                      return(
                        <div key={f.id} style={{background:'#faf7f2',border:'1px solid #d8cebb',borderRadius:10,padding:'12px',borderLeft:`3px solid ${color}`}}>
                          <div style={{fontSize:24,marginBottom:6}}>{isPDF?'📄':isImg?'🖼️':'📁'}</div>
                          <div style={{fontSize:12,fontWeight:600,color:'#1a1208',marginBottom:3,wordBreak:'break-word'}}>{f.file_name}</div>
                          {f.description&&<div style={{fontSize:10,color:'#7a6a50',marginBottom:6,lineHeight:1.4}}>{f.description}</div>}
                          <div style={{fontSize:10,color:'#7a6a50',marginBottom:8,fontFamily:"'DM Mono',monospace"}}>{fmtDate(f.created_at)}</div>
                          <div style={{display:'flex',gap:5}}>
                            <a href={f.file_url} target="_blank" rel="noreferrer"
                              style={{flex:1,background:'#e8f0fb',color:'#4a90c4',borderRadius:6,padding:'5px 8px',fontSize:10,fontWeight:600,textDecoration:'none',textAlign:'center',display:'block'}}>
                              👁 Open
                            </a>
                            {f.can_download&&(
                              <a href={f.file_url} download={f.file_name}
                                style={{flex:1,background:'#eef7e4',color:'#4a7a1e',borderRadius:6,padding:'5px 8px',fontSize:10,fontWeight:600,textDecoration:'none',textAlign:'center',display:'block'}}>
                                ↓ Download
                              </a>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {toast&&<div style={{position:'fixed',bottom:22,right:22,background:'#1a1208',color:'#f5f0e8',border:'1px solid #3d3020',borderRadius:12,padding:'12px 16px',fontSize:12,fontWeight:500,display:'flex',alignItems:'center',gap:9,boxShadow:'0 8px 28px rgba(0,0,0,.2)',zIndex:1000}}><span>{toast.icon}</span><span>{toast.msg}</span></div>}
    </PortalShell>
  )
}
