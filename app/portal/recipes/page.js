'use client'
export const dynamic = 'force-dynamic'
import { useState, useEffect } from 'react'
import PortalShell from '../../../components/PortalShell'
import { createClient } from '../../../lib/supabase'

const SETTINGS_KEY = 'recipe_categories'

const PALETTE = [
  { bg: '#e8f4fd', text: '#1e40af', dot: '#2563eb', border: '#bfdbfe' },
  { bg: '#fef3c7', text: '#b45309', dot: '#d97706', border: '#fde68a' },
  { bg: '#fce7f3', text: '#9d174d', dot: '#db2777', border: '#fbcfe8' },
  { bg: '#f3f4f6', text: '#4b5563', dot: '#6b7280', border: '#e5e7eb' },
  { bg: '#d1fae5', text: '#065f46', dot: '#10b981', border: '#a7f3d0' },
  { bg: '#ede9fe', text: '#5b21b6', dot: '#7c3aed', border: '#ddd6fe' },
  { bg: '#fee2e2', text: '#991b1b', dot: '#dc2626', border: '#fecaca' },
  { bg: '#fef9c3', text: '#854d0e', dot: '#ca8a04', border: '#fef08a' },
]

const ROLE_ACCESS = {
  'Cafe Supervisor':              { juniorOnly: false },
  'Cafe Operations Support':      { juniorOnly: false },
  'Senior Barista':               { tags: ['bar'], juniorOnly: false },
  'Junior Barista - Milk Station':{ tags: ['bar'], juniorOnly: true },
  'Junior Barista - Cashier':     { tags: ['bar'], juniorOnly: true },
  'Executive Chef':               { tags: ['kitchen'], juniorOnly: false },
  'Sous Chef':                    { tags: ['kitchen'], juniorOnly: true },
  'Kitchen Staff':                { tags: ['kitchen'], juniorOnly: true },
}

function catMatchesTags(catName, tags) {
  if (!tags || tags.length === 0) return true
  const lower = catName.toLowerCase()
  return tags.some(tag => lower.includes(tag))
}

function Modal({ open, onClose, title, children }) {
  if (!open) return null
  return (
    <div onClick={e => e.target === e.currentTarget && onClose()} style={{ position: 'fixed', inset: 0, background: 'rgba(26,18,8,.6)', backdropFilter: 'blur(4px)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: 'white', borderRadius: 18, padding: 24, width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,.2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <div style={{ fontFamily: "'Montserrat',sans-serif", fontSize: 16, fontWeight: 700 }}>{title}</div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', fontSize: 22, cursor: 'pointer', color: '#9ca3af', lineHeight: 1 }}>×</button>
        </div>
        {children}
      </div>
    </div>
  )
}

export default function PortalRecipesPage() {
  const supabase = createClient()
  const [categories, setCategories] = useState([])
  const [recipes, setRecipes] = useState([])
  const [loading, setLoading] = useState(true)
  const [access, setAccess] = useState(null)
  const [staffRole, setStaffRole] = useState('')

  const [expandedCats, setExpandedCats] = useState({})
  const [search, setSearch] = useState('')
  const [viewRecipe, setViewRecipe] = useState(null)

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setLoading(false); return }

      const { data: staff } = await supabase.from('staff').select('role').eq('email', session.user.email).single()
      const role = staff?.role || ''
      setStaffRole(role)

      const acc = ROLE_ACCESS[role] || null
      setAccess(acc)

      const { data: settingsData } = await supabase.from('settings').select('value').eq('key', SETTINGS_KEY).single()
      let cats = []
      if (settingsData?.value) {
        try { cats = JSON.parse(settingsData.value) } catch {}
      }

      if (!acc) { setLoading(false); return }

      // Filter cats by role tags
      const allowedCats = cats.filter(c => catMatchesTags(c.name, acc.tags))
      setCategories(allowedCats)

      if (allowedCats.length === 0) { setLoading(false); return }

      const allowedCatNames = allowedCats.map(c => c.name)
      let query = supabase.from('recipes').select('*').eq('is_active', true).in('category', allowedCatNames)
      if (acc.juniorOnly) query = query.eq('junior_visible', true)

      const { data } = await query.order('category').order('subcategory').order('name')
      setRecipes(data || [])
      setLoading(false)
    }
    init()
  }, [])

  function toggleCat(catName) {
    setExpandedCats(prev => ({ ...prev, [catName]: !prev[catName] }))
  }

  const filtered = recipes.filter(r =>
    !search || `${r.name} ${r.subcategory || ''} ${r.description || ''}`.toLowerCase().includes(search.toLowerCase())
  )

  if (loading) {
    return <PortalShell><div style={{ textAlign: 'center', padding: 80, color: '#9ca3af', fontFamily: "'DM Sans',sans-serif" }}>Loading recipes…</div></PortalShell>
  }

  if (!access) {
    return (
      <PortalShell>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: 12, fontFamily: "'DM Sans',sans-serif" }}>
          <div style={{ fontSize: 40 }}>📒</div>
          <div style={{ fontFamily: "'Montserrat',sans-serif", fontSize: 18, fontWeight: 700, color: '#111827' }}>No Recipes Available</div>
          <div style={{ fontSize: 13, color: '#9ca3af', textAlign: 'center', maxWidth: 300 }}>Recipes are not configured for your role ({staffRole || 'Unknown'}). Contact your manager.</div>
        </div>
      </PortalShell>
    )
  }

  return (
    <PortalShell>
      <div style={{ padding: '20px 18px', fontFamily: "'DM Sans',sans-serif", maxWidth: 700, margin: '0 auto' }}>
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontFamily: "'Montserrat',sans-serif", fontSize: 20, fontWeight: 800, color: '#111827' }}>📒 Recipes</div>
          <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 3 }}>{access.juniorOnly ? 'Selected recipes for your role' : 'All recipes for your role'}</div>
        </div>

        <input
          style={{ width: '100%', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: '9px 12px', fontSize: 13, fontFamily: "'DM Sans',sans-serif", outline: 'none', boxSizing: 'border-box', marginBottom: 18 }}
          placeholder="🔍  Search recipes…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />

        {/* Category accordion columns */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16, alignItems: 'start' }}>
          {categories.map(cat => {
            const p = PALETTE[cat.colorIdx % PALETTE.length]
            const isExpanded = !!expandedCats[cat.name]
            const catRecipes = filtered.filter(r => r.category === cat.name)

            return (
              <div key={cat.name} style={{ background: 'white', border: `1px solid ${isExpanded ? p.border : '#e5e7eb'}`, borderRadius: 16, overflow: 'hidden', transition: 'border-color .2s' }}>

                {/* Category header */}
                <div onClick={() => toggleCat(cat.name)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', cursor: 'pointer', background: isExpanded ? p.bg : 'transparent', transition: 'background .2s', userSelect: 'none' }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: p.dot, flexShrink: 0 }} />
                  <span style={{ fontWeight: 700, fontSize: 14, color: isExpanded ? p.text : '#111827', flex: 1 }}>{cat.name}</span>
                  <span style={{ fontSize: 11, color: isExpanded ? p.text : '#9ca3af', opacity: 0.7 }}>{catRecipes.length}</span>
                  <span style={{ fontSize: 13, color: isExpanded ? p.text : '#9ca3af', display: 'inline-block', transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform .2s' }}>›</span>
                </div>

                {/* Collapsed: subcategory pills */}
                {!isExpanded && (cat.subcategories || []).length > 0 && (
                  <div style={{ padding: '0 16px 12px', display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                    {(cat.subcategories || []).map(sub => {
                      const count = recipes.filter(r => r.category === cat.name && r.subcategory === sub.name).length
                      return (
                        <span key={sub.name} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: p.bg, color: p.text, border: `1px solid ${p.border}` }}>
                          {sub.name}{count > 0 ? ` ·${count}` : ''}
                        </span>
                      )
                    })}
                  </div>
                )}

                {/* Expanded: subcategory sections */}
                {isExpanded && (
                  <div style={{ borderTop: `1px solid ${p.border}` }}>
                    {(cat.subcategories || []).map((sub, si) => {
                      const subRecipes = catRecipes.filter(r => r.subcategory === sub.name)
                      const isLast = si === (cat.subcategories || []).length - 1
                      return (
                        <div key={sub.name} style={{ borderBottom: isLast ? 'none' : `1px solid ${p.border}` }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', background: '#f9fafb' }}>
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: p.dot, opacity: 0.5, flexShrink: 0 }} />
                            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.5, color: '#6b7280', textTransform: 'uppercase', flex: 1 }}>{sub.name}</span>
                            <span style={{ fontSize: 10, color: '#9ca3af' }}>{subRecipes.length}</span>
                          </div>
                          <div style={{ padding: '8px 12px' }}>
                            {subRecipes.length === 0 && <div style={{ fontSize: 11, color: '#9ca3af', fontStyle: 'italic', padding: '4px 4px 6px' }}>No recipes yet.</div>}
                            {subRecipes.map(r => (
                              <div key={r.id} onClick={e => { e.stopPropagation(); setViewRecipe(r) }}
                                style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: '12px 14px', marginBottom: 8, cursor: 'pointer', transition: 'border-color .15s, box-shadow .15s' }}
                                onMouseEnter={e => { e.currentTarget.style.borderColor = p.dot; e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,.06)' }}
                                onMouseLeave={e => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.boxShadow = 'none' }}>
                                {r.junior_visible && <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 10, background: '#d1fae5', color: '#065f46', display: 'inline-block', marginBottom: 6 }}>Junior ✓</span>}
                                <div style={{ fontWeight: 700, fontSize: 13, color: '#111827', lineHeight: 1.35, marginBottom: r.description ? 5 : 6 }}>{r.name}</div>
                                {r.description && <div style={{ fontSize: 11, color: '#6b7280', lineHeight: 1.5, marginBottom: 6 }}>{r.description.length > 70 ? r.description.slice(0, 70) + '…' : r.description}</div>}
                                <div style={{ display: 'flex', gap: 10, fontSize: 10, color: '#9ca3af', flexWrap: 'wrap' }}>
                                  {r.serving_size && <span>🍽 {r.serving_size}</span>}
                                  {r.prep_time && <span>⏱ {r.prep_time}</span>}
                                  {Array.isArray(r.ingredients) && r.ingredients.length > 0 && <span>🧂 {r.ingredients.length}</span>}
                                  {Array.isArray(r.steps) && r.steps.length > 0 && <span>📋 {r.steps.length} steps</span>}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* VIEW MODAL */}
        <Modal open={!!viewRecipe} onClose={() => setViewRecipe(null)} title={viewRecipe?.name || ''}>
          {viewRecipe && (() => {
            const cat = categories.find(c => c.name === viewRecipe.category)
            const p = cat ? PALETTE[cat.colorIdx % PALETTE.length] : PALETTE[3]
            return (
              <div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: p.bg, color: p.text }}>{viewRecipe.category}</span>
                  {viewRecipe.subcategory && <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: '#f3f4f6', color: '#4b5563', border: '1px solid #e5e7eb' }}>{viewRecipe.subcategory}</span>}
                  {viewRecipe.serving_size && <span style={{ fontSize: 12, color: '#9ca3af' }}>🍽 {viewRecipe.serving_size}</span>}
                  {viewRecipe.prep_time && <span style={{ fontSize: 12, color: '#9ca3af' }}>⏱ {viewRecipe.prep_time}</span>}
                </div>
                {viewRecipe.description && <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 18, lineHeight: 1.6 }}>{viewRecipe.description}</p>}
                {Array.isArray(viewRecipe.ingredients) && viewRecipe.ingredients.length > 0 && (
                  <div style={{ marginBottom: 18 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: '#9ca3af', marginBottom: 10 }}>Ingredients</div>
                    <div style={{ background: '#f9fafb', borderRadius: 10, overflow: 'hidden', border: '1px solid #e5e7eb' }}>
                      {viewRecipe.ingredients.map((ing, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', borderBottom: i < viewRecipe.ingredients.length - 1 ? '1px solid #e5e7eb' : 'none', fontSize: 13 }}>
                          <span style={{ color: '#111827', fontWeight: 500 }}>{ing.name}</span>
                          <span style={{ color: '#6b7280' }}>{ing.qty} {ing.unit}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {Array.isArray(viewRecipe.steps) && viewRecipe.steps.length > 0 && (
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: '#9ca3af', marginBottom: 10 }}>Preparation</div>
                    <ol style={{ margin: 0, paddingLeft: 20 }}>
                      {viewRecipe.steps.map((step, i) => (
                        <li key={i} style={{ fontSize: 13, color: '#374151', marginBottom: 10, lineHeight: 1.6 }}>{step}</li>
                      ))}
                    </ol>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 16, borderTop: '1px solid #e5e7eb' }}>
                  <button onClick={() => setViewRecipe(null)} style={{ padding: '9px 20px', borderRadius: 9, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, background: '#ef4576', color: 'white', fontFamily: "'DM Sans',sans-serif" }}>Close</button>
                </div>
              </div>
            )
          })()}
        </Modal>
      </div>
    </PortalShell>
  )
}
