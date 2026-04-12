import { createClient } from '@supabase/supabase-js'

const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL
const supabaseKey  = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseKey)

// Admin client dengan service role — hanya untuk operasi admin (hapus user)
const serviceKey = import.meta.env.VITE_SUPABASE_SERVICE_KEY
export const supabaseAdmin = serviceKey
  ? createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
  : null
