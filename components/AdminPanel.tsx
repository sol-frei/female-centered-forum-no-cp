import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { 
  get_all_users, 
  updateUser, 
  toggle_ban_user, 
  get_banned_words 
} from '../services/storage';
import { 
  UserPlus, Ban, Copy, ShieldAlert, Check, UserCircle, Crown, Settings, Users
} from 'lucide-react';
import Toast from './Toast';

// 统一的旋转圆圈组件
const LoadingSpinner = () => (
  <div className="py-20 flex items-center justify-center bg-white">
    <div className="w-6 h-6 border-2 border-zinc-200 border-t-zinc-800 rounded-full animate-spin"></div>
  </div>
);

export default function AdminPanel() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newUser, setNewUser] = useState<any | null>(null);
  const [bannedWordsInput, setBannedWordsInput] = useState('');
  const [activeTab, setActiveTab] = useState<'users' | 'settings'>('users');
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
      setToast({ msg: '数据加载失败', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleBan = async (uid: string, currentStatus: boolean) => {
    try {
      await toggle_ban_user(uid, !currentStatus);
      setUsers(users.map(u => u.id === uid ? { ...u, is_banned: !currentStatus } : u));
      setToast({ msg: currentStatus ? '已解封' : '已封禁', type: 'success' });
    } catch {
      setToast({ msg: '操作失败', type: 'error' });
    }
  };

  const handleToggleRole = async (uid: string, currentRole: string) => {
    const nextRole = currentRole === 'admin' ? 'user' : 'admin';
    try {
      await updateUser(uid, { role: nextRole });
      setUsers(users.map(u => u.id === uid ? { ...u, role: nextRole } : u));
      setToast({ msg: '权限更新成功', type: 'success' });
    } catch {
      setToast({ msg: '权限更新失败', type: 'error' });
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 pb-20">
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ShieldAlert className="w-7 h-7" /> 管理后台
        </h1>
        <div className="flex bg-zinc-100 p-1 rounded-xl">
          <button 
            onClick={() => setActiveTab('users')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'users' ? 'bg-white shadow-sm' : 'text-zinc-500'}`}
          >
            用户管理
          </button>
          <button 
            onClick={() => setActiveTab('settings')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'settings' ? 'bg-white shadow-sm' : 'text-zinc-500'}`}
          >
            全站设置
          </button>
        </div>
      </div>

      {activeTab === 'users' && (
        <div className="bg-white border border-zinc-200 rounded-3xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-zinc-50 border-b border-zinc-200 text-xs font-bold text-zinc-400 uppercase tracking-wider">
                  <th className="px-6 py-4">用户信息</th>
                  <th className="px-6 py-4">权限角色</th>
                  <th className="px-6 py-4">状态</th>
                  <th className="px-6 py-4 text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {users.map(u => (
                  <tr key={u.id} className="hover:bg-zinc-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-zinc-100 flex-shrink-0">
                          {u.avatar ? <img src={u.avatar} className="w-full h-full rounded-full object-cover" /> : <UserCircle className="w-full h-full text-zinc-300" />}
                        </div>
                        <div>
                          <div className="font-bold text-sm">{u.user_name}</div>
                          <div className="text-xs text-zinc-400">ID: {u.id.slice(0,8)}...</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {u.role === 'admin' ? (
                        <span className="flex items-center gap-1 text-purple-600 font-bold">
                          <Crown className="w-4 h-4" /> 管理员
                        </span>
                      ) : (
                        <span className="text-zinc-500">普通用户</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {u.is_banned ? (
                        <span className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-bold">已封禁</span>
                      ) : (
                        <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-bold">活跃</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <button 
                        onClick={() => handleToggleRole(u.id, u.role)}
                        className="text-xs text-zinc-400 hover:text-black font-medium"
                      >
                        切换角色
                      </button>
                      <button 
                        onClick={() => handleToggleBan(u.id, !!u.is_banned)}
                        className={`text-xs font-bold ${u.is_banned ? 'text-green-600' : 'text-red-500'}`}
                      >
                        {u.is_banned ? '解封' : '封禁'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'settings' && (
        <div className="bg-white border border-zinc-200 rounded-3xl p-8 space-y-6">
          <div>
            <h3 className="text-lg font-bold flex items-center gap-2 mb-2">
              <Ban className="w-5 h-5 text-red-500" /> 内容风控
            </h3>
            <p className="text-sm text-zinc-500 mb-4">设定违禁词库，系统将自动拦截包含这些词汇的评论和帖子。</p>
            <textarea 
              value={bannedWordsInput}
              onChange={(e) => setBannedWordsInput(e.target.value)}
              className="w-full h-48 p-4 bg-zinc-50 border border-zinc-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-black font-mono text-sm"
              placeholder="词语之间请用逗号分隔..."
            />
          </div>
          <button className="px-8 py-3 bg-black text-white rounded-xl font-bold hover:bg-zinc-800 transition-all">
            保存设置
          </button>
        </div>
      )}
    </div>
  );
}
