import { createClient } from '@supabase/supabase-js'

// 1. 读取环境变量
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
// 新增：读取你刚在 .env.local 中添加的 Service Role Key
const supabaseServiceKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY

// 检查必要的地址和匿名 Key
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('哎呀！找不到 Supabase 的地址或暗号，请检查 .env.local 文件！')
}

// 2. 导出普通客户端 (用于大部分日常操作：登录、发帖、评论等)
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true, 
    persistSession: true,
    detectSessionInUrl: true
  }
})

// 3. 导出管理员客户端 (专门用于“生成新用户”等管理后台操作)
// 只有这个客户端拥有调用 auth.admin API 的权限
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    // 管理员客户端通常不需要持久化 session 或自动刷新
    autoRefreshToken: false,
    persistSession: false
  }
})