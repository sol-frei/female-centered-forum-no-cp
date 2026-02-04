import { supabase } from './services/supabaseClient';
import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, useSearchParams, useLocation } from 'react-router-dom';

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
import { get_all_users, get_user, get_posts } from './services/storage';
import { 
  Search, LogOut, Menu, UserCircle, 
  PenSquare, X, Shield, BookOpen 
} from 'lucide-react';

const CATEGORIES: Category[] = ['全部', '推书📖排雷', '讨论👊🏻i女', '求书🔍求作', '自荐🙋🏻分享', '组务❗组规'];

// ✅ 统一样式：黑色旋转圆圈
const LoadingSpinner = ({ fullScreen = false }: { fullScreen?: boolean }) => (
  <div className={fullScreen ? "min-h-screen flex items-center justify-center bg-white" : "py-20 flex items-center justify-center bg-white"}>
    <div className="w-6 h-6 border-2 border-zinc-200 border-t-zinc-800 rounded-full animate-spin"></div>
  </div>
);

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
  if (url) return <img src={url} alt="头像" className={`${className} rounded-full object-cover border border-zinc-100`} />;
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

  const showToast = (msg: string, type: ToastType) => setToast({ msg, type });

  // 🟢 处理左滑手势：搜索时左滑清空搜索，而不是退出
  useEffect(() => {
    const handlePopState = () => {
      if (searchQuery) {
        setSearchQuery('');
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [searchQuery]);

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
      setDisplayPosts(data || []);
      setIsLoading(false);
    };
    loadPosts();
  }, [currentCategory, onlyEssence, refreshKey, isAuthChecking]);

  useEffect(() => {
    if (!user) return;
    get_all_users().then(list => {
      const map: Record<string, User> = {};
      list.forEach(u => map[u.id] = u);
      setUsersMap(map);
    });
  }, [user]);

  const filteredPosts = displayPosts.filter(post => {
    const searchLower = searchQuery.toLowerCase();
    return post.title.toLowerCase().includes(searchLower) || 
           post.content.toLowerCase().includes(searchLower);
  });

  const handleLogout = async () => {
    // 🟢 修复点：退出时立即重置侧边栏状态
    setShowMobileMenu(false);
    await supabase.auth.signOut();
    setUser(null);
    navigate('/login', { replace: true });
  };

  const getPostPreview = (content: string) => {
    try {
      const blocks = JSON.parse(content);
      if (Array.isArray(blocks)) return blocks.filter(b => b.type === 'text').map(b => b.value).join(' ').slice(0, 100);
    } catch {}
    return content.slice(0, 100);
  };

  if (isAuthChecking) return <LoadingSpinner fullScreen />;

  if (user && user.is_first_login) {
    return <ChangePasswordModal user={user} onComplete={(u) => { setUser(u); navigate('/feed', { replace: true }); }} />;
  }

  const isLoginPage = location.pathname === '/login' || location.pathname === '/';
  const hideNavPages = location.pathname.startsWith('/post/') || 
                       location.pathname.startsWith('/profile/') || 
                       location.pathname === '/admin' ||
                       location.pathname === '/bookshelf';

  return (
    <div className="min-h-screen bg-white text-zinc-900">
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      {/* 侧边栏 */}
      {showMobileMenu && (
        <div className="fixed inset-0 z-[100] md:hidden">
          <div className="fixed inset-0 bg-black/50" onClick={() => setShowMobileMenu(false)} />
          <div className="relative w-72 bg-white h-full shadow-xl flex flex-col p-4">
            <div className="flex justify-between items-center mb-6">
              <span className="font-bold text-lg">板块选择</span>
              <button onClick={() => setShowMobileMenu(false)} className="p-1"><X className="w-6 h-6" /></button>
            </div>
            <div className="flex flex-col gap-2">
              {CATEGORIES.map(c => (
                <button key={c} onClick={() => { setCurrentCategory(c); setShowMobileMenu(false); navigate('/feed'); }}
                  className={`px-4 py-3 text-left text-sm rounded-lg ${currentCategory === c ? 'bg-black text-white' : 'hover:bg-zinc-100'}`}>
                  {c}
                </button>
              ))}
              <hr className="my-4 border-zinc-100" />
              {user?.role === 'admin' && (
                <button onClick={() => { navigate('/admin'); setShowMobileMenu(false); }} className="flex items-center gap-2 px-4 py-3 text-sm hover:bg-zinc-100 rounded-lg">
                  <Shield className="w-4 h-4" /> 管理后台
                </button>
              )}
              <button onClick={handleLogout} className="flex items-center gap-2 px-4 py-4 text-sm text-red-600 bg-red-50 hover:bg-red-100 rounded-xl mt-4 font-medium">
                <LogOut className="w-4 h-4" /> 退出登录
              </button>
            </div>
          </div>
        </div>
      )}

      {user && !isLoginPage && !hideNavPages && (
        <nav className="border-b border-zinc-200 sticky top-0 bg-white z-40">
          <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 flex-shrink-0">
              <button onClick={() => setShowMobileMenu(true)} className="md:hidden p-1.5 hover:bg-zinc-100 rounded-full">
                <Menu className="w-5 h-5" />
              </button>
              <h1 className="font-bold text-base md:text-lg cursor-pointer hidden sm:block" onClick={() => navigate('/feed')}>
                女主无cp交流中心
              </h1>
            </div>

            {/* 搜索框 */}
            <div className="flex-1 max-w-xs relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 group-focus-within:text-black" />
              <input 
                type="text" 
                placeholder="搜索帖子..." 
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="w-full bg-zinc-100 border-none rounded-full py-1.5 pl-9 pr-4 text-sm focus:ring-1 focus:ring-black transition-all"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 hover:bg-zinc-200 rounded-full">
                  <X className="w-3 h-3 text-zinc-500" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-1 md:gap-2 flex-shrink-0">
              <button onClick={() => navigate('/bookshelf')} className="p-2 hover:bg-zinc-100 rounded-full"><BookOpen className="w-5 h-5 text-zinc-600" /></button>
              <button onClick={() => navigate(`/profile/${user.id}`)} className="p-1.5 md:p-2 hover:bg-zinc-100 rounded-full"><Avatar url={user.avatar} className="w-6 h-6" /></button>
              <button onClick={handleLogout} className="hidden md:block p-2 hover:bg-zinc-100 rounded-full"><LogOut className="w-5 h-5" /></button>
            </div>
          </div>
        </nav>
      )}

      <main className="max-w-5xl mx-auto">
        <Routes>
          <Route path="/" element={user ? <Navigate to="/feed" replace /> : <Landing onLoginClick={() => navigate('/login')} />} />
          <Route path="/login" element={user ? <Navigate to="/feed" replace /> : <LoginPage onLogin={(u) => { setUser(u); navigate('/feed', { replace: true }); }} />} />
          
          <Route path="/feed" element={
            user ? (
              <div className="p-4">
                <div className="flex justify-between items-center mb-4 border-b pb-2">
                  <div className="flex items-center gap-2">
                    <button onClick={() => setOnlyEssence(!onlyEssence)} className={`px-2 py-1 text-sm font-bold rounded ${onlyEssence ? 'bg-black text-white' : 'border'}`}>蒂</button>
                  </div>
                  <button onClick={() => setIsCreatingPost(true)} className="bg-black text-white px-4 py-2 text-sm flex items-center gap-2 rounded"><PenSquare className="w-4 h-4" /> 发帖</button>
                </div>
                <div className="divide-y">
                  {isLoading ? <LoadingSpinner /> : filteredPosts.map(post => (
                    <div key={post.id} onClick={() => navigate(`/post/${post.id}`)} className="py-4 cursor-pointer hover:bg-zinc-50 flex gap-3">
                      <Avatar url={usersMap[post.user_id]?.avatar} className="w-10 h-10 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        {/* ✅ 确保完整显示标题：去掉 truncate，改为换行 */}
                        <h3 className="font-medium break-words whitespace-normal text-[15px] leading-snug">
                          {post.is_essence && <span className="mr-1 bg-black text-white px-1 text-xs inline-block align-middle">蒂</span>}
                          {post.title}
                        </h3>
                        <p className="text-sm text-zinc-500 line-clamp-2 mt-1">{getPostPreview(post.content)}</p>
                        <div className="text-xs text-zinc-400 mt-2">{post.category} · {usersMap[post.user_id]?.user_name || '匿名'} · {timeAgo(post.created_at)}</div>
                      </div>
                    </div>
                  ))}
                  {!isLoading && filteredPosts.length === 0 && (
                    <div className="py-20 text-center text-zinc-400 text-sm">暂无匹配的帖子</div>
                  )}
                </div>
              </div>
            ) : <Navigate to="/login" replace />
          } />
          
          <Route path="/post/:postId" element={user ? <PostDetailPage user={user} usersMap={usersMap} showToast={showToast} /> : <Navigate to="/login" replace />} />
          <Route path="/profile/:userId" element={user ? <UserProfile userId={user.id} onNavigateBack={() => navigate(-1)} onPostClick={(id: string) => navigate(`/post/${id}`)} /> : <Navigate to="/login" replace />} />
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
