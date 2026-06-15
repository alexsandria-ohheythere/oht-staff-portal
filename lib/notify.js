import { createClient } from './supabase'

const ADMIN_EMAILS = ['ohheythere.matcha@gmail.com', 'ohheythere.group@gmail.com']

export async function notifyAdmins(payload) {
  const supabase = createClient()
  const { data: admins } = await supabase.from('staff').select('id').in('email', ADMIN_EMAILS)
  if (!admins || admins.length === 0) return
  const notifs = admins.map(a => ({ staff_id:a.id, is_read:false, ...payload }))
  await supabase.from('notifications').insert(notifs)
}

export async function notifyOne(staffId, payload) {
  if (!staffId) return
  const supabase = createClient()
  await supabase.from('notifications').insert([{ staff_id:staffId, is_read:false, ...payload }])
}
