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
  <div className={`${fullScreen ? 'min-h-screen' : 'py-20'} flex items-center justify-center bg-white`}>
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
  const [searchQuery] = useState('');
  const [onlyEssence, setOnlyEssence] = useState(false);
  const [isCreatingPost, setIsCreatingPost] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [usersMap, setUsersMap] = useState<Record<string, User>>({});
  const [displayPosts, setDisplayPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(false); 
  const [toast, setToast] = useState<{ msg: string, type: ToastType } | null>(null);
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  const showToast = (msg: string, type: ToastType) => setToast({ msg, type });

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
      const sortedData = (data || []).sort((a, b) => 
        new Date(b.last_comment_at || b.created_at).getTime() - new Date(a.last_comment_at || a.created_at).getTime()
      );
      setDisplayPosts(sortedData);
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

  if (user && user.is_first_login) {
    return <ChangePasswordModal user={user} onComplete={(u) => { setUser(u); navigate('/feed', { replace: true }); }} />;
  }

  const isLoginPage = location.pathname === '/login' || location.pathname === '/';
  const hideNavPages = location.pathname.startsWith('/post/') || 
                       location.pathname.startsWith('/profile/') || 
                       location.pathname === '/admin';

  return (
    <div className="min-h-screen bg-white text-zinc-900">
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      {user && !isLoginPage && !hideNavPages && (
        <nav className="border-b border-zinc-200 sticky top-0 bg-white z-40">
          <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
            <div className="flex items-center gap-2 md:gap-6 flex-1 min-w-0">
              <h1 className="font-bold text-base md:text-lg cursor-pointer truncate" onClick={() => navigate('/feed')}>
                女主无cp/无男主交流中心
              </h1>
              <div className="hidden md:flex gap-1">
                {CATEGORIES.map(c => (
                  <button key={c} onClick={() => { setCurrentCategory(c); navigate('/feed'); }}
                    className={`px-3 py-1 text-sm rounded-full ${currentCategory === c ? 'bg-black text-white' : 'text-zinc-600 hover:bg-zinc-100'}`}>
                    {c}
                  </button>
                ))}
              </div>
              <button onClick={() => setShowMobileMenu(true)} className="md:hidden p-2 hover:bg-zinc-100 rounded-full"><Menu className="w-5 h-5" /></button>
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

      {showMobileMenu && (
        <div className="fixed inset-0 bg-black/50 z-50 md:hidden" onClick={() => setShowMobileMenu(false)}>
          <div className="bg-white w-64 h-full p-4" onClick={e => e.stopPropagation()}>
             <div className="flex justify-between items-center mb-6">
               <span className="font-bold">菜单</span>
               <X className="w-5 h-5" onClick={() => setShowMobileMenu(false)} />
             </div>
             <div className="space-y-4">
               {CATEGORIES.map(c => (
                 <div key={c} onClick={() => { setCurrentCategory(c); navigate('/feed'); setShowMobileMenu(false); }} className="text-zinc-600 cursor-pointer">{c}</div>
               ))}
               <div className="border-t pt-4 space-y-4">
                 <div onClick={() => { navigate('/bookshelf'); setShowMobileMenu(false); }} className="flex items-center gap-2 cursor-pointer"><BookOpen className="w-4 h-4" /> 书架</div>
                 <div onClick={handleLogout} className="flex items-center gap-2 text-red-500 cursor-pointer"><LogOut className="w-4 h-4" /> 退出</div>
               </div>
             </div>
          </div>
        </div>
      )}

      <main className="max-w-5xl mx-auto">
        <Routes>
          {/* ✅ 关键修复：如果已登录，访问 / 或 /login 直接弹回 /feed */}
          <Route path="/" element={user ? <Navigate to="/feed" replace /> : <Landing onLoginClick={() => navigate('/login')} />} />
          <Route path="/login" element={user ? <Navigate to="/feed" replace /> : <LoginPage onLogin={(u) => { setUser(u); navigate('/feed', { replace: true }); }} />} />
          
          <Route path="/feed" element={
            user ? (
              <div className="p-4">
                <div className="flex justify-between items-center mb-4 border-b pb-2">
                  <div className="flex items-center gap-2">
                    <button onClick={() => setOnlyEssence(!onlyEssence)} className={`px-2 py-1 text-sm font-bold rounded ${onlyEssence ? 'bg-black text-white' : 'border'}`}>蒂</button>
                  </div>
                  <button onClick={() => setIsCreatingPost(true)} className="bg-black text-white px-4 py-2 text-sm flex items-center gap-2"><PenSquare className="w-4 h-4" /> 发帖</button>
                </div>
                <div className="divide-y">
                  {isLoading ? <LoadingSpinner /> : displayPosts.map(post => (
                    <div key={post.id} onClick={() => navigate(`/post/${post.id}`)} className="py-4 cursor-pointer hover:bg-zinc-50 flex gap-3">
                      <Avatar url={usersMap[post.user_id]?.avatar} className="w-10 h-10 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium truncate">{post.is_essence && <span className="mr-1 bg-black text-white px-1 text-xs">蒂</span>}{post.title}</h3>
                        <p className="text-sm text-zinc-500 line-clamp-2">{getPostPreview(post.content)}</p>
                        <div className="text-xs text-zinc-400 mt-1">{post.category} · {usersMap[post.user_id]?.user_name} · {timeAgo(post.created_at)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : <Navigate to="/login" replace />
          } />
          
          <Route path="/post/:postId" element={user ? <PostDetailPage user={user} usersMap={usersMap} showToast={showToast} /> : <Navigate to="/login" replace />} />
          <Route path="/profile/:userId" element={user ? <UserProfile userId={userId} onNavigateBack={() => navigate(-1)} onPostClick={(id) => navigate(`/post/${id}`)} /> : <Navigate to="/login" replace />} />
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
