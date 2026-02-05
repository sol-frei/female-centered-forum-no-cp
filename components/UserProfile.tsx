import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { 
  get_user, 
  getUnreadNotificationCount, 
  get_posts_by_user,
  updateUser,
  markAllNotificationsAsRead
} from '../services/storage'; 
import { uploadImage } from '../services/storageService';
import { CollectionsTab } from '../components/CollectionsTab';
import { MessagesTab } from '../components/MessagesTab';
import { 
  UserCircle, 
  Calendar, 
  Camera,
  ArrowLeft,
  Edit2,
  Check,
  X,
  Bell
} from 'lucide-react';

interface UserProfileProps {
  userId: string;
  onNavigateBack: () => void;
  onPostClick: (postId: string) => void;
}

// 统一的旋转圆圈组件
const LoadingSpinner = () => (
  <div className="py-20 flex items-center justify-center bg-white">
    <div className="w-6 h-6 border-2 border-zinc-200 border-t-zinc-800 rounded-full animate-spin"></div>
  </div>
);

export default function UserProfile({ userId, onNavigateBack, onPostClick }: UserProfileProps) {
  const [user, setUser] = useState<any>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [activeTab, setActiveTab] = useState<'posts' | 'messages' | 'collections'>('posts');
  const [currentUser, setCurrentUser] = useState<any>(null);

  const [isEditingName, setIsEditingName] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [savingName, setSavingName] = useState(false);

  useEffect(() => {
    console.log('UserProfile: userId changed to:', userId);
    
    // 当userId变化时,先清空旧数据,避免显示上一个用户的信息
    setUser(null);
    setPosts([]);
    setUnreadCount(0);
    setActiveTab('posts');
    setIsEditingName(false);
    
    loadProfile();
  }, [userId]); // userId变化时重新执行

  const loadProfile = async () => {
    setLoading(true);
    try {
      const userData = await get_user(userId);
      setUser(userData);
      setNewUserName(userData?.user_name || '');
      
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setCurrentUser(session.user);
        if (session.user.id === userId) {
          const count = await getUnreadNotificationCount(userId);
          setUnreadCount(count);
          
          // 🟢 新增:进入自己的主页时自动标记所有消息为已读
          if (count > 0) {
            try {
              await markAllNotificationsAsRead(userId);
              setUnreadCount(0); // 立即更新UI
            } catch (err) {
              console.error('批量标记已读失败:', err);
            }
          }
        }
      }

      const userPosts = await get_posts_by_user(userId);
      setPosts(userPosts);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setUploading(true);
    try {
      const url = await uploadImage(file, 'avatars');
      await updateUser(user.id, { avatar: url });
      setUser({ ...user, avatar: url });
    } catch (err) {
      alert('上传失败');
    } finally {
      setUploading(false);
    }
  };

  const handleUpdateName = async () => {
    if (!newUserName.trim() || newUserName === user.user_name) {
      setIsEditingName(false);
      return;
    }
    setSavingName(true);
    try {
      await updateUser(user.id, { user_name: newUserName });
      setUser({ ...user, user_name: newUserName });
      setIsEditingName(false);
    } catch (err) {
      alert('更新失败');
    } finally {
      setSavingName(false);
    }
  };

  const isOwnProfile = currentUser?.id === userId;

  if (loading) return <LoadingSpinner />;
  if (!user) return <div className="p-20 text-center text-zinc-400">用户不存在</div>;

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 pb-20">
      <button onClick={onNavigateBack} className="mb-4 p-2 hover:bg-zinc-100 rounded-full transition-colors">
        <ArrowLeft className="w-5 h-5" />
      </button>

      {/* 🟢 优化后的用户信息卡片 - 更紧凑的布局 */}
      <div className="flex flex-col md:flex-row items-center gap-6 bg-white border border-zinc-200 p-6 rounded-2xl">
        <div className="relative group">
          {/* 🟢 优化头像尺寸 - 从w-32 h-32改为w-20 h-20 */}
          <div className="w-20 h-20 rounded-full overflow-hidden bg-zinc-100 border-2 border-white shadow-sm">
            {user.avatar ? (
              <img src={user.avatar} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <UserCircle className="w-full h-full text-zinc-300" />
            )}
          </div>
          {isOwnProfile && (
            <label className="absolute inset-0 flex items-center justify-center bg-black/40 text-white rounded-full opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity">
              <Camera className="w-5 h-5" />
              <input type="file" className="hidden" accept="image/*" onChange={handleAvatarUpload} disabled={uploading} />
            </label>
          )}
          {uploading && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/80 rounded-full">
              <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
            </div>
          )}
        </div>

        <div className="flex-1 text-center md:text-left">
          <div className="flex items-center justify-center md:justify-start gap-2 mb-1">
            {isEditingName ? (
              <div className="flex items-center gap-2">
                <input
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  className="px-2 py-1 border-b border-black outline-none text-xl font-bold bg-transparent"
                  autoFocus
                />
                <button onClick={handleUpdateName} disabled={savingName} className="text-green-600">
                  <Check className="w-4 h-4" />
                </button>
                <button onClick={() => { setIsEditingName(false); setNewUserName(user.user_name); }} className="text-red-500">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <>
                {/* 🟢 优化昵称字号 - 从text-3xl改为text-xl */}
                <h1 className="text-xl font-bold">{user.user_name}</h1>
                {isOwnProfile && (
                  <button onClick={() => setIsEditingName(true)} className="text-zinc-400 hover:text-black">
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </>
            )}
            {user.role === 'admin' && (
              <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs font-bold rounded">管理员</span>
            )}
          </div>
          <div className="text-zinc-500 flex items-center justify-center md:justify-start gap-2 text-xs">
            <Calendar className="w-3.5 h-3.5" />
            <span>{new Date(user.created_at).toLocaleDateString()} 加入</span>
          </div>
        </div>
      </div>

      <div className="mt-6">
        {/* 🟢 标签页顺序调整:消息tab提前到第一位(仅自己可见) */}
        <div className="flex border-b border-zinc-200">
          {isOwnProfile && (
            <button 
              onClick={() => setActiveTab('messages')}
              className={`px-6 py-3 text-sm font-medium transition-colors border-b-2 flex items-center gap-2 ${activeTab === 'messages' ? 'border-black text-black' : 'border-transparent text-zinc-500 hover:text-black'}`}
            >
              <Bell className="w-4 h-4" />
              消息
            </button>
          )}
          <button 
            onClick={() => setActiveTab('posts')}
            className={`px-6 py-3 text-sm font-medium transition-colors border-b-2 ${activeTab === 'posts' ? 'border-black text-black' : 'border-transparent text-zinc-500 hover:text-black'}`}
          >
            发布 ({posts.length})
          </button>
          {isOwnProfile && (
            <button 
              onClick={() => setActiveTab('collections')}
              className={`px-6 py-3 text-sm font-medium transition-colors border-b-2 ${activeTab === 'collections' ? 'border-black text-black' : 'border-transparent text-zinc-500 hover:text-black'}`}
            >
              收藏
            </button>
          )}
        </div>

        <div className="py-4">
          {activeTab === 'messages' && isOwnProfile && (
            <MessagesTab userId={userId} onPostClick={onPostClick} />
          )}

          {activeTab === 'posts' && (
            <div className="grid gap-3">
              {posts.length === 0 ? (
                <div className="text-center py-16 text-zinc-400 text-sm">尚未发布过帖子</div>
              ) : (
                posts.map(post => (
                  <div key={post.id} onClick={() => onPostClick(post.id)} className="p-4 bg-white border border-zinc-200 rounded-xl cursor-pointer hover:border-zinc-400 transition-all">
                    <h3 className="font-bold mb-1 line-clamp-1 text-sm">{post.title}</h3>
                    <p className="text-xs text-zinc-400">{new Date(post.created_at).toLocaleString()}</p>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'collections' && isOwnProfile && (
            <CollectionsTab userId={userId} onPostClick={onPostClick} />
          )}
        </div>
      </div>
    </div>
  );
}
