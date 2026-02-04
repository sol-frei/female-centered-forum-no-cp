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
  
  // --- 状态管理 ---
  const [user, setUser] = useState<User | null>(null);
  const [isAuthChecking, setIsAuthChecking] = useState(true); // 全局启动拦截状态
  const [currentCategory, setCurrentCategory] = useState<Category | '全部'>((searchParams.get('cat') as Category) || '全部');
  const [searchQuery] = useState('');
  const [onlyEssence, setOnlyEssence] = useState(false);
  const [isCreatingPost, setIsCreatingPost] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [usersMap, setUsersMap] = useState<Record<string, User>>({});
  const [displayPosts, setDisplayPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(false); // 页面内容加载状态
  const [toast, setToast] = useState<{ msg: string, type: ToastType } | null>(null);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showCategoriesInMenu, setShowCategoriesInMenu] = useState(true);

  const showToast = (msg: string, type: ToastType) => setToast({ msg, type });

  // 1. 系统启动：仅在刷新或首次进入时检查登录
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
      } catch (err) {
        console.error("Auth init error:", err);
      } finally {
        setIsAuthChecking(false); // 启动完成，关闭全屏拦截
      }
    };
    initAuth();
  }, []);

  // 2. 业务数据加载：仅在内容更新时触发
  useEffect(() => {
    if (isAuthChecking) return; 
    const loadPosts = async () => {
      setIsLoading(true);
      const data = await get_posts(currentCategory, onlyEssence ? 'essence' : 'new');
      const sortedData = (data || []).sort((a, b) => 
        new Date(b.last_comment_at || b.created_at).getTime() - new Date(a.last_comment_at || a.created_at).getTime()
      );
      setDisplayPosts(sortedData);
      setIsLoading(false);
    };
    loadPosts();
  }, [currentCategory, onlyEssence, refreshKey, isAuthChecking]);

  // 3. 用户映射表
  useEffect(() => {
    if (!user) return;
    get_all_users().then(list => {
      const map: Record<string, User> = {};
      list.forEach(u => map[u.id] = u);
      setUsersMap(map);
    });
  }, [user]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    navigate('/');
  };

  const getPostPreview = (content: string) => {
    try {
      const blocks = JSON.parse(content);
      if (Array.isArray(blocks)) return blocks.filter(b => b.type === 'text').map(b => b.value).join(' ').slice(0, 100);
    } catch {}
    return content.slice(0, 100);
  };

  // --- 拦截阶段：系统启动动画 (刷新时显示) ---
  if (isAuthChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="flex gap-2">
          <div className="w-2.5 h-2.5 bg-zinc-800 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
          <div className="w-2.5 h-2.5 bg-zinc-800 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
          <div className="w-2.5 h-2.5 bg-zinc-800 rounded-full animate-bounce"></div>
        </div>
      </div>
    );
  }

  // 强制改密逻辑
  if (user && user.is_first_login) {
    return <ChangePasswordModal user={user} onComplete={(u) => { setUser(u); navigate('/feed'); }} />;
  }

  const isLoginPage = location.pathname === '/login' || location.pathname === '/';
  const hideNavPages = location.pathname.startsWith('/post/') || 
                       location.pathname.startsWith('/profile/') || 
                       location.pathname === '/admin';

  return (
    <div className="min-h-screen bg-white text-zinc-900">
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      {/* 顶部导航 */}
      {user && !isLoginPage && !hideNavPages && (
        <nav className="border-b border-zinc-200 sticky top-0 bg-white z-40">
          <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
            <div className="flex items-center gap-2 md:gap-6 flex-1 min-w-0">
              <h1 className="font-bold text-base md:text-lg cursor-pointer truncate" onClick={() => navigate('/feed')}>
                女主无cp/无男主交流中心
              </h1>
              
              <div className="hidden md:flex gap-1">
                {CATEGORIES.map(c => (
                  <button
                    key={c}
                    onClick={() => { setCurrentCategory(c); navigate('/feed'); }}
                    className={`px-3 py-1 text-sm rounded-full ${currentCategory === c ? 'bg-black text-white' : 'text-zinc-600 hover:bg-zinc-100'}`}
                  >
                    {c}
                  </button>
                ))}
              </div>

              <button onClick={() => setShowMobileMenu(true)} className="md:hidden p-2 hover:bg-zinc-100 rounded-full">
                <Menu className="w-5 h-5" />
              </button>
            </div>

            <div className="flex items-center gap-1 md:gap-2">
              <button className="p-2 hover:bg-zinc-100 rounded-full"><Search className="w-5 h-5 text-zinc-600" /></button>
              <button onClick={() => navigate('/bookshelf')} className="p-2 hover:bg-zinc-100 rounded-full" title="书架"><BookOpen className="w-5 h-5 text-zinc-600" /></button>
              <button onClick={() => navigate(`/profile/${user.id}`)} className="p-1.5 md:p-2 hover:bg-zinc-100 rounded-full"><Avatar url={user.avatar} className="w-6 h-6" /></button>
              {user.role === 'admin' && <button onClick={() => navigate('/admin')} className="hidden md:block p-2 hover:bg-zinc-100 rounded-full"><Shield className="w-5 h-5" /></button>}
              <button onClick={handleLogout} className="hidden md:block p-2 hover:bg-zinc-100 rounded-full"><LogOut className="w-5 h-5" /></button>
            </div>
          </div>
        </nav>
      )}

      {/* 移动端菜单 */}
      {showMobileMenu && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 md:hidden" onClick={() => setShowMobileMenu(false)}>
          <div className="bg-white w-64 h-full p-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg">菜单</h3>
              <button onClick={() => setShowMobileMenu(false)}><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-1">
              {CATEGORIES.map(c => (
                <button
                  key={c}
                  onClick={() => { setCurrentCategory(c); navigate('/feed'); setShowMobileMenu(false); }}
                  className={`w-full text-left px-4 py-2.5 rounded-lg text-sm ${currentCategory === c ? 'bg-black text-white' : 'text-zinc-600 hover:bg-zinc-100'}`}
                >
                  {c}
                </button>
              ))}
              <div className="border-t mt-4 pt-4">
                <button onClick={() => { navigate('/bookshelf'); setShowMobileMenu(false); }} className="w-full text-left px-4 py-3 rounded-lg flex items-center gap-2 text-zinc-600"><BookOpen className="w-4 h-4" /> 我的书架</button>
                <button onClick={handleLogout} className="w-full text-left px-4 py-3 rounded-lg flex items-center gap-2 text-zinc-600"><LogOut className="w-4 h-4" /> 退出登录</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 路由主体 */}
      <main className="max-w-5xl mx-auto">
        <Routes>
          <Route path="/" element={user ? <Navigate to="/feed" /> : <Landing onLoginClick={() => navigate('/login')} />} />
          <Route path="/login" element={<LoginPage onLogin={(u) => { setUser(u); navigate('/feed'); }} />} />
          
          <Route path="/feed" element={
            user ? (
              <div className="p-4">
                <div className="flex justify-between items-center mb-4 border-b pb-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={onlyEssence} onChange={e => setOnlyEssence(e.target.checked)} className="hidden" />
                    <div className={`px-2 py-1 text-sm font-bold rounded ${onlyEssence ? 'bg-black text-white' : 'bg-white text-black border border-zinc-300'}`}>蒂</div>
                  </label>
                  <button onClick={() => setIsCreatingPost(true)} className="bg-black text-white px-4 py-2 text-sm flex items-center gap-2 hover:bg-zinc-800">
                    <PenSquare className="w-4 h-4" /> 发帖
                  </button>
                </div>

                <div className="divide-y divide-zinc-100">
                  {isLoading ? (
                    // 业务级文字变换提示
                    <div className="py-20 text-center text-zinc-400 text-sm italic animate-pulse">
                      正在获取最新动态...
                    </div>
                  ) : (
                    displayPosts.filter(p => p.title.includes(searchQuery)).map(post => (
                      <div key={post.id} onClick={() => navigate(`/post/${post.id}`)} className="py-4 cursor-pointer hover:bg-zinc-50 flex gap-3">
                        <Avatar url={usersMap[post.user_id]?.avatar} className="w-10 h-10 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium flex items-center gap-2">
                            {post.is_essence && <span className="px-2 py-0.5 bg-black text-white text-xs font-bold rounded">蒂</span>}
                            <span className="truncate">{post.title}</span>
                          </h3>
                          <p className="text-sm text-zinc-500 line-clamp-2">{getPostPreview(post.content)}</p>
                          <div className="text-xs text-zinc-400 mt-1">{post.category} • {usersMap[post.user_id]?.user_name} • {timeAgo(post.created_at)}</div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ) : <Navigate to="/login" replace />
          } />

          <Route path="/post/:postId" element={user ? <PostDetailPage user={user} usersMap={usersMap} showToast={showToast} /> : <Navigate to="/login" replace />} />
          <Route path="/profile/:userId" element={user ? <UserProfile userId={user.id} onNavigateBack={() => navigate(-1)} onPostClick={(id) => navigate(`/post/${id}`)} /> : <Navigate to="/login" replace />} />
          <Route path="/bookshelf" element={user ? <Bookshelf onNavigateBack={() => navigate(-1)} onBookClick={(postId) => navigate(`/post/${postId}`)} showToast={showToast} /> : <Navigate to="/login" replace />} />
          <Route path="/admin" element={user?.role === 'admin' ? <AdminPanel /> : <Navigate to="/feed" replace />} />
        </Routes>
      </main>

      {isCreatingPost && user && (
        <CreatePostModal user={user} onClose={() => setIsCreatingPost(false)} onSuccess={() => { setIsCreatingPost(false); setRefreshKey(k => k + 1); }} showToast={showToast} />
      )}
    </div>
  );
}
