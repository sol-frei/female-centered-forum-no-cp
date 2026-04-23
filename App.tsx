import { supabase } from './services/supabaseClient';
import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, useSearchParams, useLocation, useParams } from 'react-router-dom';

// 导入组件
import Bookshelf from './components/Bookshelf';
import Landing from './components/Landing';
import PostDetailPage from './pages/PostDetailPage';
import LoginPage from './pages/LoginPage';
import AdminPanel from './components/AdminPanel';
import UserProfile from './components/UserProfile';
import Toast, { ToastType } from './components/Toast';
import CreatePostModal from './components/CreatePostModal';
import ChangePasswordModal from './components/ChangePasswordModal';

// 导入类型与工具
import { User, Post, Category } from './types';
import { get_all_users, get_user, get_posts, getUnreadNotificationCount } from './services/storage';
import { 
  Search, LogOut, Menu, UserCircle, 
  PenSquare, X, Shield, BookOpen 
} from 'lucide-react';

const CATEGORIES: Category[] = ['全部', '推书📖排雷', '讨论👊🏻i女', '求书🔍求作', '自荐🙋🏻分享', '组务❗组规'];

const LoadingSpinner = ({ fullScreen = false }: { fullScreen?: boolean }) => (
  <div className={fullScreen ? "min-h-screen flex items-center justify-center bg-white" : "py-20 flex items-center justify-center bg-white"}>
    <div className="w-6 h-6 border-2 border-zinc-200 border-t-zinc-800 rounded-full animate-spin"></div>
  </div>
);

// 取帖子的最后活跃时间：优先用 last_comment_at，没有则用 created_at
function getPostActiveTime(post: Post): Date {
  const t = (post as any).last_comment_at;
  if (t) return new Date(t);
  return new Date(post.created_at);
}

// 按最后活跃时间降序排序（顶帖逻辑）
function sortByActivity(posts: Post[]): Post[] {
  return [...posts].sort((a, b) => getPostActiveTime(b).getTime() - getPostActiveTime(a).getTime());
}

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
  return `${Math.floor(diffInDays / 30)}个月前`;
}

const Avatar = ({ url, className = "w-8 h-8" }: { url?: string, className?: string }) => {
  if (url) return <img src={url} alt="头像" className={`${className} rounded-full object-cover`} style={{ border: '1px solid #f4f4f5' }} />;
  return <UserCircle className={`${className} text-zinc-300`} />;
};

export default function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

function AppContent() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  
  const [user, setUser] = useState<User | null>(null);
  const [isAuthChecking, setIsAuthChecking] = useState(true); 
  const [currentCategory, setCurrentCategory] = useState<Category | '全部'>((searchParams.get('cat') as Category) || '全部');
  const [onlyEssence, setOnlyEssence] = useState(false);
  const [isCreatingPost, setIsCreatingPost] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [usersMap, setUsersMap] = useState<Record<string, User>>({});
  const [displayPosts, setDisplayPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(false); 
  const [toast, setToast] = useState<{ msg: string, type: ToastType } | null>(null);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [unreadCount, setUnreadCount] = useState(0);

  const touchStartX = useRef<number | null>(null);
  const showToast = (msg: string, type: ToastType) => setToast({ msg, type });

  const loadUnreadCount = async () => {
    if (user) {
      const count = await getUnreadNotificationCount(user.id);
      setUnreadCount(count);
    }
  };

  useEffect(() => {
    if (!user) return;

    loadUnreadCount();

    const channel = supabase
      .channel(`notifications_badge_${user.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${user.id}`
      }, () => {
        loadUnreadCount();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  useEffect(() => {
    const handlePopState = () => {
      if (searchQuery) setSearchQuery('');
      if (showMobileMenu) setShowMobileMenu(false);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [searchQuery, showMobileMenu]);

  const handleSearchChange = (val: string) => {
    if (!searchQuery && val) {
      window.history.pushState({ searching: true }, '');
    }
    setSearchQuery(val);
  };

  useEffect(() => {
    const initAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          const freshUser = await get_user(session.user.id);
          if (freshUser) {
            if (freshUser.is_banned) {
              await supabase.auth.signOut();
              showToast('账号已被封禁', 'error');
            } else {
              setUser(freshUser);
            }
          }
        }
      } finally {
        setIsAuthChecking(false);
      }
    };
    initAuth();
  }, []);

  useEffect(() => {
    if (isAuthChecking) return; 
    const loadPosts = async () => {
      setIsLoading(true);
      const data = await get_posts(currentCategory, onlyEssence ? 'essence' : 'new');
      setDisplayPosts(sortByActivity(data || []));
      setIsLoading(false);
    };
    loadPosts();
  }, [currentCategory, onlyEssence, refreshKey, isAuthChecking]);

  useEffect(() => {
    if (isAuthChecking) return;

    const postsSubscription = supabase
      .channel('public:posts_list_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          const newPost = payload.new as Post;
          if (currentCategory === '全部' || newPost.category === currentCategory) {
            setDisplayPosts(prev => [newPost, ...prev]);
          }
        } else if (payload.eventType === 'UPDATE') {
          const updatedPost = payload.new as Post;
          setDisplayPosts(prev => sortByActivity(prev.map(p => p.id === updatedPost.id ? updatedPost : p)));
        } else if (payload.eventType === 'DELETE') {
          setDisplayPosts(prev => prev.filter(p => p.id !== payload.old.id));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(postsSubscription);
    };
  }, [currentCategory, isAuthChecking]);

  useEffect(() => {
    if (!user) return;
    get_all_users().then(list => {
      const map: Record<string, User> = {};
      list.forEach(u => map[u.id] = u);
      setUsersMap(map);
    });
  }, [user]);

  const handleLogout = async () => {
    setShowMobileMenu(false);
    await supabase.auth.signOut();
    setUser(null);
    setUnreadCount(0);
  };

  const filteredPosts = searchQuery
    ? displayPosts.filter(p =>
        p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (typeof p.content === 'string' && p.content.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : displayPosts;

  const getPostPreview = (content: any) => {
    if (!content) return '';
    if (Array.isArray(content)) {
      return content
        .filter((b: any) => b.type === 'text')
        .map((b: any) => b.value)
        .join(' ');
    }
    if (typeof content === 'string') {
      try {
        const blocks = JSON.parse(content);
        if (Array.isArray(blocks)) {
          return blocks
            .filter((b: any) => b.type === 'text')
            .map((b: any) => b.value)
            .join(' ');
        }
        return content;
      } catch {
        return content;
      }
    }
    return '';
  };

  const handleTouchStart = (e: React.TouchEvent) => touchStartX.current = e.touches[0].clientX;
  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartX.current) return;
    const diff = e.touches[0].clientX - touchStartX.current;
    if (diff < -50) setShowMobileMenu(false);
  };

  if (isAuthChecking) return <LoadingSpinner fullScreen />;

  if (user && user.is_first_login) {
    return <ChangePasswordModal user={user} onComplete={(u) => { setUser(u); navigate('/feed', { replace: true }); }} />;
  }

  const UserProfileWrapper = () => {
    const { userId } = useParams<{ userId: string }>();
    if (!userId) return <Navigate to="/feed" replace />;
    return (
      <UserProfile 
        userId={userId}
        onNavigateBack={() => navigate(-1)} 
        onPostClick={(id: string) => navigate(`/post/${id}`)} 
      />
    );
  };

  const isLoginPage = location.pathname === '/login' || location.pathname === '/';
  const hideNavPages = location.pathname.startsWith('/post/') || 
                       location.pathname.startsWith('/profile/') || 
                       location.pathname === '/admin' ||
                       location.pathname === '/bookshelf';

  return (
    <div className="min-h-screen bg-white text-zinc-900">
      <div className="fixed inset-0 z-[999] pointer-events-none">
        {toast && (
          <div className="pointer-events-auto">
            <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} duration={2000} />
          </div>
        )}
      </div>

      {/* 侧边栏 */}
      {showMobileMenu && (
        <div className="fixed inset-0 z-[100] md:hidden">
          <div className="fixed inset-0 bg-black/50" onClick={() => setShowMobileMenu(false)} />
          <div 
            className="relative w-72 bg-white h-full shadow-xl flex flex-col p-4"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={() => touchStartX.current = null}
          >
            <div className="flex justify-between items-center mb-6">
              <span className="font-bold text-lg">板块选择</span>
              <button onClick={() => setShowMobileMenu(false)} className="p-1"><X className="w-6 h-6" /></button>
            </div>
            <div className="flex flex-col gap-2">
              {CATEGORIES.map(c => (
                <button key={c} onClick={() => { setCurrentCategory(c); setShowMobileMenu(false); navigate('/feed'); }}
                  className={`px-4 py-3 text-left text-base rounded-lg ${currentCategory === c ? 'bg-black text-white' : 'hover:bg-zinc-100'}`}>
                  {c}
                </button>
              ))}
              <hr className="my-4 border-zinc-100" />
              {user?.role === 'admin' && (
                <button onClick={() => { navigate('/admin'); setShowMobileMenu(false); }} className="flex items-center gap-2 px-4 py-3 text-sm hover:bg-zinc-100 rounded-lg">
                  <Shield className="w-4 h-4" /> 管理后台
                </button>
              )}
              <button onClick={handleLogout} className="flex items-center gap-2 px-4 py-4 text-sm text-red-600 bg-red-50 rounded-xl mt-4 font-medium">
                <LogOut className="w-4 h-4" /> 退出登录
              </button>
            </div>
          </div>
        </div>
      )}

      {user && !isLoginPage && !hideNavPages && (
        <>
          <nav className="sticky top-0 bg-white z-40" style={{ borderBottom: '1px solid #e4e4e7' }}>
            <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between gap-2 md:gap-4">
            
            <div className="flex items-center gap-2 flex-shrink-0 min-w-0">
              <button onClick={() => setShowMobileMenu(true)} className="md:hidden p-1.5 hover:bg-zinc-100 rounded-full"><Menu className="w-5 h-5" /></button>
              <h1 className="font-bold text-base md:text-lg cursor-pointer truncate hidden sm:block" onClick={() => navigate('/feed')}>
                女主无cp/无男主小说交流中心
              </h1>
            </div>

            <div className="flex-1 max-w-xs relative group mx-2 sm:mx-0">
              <Search className="absolute left-3 w-4 h-4 text-zinc-400 group-focus-within:text-black" style={{ top: '50%', transform: 'translateY(-50%)', marginTop: '0' }} />
              <input 
                type="text" 
                placeholder="搜索帖子..." 
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="w-full rounded-full py-1.5 pl-9 pr-4 text-sm focus:ring-1 focus:ring-black transition-all outline-none"
                style={{ backgroundColor: '#f4f4f5', border: 'none' }}
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 hover:bg-zinc-200 rounded-full">
                  <X className="w-3 h-3 text-zinc-500" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-1 md:gap-2 flex-shrink-0">
              <button onClick={() => navigate('/bookshelf')} className="p-2 hover:bg-zinc-100 rounded-full transition-colors">
                <BookOpen className="w-5 h-5 text-zinc-600" />
              </button>
              {user.role === 'admin' && (
                <button onClick={() => navigate('/admin')} className="hidden md:flex p-2 hover:bg-zinc-100 rounded-full transition-colors" title="管理后台">
                  <Shield className="w-5 h-5 text-zinc-600" />
                </button>
              )}
              <button onClick={() => navigate(`/profile/${user.id}`)} className="p-1.5 md:p-2 hover:bg-zinc-100 rounded-full transition-colors relative">
                <Avatar url={user.avatar} className="w-6 h-6" />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-red-500 rounded-full border-2 border-white"></span>
                )}
              </button>
              <button onClick={handleLogout} className="hidden md:block p-2 hover:bg-zinc-100 rounded-full transition-colors"><LogOut className="w-5 h-5 text-zinc-500" /></button>
            </div>
          </div>
          </nav>
          <div className="hidden md:flex sticky top-14 bg-white z-30 border-b border-zinc-100">
            <div className="max-w-5xl mx-auto px-4 w-full flex gap-1 py-2 overflow-x-auto">
              {CATEGORIES.map(c => (
                <button
                  key={c}
                  onClick={() => { setCurrentCategory(c); navigate('/feed'); }}
                  className={`px-3 py-1.5 text-sm rounded-full whitespace-nowrap transition-colors ${
                    currentCategory === c
                      ? 'bg-black text-white font-medium'
                      : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      <main className="max-w-5xl mx-auto">
        <Routes>
          <Route path="/" element={user ? <Navigate to="/feed" replace /> : <Landing onLoginClick={() => navigate('/login')} />} />
          <Route path="/login" element={user ? <Navigate to="/feed" replace /> : <LoginPage onLogin={(u) => { setUser(u); navigate('/feed', { replace: true }); }} />} />
          <Route path="/feed" element={
            user ? (
              <div className="p-4">
                <div className="flex justify-between items-center mb-4 pb-2">
                  <button onClick={() => setOnlyEssence(!onlyEssence)} className={`px-2 py-1 text-sm font-bold rounded ${onlyEssence ? 'bg-black text-white' : 'hover:bg-zinc-50'}`} style={onlyEssence ? {} : { border: '1px solid #e4e4e7' }}>蒂</button>
                  <button onClick={() => setIsCreatingPost(true)} className="bg-black text-white px-4 py-2 text-sm flex items-center gap-2 rounded active:scale-95 transition-transform"><PenSquare className="w-4 h-4" /> 发帖</button>
                </div>
                
                <div>
                  {isLoading ? (
                    <LoadingSpinner />
                  ) : filteredPosts.length > 0 ? (
                    filteredPosts.map(post => (
                      <div
                        key={post.id}
                        onClick={() => navigate(`/post/${post.id}`)}
                        className="py-5 md:py-4 cursor-pointer hover:bg-zinc-50 flex gap-3 transition-colors"
                        style={{ borderBottom: '1px solid #f4f4f5' }}
                      >
                        <Avatar url={usersMap[post.user_id]?.avatar} className="w-8 h-8 md:w-7 md:h-7 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          {/* 标题：手机 text-base，PC 保持 text-[15px] */}
                          <h3 className="font-medium break-words whitespace-normal text-base md:text-[15px] leading-snug text-zinc-900">
                            {post.is_essence && <span className="mr-1 bg-black text-white px-1 text-[10px] inline-block align-middle rounded-sm">蒂</span>}
                            {post.title}
                          </h3>
                          {/* 预览文字：手机 text-base leading-relaxed，PC text-sm */}
                          <p className="text-base md:text-sm leading-relaxed md:leading-normal text-zinc-500 line-clamp-2 mt-1.5 md:mt-1">
                            {getPostPreview(post.content)}
                          </p>
                          {/* 元信息：手机 text-sm，PC text-xs */}
                          <div className="text-sm md:text-xs text-zinc-400 mt-2.5 md:mt-2 flex items-center gap-2 flex-nowrap overflow-hidden">
                            <span className="bg-zinc-100 px-1.5 py-0.5 rounded text-zinc-600 shrink-0 truncate max-w-[7rem]">{post.category}</span>
                            <span className="truncate shrink-0 max-w-[6rem]">{usersMap[post.user_id]?.user_name || '匿名'}</span>
                            <span className="shrink-0">·</span>
                            <span className="shrink-0 whitespace-nowrap">
                              {(post as any).last_comment_at ? (
                                <span title={`发帖：${timeAgo(post.created_at)}`}>
                                  💬 {timeAgo((post as any).last_comment_at)}
                                </span>
                              ) : (
                                <span>{timeAgo(post.created_at)}</span>
                              )}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="py-24 flex flex-col items-center justify-center text-zinc-400">
                      <div className="bg-zinc-50 p-4 rounded-full mb-3">
                        <Search className="w-8 h-8 text-zinc-200" />
                      </div>
                      <p className="text-sm">暂无相关帖子内容</p>
                    </div>
                  )}
                </div>
              </div>
            ) : <Navigate to="/login" replace />
          } />
          
          <Route path="/post/:postId" element={user ? <PostDetailPage user={user} usersMap={usersMap} showToast={showToast} /> : <Navigate to="/login" replace />} />
          <Route path="/profile/:userId" element={user ? <UserProfileWrapper /> : <Navigate to="/login" replace />} />
          <Route path="/bookshelf" element={user ? <Bookshelf onNavigateBack={() => navigate(-1)} onBookClick={(postId: string) => navigate(`/post/${postId}`)} showToast={showToast} /> : <Navigate to="/login" replace />} />
          <Route path="/admin" element={user?.role === 'admin' ? <AdminPanel /> : <Navigate to="/feed" replace />} />
        </Routes>
      </main>

      {isCreatingPost && user && (
        <CreatePostModal user={user} onClose={() => setIsCreatingPost(false)} onSuccess={() => { setIsCreatingPost(false); setRefreshKey(k => k + 1); }} showToast={showToast} />
      )}
    </div>
  );
}
