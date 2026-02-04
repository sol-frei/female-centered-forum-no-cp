import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { get_all_users, updateUser, toggle_ban_user, get_banned_words } from '../services/storage';
import { Ban, ShieldAlert, Check, UserCircle, Crown, Loader2 } from 'lucide-react';
import Toast from './Toast';

// ✅ 统一样式
const LoadingSpinner = () => (
  <div className=\"py-20 flex items-center justify-center bg-white\">
    <div className=\"w-6 h-6 border-2 border-zinc-200 border-t-zinc-800 rounded-full animate-spin\"></div>
  </div>
);

export default function AdminPanel() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [bannedWordsInput, setBannedWordsInput] = useState('');
  const [activeTab, setActiveTab] = useState<'users' | 'settings'>('users');
  const [toast, setToast] = useState<any>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [u, words] = await Promise.all([get_all_users(), get_banned_words()]);
    setUsers(u);
    setBannedWordsInput(words.join(', '));
    setLoading(false);
  };

  const handleSaveWords = async () => {
     const words = bannedWordsInput.split(/[，,]/).map(w => w.trim()).filter(Boolean);
     const { error } = await supabase.from('site_settings').upsert({ key: 'banned_words', value: words });
     setToast(error ? { msg: '保存失败', type: 'error' } : { msg: '保存成功', type: 'success' });
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="max-w-6xl mx-auto p-4">
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      
      <div className="flex border-b mb-6">
        <button onClick={() => setActiveTab('users')} className={`px-6 py-3 ${activeTab === 'users' ? 'border-b-2 border-black font-bold' : ''}`}>用户管理</button>
        <button onClick={() => setActiveTab('settings')} className={`px-6 py-3 ${activeTab === 'settings' ? 'border-b-2 border-black font-bold' : ''}`}>辱女词管理</button>
      </div>

      {activeTab === 'users' && (
        <div className="border rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 border-b">
              <tr>
                <th className="p-4 text-left font-medium">用户</th>
                <th className="p-4 text-left font-medium">权限</th>
                <th className="p-4 text-left font-medium">状态</th>
                <th className="p-4 text-right font-medium">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {users.map(u => (
                <tr key={u.id}>
                  <td className="p-4 flex items-center gap-2">
                    <Avatar url={u.avatar} className="w-8 h-8" />
                    <div><div>{u.user_name}</div><div className="text-xs text-zinc-400">{u.id.slice(0,8)}</div></div>
                  </td>
                  <td className="p-4">
                    {u.role === 'admin' ? <span className="text-purple-600 flex items-center gap-1"><Crown className="w-3 h-3"/>管理</span> : '普通'}
                  </td>
                  <td className="p-4">
                    {u.is_banned ? <span className="text-red-500">封禁中</span> : <span className="text-green-600">正常</span>}
                  </td>
                  <td className="p-4 text-right">
                    <button onClick={() => toggle_ban_user(u.id, !u.is_banned).then(loadData)} className="text-xs border px-2 py-1">
                      {u.is_banned ? '解封' : '封禁'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'settings' && (
        <div className="space-y-4">
          <textarea 
            value={bannedWordsInput} 
            onChange={e => setBannedWordsInput(e.target.value)}
            className="w-full h-48 p-3 border rounded-lg focus:outline-none focus:border-black"
          />
          <button onClick={handleSaveWords} className="bg-black text-white px-6 py-2 rounded-lg">保存设置</button>
        </div>
      )}
    </div>
  );
}

const Avatar = ({ url, className }: any) => (
  <div className={`${className} rounded-full overflow-hidden bg-zinc-100 border`}>
    {url ? <img src={url} className="w-full h-full object-cover" /> : <UserCircle className="w-full h-full text-zinc-300" />}
  </div>
);
