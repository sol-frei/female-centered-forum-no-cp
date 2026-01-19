import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('缺少 Supabase URL 或 ANON KEY')
}

// 前端：只允许 anon client
export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey
)
