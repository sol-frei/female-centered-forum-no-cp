import { createClient } from '@supabase/supabase-js'

// 这里的变量会自动读取你在 Vercel 设置的环境变量
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
// 加个小判断：如果没有地址或暗号，就大声报错提醒我
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('哎呀！找不到 Supabase 的地址或暗号，请检查 .env 文件！')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)