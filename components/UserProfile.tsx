import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { 
  get_user, 
  getUnreadNotificationCount, 
  get_posts_by_user,
  updateUser
} from '../services/storage'; 
import { uploadImage } from '../services/storageService';
import {CollectionsTab } from '../components/CollectionsTab';
import {MessagesTab } from '../components/MessagesTab';
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

  // ✅ 修改：从 Supabase Auth Session 获取当前用户
  useEffect(() => {
    const getCurrentUser = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          const userData = await get_user(session.user.id);
          setCurrentUser(userData);
        }
      } catch (err) {
        console.error('获取当前用户失败:', err);
      }
    };
    getCurrentUser();
  }, []);

  const isOwnProfile = currentUser && currentUser.id === userId;

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
      } catch (err) {
        console.error("加载个人资料失败:", err);
      } finally {
        setLoading(false);
      }
    };
    
    if (currentUser) {
      fetchAllData();
    }
  }, [userId, isOwnProfile, currentUser]);

  // 头像上传处理
  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !isOwnProfile) return;

    // 文件大小校验
    if (file.size > 2 * 1024 * 1024) {
      alert('头像图片不能超过 2MB');
      return;
    }

    try {
      setUploading(true);
      
      // 上传到 'user_images' 桶
      const publicUrl = await uploadImage(file, 'user_images', `avatars/${userId}`);

      // 更新数据库
      await updateUser(userId, { avatar: publicUrl });

      // 更新本地状态
      setUser((prev: any) => ({ ...prev, avatar: publicUrl }));
      setCurrentUser((prev: any) => ({ ...prev, avatar: publicUrl }));
      
      // 更新 sessionStorage
      sessionStorage.setItem('currentUser', JSON.stringify({ ...currentUser, avatar: publicUrl }));

      alert('头像更新成功！');
    } catch (error: any) {
      console.error('上传头像失败:', error);
      alert(`上传失败: ${error.message}`);
    } finally {
      setUploading(false);
    }
  };

  if (loading) return (
    <div className="flex justify-center p-20">
      <Loader2 className="animate-spin w-8 h-8 text-zinc-400" />
    </div>
  );
  
  if (!user) return (
    <div className="p-8 text-center text-zinc-500">用户不存在</div>
  );

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 animate-in fade-in duration-300">
      <button 
        onClick={onNavigateBack} 
        className="mb-6 text-sm text-zinc-500 hover:text-black flex items-center gap-1 transition-colors"
      >
        ← 返回
      </button>
      
      <div className="bg-white border border-zinc-200 p-6 md:p-8 mb-6 flex flex-col md:flex-row items-center md:items-start gap-6 shadow-sm">
        {/* 头像区域 */}
        <div className="relative group">
          <div className="w-24 h-24 bg-zinc-100 rounded-full flex items-center justify-center overflow-hidden border-2 border-zinc-200">
            {uploading && (
              <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-10 rounded-full">
                <Loader2 className="w-6 h-6 animate-spin text-black" />
              </div>
            )}
            {user.avatar ? (
              <img src={user.avatar} alt={`${user.user_name}的头像`} className="w-full h-full object-cover" />
            ) : (
              <UserCircle className="w-16 h-16 text-zinc-300" />
            )}
          </div>
          
          {isOwnProfile && !uploading && (
            <label className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity">
              <Camera className="w-6 h-6" />
              <input 
                type="file" 
                className="hidden" 
                accept="image/jpeg,image/png,image/webp" 
                onChange={handleAvatarUpload}
                aria-label="上传头像"
              />
            </label>
          )}
        </div>
        
        {/* 用户信息 */}
        <div className="text-center md:text-left flex-1">
          <h1 className="text-3xl font-bold mb-2">{user.user_name}</h1>
          <div className="flex flex-wrap justify-center md:justify-start gap-4 text-sm text-zinc-500 mb-4">
            <span className="bg-zinc-100 px-2 py-1 rounded font-mono text-xs">
              {user.login_id || user.id.substring(0, 8)}
            </span>
            <span className="flex items-center gap-1">
              <Calendar className="w-4 h-4"/> 
              加入于 {new Date(user.created_at).toLocaleDateString('zh-CN')}
            </span>
            {user.role === 'admin' && (
              <span className="bg-black text-white px-2 py-0.5 text-xs font-bold rounded">
                管理员
              </span>
            )}
            {user.role === 'i女er' && (
              <span className="bg-purple-600 text-white px-2 py-0.5 text-xs font-bold rounded">
                i女er
              </span>
            )}
          </div>
          
          {user.bio && (
            <p className="text-sm text-zinc-600 mb-4">{user.bio}</p>
          )}
          
          <div className="flex justify-center md:justify-start gap-8 mt-6 pt-6 border-t border-zinc-100">
            <div className="text-center">
              <div className="text-xl font-bold">{posts.length}</div>
              <div className="text-xs text-zinc-400 uppercase tracking-wider">帖子</div>
            </div>
            {isOwnProfile && unreadCount > 0 && (
              <div className="text-center">
                <div className="text-xl font-bold text-red-600">{unreadCount}</div>
                <div className="text-xs text-zinc-400 uppercase tracking-wider">未读消息</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border border-zinc-200 mb-6">
        <div className="flex border-b border-zinc-200">
          <button
            onClick={() => setActiveTab('posts')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'posts' 
                ? 'border-b-2 border-black text-black' 
                : 'text-zinc-500 hover:text-black'
            }`}
          >
            帖子 ({posts.length})
          </button>
          {isOwnProfile && (
            <>
              <button
                onClick={() => setActiveTab('messages')}
                className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                  activeTab === 'messages' 
                    ? 'border-b-2 border-black text-black' 
                    : 'text-zinc-500 hover:text-black'
                }`}
              >
                消息 {unreadCount > 0 && `(${unreadCount})`}
              </button>
              <button
                onClick={() => setActiveTab('collections')}
                className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                  activeTab === 'collections' 
                    ? 'border-b-2 border-black text-black' 
                    : 'text-zinc-500 hover:text-black'
                }`}
              >
                收藏
              </button>
            </>
          )}
        </div>

        <div className="p-4">
          {activeTab === 'posts' && (
            <div className="space-y-4">
              {posts.length === 0 ? (
                <div className="text-center py-12 text-zinc-400 text-sm">
                  {isOwnProfile ? '你还没有发布任何帖子' : 'TA 还没有发布任何帖子'}
                </div>
              ) : (
                posts.map(post => (
                  <div
                    key={post.id}
                    onClick={() => onPostClick(post.id)}
                    className="p-4 border border-zinc-200 rounded hover:bg-zinc-50 cursor-pointer transition-colors"
                  >
                    <h3 className="font-medium mb-2 line-clamp-1">{post.title}</h3>
                    <p className="text-sm text-zinc-500 line-clamp-2 mb-2">{post.content}</p>
                    <div className="flex gap-4 text-xs text-zinc-400">
                      <span>{post.category}</span>
                      <span>•</span>
                      <span>{new Date(post.created_at).toLocaleDateString('zh-CN')}</span>
                      {post.is_essence && (
                        <>
                          <span>•</span>
                          <span className="text-yellow-600">精华</span>
                        </>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'messages' && isOwnProfile && (
            <MessagesTab 
           userId={userId} 
          onPostClick={onPostClick} // <-- 新增：将跳转函数传递给消息组件
  />
          )}

          {activeTab === 'collections' && isOwnProfile && (
           <CollectionsTab 
           userId={userId} 
           onPostClick={onPostClick} // <-- 必须加上这一行
          />
          )}
        </div>
      </div>
    </div>
  );
}