'use client'
// ─────────────────────────────────────────────
// OHT Staff Portal — New Purchase Request
// Place at: app/inventory/request/new/page.js
// ─────────────────────────────────────────────
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { getCatalog, createRequest } from '@/app/lib/inventory'
import { toast } from 'sonner'

const CATEGORIES = ['Dairy', 'Coffee', 'Packaging', 'Cleaning', 'Food', 'Beverage', 'Equipment', 'Other']
const UNITS = ['pcs', 'kg', 'g', 'bottle', 'sleeve', 'pack', 'roll', 'box', 'bag']

const blankLine = () => ({
  _key: Math.random().toString(36).slice(2),
  catalog_item_id: '',
  item_name: '',
  category: 'Other',
  quantity: '',
  unit: 'pcs',
  staff_notes: '',
})

export default function NewRequestPage() {
  const router = useRouter()
  const supabase = createClientComponentClient()
  const [staffId, setStaffId] = useState(null)
  const [catalog, setCatalog] = useState([])
  const [title, setTitle] = useState('')
  const [urgency, setUrgency] = useState('normal')
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState([blankLine()])
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setStaffId(data.user?.id ?? null))
    getCatalog().then(setCatalog)
  }, [])

  const catalogByCategory = CATEGORIES.reduce((acc, cat) => {
    acc[cat] = catalog.filter(c => c.category === cat)
    return acc
  }, {})

  const pickCatalogItem = (key, itemId) => {
    const item = catalog.find(c => c.id === itemId)
    setLines(prev => prev.map(l =>
      l._key === key ? { ...l, catalog_item_id: itemId, item_name: item?.name ?? '', category: item?.category ?? 'Other', unit: item?.unit ?? 'pcs' } : l
    ))
  }

  const updateLine = (key, field, value) =>
    setLines(prev => prev.map(l => l._key === key ? { ...l, [field]: value } : l))

  const handleSubmit = async () => {
    if (!staffId) return toast.error('Not signed in')
    if (!title.trim()) return toast.error('Please add a title')
    if (lines.some(l => !l.item_name.trim() || !l.quantity)) return toast.error('Fill in all item names and quantities')

    setSubmitting(true)
    try {
      const payload = {
        title: title.trim(),
        urgency,
        notes: notes.trim(),
        items: lines.map(l => ({
          catalog_item_id: l.catalog_item_id || undefined,
          item_name: l.item_name.trim(),
          category: l.category,
          quantity: parseFloat(l.quantity),
          unit: l.unit,
          staff_notes: l.staff_notes.trim() || undefined,
        })),
      }
      const req = await createRequest(staffId, payload)
      toast.success(`${req.pr_number} submitted!`)
      router.push('/inventory/my-requests')
    } catch (e) { toast.error(e.message ?? 'Something went wrong') }
    finally { setSubmitting(false) }
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">New purchase request</h1>
        <p className="text-sm text-gray-500">Submit to ops support for review</p>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
        <h2 className="text-sm font-medium text-gray-700 uppercase tracking-wide">Details</h2>
        <div className="space-y-1">
          <label className="text-sm text-gray-600">What do you need?</label>
          <input type="text" value={title} onChange={e => setTitle(e.target.value)}
            placeholder="e.g. Dairy restock for Tuesday service"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm text-gray-600">How urgent?</label>
          <select value={urgency} onChange={e => setUrgency(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
            <option value="low">Can wait (next run)</option>
            <option value="normal">Normal</option>
            <option value="high">Urgent — needed today</option>
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-sm text-gray-600">Notes for ops support</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
            placeholder="Brand preferences, avoid substitutes..."
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
          />
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
        <h2 className="text-sm font-medium text-gray-700 uppercase tracking-wide">Items needed</h2>
        <div className="space-y-3">
          {lines.map((line, idx) => (
            <div key={line._key} className="border border-gray-100 rounded-lg p-3 space-y-3 bg-gray-50">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-gray-500">Item {idx + 1}</span>
                {lines.length > 1 && (
                  <button onClick={() => setLines(prev => prev.filter(l => l._key !== line._key))}
                    className="text-gray-400 hover:text-red-500 text-sm">✕</button>
                )}
              </div>
              <div className="space-y-1">
                <label className="text-xs text-gray-500">Pick from catalog (or type below)</label>
                <select value={line.catalog_item_id} onChange={e => pickCatalogItem(line._key, e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="">— Select item —</option>
                  {CATEGORIES.map(cat => (
                    catalogByCategory[cat]?.length > 0 && (
                      <optgroup key={cat} label={cat}>
                        {catalogByCategory[cat].map(item => (
                          <option key={item.id} value={item.id}>{item.name}</option>
                        ))}
                      </optgroup>
                    )
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-1 space-y-1">
                  <label className="text-xs text-gray-500">Item name</label>
                  <input type="text" value={line.item_name} onChange={e => updateLine(line._key, 'item_name', e.target.value)}
                    placeholder="Name"
                    className="w-full border border-gray-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-gray-500">Qty</label>
                  <input type="number" min="1" value={line.quantity} onChange={e => updateLine(line._key, 'quantity', e.target.value)}
                    placeholder="0"
                    className="w-full border border-gray-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-gray-500">Unit</label>
                  <select value={line.unit} onChange={e => updateLine(line._key, 'unit', e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-gray-500">Brand / notes (optional)</label>
                <input type="text" value={line.staff_notes} onChange={e => updateLine(line._key, 'staff_notes', e.target.value)}
                  placeholder="e.g. Oatside brand only"
                  className="w-full border border-gray-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          ))}
        </div>
        <button onClick={() => setLines(prev => [...prev, blankLine()])}
          className="text-sm text-indigo-600 hover:text-indigo-700 font-medium">
          + Add item
        </button>
      </div>

      <div className="flex justify-end gap-3">
        <button onClick={() => router.back()}
          className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
          Cancel
        </button>
        <button onClick={handleSubmit} disabled={submitting}
          className="px-5 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50">
          {submitting ? 'Submitting…' : 'Submit to ops support'}
        </button>
      </div>
    </div>
  )
}
