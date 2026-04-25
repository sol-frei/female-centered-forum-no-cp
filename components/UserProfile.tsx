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
  onRead?: () => void;
}

const LoadingSpinner = () => (
  <div className="py-20 flex items-center justify-center bg-white">
    <div className="w-6 h-6 border-2 border-zinc-200 border-t-zinc-800 rounded-full animate-spin"></div>
  </div>
);

export default function UserProfile({ userId, onNavigateBack, onPostClick, onRead }: UserProfileProps) {
  const [user, setUser] = useState<any>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [activeTab, setActiveTab] = useState<'posts' | 'messages' | 'collections'>('posts');
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isOwnProfile, setIsOwnProfile] = useState(false);

  const [isEditingName, setIsEditingName] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [savingName, setSavingName] = useState(false);

  useEffect(() => {
    return () => {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session && session.user.id === userId) {
          markAllNotificationsAsRead(userId).catch(() => {});
          onRead?.();
        }
      });
    };
  }, [userId]);

  useEffect(() => {
    setUser(null);
    setPosts([]);
    setUnreadCount(0);
    setIsOwnProfile(false);
    setIsEditingName(false);
    loadProfile();
  }, [userId]);

  const loadProfile = async () => {
    setLoading(true);
    try {
      const [userData, { data: { session } }, userPosts] = await Promise.all([
        get_user(userId),
        supabase.auth.getSession(),
        get_posts_by_user(userId),
      ]);

      setUser(userData);
      setNewUserName(userData?.user_name || '');
      setPosts(userPosts);

      if (session) {
        setCurrentUser(session.user);
        const ownProfile = session.user.id === userId;
        setIsOwnProfile(ownProfile);

        if (ownProfile) {
          const count = await getUnreadNotificationCount(userId);
          setUnreadCount(count);
          setActiveTab(count > 0 ? 'messages' : 'posts');
        } else {
          setActiveTab('posts');
        }
      }
    } catch (err) {
      console.error('loadProfile 出错:', err);
    } finally {
      setLoading(false);
    }
  };

  const compressImage = (file: File, maxSize = 400, quality = 0.85): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        let { width, height } = img;
        if (width > height) {
          if (width > maxSize) { height = height * maxSize / width; width = maxSize; }
        } else {
          if (height > maxSize) { width = width * maxSize / height; height = maxSize; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d')!.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => blob ? resolve(blob) : reject(new Error('压缩失败')),
          'image/webp',
          quality
        );
      };
      img.onerror = reject;
      img.src = url;
    });
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);
    try {
      const compressed = await compressImage(file, 400, 0.85);
      const compressedFile = new File([compressed], 'avatar.webp', { type: 'image/webp' });
      const url = await uploadImage(compressedFile, 'user_images', 'avatars');
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

  if (loading) return <LoadingSpinner />;
  if (!user) return <div className="p-20 text-center text-zinc-400">用户不存在</div>;

  return (
    <div className="max-w-4xl mx-auto pb-20">

      <div className="sticky top-0 z-40 w-full bg-white/80 backdrop-blur-md border-b border-zinc-100 px-4 py-3 flex items-center justify-between">
        <button onClick={onNavigateBack} className="text-zinc-600 hover:text-black font-medium flex items-center gap-2">
          <ArrowLeft className="w-5 h-5" /> <span className="text-base">返回</span>
        </button>
      </div>

      <div className="px-4 pt-6">
        <div className="flex flex-col md:flex-row items-center gap-6 bg-white border border-zinc-200 p-6 rounded-2xl">
          <div className="relative group">
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
            <div className="text-zinc-500 flex items-center justify-center md:justify-start gap-2 text-sm">
              <Calendar className="w-4 h-4" />
              <span>{new Date(user.created_at).toLocaleDateString()} 加入</span>
            </div>
          </div>
        </div>

        <div className="mt-6">
          <div className="flex border-b border-zinc-200">
            {isOwnProfile && (
              <button
                onClick={() => setActiveTab('messages')}
                className={`px-6 py-3 text-base font-medium transition-colors border-b-2 flex items-center gap-2 ${activeTab === 'messages' ? 'border-black text-black' : 'border-transparent text-zinc-500 hover:text-black'}`}
              >
                <Bell className="w-5 h-5" />
                消息
                {unreadCount > 0 && (
                  <span className="bg-red-500 text-white text-xs font-bold rounded-full px-1.5 py-0.5 leading-none">
                    {unreadCount}
                  </span>
                )}
              </button>
            )}
            <button
              onClick={() => setActiveTab('posts')}
              className={`px-6 py-3 text-base font-medium transition-colors border-b-2 ${activeTab === 'posts' ? 'border-black text-black' : 'border-transparent text-zinc-500 hover:text-black'}`}
            >
              发布 ({posts.length})
            </button>
            {isOwnProfile && (
              <button
                onClick={() => setActiveTab('collections')}
                className={`px-6 py-3 text-base font-medium transition-colors border-b-2 ${activeTab === 'collections' ? 'border-black text-black' : 'border-transparent text-zinc-500 hover:text-black'}`}
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
              <div>
                {posts.length === 0 ? (
                  <div className="text-center py-16 text-zinc-400 text-base">尚未发布过帖子</div>
                ) : (
                  posts.map(post => (
                    // ✅ 边框和圆角
                  <div key={post.id} onClick={() => onPostClick(post.id)} className="p-4 bg-white border border-zinc-200 rounded-xl cursor-pointer hover:border-zinc-400 transition-all">
                    <h3 className="font-bold mb-1 line-clamp-1 text-base">{post.title}</h3>
                    <p className="text-sm text-zinc-400">{new Date(post.created_at).toLocaleString()}</p>
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
    </div>
  );
}
