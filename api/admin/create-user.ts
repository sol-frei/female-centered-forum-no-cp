// /api/admin/create-user.ts
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    /* =========================
       1️⃣ 校验管理员身份
    ========================= */

    const token = req.headers.authorization?.replace('Bearer ', '')
    if (!token) {
      return res.status(401).json({ error: '未登录' })
    }

    // 用 anon key 验证当前用户是谁
    const supabaseUser = createClient(
      process.env.VITE_SUPABASE_URL!,
      process.env.VITE_SUPABASE_ANON_KEY!
    )

    const {
      data: { user },
      error: userError,
    } = await supabaseUser.auth.getUser(token)

    if (userError || !user) {
      return res.status(401).json({ error: '无效用户' })
    }

    // 用 admin client 查角色
    const { data: adminProfile } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (adminProfile?.role !== 'admin') {
      return res.status(403).json({ error: '不是管理员' })
    }

    /* =========================
       2️⃣ 生成 login_id & 密码
    ========================= */

    const { role = 'user' } = req.body

    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    let loginId = ''
    for (let i = 0; i < 6; i++) {
      loginId += chars[Math.floor(Math.random() * chars.length)]
    }

    const passChars =
      'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%'
    let password = ''
    for (let i = 0; i < 8; i++) {
      password += passChars[Math.floor(Math.random() * passChars.length)]
    }

    const email = `${loginId.toLowerCase()}@temp.local`

    /* =========================
       3️⃣ 检查 login_id 冲突
    ========================= */

    const { data: existing } = await supabaseAdmin
      .from('users')
      .select('login_id')
      .eq('login_id', loginId)
      .single()

    if (existing) {
      return res.status(409).json({ error: 'Login ID 冲突，请重试' })
    }

    /* =========================
       4️⃣ 创建 Auth 用户
    ========================= */

    const { data: authData, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { login_id: loginId },
      })

    if (authError) {
      throw authError
    }

    /* =========================
       5️⃣ 插入 users 表
    ========================= */

    const newUser = {
      id: authData.user.id,
      login_id: loginId,
      email,
      role,
      is_banned: false,
      is_first_login: true,
      created_at: new Date().toISOString(),
    }

    const { error: dbError } = await supabaseAdmin
      .from('users')
      .insert(newUser)

    if (dbError) {
      // 回滚 auth 用户
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
      throw dbError
    }

    /* =========================
       6️⃣ 返回一次性凭证
    ========================= */

    return res.status(200).json({
      ...newUser,
      password, // ⚠️ 仅返回一次
    })
  } catch (err: any) {
    console.error(err)
    return res.status(500).json({ error: err.message })
  }
}
