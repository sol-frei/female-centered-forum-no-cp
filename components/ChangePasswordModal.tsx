
import React, { useState } from 'react';
import { User } from '../types';
import { X, Loader2, Eye, EyeOff } from 'lucide-react';
import { supabase } from '../services/supabaseClient';

export default function ChangePasswordModal({ user, onComplete }: { user: User, onComplete: (u: User) => void }) {
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [showPw2, setShowPw2] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    // 1. 基础前端校验
    if (!pw || !pw2) {
      setError('请填写新密码并确认');
      return;
    }
    if (pw !== pw2) {
      setError('两次输入的密码不一致');
      return;
    }
    if (pw.length < 6) {
      setError('密码长度至少需要 6 位');
      return;
    }

    try {
      setLoading(true);
      setError('');

      // 2. 先刷新 session，确保 token 是最新的
      const { data: { session }, error: refreshError } = await supabase.auth.refreshSession();
      
      if (refreshError || !session) {
        throw new Error('登录会话已过期，请刷新页面重新登录');
      }

      // 3. 先更新数据库标记（在修改密码之前，因为修改密码后 session 会失效）
      const { error: dbError } = await supabase
        .from('users')
        .update({ is_first_login: false })
        .eq('id', user.id);

      if (dbError) {
        console.warn('数据库标记更新失败:', dbError.message);
        // 不阻断流程，继续修改密码
      }

      // 4. 修改密码（这个操作会使当前 session 失效）
      const { error: authError } = await supabase.auth.updateUser({
        password: pw
      });

      if (authError) {
        // 如果是 session 相关错误，给出友好提示
        if (authError.message.includes('session') || authError.message.includes('Auth')) {
          throw new Error('登录会话已过期, 请刷新页面重新登录');
        }
        throw authError;
      }

      // 5. 密码修改成功，退出登录
      await supabase.auth.signOut();

      // 6. 显示成功消息并刷新页面让用户重新登录
      alert('密码修改成功！请使用新密码重新登录');
      
      // 刷新页面，让用户回到登录页
      window.location.reload();

    } catch (err: any) {
      console.error('修改密码时出错!!:', err);
      
      // 友好的错误处理
      if (err.message.includes('session') || err.message.includes('过期')) {
        setError('登录会话已过期, 请刷新页面重新登录');
        // 3秒后自动刷新页面
        setTimeout(() => {
          window.location.reload();
        }, 3000);
      } else {
        setError(err.message || '修改失败，请重试');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white border p-6 rounded shadow-lg">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold">首次登录 - 修改密码</h3>
        </div>

        {error && (
          <div className="text-sm bg-red-50 text-red-600 p-2 rounded mb-3 border border-red-100">
            {error}
          </div>
        )}

        <div className="space-y-4">
          {/* 新密码输入框 */}
          <div className="relative">
            <label className="text-sm font-medium">新密码</label>
            <div className="relative mt-1">
              <input 
                type={showPw ? "text" : "password"} 
                value={pw} 
                onChange={e => setPw(e.target.value)} 
                disabled={loading}
                className="w-full border p-2 pr-10 rounded focus:ring-2 focus:ring-black outline-none disabled:bg-zinc-50" 
                placeholder="请输入新密码"
                autoComplete="new-password"
              />
              <button 
                type="button"
                onClick={() => setShowPw(!showPw)}
                disabled={loading}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 disabled:opacity-50"
              >
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* 确认密码输入框 */}
          <div className="relative">
            <label className="text-sm font-medium">确认密码</label>
            <div className="relative mt-1">
              <input 
                type={showPw2 ? "text" : "password"} 
                value={pw2} 
                onChange={e => setPw2(e.target.value)} 
                disabled={loading}
                className="w-full border p-2 pr-10 rounded focus:ring-2 focus:ring-black outline-none disabled:bg-zinc-50"
                placeholder="请再次输入密码"
                autoComplete="new-password"
              />
              <button 
                type="button"
                onClick={() => setShowPw2(!showPw2)}
                disabled={loading}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 disabled:opacity-50"
              >
                {showPw2 ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-2">
            <button 
              onClick={handleSubmit} 
              disabled={loading}
              className="bg-black text-white px-6 py-2 rounded flex items-center justify-center min-w-[100px] hover:bg-zinc-800 disabled:bg-zinc-400 transition-all active:scale-95"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  保存中
                </>
              ) : '保存密码'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}