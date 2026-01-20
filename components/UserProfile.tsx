import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { 
  get_user, 
  getUnreadNotificationCount, 
  get_posts_by_user,
  updateUser
} from '../services/storage'; 
import { uploadImage } from '../services/storageService';
import { CollectionsTab } from '../components/CollectionsTab';
import { MessagesTab } from '../components/MessagesTab';
import { 
  UserCircle, 
  Calendar, 
  Camera,
  Loader2 
} from 'lucide-react';

interface UserProfileProps {
  userId: string;
  onNavigateBack: () => void;
  onPostClick: (postId: string) => void;
}

export default function UserProfile({ userId, onNavigateBack, onPostClick }: UserProfileProps) {
  const [user, setUser] = useState<any>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [activeTab, setActiveTab] = useState<'posts' | 'messages' | 'collections'>('posts');
  const [currentUser, setCurrentUser] = useState<any>(null);

  // ✅ 新增：用户名编辑状态
  const [isEditingName, setIsEditingName] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [savingName, setSavingName] = useState(false);

  // 获取当前登录用户
  useEffect(() => {
    const getCurrentUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const userData = await get_user(session.user.id);
        setCurrentUser(userData);
      }
    };
    getCurrentUser();
  }, []);

  const isOwnProfile = currentUser && currentUser.id === userId;

  // 加载资料
  useEffect(() => {
    const fetchAllData = async () => {
      setLoading(true);
      try {
        const [userData, userPosts, notificationCount] = await Promise.all([
          get_user(userId),
          get_posts_by_user(userId),
          isOwnProfile ? getUnreadNotificationCount(userId) : Promise.resolve(0)
        ]);
        setUser(userData);
        setPosts(userPosts);
        setUnreadCount(notificationCount);
        setNewUserName(userData.user_name);
      } catch (err) {
        console.error('加载个人资料失败:', err);
      } finally {
        setLoading(false);
      }
    };

    if (currentUser) fetchAllData();
  }, [userId, isOwnProfile, currentUser]);

  // ✅ 保存用户名
  const handleSaveUserName = async () => {
    if (!newUserName.trim()) return alert('用户名不能为空');

    try {
      setSavingName(true);
      await updateUser(userId, { user_name: newUserName.trim() });

      setUser((prev: any) => ({ ...prev, user_name: newUserName.trim() }));
      setCurrentUser((prev: any) => ({ ...prev, user_name: newUserName.trim() }));

      setIsEditingName(false);
    } catch (err) {
      alert('修改失败');
    } finally {
      setSavingName(false);
    }
  };

  // 头像上传
  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !isOwnProfile) return;

    try {
      setUploading(true);
      const publicUrl = await uploadImage(file, 'user_images', `avatars/${userId}`);
      await updateUser(userId, { avatar: publicUrl });
      setUser((prev: any) => ({ ...prev, avatar: publicUrl }));
      setCurrentUser((prev: any) => ({ ...prev, avatar: publicUrl }));
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center p-20">
        <Loader2 className="animate-spin w-8 h-8 text-zinc-400" />
      </div>
    );
  }

  if (!user) return <div className="p-8 text-center">用户不存在</div>;

  return (
    <div className="max-w-4xl mx-auto p-4">
      <button onClick={onNavigateBack} className="mb-6 text-sm text-zinc-500">← 返回</button>

      <div className="bg-white border p-6 flex gap-6">
        {/* 头像 */}
        <div className="relative group">
          <div className="w-24 h-24 rounded-full overflow-hidden bg-zinc-100 flex items-center justify-center">
            {user.avatar ? (
              <img src={user.avatar} className="w-full h-full object-cover" />
            ) : (
              <UserCircle className="w-16 h-16 text-zinc-300" />
            )}
          </div>

          {isOwnProfile && (
            <label className="absolute inset-0 bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 cursor-pointer">
              <Camera />
              <input type="file" className="hidden" onChange={handleAvatarUpload} />
            </label>
          )}
        </div>

        {/* 信息 */}
        <div className="flex-1">
          {/* ✅ 用户名编辑 */}
          <div className="flex items-center gap-2 mb-2">
            {!isEditingName ? (
              <>
                <h1 className="text-3xl font-bold">{user.user_name}</h1>
                {isOwnProfile && (
                  <button
                    onClick={() => setIsEditingName(true)}
                    className="text-sm text-zinc-400"
                  >
                    编辑
                  </button>
                )}
              </>
            ) : (
              <>
                <input
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  className="border px-2 py-1 text-sm"
                  autoFocus
                />
                <button
                  onClick={handleSaveUserName}
                  disabled={savingName}
                  className="bg-black text-white px-2 py-1 text-sm"
                >
                  保存
                </button>
                <button
                  onClick={() => {
                    setIsEditingName(false);
                    setNewUserName(user.user_name);
                  }}
                  className="text-sm text-zinc-500"
                >
                  取消
                </button>
              </>
            )}
          </div>

          <div className="text-sm text-zinc-500 flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            加入于 {new Date(user.created_at).toLocaleDateString('zh-CN')}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mt-6 border bg-white">
        <div className="flex border-b">
          <button onClick={() => setActiveTab('posts')} className="flex-1 py-3">
            帖子 ({posts.length})
          </button>
          {isOwnProfile && (
            <>
              <button onClick={() => setActiveTab('messages')} className="flex-1 py-3">
                消息
              </button>
              <button onClick={() => setActiveTab('collections')} className="flex-1 py-3">
                收藏
              </button>
            </>
          )}
        </div>

        <div className="p-4">
          {activeTab === 'posts' && posts.map(post => (
            <div key={post.id} onClick={() => onPostClick(post.id)} className="border p-4 mb-3 cursor-pointer">
              {post.title}
            </div>
          ))}

          {activeTab === 'messages' && isOwnProfile && (
            <MessagesTab userId={userId} onPostClick={onPostClick} />
          )}

          {activeTab === 'collections' && isOwnProfile && (
            <CollectionsTab userId={userId} onPostClick={onPostClick} />
          )}
        </div>
      </div>
    </div>
  );
}
