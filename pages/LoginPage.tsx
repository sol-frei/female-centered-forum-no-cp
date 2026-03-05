import { supabase } from '../services/supabaseClient';
import React, { useState } from 'react';
import { User } from '../types';
import { Eye, EyeOff, X } from 'lucide-react';

interface LoginProps {
  onLogin: (u: User) => void;
}

const LoginPage = ({ onLogin }: LoginProps) => {
  const [loginIdInput, setLoginIdInput] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  // 从环境变量获取管理员密码（如果你配置了的话）
  const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD;

  const handleLogin = async () => {
    setError('');
    if (!loginIdInput || !password) {
      setError('请输入 ID 和密码');
      return;
    }

    try {
      setLoading(true);

      // --- 情况 A：管理员账号登录 ---
      if (loginIdInput.toLowerCase() === 'admin') {
        if (password === ADMIN_PASSWORD) {
          const { data, error: adminErr } = await supabase
            .from('users')
            .select('*')
            .eq('role', 'admin')
            .limit(1)
            .single();

          if (adminErr || !data) {
            setError('管理员账号尚未在数据库中初始化');
            return;
          }
          onLogin(data);
          return;
        } else {
          setError('管理员密码错误');
          return;
        }
      }

      // --- 情况 B：普通用户登录 ---
      // 1. 获取 email
      const { data: userData, error: queryError } = await supabase
        .from('users')
        .select('*')
        .eq('login_id',loginIdInput.trim().toUpperCase())
        .single();

      if (queryError || !userData) {
        setError('账号不存在，请检查 ID 是否输入正确');
        return;
      }

      if (userData.is_banned) {
        setError('该账号已被封禁，无法登录');
        return;
      }

      // 2. Supabase Auth 登录
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: userData.email,
        password: password,
      });

      if (authError) {
        if (authError.message.includes('Invalid login credentials')) {
          setError('密码错误');
        } else {
          setError('登录失败: ' + authError.message);
        }
        return;
      }

      // 3. 成功后回调给 App.tsx 处理跳转
      onLogin({
        ...userData,
        auth_id: authData.user?.id,
      });

    } catch (e: any) {
      setError(`系统错误: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tighter">登录小组</h2>
          <p className="mt-2 text-zinc-500 text-sm">请输入管理员分发的 6 位短 ID 和密码</p>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-zinc-400">用户 ID</label>
            <input
              value={loginIdInput}
              onChange={e => setLoginIdInput(e.target.value.trim().toUpperCase())}
              disabled={loading}
              className="w-full p-4 border border-zinc-200 outline-none focus:border-black transition-all bg-zinc-50 focus:bg-white font-mono disabled:opacity-50"
              placeholder="例如: AX79P2"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-zinc-400">密码</label>
            <div className="relative">
              <input
                type={showPass ? "text" : "password"}
                value={password}
                onChange={e => setPassword(e.target.value)}
                disabled={loading}
                className="w-full p-4 border border-zinc-200 outline-none focus:border-black transition-all bg-zinc-50 focus:bg-white pr-12 font-mono disabled:opacity-50"
                placeholder="请输入密码"
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                disabled={loading}
                className="absolute right-4 top-4 text-zinc-400 hover:text-black disabled:opacity-50"
              >
                {showPass ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-4 text-sm flex items-center gap-2">
            <X className="w-4 h-4 flex-shrink-0" /> {error}
          </div>
        )}

        <button
          onClick={handleLogin}
          disabled={loading}
          className="w-full bg-black text-white py-4 font-bold text-lg hover:bg-zinc-800 transition-all active:scale-[0.98] shadow-lg shadow-zinc-200 disabled:bg-zinc-400 disabled:cursor-not-allowed"
        >
          {loading ? '登录中...' : '确认登录'}
        </button>

        <div className="text-center space-y-1">
          <p className="text-[10px] text-zinc-400">ID 是唯一的通行证，请妥善保管</p>
          <p className="text-[10px] text-zinc-300">Supabase Cloud Backend Connected</p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
