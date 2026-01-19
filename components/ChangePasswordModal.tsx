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

      // 2. 关键：预检查 Session 状态，防止 "Auth session missing"
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session) {
        throw new Error('登录会话已过期，请刷新页面重新登录');
      }

      // 3. 真正调用 Supabase Auth API 修改密码
      const { error: authError } = await supabase.auth.updateUser({
        password: pw
      });

      if (authError) throw authError;

      // 4. 更新数据库 profiles 表，将 is_first_login 设为 false
      // 这样用户下次登录就不会再看到这个弹窗
      const { error: dbError } = await supabase
        .from('profiles')
        .update({ is_first_login: false })
        .eq('id', user.id);

      if (dbError) {
        console.warn('数据库标记更新失败，但密码已成功修改:', dbError.message);
      }

      // 5. 构造更新后的用户对象并回调
      const updated = { ...user, isFirstLogin: false } as User;
      onComplete(updated);

    } catch (err: any) {
      console.error('修改密码过程出错:', err);
      // 将报错信息显示给用户（如 "Auth session missing"）
      setError(err.message || '修改失败，请重试');
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
              />
              <button 
                type="button"
                onClick={() => setShowPw(!showPw)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
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
              />
              <button 
                type="button"
                onClick={() => setShowPw2(!showPw2)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
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