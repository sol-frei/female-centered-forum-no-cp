import React, { useEffect, useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { Loader2 } from 'lucide-react';

export default function Profile() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadUser = async () => {
      setLoading(true);
      setError(null);

      try {
        // 获取当前登录 session
        const { data: { session } } = await supabase.auth.getSession();
        if (!session || !session.user) {
          setError('请先登录');
          setLoading(false);
          return;
        }

        const userId = session.user.id;

        // 查询 users 表
        let { data: userData, error: fetchError } = await supabase
          .from('users')
          .select('*')
          .eq('id', userId)
          .single();

        if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 = 没找到数据
          throw fetchError;
        }

        // 如果 users 表没有记录，自动创建
        if (!userData) {
          const { data: newUser, error: insertError } = await supabase
            .from('users')
            .insert({
              id: userId,
              login_id: session.user.user_metadata?.login_id || userId.slice(0,6).toUpperCase(),
              user_name: session.user.email || `用户_${userId.slice(0,6)}`,
              role: 'user',
              avatar: null,
              is_banned: false,
              is_first_login: true,
              created_at: new Date().toISOString()
            })
            .select()
            .single();

          if (insertError) throw insertError;
          userData = newUser;
        }

        setUser(userData);
      } catch (err: any) {
        console.error('加载用户信息失败:', err);
        setError(err.message || '未知错误');
      } finally {
        setLoading(false);
      }
    };

    loadUser();
  }, []);

  if (loading) return <div className="p-10 flex justify-center"><Loader2 className="animate-spin" /></div>;
  if (error) return <div className="p-10 text-center text-red-600">{error}</div>;
  if (!user) return <div className="p-10 text-center">用户不存在</div>;

  return (
    <div className="max-w-md mx-auto p-6 bg-white border rounded shadow space-y-3">
      <h2 className="text-xl font-bold mb-4">个人信息</h2>
      <p><strong>用户名:</strong> {user.user_name}</p>
      <p><strong>Login ID:</strong> {user.login_id}</p>
      <p><strong>角色:</strong> {user.role}</p>
      <p><strong>注册时间:</strong> {new Date(user.created_at).toLocaleString()}</p>
      {user.is_banned && <p className="text-red-600 font-bold">已封禁</p>}
    </div>
  );
}
