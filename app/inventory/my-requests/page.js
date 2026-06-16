'use client'
export const dynamic = 'force-dynamic'
// ─────────────────────────────────────────────
// OHT Staff Portal — My Purchase Requests
// Place at: app/inventory/my-requests/page.js
// ─────────────────────────────────────────────
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../../lib/supabase'
import { getMyRequests } from '../../../lib/inventory'

const STATUS_STYLE = {
  draft:                  'bg-gray-100 text-gray-600',
  submitted:              'bg-blue-100 text-blue-700',
  queued:                 'bg-indigo-100 text-indigo-700',
  rejected_by_support:    'bg-red-100 text-red-700',
  pending_supervisor:     'bg-amber-100 text-amber-700',
  approved:               'bg-green-100 text-green-700',
  rejected_by_supervisor: 'bg-red-100 text-red-700',
  purchased:              'bg-teal-100 text-teal-700',
  done:                   'bg-gray-100 text-gray-600',
}
const STATUS_LABEL = {
  draft:                  'Draft',
  submitted:              'Submitted',
  queued:                 'In purchase list',
  rejected_by_support:    'Returned — needs edit',
  pending_supervisor:     'Awaiting CJ',
  approved:               'Approved ✓',
  rejected_by_supervisor: 'Returned by CJ',
  purchased:              'Purchased',
  done:                   'Done',
}
const URGENCY_DOT = { low: 'bg-gray-400', normal: 'bg-green-500', high: 'bg-red-500' }

export default function MyRequestsPage() {
  const router = useRouter()
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const sb = createClient()
    sb.auth.getUser().then(async ({ data }) => {
      if (!data.user) return
      try {
        const reqs = await getMyRequests(data.user.id)
        setRequests(reqs)
      } catch (e) { console.error(e) }
      finally { setLoading(false) }
    })
  }, [])

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">My requests</h1>
          <p className="text-sm text-gray-500">Track your purchase requests</p>
        </div>
        <button
          onClick={() => router.push('/inventory/request/new')}
          className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"
        >
          + New request
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400 text-sm">Loading…</div>
      ) : requests.length === 0 ? (
        <div className="text-center py-16 space-y-3">
          <p className="text-gray-500 text-sm">No requests yet.</p>
          <button
            onClick={() => router.push('/inventory/request/new')}
            className="text-indigo-600 text-sm font-medium hover:underline"
          >
            Submit your first request →
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map(req => (
            <div key={req.id} className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-mono text-gray-400">{req.pr_number}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLE[req.status]}`}>
                      {STATUS_LABEL[req.status]}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-gray-900 truncate">{req.title}</p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="flex items-center gap-1 text-xs text-gray-500">
                      <span className={`w-1.5 h-1.5 rounded-full ${URGENCY_DOT[req.urgency]}`} />
                      {req.urgency === 'high' ? 'Urgent' : req.urgency === 'normal' ? 'Normal' : 'Low'}
                    </span>
                    <span className="text-xs text-gray-400">
                      {req.items?.length ?? 0} item{req.items?.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
              </div>
              {(req.status === 'rejected_by_support' || req.status === 'rejected_by_supervisor') && req.support_notes && (
                <div className="mt-3 bg-red-50 border border-red-100 rounded-lg px-3 py-2 text-xs text-red-700">
                  <span className="font-medium">Returned: </span>{req.support_notes}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
