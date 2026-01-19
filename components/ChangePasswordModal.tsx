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
  const [success, setSuccess] = useState(false);

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
      console.log('🔄 开始刷新 session...');
      const { data: { session }, error: refreshError } = await supabase.auth.refreshSession();
      
      if (refreshError) {
        console.error('❌ Session 刷新失败:', refreshError);
        throw new Error('登录会话已过期，请刷新页面重新登录');
      }
      
      if (!session) {
        console.error('❌ Session 不存在');
        throw new Error('登录会话已过期，请刷新页面重新登录');
      }
      
      console.log('✅ Session 刷新成功, user ID:', session.user.id);

      // 3. 修改密码（重要：这一步必须在数据库更新之前）
      console.log('🔐 开始修改密码...');
      const { data: updateData, error: authError } = await supabase.auth.updateUser({
        password: pw
      });

      if (authError) {
        console.error('❌ 修改密码失败:', authError);
        if (authError.message.includes('session') || authError.message.includes('Auth')) {
          throw new Error('登录会话已过期, 请刷新页面重新登录');
        }
        throw authError;
      }

      console.log('✅ 密码修改成功:', updateData);

      // 4. 更新数据库标记
      console.log('💾 开始更新数据库标记...');
      const { error: dbError } = await supabase
        .from('users')
        .update({ is_first_login: false })
        .eq('id', user.id);

      if (dbError) {
        console.error('⚠️ 数据库标记更新失败:', dbError.message);
        // 不阻断流程，因为密码已经修改成功了
      } else {
        console.log('✅ 数据库标记更新成功');
      }

      // 5. 修改成功，显示成功状态
      setSuccess(true);

      // 6. 2秒后关闭弹窗并退出登录
      setTimeout(async () => {
        const updated = { ...user, isFirstLogin: false } as User;
        onComplete(updated);
        
        // 退出登录并刷新
        await supabase.auth.signOut();
        window.location.reload();
      }, 2000);

    } catch (err: any) {
      console.error('修改密码时出错!!:', err);
      
      if (err.message.includes('session') || err.message.includes('过期')) {
        setError('登录会话已过期, 请刷新页面重新登录');
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      } else {
        setError(err.message || '修改失败，请重试');
      }
      setLoading(false);
    }
  };

  // 成功状态的UI
  if (success) {
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white border p-6 rounded shadow-lg text-center">
          <div className="mb-4">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-lg font-bold mb-2">密码修改成功！</h3>
            <p className="text-sm text-zinc-600">
              即将跳转到登录页面，请使用新密码重新登录...
            </p>
          </div>
          <div className="flex justify-center">
            <Loader2 className="w-5 h-5 animate-spin text-zinc-400" />
          </div>
        </div>
      </div>
    );
  }

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