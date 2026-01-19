// api/admin/create-user.ts
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error('Supabase 环境变量缺失！请检查 Vercel 设置。')
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey)

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed')

  try {
    const authHeader = req.headers.authorization
    if (!authHeader) return res.status(401).send('请先登录')

    const token = authHeader.split(' ')[1]
    if (!token) return res.status(401).send('请先登录')

    // 验证登录用户并检查是否为管理员
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token)
    if (userError || !userData.user) return res.status(401).send('无效 token')
    
    // 检查 role
    const { data: dbUser } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('id', userData.user.id)
      .single()

    if (!dbUser || dbUser.role !== 'admin') return res.status(403).send('仅管理员可调用此接口')

    // 读取请求 body
    const { role } = req.body
    const userRole = role || 'user'

    // 生成随机 login_id
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    let loginId = ''
    for (let i = 0; i < 6; i++) {
      loginId += chars.charAt(Math.floor(Math.random() * chars.length))
    }

    const passwordChars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%'
    let password = ''
    for (let i = 0; i < 8; i++) {
      password += passwordChars.charAt(Math.floor(Math.random() * passwordChars.length))
    }

    const email = `${loginId.toLowerCase()}@temp.local`

    // 创建 Auth 用户
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { login_id: loginId }
    })

    if (authError) throw authError

    // 插入 users 表
    const newUser = {
      id: authData.user.id,
      login_id: loginId,
      email,
      user_name: `用户_${loginId}`,
      avatar: null,
      role: userRole,
      is_banned: false,
      is_first_login: true,
      created_at: new Date().toISOString()
    }

    const { error: dbError } = await supabaseAdmin.from('users').insert(newUser)
    if (dbError) {
      // 数据库插入失败，删除 Auth 用户
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
      throw dbError
    }

    // 返回用户信息 + 一次性密码
    return res.status(200).json({ ...newUser, password })

  } catch (err: any) {
    console.error('创建用户失败:', err)
    return res.status(500).send(err.message || '创建失败')
  }
}
