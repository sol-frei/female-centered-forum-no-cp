import { createClient } from '@supabase/supabase-js'

// 这里的变量会自动读取你在 Vercel 设置的环境变量
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)