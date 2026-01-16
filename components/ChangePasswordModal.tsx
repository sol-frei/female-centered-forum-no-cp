import React, { useState } from 'react';
import { User } from '../types';
import { X } from 'lucide-react';

export default function ChangePasswordModal({ user, onComplete }: { user: User, onComplete: (u: User) => void }) {
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = () => {
    if (!pw || !pw2) {
      setError('请填写新密码并确认');
      return;
    }
    if (pw !== pw2) {
      setError('两次输入的密码不一致');
      return;
    }

    // 简单本地更新：真实项目请替换为 API / supabase 调用
    const updated = { ...user, password: pw, isFirstLogin: false } as User;
    onComplete(updated);
  };

  return (
    <div className="fixed inset-0 bg-white z-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full border p-6 rounded shadow">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold">首次登录 - 修改密码</h3>
          <X className="w-5 h-5 text-zinc-400" />
        </div>

        {error && <div className="text-sm text-red-600 mb-3">{error}</div>}

        <div className="space-y-3">
          <div>
            <label className="text-sm">新密码</label>
            <input type="password" value={pw} onChange={e => setPw(e.target.value)} className="w-full border p-2 mt-1" />
          </div>
          <div>
            <label className="text-sm">确认密码</label>
            <input type="password" value={pw2} onChange={e => setPw2(e.target.value)} className="w-full border p-2 mt-1" />
          </div>

          <div className="flex justify-end gap-2 mt-4">
            <button onClick={handleSubmit} className="bg-black text-white px-4 py-2">保存</button>
          </div>
        </div>
      </div>
    </div>
  );
}
