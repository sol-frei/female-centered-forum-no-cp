import React, { useState, useEffect } from 'react';
// 1. 引入你的云端函数和新提供的上传工具
import { 
  get_user, 
  getUnreadNotificationCount, 
  get_posts_by_user,
  updateUser // 假设你在 storage.ts 有一个更新用户的函数
} from '../services/storage'; 
import { uploadImage } from '../services/storageService'; // 引入你刚才给我的上传函数
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
  const [uploading, setUploading] = useState(false); // 新增：上传状态
  const [activeTab, setActiveTab] = useState<'posts' | 'messages' | 'collections'>('posts');

  const currentUser = JSON.parse(sessionStorage.getItem('currentUser') || '{}');
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
    fetchAllData();
  }, [userId, isOwnProfile]);

  // --- 重点修改：头像上传处理 ---
  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !isOwnProfile) return;

    // 1. 简单的文件大小校验
    if (file.size > 2 * 1024 * 1024) {
      alert('头像图片不能超过 2MB');
      return;
    }

    try {
      setUploading(true);
      
      // 2. 调用你提供的 uploadImage 上传到 'user_images' 桶
      // folder 以用户 ID 命名，方便管理
      const publicUrl = await uploadImage(file, 'user_images', `avatars/${userId}`);

      // 3. 将新的 URL 更新到数据库中的 users 表
      // 假设你的 storage.ts 里有一个 updateUser 函数：
      // export const updateUser = async (id, data) => await supabase.from('users').update(data).eq('id', id)
      await updateUser(userId, { avatar: publicUrl });

      // 4. 同步更新本地状态和 SessionStorage
      setUser((prev: any) => ({ ...prev, avatar: publicUrl }));
      const updatedSessionUser = { ...currentUser, avatar: publicUrl };
      sessionStorage.setItem('currentUser', JSON.stringify(updatedSessionUser));

      alert('头像更新成功！');
    } catch (error: any) {
      alert(`上传失败: ${error.message}`);
    } finally {
      setUploading(false);
    }
  };

  if (loading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin" /></div>;
  if (!user) return <div className="p-8 text-center">用户不存在</div>;

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 animate-in fade-in duration-300">
      <button onClick={onNavigateBack} className="mb-6 text-sm text-zinc-500 hover:text-black flex items-center gap-1">
        ← 返回
      </button>
      
      <div className="bg-white border border-zinc-200 p-6 md:p-8 mb-6 flex flex-col md:flex-row items-center md:items-start gap-6 shadow-sm">
        <div className="relative group">
          <div className="w-24 h-24 bg-zinc-100 rounded-full flex items-center justify-center overflow-hidden border-2 border-zinc-100">
            {/* 上传时显示加载遮罩 */}
            {uploading && (
              <div className="absolute inset-0 bg-white/60 flex items-center justify-center z-10">
                <Loader2 className="w-6 h-6 animate-spin text-black" />
              </div>
            )}
            {user.avatar ? (
              <img src={user.avatar} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <UserCircle className="w-16 h-16 text-zinc-300" />
            )}
          </div>
          
          {isOwnProfile && !uploading && (
            <label className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity">
              <Camera className="w-6 h-6" />
              <input type="file" className="hidden" accept="image/*" onChange={handleAvatarUpload} />
            </label>
          )}
        </div>
        
        <div className="text-center md:text-left flex-1">
          <h1 className="text-3xl font-bold mb-2">{user.user_name}</h1>
          <div className="flex flex-wrap justify-center md:justify-start gap-4 text-sm text-zinc-500">
            <span className="bg-zinc-100 px-2 py-1 rounded font-mono text-xs">ID: {user.id}</span>
            <span className="flex items-center gap-1">
              <Calendar className="w-4 h-4"/> 加入于 {new Date(user.created_at).toLocaleDateString()}
            </span>
            {user.role === 'admin' && (
              <span className="bg-black text-white px-2 py-0.5 text-xs font-bold rounded">管理员</span>
            )}
          </div>
          
          <div className="flex justify-center md:justify-start gap-8 mt-6 pt-6 border-t border-zinc-100">
            <div className="text-center">
              <div className="text-xl font-bold">{posts.length}</div>
              <div className="text-xs text-zinc-400 uppercase tracking-wider">帖子</div>
            </div>
          </div>
        </div>
      </div>

      {/* ... (Tabs 和列表渲染部分保持不变) ... */}
    </div>
  );
}