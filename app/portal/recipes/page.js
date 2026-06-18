'use client'
export const dynamic = 'force-dynamic'
import { useState, useEffect } from 'react'
import PortalShell from '../../../components/PortalShell'
import { createClient } from '../../../lib/supabase'

// Role → which categories they can see
// junior_visible = true recipes are visible to junior roles
const ROLE_ACCESS = {
  // All recipes
  'Cafe Supervisor': { categories: ['Bar', 'Kitchen', 'Pastry', 'Other'], juniorOnly: false },
  'Cafe Operations Support': { categories: ['Bar', 'Kitchen', 'Pastry', 'Other'], juniorOnly: false },
  // Bar
  'Senior Barista': { categories: ['Bar', 'Pastry', 'Other'], juniorOnly: false },
  'Junior Barista - Milk Station': { categories: ['Bar', 'Pastry', 'Other'], juniorOnly: true },
  'Junior Barista - Cashier': { categories: ['Bar', 'Pastry', 'Other'], juniorOnly: true },
  // Kitchen
  'Executive Chef': { categories: ['Kitchen', 'Pastry', 'Other'], juniorOnly: false },
  'Sous Chef': { categories: ['Kitchen', 'Pastry', 'Other'], juniorOnly: true },
  'Kitchen Staff': { categories: ['Kitchen', 'Pastry', 'Other'], juniorOnly: true },
}

const CATEGORY_COLORS = {
  Bar: { bg: '#e8f4fd', text: '#2563eb', border: '#bfdbfe' },
  Kitchen: { bg: '#fef3c7', text: '#d97706', border: '#fde68a' },
  Pastry: { bg: '#fce7f3', text: '#db2777', border: '#fbcfe8' },
  Other: { bg: '#f3f4f6', text: '#6b7280', border: '#e5e7eb' },
}

function CategoryBadge({ cat }) {
  const c = CATEGORY_COLORS[cat] || CATEGORY_COLORS.Other
  return (
    <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 20, background: c.bg, color: c.text, border: `1px solid ${c.border}` }}>
      {cat}
    </span>
  )
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
  const [staffRole, setStaffRole] = useState(null)
  const [recipes, setRecipes] = useState([])
  const [loading, setLoading] = useState(true)
  const [access, setAccess] = useState(null)

  const [search, setSearch] = useState('')
  const [filterCat, setFilterCat] = useState('All')
  const [viewRecipe, setViewRecipe] = useState(null)

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setLoading(false); return }

      const { data: staff } = await supabase
        .from('staff')
        .select('role')
        .eq('email', session.user.email)
        .single()

      const role = staff?.role || ''
      setStaffRole(role)

      const acc = ROLE_ACCESS[role] || null
      setAccess(acc)

      if (!acc) { setLoading(false); return }

      let query = supabase
        .from('recipes')
        .select('*')
        .eq('is_active', true)
        .in('category', acc.categories)

      if (acc.juniorOnly) {
        query = query.eq('junior_visible', true)
      }

      const { data } = await query.order('category').order('name')
      setRecipes(data || [])
      setLoading(false)
    }
    init()
  }, [])

  const filtered = recipes.filter(r => {
    if (filterCat !== 'All' && r.category !== filterCat) return false
    if (search && !`${r.name} ${r.description}`.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const availableCategories = [...new Set(recipes.map(r => r.category))]

  if (loading) {
    return (
      <PortalShell>
        <div style={{ textAlign: 'center', padding: 80, color: '#9ca3af', fontFamily: "'DM Sans',sans-serif" }}>Loading recipes…</div>
      </PortalShell>
    )
  }

  if (!access) {
    return (
      <PortalShell>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: 12, fontFamily: "'DM Sans',sans-serif" }}>
          <div style={{ fontSize: 40 }}>📒</div>
          <div style={{ fontFamily: "'Montserrat',sans-serif", fontSize: 18, fontWeight: 700, color: '#111827' }}>No Recipes Available</div>
          <div style={{ fontSize: 13, color: '#9ca3af', textAlign: 'center', maxWidth: 300 }}>Recipes are not yet configured for your role ({staffRole || 'Unknown'}). Please contact your manager.</div>
        </div>
      </PortalShell>
    )
  }

  return (
    <PortalShell>
      <div style={{ padding: '20px 18px', fontFamily: "'DM Sans',sans-serif", maxWidth: 700, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontFamily: "'Montserrat',sans-serif", fontSize: 20, fontWeight: 800, color: '#111827' }}>📒 Recipes</div>
          <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 3 }}>
            {access.categories.join(', ')} recipes
            {access.juniorOnly ? ' · Selected recipes only' : ' · All recipes'}
          </div>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          <input
            style={{ flex: 1, minWidth: 180, background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: '9px 12px', fontSize: 13, fontFamily: "'DM Sans',sans-serif", outline: 'none' }}
            placeholder="🔍  Search…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {availableCategories.length > 1 && (
            <select
              style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: '9px 12px', fontSize: 13, fontFamily: "'DM Sans',sans-serif", outline: 'none' }}
              value={filterCat}
              onChange={e => setFilterCat(e.target.value)}>
              <option value="All">All</option>
              {availableCategories.map(c => <option key={c}>{c}</option>)}
            </select>
          )}
        </div>

        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af', fontSize: 14 }}>No recipes found.</div>
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            {filtered.map(r => (
              <div key={r.id} onClick={() => setViewRecipe(r)} style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 14, padding: '16px 18px', cursor: 'pointer', boxShadow: '0 1px 4px rgba(0,0,0,.06)', transition: 'box-shadow .15s' }}
                onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,.12)'}
                onMouseLeave={e => e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,.06)'}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
                  <div style={{ fontWeight: 700, fontSize: 15, color: '#111827', lineHeight: 1.3 }}>{r.name}</div>
                  <CategoryBadge cat={r.category} />
                </div>
                {r.description && <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 10, lineHeight: 1.5 }}>{r.description.length > 100 ? r.description.slice(0, 100) + '…' : r.description}</div>}
                <div style={{ display: 'flex', gap: 14, fontSize: 12, color: '#9ca3af', flexWrap: 'wrap' }}>
                  {r.serving_size && <span>🍽 {r.serving_size}</span>}
                  {r.prep_time && <span>⏱ {r.prep_time}</span>}
                  {Array.isArray(r.ingredients) && r.ingredients.length > 0 && <span>🧂 {r.ingredients.length} ingredients</span>}
                  {Array.isArray(r.steps) && r.steps.length > 0 && <span>📋 {r.steps.length} steps</span>}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* VIEW MODAL */}
        <Modal open={!!viewRecipe} onClose={() => setViewRecipe(null)} title={viewRecipe?.name || ''}>
          {viewRecipe && (
            <div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
                <CategoryBadge cat={viewRecipe.category} />
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
          )}
        </Modal>
      </div>
    </PortalShell>
  )
}
