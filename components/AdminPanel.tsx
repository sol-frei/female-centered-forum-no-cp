import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { 
  get_all_users, 
  updateUser, 
  toggle_ban_user, 
  get_banned_words 
} from '../services/storage';
import { 
  UserPlus, Ban, Copy, ShieldAlert, Check, UserCircle, Crown, Loader2, Camera
} from 'lucide-react';
import Toast from './Toast';

// 压缩图片为 webp，最大 400px
async function compressImageFromUrl(url: string): Promise<Blob> {
  const res = await fetch(url);
  if (!res.ok) throw new Error('下载失败');
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const maxSize = 400;
      let { width, height } = img;
      if (width > height) {
        if (width > maxSize) { height = Math.round(height * maxSize / width); width = maxSize; }
      } else {
        if (height > maxSize) { width = Math.round(width * maxSize / height); height = maxSize; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d')!.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        b => b ? resolve(b) : reject(new Error('压缩失败')),
        'image/webp', 0.85
      );
    };
    img.onerror = () => reject(new Error('图片加载失败'));
    img.src = URL.createObjectURL(blob);
  });
}

export default function AdminPanel() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newUser, setNewUser] = useState<any | null>(null);
  const [bannedWordsInput, setBannedWordsInput] = useState('');
  const [activeTab, setActiveTab] = useState<'users' | 'settings'>('users');
  const [copiedId, setCopiedId] = useState(false);
  const [copiedPass, setCopiedPass] = useState(false);
  const [toast, setToast] = useState<{msg: string, type: 'success' | 'error'} | null>(null);
  const [compressing, setCompressing] = useState(false);
  const [compressProgress, setCompressProgress] = useState<{done: number, total: number, log: string[]}>({ done: 0, total: 0, log: [] });

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

  const handleCompressAllAvatars = async () => {
    const targets = users.filter(u => u.avatar && !u.avatar.includes('.webp'));
    if (targets.length === 0) {
      setToast({ msg: '没有需要压缩的头像', type: 'success' });
      return;
    }
    setCompressing(true);
    setCompressProgress({ done: 0, total: targets.length, log: [] });

    for (let i = 0; i < targets.length; i++) {
      const u = targets[i];
      try {
        const compressed = await compressImageFromUrl(u.avatar);
        const file = new File([compressed], `${u.id}.webp`, { type: 'image/webp' });

        const uploadPath = `avatars/${u.id}.webp`;
        const { error: uploadError } = await supabase.storage
          .from('user_images')
          .upload(uploadPath, file, { upsert: true, contentType: 'image/webp' });
        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage.from('user_images').getPublicUrl(uploadPath);

        const { error: dbError } = await supabase
          .from('users')
          .update({ avatar: publicUrl })
          .eq('id', u.id);
        if (dbError) throw dbError;

        setUsers(prev => prev.map(p => p.id === u.id ? { ...p, avatar: publicUrl } : p));
        setCompressProgress(prev => ({
          done: prev.done + 1,
          total: prev.total,
          log: [...prev.log, `✅ ${u.user_name}`]
        }));
      } catch (err: any) {
        setCompressProgress(prev => ({
          done: prev.done + 1,
          total: prev.total,
          log: [...prev.log, `❌ ${u.user_name}: ${err.message}`]
        }));
      }
      await new Promise(r => setTimeout(r, 200));
    }
    setCompressing(false);
    setToast({ msg: '批量压缩完成', type: 'success' });
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

          {/* 批量压缩头像 */}
          <div className="bg-zinc-50 p-6 border border-zinc-200">
            <h3 className="font-bold flex items-center gap-2 mb-2">
              <Camera className="w-5 h-5" /> 批量压缩历史头像
            </h3>
            <p className="text-xs text-zinc-500 mb-4">
              将已上传的原图压缩为 webp 格式（最大 400px），可大幅提升加载速度。已压缩的会自动跳过。
            </p>
            <button
              onClick={handleCompressAllAvatars}
              disabled={compressing}
              className="bg-black text-white px-4 py-2 hover:bg-zinc-800 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {compressing
                ? <><Loader2 className="w-4 h-4 animate-spin" /> 压缩中 {compressProgress.done}/{compressProgress.total}</>
                : '开始批量压缩'}
            </button>
            {compressProgress.log.length > 0 && (
              <div className="mt-4 bg-white border border-zinc-200 p-3 max-h-48 overflow-y-auto font-mono text-xs space-y-1">
                {compressProgress.log.map((line, i) => (
                  <div key={i} className={line.startsWith('✅') ? 'text-green-700' : 'text-red-600'}>{line}</div>
                ))}
                {!compressing && (
                  <div className="text-zinc-400 pt-1 border-t border-zinc-100">
                    完成：{compressProgress.log.filter(l => l.startsWith('✅')).length} 成功，
                    {compressProgress.log.filter(l => l.startsWith('❌')).length} 失败
                  </div>
                )}
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
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-zinc-100 overflow-hidden border border-zinc-200">
                          {u.avatar ? (
                            <img src={u.avatar} className="w-full h-full object-cover" alt={u.user_name} />
                          ) : (
                            <UserCircle className="w-full h-full text-zinc-300" />
                          )}
                        </div>
                        <div>
                          <div className="font-bold">
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
