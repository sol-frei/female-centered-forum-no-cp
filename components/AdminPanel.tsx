import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { get_all_users, updateUser, toggle_ban_user, get_banned_words } from '../services/storage';
import { UserPlus, Ban, Copy, ShieldAlert, Check, UserCircle, Crown } from 'lucide-react';
import Toast from './Toast';

const LoadingSpinner = () => (
  <div className="flex justify-center p-20">
    <div className="w-6 h-6 border-2 border-zinc-200 border-t-zinc-800 rounded-full animate-spin"></div>
  </div>
);

export default function AdminPanel() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newUser, setNewUser] = useState<any | null>(null);
  const [bannedWordsInput, setBannedWordsInput] = useState('');
  const [activeTab, setActiveTab] = useState<'users' | 'settings'>('users');
  const [copiedId, setCopiedId] = useState(false);
  const [copiedPass, setCopiedPass] = useState(false);
  const [toast, setToast] = useState<{msg: string, type: 'success' | 'error'} | null>(null);

  useEffect(() => { loadAdminData(); }, []);

  const loadAdminData = async () => {
    setLoading(true);
    try {
      const [allUsers, words] = await Promise.all([get_all_users(), get_banned_words()]);
      setUsers(allUsers);
      setBannedWordsInput(words.join(', '));
    } finally { setLoading(false); }
  };

  const handleGenerateUser = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/admin/create-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ role: 'user' }),
      });
      const user = await res.json();
      setNewUser(user);
      setUsers(prev => [user, ...prev]);
      setToast({ msg: '生成成功', type: 'success' });
    } catch (err: any) {
      setToast({ msg: '生成失败', type: 'error' });
    }
  };

  const copyToClipboard = (text: string, type: 'id' | 'pass') => {
    navigator.clipboard.writeText(text);
    if (type === 'id') { setCopiedId(true); setTimeout(() => setCopiedId(false), 2000); }
    else { setCopiedPass(true); setTimeout(() => setCopiedPass(false), 2000); }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      <h1 className="text-xl font-bold border-b pb-4">云端管理后台</h1>

      <div className="flex gap-4 border-b">
        <button onClick={() => setActiveTab('users')} className={`pb-2 px-4 ${activeTab === 'users' ? 'border-b-2 border-black font-bold' : 'text-zinc-500'}`}>用户管理 ({users.length})</button>
        <button onClick={() => setActiveTab('settings')} className={`pb-2 px-4 ${activeTab === 'settings' ? 'border-b-2 border-black font-bold' : 'text-zinc-500'}`}>发言设置</button>
      </div>

      {activeTab === 'users' && (
        <div className="space-y-8">
          <div className="bg-zinc-50 p-6 border">
            <h3 className="font-bold flex items-center gap-2 mb-4"><UserPlus className="w-5 h-5" /> 生成新用户</h3>
            <button onClick={handleGenerateUser} className="bg-black text-white px-4 py-2">向云端申请 Login ID & 密码</button>
            {newUser && (
              <div className="mt-4 p-4 bg-white border-2 border-dashed border-zinc-300">
                <p className="text-sm text-red-600 italic font-bold mb-2">请立即保存：</p>
                <div className="space-y-2">
                  <div className="flex justify-between bg-zinc-50 p-2 border">
                    <span className="font-mono text-sm">ID: {newUser.login_id}</span>
                    <button onClick={() => copyToClipboard(newUser.login_id, 'id')} className="text-xs">{copiedId ? '已复制' : '复制'}</button>
                  </div>
                  <div className="flex justify-between bg-zinc-50 p-2 border">
                    <span className="font-mono text-sm font-bold">Pass: {newUser.password}</span>
                    <button onClick={() => copyToClipboard(newUser.password, 'pass')} className="text-xs">{copiedPass ? '已复制' : '复制'}</button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <table className="w-full text-left text-sm border">
            <thead className="bg-zinc-50">
              <tr><th className="p-3">用户信息</th><th className="p-3">权限/状态</th><th className="p-3">管理操作</th></tr>
            </thead>
            <tbody className="divide-y bg-white">
              {users.map(u => (
                <tr key={u.id} className={u.is_banned ? 'bg-red-50/50' : ''}>
                  <td className="p-3 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full border bg-zinc-100 overflow-hidden">
                      {u.avatar ? <img src={u.avatar} className="w-full h-full object-cover" /> : <UserCircle className="w-full h-full text-zinc-300" />}
                    </div>
                    <div><div className="font-bold">{u.user_name}</div><div className="text-[10px] text-zinc-400">{u.login_id}</div></div>
                  </td>
                  <td className="p-3">
                    <div className="flex flex-col gap-1">
                      {u.role === 'admin' ? <span className="bg-black text-white text-[10px] px-1 py-0.5 rounded w-fit">管理员</span> : <span className="text-zinc-400 text-[10px]">普通用户</span>}
                      {u.is_banned && <span className="text-red-600 text-[10px] font-bold flex items-center gap-0.5"><ShieldAlert className="w-3 h-3"/> 已封禁</span>}
                    </div>
                  </td>
                  <td className="p-3">
                    {u.role !== 'admin' && (
                      <button onClick={() => toggle_ban_user(u.id, u.is_banned).then(loadAdminData)} className={`px-3 py-1 text-[10px] border ${u.is_banned ? 'text-green-600 border-green-600' : 'text-red-600 border-red-600'}`}>
                        {u.is_banned ? '解封' : '封禁'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
