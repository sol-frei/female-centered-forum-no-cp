import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
const supabaseServiceKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY

// 调试用：如果报错，请看浏览器控制台打印了什么
console.log('Supabase URL:', supabaseUrl ? '已加载' : '缺失')
console.log('Service Key:', supabaseServiceKey ? '已加载' : '缺失')

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('找不到 Supabase 地址或匿名 Key，请检查 .env.local')
}

// 1. 普通客户端
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// 2. 管理员客户端 (报错的核心就在这里，必须确保 supabaseServiceKey 有值)
if (!supabaseServiceKey) {
  console.error('致命错误: VITE_SUPABASE_SERVICE_ROLE_KEY 缺失！')
}

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey || '', {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})