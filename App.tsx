import { supabase } from './services/supabaseClient';
import React, { useState, useEffect, useRef } from 'react';
import Landing from './components/Landing';
import { User, Post, Category, Collection, Notification, SensitiveWords } from './types';
import { get_all_users, get_user, create_post, get_posts, toggle_like_post, toggle_essence_post, delete_post, vote_poll, add_comment, update_post, getComments, updateUser, getUnreadNotificationCount, create_collection, addToCollection, updatePost, update_comment, toggle_lock_post, delete_comment,check_sensitive_words } from './services/storage';
import AdminPanel from './components/AdminPanel';
import ChangePasswordModal from './components/ChangePasswordModal';
import UserProfile from './components/UserProfile';
import Toast, { ToastType } from './components/Toast';
import CreatePostModal from './components/CreatePostModal';
import { uploadImage } from './services/storageService';  // ✅ 新增这行
import { Search, LogOut, Menu, UserCircle, PenSquare, Heart, MessageCircle, MessageSquare, Trash2, X, Plus, Check, Star, Eye, EyeOff, Image as ImageIcon, Bookmark, Send, Edit2, MoreVertical } from 'lucide-react';
import PostContent from './components/PostContent';



const CATEGORIES: Category[] = ['全部', '推书📖排雷', '讨论👊🏻i女', '求书🔍求作', '自荐🙋🏻分享', '组务❗组规'];

function timeAgo(dateInput: string | Date): string {
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  const now = new Date();
  const diffInSeconds = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 1000));

  if (diffInSeconds < 60) return '刚刚';

  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes}分钟前`;

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}小时前`;

  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 30) return `${diffInDays}天前`;

  const diffInMonths = Math.floor(diffInDays / 30);
  if (diffInMonths < 12) return `${diffInMonths}个月前`;

  return `${Math.floor(diffInMonths / 12)}年前`;
}

// Helper to get avatar safely
const Avatar = ({ url, className = "w-8 h-8" }: { url?: string, className?: string }) => {
  if (url) {
    return <img src={url} alt="用户头像" className={`${className} rounded-full object-cover bg-zinc-100 border border-zinc-100`} />;
  }
  return <UserCircle className={`${className} text-zinc-300`} />;
};


// 主应用组件
export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [view, setView] = useState<'landing' | 'login' | 'feed' | 'admin' | 'post' | 'profile'>('landing');
  const [currentCategory, setCurrentCategory] = useState<Category | '全部'>('全部');
  const [searchQuery, setSearchQuery] = useState('');
  const [onlyEssence, setOnlyEssence] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [targetProfileId, setTargetProfileId] = useState<string | null>(null);
  const [isCreatingPost, setIsCreatingPost] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [usersMap, setUsersMap] = useState<Record<string, User>>({});
  const [displayPosts, setDisplayPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [readPosts, setReadPosts] = useState<Set<string>>(new Set());

  // Toast 状态
  const [toast, setToast] = useState<{ msg: string, type: ToastType } | null>(null);

  // ✅ 修改后的初始化用户登录状态
  useEffect(() => {
    const initAuth = async () => {
      try {
        // 1. 先检查 Supabase Auth Session
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          // 如果没有 session，清除本地缓存
          sessionStorage.removeItem('currentUser');
          return;
        }

        // 2. 如果有 session，获取用户信息
        const freshUser = await get_user(session.user.id);
        
        if (freshUser) {
          // 检查是否被封禁
          if (freshUser.is_banned) {
            sessionStorage.removeItem('currentUser');
            await supabase.auth.signOut();
            setUser(null);
            setView('login');
            setToast({ msg: '账号已被封禁', type: 'error' });
            return;
          }
          
          // 更新本地状态
          setUser(freshUser);
          sessionStorage.setItem('currentUser', JSON.stringify(freshUser));
          setView('feed');
        }
      } catch (err) {
        console.error("获取用户信息失败:", err);
        // 如果获取失败，清除状态
        sessionStorage.removeItem('currentUser');
        await supabase.auth.signOut();
      }
    };

    initAuth();
  }, []);

  // 加载帖子列表
// 加载帖子列表
useEffect(() => {
  const loadPosts = async () => {
    setIsLoading(true);
    try {
      const data = await get_posts(currentCategory, onlyEssence ? 'essence' : 'new');
      
      // ✅ 按最后评论时间排序(有评论的帖子自动顶上来)
      const sortedData = (data || []).sort((a, b) => {
        const timeA = new Date(a.last_comment_at || a.created_at).getTime();
        const timeB = new Date(b.last_comment_at || b.created_at).getTime();
        return timeB - timeA; // 降序排列
      });
      
      setDisplayPosts(sortedData);
    } catch (err) {
      console.error("加载帖子失败:", err);
      showToast("加载帖子失败", "error");
    } finally {
      setIsLoading(false);
    }
  };

  loadPosts();
}, [currentCategory, onlyEssence, refreshKey]);

  // 加载用户映射
  useEffect(() => {
    if (!user) return;

    const refreshData = async () => {
      try {
        const usersList = await get_all_users();
        const map: Record<string, User> = {};
        usersList.forEach(u => map[u.id] = u);
        setUsersMap(map);
      } catch (err) {
        console.error("加载用户列表失败:", err);
      }
    };

    refreshData();
  }, [user]);
  
  // 加载已读记录
  useEffect(() => {
    const loadReadPosts = async () => {
      if (!user) return;
      
      try {
        const result = await window.storage.get(`read_posts_${user.id}`);
        if (result?.value) {
          const readPostIds = JSON.parse(result.value);
          setReadPosts(new Set(readPostIds));
        }
      } catch (err) {
        console.log('未找到已读记录,使用空集合');
        setReadPosts(new Set());
      }
    };

    loadReadPosts();
  }, [user]);

  // ✅ 第2段新增代码:监听已读事件 (就是你问的这段!)
  useEffect(() => {
    const handlePostRead = (e: CustomEvent) => {
      const { postId } = e.detail;
      setReadPosts(prev => new Set([...prev, postId]));
    };

    window.addEventListener('post-read', handlePostRead as EventListener);
    return () => {
      window.removeEventListener('post-read', handlePostRead as EventListener);
    };
  }, []);


  
  const showToast = (msg: string, type: ToastType) => {
    setToast({ msg, type });
  };

  const handleLogin = (u: User) => {
    if (u.is_first_login) {
      setUser(u);
    } else {
      setUser(u);
      sessionStorage.setItem('currentUser', JSON.stringify(u));
      setView('feed');
    }
  };

  const handleUpdateProfile = (u: User) => {
    setUser(u);
    sessionStorage.setItem('currentUser', JSON.stringify(u));
    setView('feed');
  };

  // ✅ 修改后的退出登录函数
  const handleLogout = async () => {
    try {
      // 1. 调用 Supabase Auth 退出登录
      await supabase.auth.signOut();
      console.log('✅ Supabase Auth 已退出');
    } catch (error) {
      console.error('退出登录时出错:', error);
    } finally {
      // 2. 清除本地状态
      setUser(null);
      sessionStorage.removeItem('currentUser');
      setView('landing');
    }
  };

  const handleViewProfile = (userId: string) => {
    setTargetProfileId(userId);
    setView('profile');
    setSelectedPostId(null);
  };

  const refreshData = () => {
    setRefreshKey(prev => prev + 1);
  };

  // 首次登录修改密码
  if (user && user.is_first_login) {
    return <ChangePasswordModal user={user} onComplete={handleUpdateProfile} />;
  }

  if (view === 'landing') {
    return <Landing onLoginClick={() => setView('login')} />;
  }

  if (view === 'login') {
    return <Login onLogin={handleLogin} />;
  }

  const isAdminOrInver = user ? ['admin', 'i女er'].includes(user.role) : false;
  
  
  const getPostPreview = (content: string) => {
    try {
      const blocks = JSON.parse(content);
      if (Array.isArray(blocks)) {
        return blocks
          .filter(b => b.type === 'text')
          .map(b => b.value)
          .join(' ')  // 用空格连接多个文本块
          .slice(0, 100);
      }
    } catch {}
    return content.slice(0, 100);
  };


  
  return (
    <div className="min-h-screen bg-white text-zinc-900">
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      {/* 导航栏 */}
      <nav className="border-b border-zinc-200 sticky top-0 bg-white z-40">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <h1 className="font-bold text-lg cursor-pointer truncate" onClick={() => { setView('feed'); setSelectedPostId(null); }}>
              女主无cp/无男主小说交流中心
            </h1>
            <div className="hidden md:flex gap-1">
              {CATEGORIES.map(c => (
                <button
                  key={c}
                  onClick={() => { setCurrentCategory(c); setView('feed'); setSelectedPostId(null); }}
                  className={`px-3 py-1 text-sm rounded-full transition-colors ${currentCategory === c ? 'bg-black text-white' : 'text-zinc-600 hover:bg-zinc-100'}`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative hidden sm:block">
              <input
                type="text"
                placeholder="搜索帖子..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-8 pr-4 py-1.5 bg-zinc-100 rounded-full text-sm w-48 focus:w-64 transition-all outline-none"
                aria-label="搜索帖子"
              />
              <Search className="w-4 h-4 absolute left-2.5 top-2 text-zinc-400" />
            </div>

            <div className="flex items-center gap-2 border-l pl-4 border-zinc-200">
              <div onClick={() => handleViewProfile(user!.id)} className="flex items-center gap-2 cursor-pointer hover:bg-zinc-50 p-1 rounded-full transition-colors">
                <div className="relative">
                  <Avatar url={user?.avatar} className="w-6 h-6" />
                  {unreadCount > 0 && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border border-white"></span>}
                </div>
                <span className="text-sm font-bold hidden sm:block">{user?.user_name}</span>
              </div>

              {isAdminOrInver && (
                <button onClick={() => setView('admin')} className="p-2 hover:bg-zinc-100 rounded-full" title="管理后台" aria-label="管理后台">
                  <Menu className="w-5 h-5" />
                </button>
              )}
              <button onClick={handleLogout} className="p-2 hover:bg-zinc-100 rounded-full" title="退出" aria-label="退出登录">
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* 移动端分类导航 */}
      <div className="md:hidden sticky top-14 bg-white z-30 border-b border-zinc-200 overflow-x-auto scrollbar-hide">
        <div className="flex px-4 py-2 gap-2 min-w-max">
          {CATEGORIES.map(c => (
            <button
              key={c}
              onClick={() => { setCurrentCategory(c); setView('feed'); setSelectedPostId(null); }}
              className={`px-3 py-1.5 text-sm rounded-full whitespace-nowrap transition-colors ${currentCategory === c ? 'bg-black text-white' : 'bg-zinc-100 text-zinc-600'}`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* 主内容区 */}
      <main className="max-w-5xl mx-auto min-h-[calc(100vh-3.5rem)]">
        {view === 'admin' && <AdminPanel />}
        {view === 'profile' && targetProfileId && (
          <UserProfile 
            userId={targetProfileId} 
            onNavigateBack={() => setView('feed')} 
            onPostClick={(id) => { setSelectedPostId(id); setView('post'); }}
          />
        )}
        
        {(view === 'feed' || view === 'post') && (
          <div className="flex flex-col md:flex-row gap-6 p-4">
            <div className="flex-1">
              {view === 'post' && selectedPostId ? (
                <PostDetail 
                  postId={selectedPostId} 
                  user={user!}
                  usersMap={usersMap}
                  onBack={() => { setSelectedPostId(null); setView('feed'); }}
                  onViewProfile={handleViewProfile}
                  onDelete={() => { setSelectedPostId(null); setView('feed'); refreshData(); }}
                  showToast={showToast}
                />
              ) : (
                <div className="space-y-4">
                  {/* 筛选栏 */}
                  <div className="flex justify-between items-center pb-2 border-b border-zinc-100">
                    <div className="flex gap-4 text-sm">
                      <label className="flex items-center gap-1 cursor-pointer select-none">
                        <input type="checkbox" checked={onlyEssence} onChange={e => setOnlyEssence(e.target.checked)} className="accent-black" />
                         <span className="bg-black text-white text-[10px] px-1">蒂</span>
                      </label>
                    </div>
                    <button 
                      onClick={() => setIsCreatingPost(true)}
                      className="bg-black text-white px-4 py-2 text-sm font-medium flex items-center gap-2 hover:bg-zinc-800 transition-shadow shadow-md"
                      aria-label="发帖"
                    >
                      <PenSquare className="w-4 h-4" /> 发帖
                    </button>
                  </div>

                  
                 {/* 帖子列表 */}
                  <div className="space-y-0 divide-y divide-zinc-100">
                    {isLoading ? (
                      <div className="py-20 text-center text-zinc-400">正在加载内容...</div>
                    ) : (
                      <>
                        {(displayPosts || []).length > 0 ? (
                          displayPosts
                            .filter(p => (p.title || '').includes(searchQuery) || (p.content || '').includes(searchQuery))
                            .map(post => {
                              const isRead = readPosts.has(post.id);
                              
                              return (
                                      <div 
                                        key={post.id} 
                                        onClick={() => { setSelectedPostId(post.id); setView('post'); }}
                                        className={`py-4 cursor-pointer group transition-colors px-2
                                        ${isRead ? 'opacity-50' : 'hover:bg-zinc-50'}
                                        `}
                                       >

                                  <div className="flex items-start gap-3">
                                    <div className="flex-shrink-0 pt-1" onClick={(e) => { e.stopPropagation(); handleViewProfile(post.user_id); }}>
                                      <Avatar url={usersMap[post.user_id]?.avatar} className="w-10 h-10" />
                                    </div>
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2 mb-1">
                                        {post.is_essence && <span className="bg-black text-white px-1 text-xs" title="精华帖">荐</span>}
                                        {isRead && <span className="text-xs text-zinc-400">[已读]</span>}
                                    <h3
                                       className={`font-medium text-base transition-colors line-clamp-1
                                       ${isRead ? 'text-zinc-500' : 'group-hover:text-blue-800'}
                                        `}
                                    >
                                     {post.title}
                                    </h3>

                                      </div>
                                      <p className={`text-sm line-clamp-2 mb-2 ${
                                        isRead ? 'text-zinc-400' : 'text-zinc-500'
                                      }`}>
                                        {getPostPreview(post.content)}...
                                      </p>
                                      <div className="text-xs text-zinc-400 flex gap-3">
                                        <span>{post.category}</span>
                                        <span>•</span>
                                        <span className="hover:text-black hover:underline">{usersMap[post.user_id]?.user_name || '未知用户'}</span>
                                        <span>•</span>
                                        <span>{timeAgo(post.created_at)}</span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                               );
                              })
                        ) : (
                          <div className="py-20 text-center text-zinc-400 text-sm">暂无内容</div>
                        )}
                      </>
                    )}
                  </div>
                </div>  
              )} 
            </div>  
          </div>  
        )}

        {isCreatingPost && (
          <CreatePostModal 
            user={user!} 
            onClose={() => setIsCreatingPost(false)} 
            onSuccess={() => { setIsCreatingPost(false); refreshData(); }}
            showToast={showToast}
          />
        )}
      </main>
    </div>
  );
}
