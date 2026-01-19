import React, { useState } from 'react';
import { User } from '../types';
import { X, Loader2, Eye, EyeOff } from 'lucide-react'; // 增加眼睛图标
import { supabase } from '../services/supabaseClient';

export default function ChangePasswordModal({ user, onComplete }: { user: User, onComplete: (u: User) => void }) {
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [showPw, setShowPw] = useState(false); // 控制第一行密码显示
  const [showPw2, setShowPw2] = useState(false); // 控制第二行密码显示
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
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

      // 真正调用 Supabase 修改密码
      const { error: authError } = await supabase.auth.updateUser({
        password: pw
      });

      if (authError) throw authError;

      // 更新数据库中的首次登录标记
      const { error: dbError } = await supabase
        .from('profiles')
        .update({ is_first_login: false })
        .eq('id', user.id);

      if (dbError) console.warn('数据库状态更新失败:', dbError.message);

      const updated = { ...user, isFirstLogin: false } as User;
      onComplete(updated);

    } catch (err: any) {
      console.error('修改密码过程出错:', err);
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
                className="w-full border p-2 pr-10 rounded focus:ring-2 focus:ring-black outline-none" 
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
                className="w-full border p-2 pr-10 rounded focus:ring-2 focus:ring-black outline-none"
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
              className="bg-black text-white px-6 py-2 rounded flex items-center justify-center min-w-[80px] hover:bg-zinc-800 disabled:bg-zinc-400 transition-colors"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : '保存'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}