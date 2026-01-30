import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom'; // ✅ 新增
import { supabase } from '../services/supabaseClient';
import { 
  get_all_users, 
  updateUser, 
  toggle_ban_user, 
  get_banned_words,
  save_banned_words // 确保你有这个函数
} from '../services/storage';
import { 
  UserPlus, Ban, Copy, ShieldAlert, Check, UserCircle, Crown, Loader2, ArrowLeft 
} from 'lucide-react';
import Toast from './Toast';

export default function AdminPanel() {
  const navigate = useNavigate(); // ✅ 初始化路由
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
      setToast({ msg: '加载数据失败', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // 保存敏感词逻辑
  const handleSaveWords = async () => {
    try {
      const wordsArray = bannedWordsInput.split(/[，,]+/).map(w => w.trim()).filter(Boolean);
      // 注意：这里需要调用你的 storage 服务中的保存函数
      const { error } = await supabase.from('sensitive_words').upsert({ id: 1, words: wordsArray });
      if (error) throw error;
      setToast({ msg: '设置已保存', type: 'success' });
    } catch (err: any) {
      setToast({ msg: '保存失败', type: 'error' });
    }
  };

  if (loading) return <div className="p-20 text-center"><Loader2 className="animate-spin mx-auto" /></div>;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-zinc-200 overflow-hidden">
      {/* 头部：添加返回按钮 */}
      <div className="p-4 border-b border-zinc-100 flex items-center justify-between bg-zinc-50">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-zinc-200 rounded-full transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h2 className="text-xl font-black">系统管理后台</h2>
        </div>
        <div className="flex bg-white border border-zinc-200 p-1 rounded-lg">
          <button 
            onClick={() => setActiveTab('users')}
            className={`px-4 py-1.5 text-sm rounded-md transition-all ${activeTab === 'users' ? 'bg-black text-white' : 'hover:bg-zinc-100'}`}
          >
            用户管理
          </button>
          <button 
            onClick={() => setActiveTab('settings')}
            className={`px-4 py-1.5 text-sm rounded-md transition-all ${activeTab === 'settings' ? 'bg-black text-white' : 'hover:bg-zinc-100'}`}
          >
            全站设置
          </button>
        </div>
      </div>

      <div className="p-6">
        {activeTab === 'users' ? (
          /* 这里保留你原来的用户表格代码... */
          <div className="overflow-x-auto">
             <table className="w-full text-sm">
                {/* ... 原有的 table 内容 ... */}
             </table>
          </div>
        ) : (
          <div className="max-w-2xl space-y-4">
            <h3 className="font-bold flex items-center gap-2"><Ban className="w-5 h-5" /> 辱女词黑名单管理</h3>
            <textarea 
              value={bannedWordsInput}
              onChange={(e) => setBannedWordsInput(e.target.value)}
              className="w-full h-48 p-3 border border-zinc-300 rounded-lg font-mono text-sm"
              placeholder="输入词语，用逗号分隔..."
            />
            <button onClick={handleSaveWords} className="bg-black text-white px-6 py-2 rounded-lg hover:bg-zinc-800">
              保存更改
            </button>
          </div>
        )}
      </div>
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
