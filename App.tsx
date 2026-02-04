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

// ✅ 加载动画组件
const LoadingSpinner = ({ fullScreen = false }: { fullScreen?: boolean }) => (
  <div className={fullScreen ? "min-h-screen flex items-center justify-center bg-white" : "py-20 flex items-center justify-center bg-white"}>
    <div className="w-6 h-6 border-2 border-zinc-200 border-t-zinc-800 rounded-full animate-spin"></div>
  </div>
);

// ✅ 时间转换工具
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

// ✅ 头像组件
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
  
  // 核心状态
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
  
  // 🟢 新增：移动端菜单与搜索状态
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const showToast = (msg: string, type: ToastType) => setToast({ msg, type });

  // 身份校验
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

  // 加载帖子列表
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

  // 加载用户信息映射
  useEffect(() => {
    if (!user) return;
    get_all_users().then(list => {
      const map: Record<string, User> = {};
      list.forEach(u => map[u.id] = u);
      setUsersMap(map);
    });
  }, [user]);

  // 🟢 搜索过滤逻辑
  const filteredPosts = displayPosts.filter(post => {
    const searchLow = searchQuery.toLowerCase();
    return post.title.toLowerCase().includes(searchLow) || 
           post.content.toLowerCase().includes(searchLow);
  });

  const handleLogout = async () => {
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

  // 首次登录强制改密
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

      {/* 🟢 移动端侧边栏菜单 */}
      {showMobileMenu && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowMobileMenu(false)} />
          <div className="relative w-72 bg-white h-full shadow-2xl flex flex-col p-6 animate-in slide-in-from-left duration-300">
            <div className="flex justify-between items-center mb-8">
              <h2 className="font-bold text-xl">分类浏览</h2>
              <button onClick={() => setShowMobileMenu(false)} className="p-2 hover:bg-zinc-100 rounded-full">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="flex flex-col gap-1">
              {CATEGORIES.map(c => (
                <button 
                  key={c} 
                  onClick={() => { setCurrentCategory(c); setShowMobileMenu(false); navigate('/feed'); }}
                  className={`text-left px-4 py-3 rounded-xl transition-colors ${currentCategory === c ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:bg-zinc-100'}`}
                >
                  {c}
                </button>
              ))}
              <div className="h-px bg-zinc-100 my-4" />
              {user?.role === 'admin' && (
                <button onClick={() => { navigate('/admin'); setShowMobileMenu(false); }} className="flex items-center gap-3 px-4 py-3 text-zinc-600 hover:bg-zinc-100 rounded-xl">
                  <Shield className="w-5 h-5" /> 管理后台
                </button>
              )}
              <button onClick={handleLogout} className="flex items-center gap-3 px-4 py-3 text-red-500 hover:bg-red-50 rounded-xl mt-auto">
                <LogOut className="w-5 h-5" /> 退出登录
              </button>
            </div>
          </div>
        </div>
      )}

      {user && !isLoginPage && !hideNavPages && (
        <nav className="border-b border-zinc-100 sticky top-0 bg-white/80 backdrop-blur-md z-40">
          <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button onClick={() => setShowMobileMenu(true)} className="md:hidden p-2 -ml-2 hover:bg-zinc-100 rounded-full transition-colors">
                <Menu className="w-6 h-6" />
              </button>
              <h1 className="font-bold text-lg cursor-pointer hidden sm:block whitespace-nowrap" onClick={() => navigate('/feed')}>
                无CP交流中心
              </h1>
            </div>

            {/* 🟢 搜索框实现 */}
            <div className="flex-1 max-w-md relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 group-focus-within:text-zinc-900 transition-colors" />
              <input 
                type="text"
                placeholder="搜索标题或内容..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-zinc-100 border-none rounded-2xl py-2 pl-10 pr-4 text-sm focus:ring-2 focus:ring-zinc-200 transition-all"
              />
            </div>

            <div className="flex items-center gap-1 md:gap-2">
              <button onClick={() => navigate('/bookshelf')} className="p-2 hover:bg-zinc-100 rounded-full transition-colors" title="书架">
                <BookOpen className="w-5 h-5 text-zinc-600" />
              </button>
              <button onClick={() => navigate(`/profile/${user.id}`)} className="p-1 hover:bg-zinc-100 rounded-full transition-colors">
                <Avatar url={user.avatar} className="w-8 h-8 md:w-9 md:h-9" />
              </button>
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
                <div className="flex justify-between items-center mb-6">
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => setOnlyEssence(!onlyEssence)} 
                      className={`px-3 py-1 text-sm font-bold rounded-lg transition-all ${onlyEssence ? 'bg-zinc-900 text-white shadow-lg' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'}`}
                    >
                      蒂
                    </button>
                    {searchQuery && <span className="text-xs text-zinc-400">找到 {filteredPosts.length} 条结果</span>}
                  </div>
                  <button 
                    onClick={() => setIsCreatingPost(true)} 
                    className="bg-zinc-900 text-white px-5 py-2 rounded-full text-sm font-medium flex items-center gap-2 hover:bg-zinc-800 transition-all active:scale-95 shadow-md"
                  >
                    <PenSquare className="w-4 h-4" /> 发帖
                  </button>
                </div>
                
                <div className="space-y-1">
                  {isLoading ? <LoadingSpinner /> : (
                    filteredPosts.length > 0 ? (
                      filteredPosts.map(post => (
                        <div 
                          key={post.id} 
                          onClick={() => navigate(`/post/${post.id}`)} 
                          className="py-5 px-4 -mx-4 cursor-pointer hover:bg-zinc-50 flex gap-4 transition-colors border-b border-zinc-50 last:border-0"
                        >
                          <Avatar url={usersMap[post.user_id]?.avatar} className="w-11 h-11 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-[16px] leading-tight truncate flex items-center gap-2 mb-1">
                              {post.is_essence && <span className="bg-zinc-900 text-white px-1.5 py-0.5 text-[10px] rounded-sm">精</span>}
                              {post.title}
                            </h3>
                            <p className="text-[14px] text-zinc-500 line-clamp-2 leading-relaxed mb-2">
                              {getPostPreview(post.content)}
                            </p>
                            <div className="flex items-center gap-3 text-[12px] text-zinc-400">
                              <span className="bg-zinc-100 text-zinc-600 px-2 py-0.5 rounded-md font-medium">{post.category}</span>
                              <span className="hover:underline">{usersMap[post.user_id]?.user_name || '未知用户'}</span>
                              <span>·</span>
                              <span>{timeAgo(post.created_at)}</span>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="py-32 text-center flex flex-col items-center gap-2">
                        <Search className="w-12 h-12 text-zinc-100" />
                        <p className="text-zinc-400">没有找到匹配的帖子，换个关键词试试？</p>
                      </div>
                    )
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
        <CreatePostModal 
          user={user} 
          onClose={() => setIsCreatingPost(false)} 
          onSuccess={() => { setIsCreatingPost(false); setRefreshKey(k => k + 1); }} 
          showToast={showToast} 
        />
      )}
    </div>
  );
}
