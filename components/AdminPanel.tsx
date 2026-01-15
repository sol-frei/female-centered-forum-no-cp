import React, { useState } from 'react';
import { User, Role } from '../types';
import { createUser, getDB, setBannedWords, toggleBanUser, updateUser } from '../services/storage';
import { UserPlus, Ban, Settings, Copy, ShieldAlert, Check, UserCircle, Crown } from 'lucide-react';
import Toast from './Toast';

export default function AdminPanel() {
  const [db, setDb] = useState(getDB());
  const [newUser, setNewUser] = useState<User | null>(null);
  const [bannedWordsInput, setBannedWordsInput] = useState(db.bannedWords.join(', '));
  const [activeTab, setActiveTab] = useState<'users' | 'settings'>('users');
  const [copiedId, setCopiedId] = useState(false);
  const [copiedPass, setCopiedPass] = useState(false);
  const [toast, setToast] = useState<{msg: string, type: 'success' | 'error'} | null>(null);

  const handleGenerateUser = () => {
    const user = createUser('user');
    setNewUser(user);
    setDb(getDB()); // Refresh list
    setCopiedId(false);
    setCopiedPass(false);
  };

  const handleToggleBan = (id: string) => {
    toggleBanUser(id);
    setDb(getDB());
  };

  const handleToggleRole = (id: string, currentRole: Role) => {
    const newRole = currentRole === 'i女er' ? 'user' : 'i女er';
    updateUser(id, { role: newRole });
    setDb(getDB());
  };

  const handleSaveWords = () => {
    const words = bannedWordsInput.split(/[,，]/).map(w => w.trim()).filter(Boolean);
    setBannedWords(words);
    setToast({ msg: '已保存', type: 'success' });
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

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      <h1 className="text-xl font-bold border-b border-zinc-200 pb-4">管理员后台</h1>

      {/* Tabs */}
      <div className="flex gap-4 border-b border-zinc-200">
        <button 
          onClick={() => setActiveTab('users')}
          className={`pb-2 px-4 ${activeTab === 'users' ? 'border-b-2 border-black font-bold' : 'text-zinc-500'}`}
        >
          用户管理
        </button>
        <button 
          onClick={() => setActiveTab('settings')}
          className={`pb-2 px-4 ${activeTab === 'settings' ? 'border-b-2 border-black font-bold' : 'text-zinc-500'}`}
        >
          发言设置
        </button>
      </div>

      {activeTab === 'users' && (
        <div className="space-y-8">
          {/* Generate User */}
          <div className="bg-zinc-50 p-6 border border-zinc-200">
            <h3 className="font-bold flex items-center gap-2 mb-4">
              <UserPlus className="w-5 h-5" /> 生成新用户
            </h3>
            <button 
              onClick={handleGenerateUser}
              className="bg-black text-white px-4 py-2 hover:bg-zinc-800 transition-colors"
            >
              随机生成 ID & 密码
            </button>

            {newUser && (
              <div className="mt-4 p-4 bg-white border-2 border-dashed border-zinc-300">
                <p className="text-sm text-zinc-500 mb-2">新用户信息 (请务必保存):</p>
                <div className="space-y-3">
                  <div className="flex items-center justify-between bg-zinc-50 p-2 border border-zinc-200">
                    <div className="flex items-center gap-2">
                      <span className="text-zinc-500 text-sm">ID:</span>
                      <span className="font-mono font-bold text-lg">{newUser.id}</span>
                    </div>
                    <button 
                      onClick={() => copyToClipboard(newUser.id, 'id')}
                      className="text-sm flex items-center gap-1 hover:bg-zinc-200 px-2 py-1 rounded transition-colors"
                    >
                      {copiedId ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                      {copiedId ? '已复制' : '复制'}
                    </button>
                  </div>
                  
                  <div className="flex items-center justify-between bg-zinc-50 p-2 border border-zinc-200">
                    <div className="flex items-center gap-2">
                      <span className="text-zinc-500 text-sm">密码:</span>
                      <span className="font-mono font-bold text-lg">{newUser.password}</span>
                    </div>
                    <button 
                      onClick={() => copyToClipboard(newUser.password, 'pass')}
                      className="text-sm flex items-center gap-1 hover:bg-zinc-200 px-2 py-1 rounded transition-colors"
                    >
                      {copiedPass ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                      {copiedPass ? '已复制' : '复制'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* User List */}
          <div>
            <h3 className="font-bold mb-4">用户列表 ({db.users.length})</h3>
            <div className="border border-zinc-200 rounded-sm overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="bg-zinc-100 border-b border-zinc-200">
                  <tr>
                    <th className="p-3">头像</th>
                    <th className="p-3">ID</th>
                    <th className="p-3">用户名</th>
                    <th className="p-3">角色/状态</th>
                    <th className="p-3">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 bg-white">
                  {db.users.map(u => (
                    <tr key={u.id} className={u.isBanned ? 'bg-red-50' : ''}>
                      <td className="p-3">
                        <div className="w-8 h-8 rounded-full bg-zinc-100 overflow-hidden">
                           {u.avatar ? <img src={u.avatar} className="w-full h-full object-cover" /> : <UserCircle className="w-8 h-8 text-zinc-300"/>}
                        </div>
                      </td>
                      <td className="p-3 font-mono">{u.id}</td>
                      <td className="p-3">{u.username}</td>
                      <td className="p-3">
                        <div className="flex flex-col gap-1">
                          {u.role === 'admin' && <span className="bg-black text-white text-xs px-2 py-0.5 w-fit">管理员</span>}
                          {u.role === 'i女er' && <span className="bg-purple-600 text-white text-xs px-2 py-0.5 w-fit flex items-center gap-1"><Crown className="w-3 h-3"/> i女er</span>}
                          
                          {u.isBanned ? (
                            <span className="text-red-600 font-bold flex items-center gap-1"><ShieldAlert className="w-3 h-3"/> 封禁中</span>
                          ) : (
                            <span className="text-green-600">正常</span>
                          )}
                        </div>
                      </td>
                      <td className="p-3">
                        {u.role !== 'admin' && (
                          <div className="flex gap-2">
                            <button 
                              onClick={() => handleToggleBan(u.id)}
                              className={`px-3 py-1 text-xs border ${u.isBanned ? 'border-green-600 text-green-600' : 'border-red-600 text-red-600'} hover:bg-zinc-50`}
                            >
                              {u.isBanned ? '解封' : '封禁'}
                            </button>
                            {!u.isBanned && (
                              <button
                                onClick={() => handleToggleRole(u.id, u.role)}
                                className="px-3 py-1 text-xs border border-purple-600 text-purple-600 hover:bg-purple-50"
                              >
                                {u.role === 'i女er' ? '成为用户' : '成为i女er'}
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
        </div>
      )}

      {activeTab === 'settings' && (
        <div className="bg-white border border-zinc-200 p-6 space-y-4">
          <h3 className="font-bold flex items-center gap-2">
            <Ban className="w-5 h-5" /> 违禁词设置
          </h3>
          <p className="text-sm text-zinc-500">
            设置后，包含这些词汇的帖子和评论将无法发布。请用逗号分隔。
          </p>
          <textarea 
            value={bannedWordsInput}
            onChange={(e) => setBannedWordsInput(e.target.value)}
            className="w-full h-32 p-3 border border-zinc-300 focus:outline-none focus:border-black"
            placeholder="例如: 词语1, 词语2, ..."
          />
          <button 
            onClick={handleSaveWords}
            className="bg-black text-white px-6 py-2 hover:bg-zinc-800"
          >
            保存设置
          </button>
        </div>
      )}
    </div>
  );
}