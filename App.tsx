import { supabase } from './services/supabaseClient';
import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useParams } from 'react-router-dom';
import Landing from './components/Landing';
import { User, Post, Category } from './types';
import { get_all_users, get_user, get_posts } from './services/storage';
import AdminPanel from './components/AdminPanel';
import UserProfile from './components/UserProfile';
import Toast, { ToastType } from './components/Toast';
import CreatePostModal from './components/CreatePostModal';
import { Search, LogOut, Menu, UserCircle, PenSquare } from 'lucide-react';
import PostDetail from './PostDetailPage';
import Login from './LoginPage';

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

const Avatar = ({ url, className = "w-8 h-8" }: { url?: string, className?: string }) => {
  if (url) {
    return <img src={url} alt="用户头像" className={`${className} rounded-full object-cover bg-zinc-100 border border-zinc-100`} />;
  }
  return <UserCircle className={`${className} text-zinc-300`} />;
};

const getPostPreview = (content: string) => {
  try {
    const blocks = JSON.parse(content);
    const textBlock = blocks.find((b: any) => b.type === 'text');
    return textBlock?.content?.substring(0, 100) || '';
  } catch {
    return content.substring(0, 100);
  }
};

// 主应用内容组件
function AppContent() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [currentCategory, setCurrentCategory] = useState<Category | '全部'>('全部');
  const [searchQuery, setSearchQuery] = useState('');
  const [onlyEssence, setOnlyEssence] = useState(false);
  const [isCreatingPost, setIsCreatingPost] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [usersMap, setUsersMap] = useState<Record<string, User>>({});
  const [displayPosts, setDisplayPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [readPosts, setReadPosts] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<{ msg: string, type: ToastType } | null>(null);

  // 初始化用户登录状态
  useEffect(() => {
    const initAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          sessionStorage.removeItem('currentUser');
          return;
        }

        const freshUser = await get_user(session.user.id);
        
        if (freshUser) {
          if (freshUser.is_banned) {
            sessionStorage.removeItem('currentUser');
            await supabase.auth.signOut();
            setUser(null);
            navigate('/login');
            setToast({ msg: '账号已被封禁', type: 'error' });
            return;
          }
          
          setUser(freshUser);
          sessionStorage.setItem('currentUser', JSON.stringify(freshUser));
        }
      } catch (err) {
        console.error("获取用户信息失败:", err);
        sessionStorage.removeItem('currentUser');
        await supabase.auth.signOut();
      }
    };

    initAuth();
  }, [navigate]);

  // 加载帖子列表
  useEffect(() => {
    const loadPosts = async () => {
      setIsLoading(true);
      try {
        const data = await get_posts(currentCategory, onlyEssence ? 'essence' : 'new');
        const sortedData = (data || []).sort((a, b) => {
          const timeA = new Date(a.last_comment_at || a.created_at).getTime();
          const timeB = new Date(b.last_comment_at || b.created_at).getTime();
          return timeB - timeA;
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

  // 监听已读事件
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
    setUser(u);
    sessionStorage.setItem('currentUser', JSON.stringify(u));
    navigate('/');
  };

  const handleViewProfile = (uid: string) => {
    navigate(`/profile/${uid}`);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    sessionStorage.removeItem('currentUser');
    setUser(null);
    navigate('/login');
  };

  const refreshData = () => {
    setRefreshKey(prev => prev + 1);
  };

  const isAdminOrInver = user?.role === 'admin' || user?.role === 'inver';

  // UserProfile 路由包装器
  const UserProfileWrapper = () => {
    const { userId } = useParams<{ userId: string }>();
    return (
      <UserProfile 
        userId={userId!}
        onNavigateBack={() => navigate('/')}
        onPostClick={(id) => navigate(`/post/${id}`)}
      />
    );
  };

  // PostDetail 路由包装器
  const PostDetailWrapper = () => {
    const { postId } = useParams<{ postId: string }>();
    return (
      <PostDetail 
        postId={postId!}
        user={user!}
        usersMap={usersMap}
        onBack={() => navigate('/')}
        onViewProfile={handleViewProfile}
        onDelete={() => {
          navigate('/');
          refreshData();
        }}
        showToast={showToast}
      />
    );
  };

  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-white">
      {toast && <Toast message={toast.msg} type={toast.type} />}

      {/* 导航栏 */}
      <nav className="border-b border-zinc-200 sticky top-0 bg-white z-40">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <h1 className="font-bold text-lg cursor-pointer truncate" onClick={() => navigate('/')}>
              女主无cp/无男主小说交流中心
            </h1>
            <div className="hidden md:flex gap-1">
              {CATEGORIES.map(c => (
                <button
                  key={c}
                  onClick={() => {
                    setCurrentCategory(c);
                    navigate('/');
                  }}
                  className={`px-3 py-1 text-sm rounded-full transition-colors ${
                    currentCategory === c ? 'bg-black text-white' : 'text-zinc-600 hover:bg-zinc-100'
                  }`}
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
              <div onClick={() => handleViewProfile(user.id)} className="flex items-center gap-2 cursor-pointer hover:bg-zinc-50 p-1 rounded-full transition-colors">
                <div className="relative">
                  <Avatar url={user?.avatar} className="w-6 h-6" />
                  {unreadCount > 0 && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border border-white"></span>}
                </div>
                <span className="text-sm font-bold hidden sm:block">{user?.user_name}</span>
              </div>

              {isAdminOrInver && (
                <button onClick={() => navigate('/admin')} className="p-2 hover:bg-zinc-100 rounded-full" title="管理后台" aria-label="管理后台">
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
              onClick={() => {
                setCurrentCategory(c);
                navigate('/');
              }}
              className={`px-3 py-1.5 text-sm rounded-full whitespace-nowrap transition-colors ${
                currentCategory === c ? 'bg-black text-white' : 'bg-zinc-100 text-zinc-600'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* 主内容区 - 使用路由 */}
      <main className="max-w-5xl mx-auto min-h-[calc(100vh-3.5rem)]">
        <Routes>
          {/* 首页 - 帖子列表 */}
          <Route path="/" element={
            <div className="flex flex-col md:flex-row gap-6 p-4">
              <div className="flex-1">
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
                                  onClick={() => navigate(`/post/${post.id}`)}
                                  className={`py-4 cursor-pointer group transition-colors px-2 ${
                                    isRead ? 'opacity-50' : 'hover:bg-zinc-50'
                                  }`}
                                >
                                  <div className="flex items-start gap-3">
                                    <div className="flex-shrink-0 pt-1" onClick={(e) => { e.stopPropagation(); handleViewProfile(post.user_id); }}>
                                      <Avatar url={usersMap[post.user_id]?.avatar} className="w-10 h-10" />
                                    </div>
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2 mb-1">
                                        {post.is_essence && <span className="bg-black text-white px-1 text-xs" title="精华帖">荐</span>}
                                        {isRead && <span className="text-xs text-zinc-400">[已读]</span>}
                                        <h3 className={`font-medium text-base transition-colors line-clamp-1 ${
                                          isRead ? 'text-zinc-500' : 'group-hover:text-blue-800'
                                        }`}>
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
              </div>
            </div>
          } />

          {/* 帖子详情页 */}
          <Route path="/post/:postId" element={<PostDetailWrapper />} />

          {/* 用户资料页 */}
          <Route path="/profile/:userId" element={<UserProfileWrapper />} />

          {/* 管理后台 */}
          <Route path="/admin" element={<AdminPanel />} />
        </Routes>

        {isCreatingPost && (
          <CreatePostModal 
            user={user}
            onClose={() => setIsCreatingPost(false)} 
            onSuccess={() => {
              setIsCreatingPost(false);
              refreshData();
            }}
            showToast={showToast}
          />
        )}
      </main>
    </div>
  );
}

// 主应用组件 - 包装 BrowserRouter
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login onLogin={() => {}} />} />
        <Route path="/*" element={<AppContent />} />
      </Routes>
    </BrowserRouter>
  );
}
