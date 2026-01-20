import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom'; // 添加这一行
import { supabase } from '../services/supabaseClient';
import { 
  get_all_users, 
  updateUser, 
  toggle_ban_user, 
  get_banned_words 
} from '../services/storage';
import { 
  UserPlus, Ban, Copy, ShieldAlert, Check, UserCircle, Crown, Loader2 
} from 'lucide-react';
import Toast from './Toast';

export default function AdminPanel() {
  const navigate = useNavigate(); // 添加这一行
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newUser, setNewUser] = useState<any | null>(null);
  const [bannedWordsInput, setBannedWordsInput] = useState('');
  const [activeTab, setActiveTab] = useState<'users' | 'settings'>('users');
  const [copiedId, setCopiedId] = useState(false);
  const [copiedPass, setCopiedPass] = useState(false);
  const [toast, setToast] = useState<{msg: string, type: 'success' | 'error'} | null>(null);

  useEffect(() => {
    loadAdminData();
  }, []);

  const loadAdminData = async () => {
    setLoading(true);
    try {
      const [allUsers, words] = await Promise.all([
        get_all_users(),
        get_banned_words()
      ]);
      setUsers(allUsers);
      setBannedWordsInput(words.join(', '));
    } catch (err: any) {
      setToast({ msg: '加载数据失败: ' + err.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateUser = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('请先登录');

      const res = await fetch('/api/admin/create-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ role: 'user' }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || '创建用户失败');
      }

      const user = await res.json();
      setNewUser(user);
      setUsers(prev => [user, ...prev]);
      setToast({ msg: '生成成功', type: 'success' });

    } catch (err: any) {
      setToast({ msg: '生成失败: ' + err.message, type: 'error' });
    }
  };

  const handleToggleBan = async (id: string, currentStatus: boolean) => {
    try {
      await toggle_ban_user(id, currentStatus);
      setUsers(prev => prev.map(u => u.id === id ? { ...u, is_banned: !currentStatus } : u));
      setToast({ msg: '操作成功', type: 'success' });
    } catch (err: any) {
      setToast({ msg: '操作失败', type: 'error' });
    }
  };

  const handleToggleRole = async (id: string, currentRole: string) => {
    const newRole = currentRole === 'i女er' ? 'user' : 'i女er';
    try {
      await updateUser(id, { role: newRole });
      setUsers(prev => prev.map(u => u.id === id ? { ...u, role: newRole } : u));
      setToast({ msg: '角色更新成功', type: 'success' });
    } catch (err: any) {
      setToast({ msg: '更新失败', type: 'error' });
    }
  };

  const handleSaveWords = async () => {
    try {
      const wordsArray = bannedWordsInput
        .split(/[，, \n]+/)
        .map(w => w.trim())
        .filter(w => w.length > 0);
      const uniqueWords = Array.from(new Set(wordsArray));

      const { error: deleteError } = await supabase
        .from('sensitive_words')
        .delete()
        .not('id', 'is', null);

      if (deleteError) throw deleteError;

      const inserts = uniqueWords.map(w => ({
        word: w,
        category: 'misogyny',
        replacement: '***',
      }));

      if (inserts.length > 0) {
        const { error: insertError } = await supabase
          .from('sensitive_words')
          .insert(inserts);
        if (insertError) throw insertError;
      }

      alert('保存成功！违禁词已同步至云端。');
    } catch (err: any) {
      console.error('保存失败:', err);
      alert('保存失败: ' + (err.message || '未知错误'));
    }
  };

  const copyToClipboard = (text: string, type: 'id' | 'pass') => {
    navigator.clipboard.writeText(text);
    if (type === 'id') {
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    } else {
      setCopiedPass(true);
      setTimeout(() => setCopiedPass(false), 2000);
    }
  };

  // 添加处理用户点击的函数 - 和导航栏风格一致
  const handleViewProfile = (userId: string) => {
    navigate(`/users/${userId}`);
  };

  if (loading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      <h1 className="text-xl font-bold border-b border-zinc-200 pb-4">云端管理后台</h1>

      {/* Tabs */}
      <div className="flex gap-4 border-b border-zinc-200">
        <button 
          onClick={() => setActiveTab('users')}
          className={`pb-2 px-4 ${activeTab === 'users' ? 'border-b-2 border-black font-bold' : 'text-zinc-500'}`}
        >
          用户管理 ({users.length})
        </button>
        <button 
          onClick={() => setActiveTab('settings')}
          className={`pb-2 px-4 ${activeTab === 'settings' ? 'border-b-2 border-black font-bold' : 'text-zinc-500'}`}
        >
          发言设置
        </button>
      </div>

      {activeTab === 'users' && (
        <div className="space-y-8 animate-in fade-in duration-300">
          {/* 生成用户 */}
          <div className="bg-zinc-50 p-6 border border-zinc-200">
            <h3 className="font-bold flex items-center gap-2 mb-4">
              <UserPlus className="w-5 h-5" /> 生成新用户
            </h3>
            <button 
              onClick={handleGenerateUser}
              className="bg-black text-white px-4 py-2 hover:bg-zinc-800 transition-colors"
            >
              向云端申请 Login ID & 密码
            </button>

            {newUser && (
              <div className="mt-4 p-4 bg-white border-2 border-dashed border-zinc-300 animate-in zoom-in duration-200">
                <p className="text-sm text-zinc-500 mb-2 font-bold text-red-600 italic">
                  请立即保存，离开后无法再次查看密码：
                </p>
                <div className="space-y-3">
                  <div className="flex items-center justify-between bg-zinc-50 p-2 border border-zinc-200">
                    <span className="font-mono text-sm">Login ID: {newUser.login_id}</span>
                    <button onClick={() => copyToClipboard(newUser.login_id, 'id')} className="text-xs flex items-center gap-1">
                      {copiedId ? <Check className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3" />} 复制
                    </button>
                  </div>
                  <div className="flex items-center justify-between bg-zinc-50 p-2 border border-zinc-200">
                    <span className="font-mono text-sm font-bold">Password: {newUser.password}</span>
                    <button onClick={() => copyToClipboard(newUser.password, 'pass')} className="text-xs flex items-center gap-1">
                      {copiedPass ? <Check className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3" />} 复制
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 用户列表 */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border border-zinc-200">
              <thead className="bg-zinc-50">
                <tr>
                  <th className="p-3">用户信息</th>
                  <th className="p-3">权限/状态</th>
                  <th className="p-3">管理操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 bg-white">
                {users.map(u => (
                  <tr key={u.id} className={u.is_banned ? 'bg-red-50/50' : ''}>
                    <td className="p-3">
                      {/* 采用和导航栏一致的跳转方式 */}
                      <div 
                        onClick={() => handleViewProfile(u.id)}
                        className="flex items-center gap-3 cursor-pointer group" 
                        title="查看用户主页"
                      >
                        <div className="w-10 h-10 rounded-full bg-zinc-100 overflow-hidden border border-zinc-200 group-hover:border-black transition-colors">
                          {u.avatar ? (
                            <img src={u.avatar} className="w-full h-full object-cover" alt={u.user_name} />
                          ) : (
                            <UserCircle className="w-full h-full text-zinc-300" />
                          )}
                        </div>
                        <div>
                          <div className="font-bold group-hover:text-blue-600 group-hover:underline transition-colors">
                            {u.user_name}
                          </div>
                          <div className="text-[10px] font-mono text-zinc-400">
                            {u.login_id}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="flex flex-col gap-1">
                        {u.role === 'admin' ? <span className="bg-black text-white text-[10px] px-1 py-0.5 w-fit rounded">管理员</span> : 
                         u.role === 'i女er' ? <span className="bg-purple-600 text-white text-[10px] px-1 py-0.5 w-fit rounded flex items-center gap-1"><Crown className="w-2 h-2"/> i女er</span> : 
                         <span className="text-zinc-400 text-[10px]">普通用户</span>}
                        {u.is_banned && <span className="text-red-600 text-[10px] font-bold flex items-center gap-0.5"><ShieldAlert className="w-3 h-3"/> 已封禁</span>}
                      </div>
                    </td>
                    <td className="p-3">
                      {u.role !== 'admin' && (
                        <div className="flex gap-2">
                          <button 
                            onClick={() => handleToggleBan(u.id, u.is_banned)}
                            className={`px-3 py-1 text-[10px] border transition-colors ${u.is_banned ? 'border-green-600 text-green-600 hover:bg-green-50' : 'border-red-600 text-red-600 hover:bg-red-50'}`}
                          >
                            {u.is_banned ? '解封' : '封禁'}
                          </button>
                          {!u.is_banned && (
                            <button
                              onClick={() => handleToggleRole(u.id, u.role)}
                              className="px-3 py-1 text-[10px] border border-purple-600 text-purple-600 hover:bg-purple-50"
                            >
                              {u.role === 'i女er' ? '成为user' : '成为i女er'}
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 设置 Tab */}
      {activeTab === 'settings' && (
        <div className="bg-white border border-zinc-200 p-6 space-y-4 animate-in slide-in-from-right duration-300">
          <h3 className="font-bold flex items-center gap-2">
            <Ban className="w-5 h-5" /> 辱女词管理
          </h3>
          <p className="text-sm text-zinc-500">
            设置后即刻生效，所有用户发帖都将受到限制。
          </p>
          <textarea 
            value={bannedWordsInput}
            onChange={(e) => setBannedWordsInput(e.target.value)}
            className="w-full h-48 p-3 border border-zinc-300 focus:outline-none focus:border-black font-mono text-sm leading-relaxed"
            placeholder="输入词语，用中文或英文逗号分隔..."
          />
          <button 
            onClick={handleSaveWords}
            className="bg-black text-white px-8 py-3 hover:bg-zinc-800 transition-all font-bold"
          >
            保存并应用到云端
          </button>
        </div>
      )}
    </div>
  );
}