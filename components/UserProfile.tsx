import React, { useState, useEffect } from 'react';
import { getDB, markNotificationsRead, updateUser } from '../services/storage';
import { UserCircle, Heart, Calendar, MessageCircle, Bell, Bookmark, FileText, ChevronDown, ChevronUp, Camera } from 'lucide-react';

interface UserProfileProps {
  userId: string;
  onNavigateBack: () => void;
  onPostClick: (postId: string) => void;
}

export default function UserProfile({ userId, onNavigateBack, onPostClick }: UserProfileProps) {
  const [db, setDb] = useState(getDB());
  const user = db.users.find(u => u.id === userId);
  
  // Get posts and sort by date descending
  const posts = db.posts
    .filter(p => p.userId === userId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  
  const notifications = (db.notifications || [])
    .filter(n => n.userId === userId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const collections = (db.collections || []).filter(c => c.userId === userId);

  // Check if viewing own profile
  const currentUser = JSON.parse(sessionStorage.getItem('currentUser') || '{}');
  const isOwnProfile = currentUser && currentUser.id === userId;

  const [activeTab, setActiveTab] = useState<'posts' | 'messages' | 'collections'>('posts');
  const [expandedCollection, setExpandedCollection] = useState<string | null>(null);

  useEffect(() => {
    // If viewing own messages, mark as read
    if (isOwnProfile && activeTab === 'messages') {
      markNotificationsRead(userId);
    }
  }, [activeTab, isOwnProfile, userId]);

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0] && isOwnProfile) {
       const file = e.target.files[0];
       if (file.size > 2 * 1024 * 1024) {
         alert('头像大小不能超过2MB');
         return;
       }
       const reader = new FileReader();
       reader.onloadend = () => {
         if (typeof reader.result === 'string') {
           const updated = updateUser(userId, { avatar: reader.result });
           if (updated) {
             // Update local session
             sessionStorage.setItem('currentUser', JSON.stringify(updated));
             setDb(getDB()); // Force re-render
           }
         }
       };
       reader.readAsDataURL(file);
    }
  };

  if (!user) return <div className="p-8 text-center text-zinc-500">用户不存在</div>;

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 animate-in fade-in duration-300">
       <button onClick={onNavigateBack} className="mb-4 text-sm text-zinc-500 hover:text-black flex items-center gap-1">
         ← 返回
       </button>
       
       {/* Header */}
       <div className="bg-white border border-zinc-200 p-6 md:p-8 mb-6 flex flex-col md:flex-row items-center md:items-start gap-6 shadow-sm">
          <div className="relative group">
            <div className="w-24 h-24 bg-zinc-100 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden border-2 border-zinc-100">
              {user.avatar ? (
                <img src={user.avatar} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <UserCircle className="w-16 h-16 text-zinc-300" />
              )}
            </div>
            {isOwnProfile && (
              <label className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity">
                <Camera className="w-6 h-6" />
                <input type="file" className="hidden" accept="image/*" onChange={handleAvatarUpload} />
              </label>
            )}
          </div>
          
          <div className="text-center md:text-left flex-1">
            <h1 className="text-3xl font-bold mb-2">{user.username}</h1>
            <div className="flex flex-wrap justify-center md:justify-start gap-4 text-sm text-zinc-500">
              <span className="bg-zinc-100 px-2 py-1 rounded font-mono">ID: {user.id}</span>
              <span className="flex items-center gap-1">
                <Calendar className="w-4 h-4"/> 加入于 {new Date(user.createdAt).toLocaleDateString()}
              </span>
              {user.role === 'admin' && (
                <span className="bg-black text-white px-2 py-1 text-xs font-bold">管理员</span>
              )}
            </div>
            {/* Stats */}
            <div className="flex justify-center md:justify-start gap-6 mt-6 pt-6 border-t border-zinc-100">
              <div className="text-center">
                <div className="text-xl font-bold">{posts.length}</div>
                <div className="text-xs text-zinc-400 uppercase tracking-wider">帖子</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold">{collections.length}</div>
                <div className="text-xs text-zinc-400 uppercase tracking-wider">收藏夹</div>
              </div>
            </div>
          </div>
       </div>

       {/* Tabs */}
       <div className="flex border-b border-zinc-200 mb-6 bg-white sticky top-14 z-10">
         <button 
           onClick={() => setActiveTab('posts')}
           className={`flex-1 py-3 text-center font-medium text-sm transition-colors relative ${activeTab === 'posts' ? 'text-black' : 'text-zinc-400 hover:text-zinc-600'}`}
         >
           {isOwnProfile ? '我的帖子' : 'Ta的帖子'}
           {activeTab === 'posts' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-black mx-auto w-12"></div>}
         </button>
         
         <button 
            onClick={() => setActiveTab('collections')}
            className={`flex-1 py-3 text-center font-medium text-sm transition-colors relative ${activeTab === 'collections' ? 'text-black' : 'text-zinc-400 hover:text-zinc-600'}`}
         >
           {isOwnProfile ? '我的收藏' : 'Ta的收藏'}
           {activeTab === 'collections' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-black mx-auto w-12"></div>}
         </button>

         {isOwnProfile && (
           <button 
              onClick={() => setActiveTab('messages')}
              className={`flex-1 py-3 text-center font-medium text-sm transition-colors relative ${activeTab === 'messages' ? 'text-black' : 'text-zinc-400 hover:text-zinc-600'}`}
           >
             我的消息
             {notifications.some(n => !n.isRead) && <span className="absolute top-3 ml-1 w-2 h-2 bg-red-500 rounded-full"></span>}
             {activeTab === 'messages' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-black mx-auto w-12"></div>}
           </button>
         )}
       </div>

       {/* Content */}
       <div className="min-h-[300px]">
         {activeTab === 'posts' && (
            <div className="space-y-4">
               {posts.length === 0 ? (
                 <div className="text-center py-12 text-zinc-400 bg-zinc-50 rounded-lg border border-zinc-100 border-dashed">
                   暂无发布内容
                 </div>
               ) : posts.map(post => (
                 <div 
                   key={post.id} 
                   onClick={() => onPostClick(post.id)} 
                   className="bg-white border border-zinc-200 p-4 hover:shadow-md cursor-pointer transition-all group"
                 >
                    <div className="flex justify-between items-start mb-2">
                       <h3 className="font-bold text-lg group-hover:text-blue-900 transition-colors">{post.title}</h3>
                       {post.isEssence && <span className="bg-black text-white px-1.5 text-xs">蒂</span>}
                    </div>
                    <p className="text-zinc-600 text-sm mb-3 line-clamp-2">{post.content}</p>
                    <div className="flex items-center justify-between text-xs text-zinc-400">
                      <span>{new Date(post.createdAt).toLocaleDateString()} · {post.category}</span>
                      <div className="flex gap-3">
                        <span className="flex items-center gap-1"><Heart className="w-3 h-3"/> {post.likes.length}</span>
                      </div>
                    </div>
                 </div>
               ))}
            </div>
         )}

         {activeTab === 'collections' && (
           <div className="space-y-4">
              {collections.length === 0 ? (
                 <div className="text-center py-12 text-zinc-400 bg-zinc-50 rounded-lg border border-zinc-100 border-dashed">
                   暂无收藏夹
                 </div>
              ) : collections.map(col => (
                <div key={col.id} className="bg-white border border-zinc-200 overflow-hidden">
                   <div 
                     className="p-4 flex items-center justify-between cursor-pointer hover:bg-zinc-50"
                     onClick={() => setExpandedCollection(expandedCollection === col.id ? null : col.id)}
                   >
                     <div className="flex items-center gap-3">
                       <Bookmark className="w-5 h-5 text-zinc-800 fill-zinc-100"/> 
                       <span className="font-bold">{col.name}</span>
                       <span className="text-xs text-zinc-400 bg-zinc-100 px-2 py-0.5 rounded-full">{col.postIds.length}</span>
                     </div>
                     {expandedCollection === col.id ? <ChevronUp className="w-4 h-4 text-zinc-400"/> : <ChevronDown className="w-4 h-4 text-zinc-400"/>}
                   </div>
                   
                   {expandedCollection === col.id && (
                     <div className="bg-zinc-50 border-t border-zinc-100 p-4 space-y-2">
                       {col.postIds.length === 0 && <div className="text-xs text-zinc-400 pl-8">收藏夹为空</div>}
                       {col.postIds.map(pid => {
                         const p = db.posts.find(post => post.id === pid);
                         if (!p) return null;
                         return (
                           <div 
                             key={pid} 
                             onClick={(e) => { e.stopPropagation(); onPostClick(pid); }}
                             className="flex items-center gap-2 text-sm pl-8 py-1 hover:text-blue-800 cursor-pointer"
                           >
                             <FileText className="w-3 h-3 text-zinc-400"/>
                             <span className="truncate">{p.title}</span>
                           </div>
                         );
                       })}
                     </div>
                   )}
                </div>
              ))}
           </div>
         )}

         {activeTab === 'messages' && isOwnProfile && (
           <div className="space-y-4">
              {notifications.length === 0 ? (
                 <div className="text-center py-12 text-zinc-400 bg-zinc-50 rounded-lg border border-zinc-100 border-dashed">
                   暂无消息
                 </div>
              ) : notifications.map(notif => (
                <div key={notif.id} className={`bg-white border border-zinc-200 p-4 flex gap-4 ${!notif.isRead ? 'border-l-4 border-l-black' : ''}`}>
                   <div className="mt-1">
                     <Bell className="w-5 h-5 text-zinc-400" />
                   </div>
                   <div className="flex-1">
                     <div className="text-sm mb-1">
                       <span className="font-bold">{notif.fromUsername}</span>
                       <span className="text-zinc-500 mx-1">
                         {notif.type === 'reply' ? '回复了你的评论' : '评论了你的帖子'}
                       </span>
                       <span className="font-medium text-blue-900 cursor-pointer hover:underline" onClick={() => onPostClick(notif.postId)}>
                         《{notif.postTitle}》
                       </span>
                     </div>
                     <p className="bg-zinc-50 p-2 text-sm text-zinc-700 mb-2 rounded border border-zinc-100">
                       "{notif.content}"
                     </p>
                     <div className="text-xs text-zinc-400">
                       {new Date(notif.createdAt).toLocaleString()}
                     </div>
                   </div>
                </div>
              ))}
           </div>
         )}
       </div>
    </div>
  );
}