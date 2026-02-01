import { supabase } from './services/supabaseClient';
import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, useSearchParams, useLocation } from 'react-router-dom';

// 导入页面与类型
import Landing from './components/Landing';
import PostDetailPage from './pages/PostDetailPage';
import LoginPage from './pages/LoginPage';
import AdminPanel from './components/AdminPanel';
import UserProfile from './components/UserProfile';
import Toast, { ToastType } from './components/Toast';
import CreatePostModal from './components/CreatePostModal';
import ChangePasswordModal from './components/ChangePasswordModal';
import { User, Post, Category } from './types';
import { get_all_users, get_user, get_posts } from './services/storage';
import { Search, LogOut, Menu, UserCircle, PenSquare, X, Shield } from 'lucide-react';

const CATEGORIES: Category[] = ['全部', '推书📖排雷', '讨论👊🏻i女', '求书🔍求作', '自荐🙋🏻分享', '组务❗组规'];

// 工具函数
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

// --- 路由包装层：让主逻辑更清爽 ---

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
  const [searchParams, setSearchParams] = useSearchParams();
  
  // 核心状态
  const [user, setUser] = useState<User | null>(null);
  const [currentCategory, setCurrentCategory] = useState<Category | '全部'>((searchParams.get('cat') as Category) || '全部');
  const [searchQuery, setSearchQuery] = useState('');
  const [onlyEssence, setOnlyEssence] = useState(false);
  const [isCreatingPost, setIsCreatingPost] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [usersMap, setUsersMap] = useState<Record<string, User>>({});
  const [displayPosts, setDisplayPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [readPosts, setReadPosts] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<{ msg: string, type: ToastType } | null>(null);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showCategoriesInMenu, setShowCategoriesInMenu] = useState(true);

  const showToast = (msg: string, type: ToastType) => setToast({ msg, type });

  // 初始化登录
  useEffect(() => {
    const initAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const freshUser = await get_user(session.user.id);
      if (freshUser) {
        if (freshUser.is_banned) {
          await supabase.auth.signOut();
          showToast('账号已被封禁', 'error');
          return;
        }
        setUser(freshUser);
      }
    };
    initAuth();
  }, []);

  // 加载数据逻辑 (保持原有逻辑)
  useEffect(() => {
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
  }, [currentCategory, onlyEssence, refreshKey]);

  // 监听路由变化,返回feed页面时刷新列表
  useEffect(() => {
    if (location.pathname === '/feed') {
      setRefreshKey(k => k + 1);
    }
  }, [location.pathname]);

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

  // 如果首登需要改密码
  if (user && user.is_first_login) {
    return <ChangePasswordModal user={user} onComplete={(u) => { setUser(u); navigate('/feed'); }} />;
  }

  // 判断是否在登录页面或落地页
  const isLoginPage = location.pathname === '/login' || location.pathname === '/';
  
  // 判断是否在需要隐藏导航栏的页面
  const hideNavPages = location.pathname.startsWith('/post/') || 
                       location.pathname.startsWith('/profile/') || 
                       location.pathname === '/admin';

  return (
    <div className="min-h-screen bg-white text-zinc-900">
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      {/* 只有登录后且不在登录/落地页且不在需要隐藏导航的页面时才显示导航栏 */}
      {user && !isLoginPage && !hideNavPages && (
        <nav className="border-b border-zinc-200 sticky top-0 bg-white z-40">
          <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
            <div className="flex items-center gap-2 md:gap-6 flex-1 min-w-0">
              <h1 className="font-bold text-base md:text-lg cursor-pointer truncate" onClick={() => navigate('/feed')}>
                女主无cp/无男主交流中心
              </h1>
              {/* 桌面端导航 */}
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
              {/* 移动端菜单按钮 */}
              <button 
                onClick={() => setShowMobileMenu(true)}
                className="md:hidden p-2 hover:bg-zinc-100 rounded-full flex-shrink-0"
              >
                <Menu className="w-5 h-5" />
              </button>
            </div>
            <div className="flex items-center gap-1 md:gap-2 flex-shrink-0">
              {/* 搜索按钮 - 所有设备显示 */}
              <button 
                className="p-2 hover:bg-zinc-100 rounded-full"
                title="搜索"
              >
                <Search className="w-5 h-5 text-zinc-600" />
              </button>
              
              {/* 用户头像 */}
              <button 
                onClick={() => navigate(`/profile/${user.id}`)} 
                className="p-1.5 md:p-2 hover:bg-zinc-100 rounded-full flex-shrink-0"
              >
                <Avatar url={user.avatar} className="w-6 h-6" />
              </button>
              
              {/* 管理员入口 - 桌面端显示 */}
              {user.role === 'admin' && (
                <button 
                  onClick={() => navigate('/admin')}
                  className="hidden md:block p-2 hover:bg-zinc-100 rounded-full"
                  title="管理员面板"
                >
                  <Shield className="w-5 h-5" />
                </button>
              )}
              
              {/* 退出按钮 - 桌面端显示 */}
              <button 
                onClick={handleLogout} 
                className="hidden md:block p-2 hover:bg-zinc-100 rounded-full"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </nav>
      )}

      {/* 移动端分类菜单 */}
      {showMobileMenu && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 md:hidden" onClick={() => setShowMobileMenu(false)}>
          <div className="bg-white w-64 h-full p-4 overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg">菜单</h3>
              <button onClick={() => setShowMobileMenu(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {/* 分类列表 - 可折叠 */}
            <div className="mb-4">
              <button 
                onClick={() => setShowCategoriesInMenu(!showCategoriesInMenu)}
                className="w-full flex items-center justify-between px-2 py-2 text-base font-medium text-zinc-700 hover:bg-zinc-50 rounded"
              >
                <span>分类</span>
                <span className="text-xs">{showCategoriesInMenu ? '▼' : '▶'}</span>
              </button>
              
              {showCategoriesInMenu && (
                <div className="mt-2 space-y-1">
                  {CATEGORIES.map(c => (
                    <button
                      key={c}
                      onClick={() => {
                        setCurrentCategory(c);
                        navigate('/feed');
                        setShowMobileMenu(false);
                      }}
                      className={`w-full text-left px-4 py-2.5 rounded-lg text-sm ${currentCategory === c ? 'bg-black text-white' : 'text-zinc-600 hover:bg-zinc-100'}`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              )}
            </div>
            
            {/* 功能选项 */}
            <div className="border-t pt-4 space-y-1">
              {user && user.role === 'admin' && (
                <button
                  onClick={() => {
                    navigate('/admin');
                    setShowMobileMenu(false);
                  }}
                  className="w-full text-left px-4 py-3 rounded-lg text-zinc-600 hover:bg-zinc-100 flex items-center gap-2"
                >
                  <Shield className="w-4 h-4" />
                  <span className="text-base">管理员面板</span>
                </button>
              )}
              <button
                onClick={() => {
                  handleLogout();
                  setShowMobileMenu(false);
                }}
                className="w-full text-left px-4 py-3 rounded-lg text-zinc-600 hover:bg-zinc-100 flex items-center gap-2"
              >
                <LogOut className="w-4 h-4" />
                <span className="text-base">退出登录</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="max-w-5xl mx-auto">
        <Routes>
          {/* 路由表 */}
          <Route path="/" element={user ? <Navigate to="/feed" /> : <Landing onLoginClick={() => navigate('/login')} />} />
          <Route path="/login" element={<LoginPage onLogin={(u) => { setUser(u); navigate('/feed'); }} />} />
          
          <Route path="/feed" element={
            <div className="p-4">
              <div className="flex justify-between items-center mb-4 border-b pb-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={onlyEssence} 
                    onChange={e => setOnlyEssence(e.target.checked)} 
                    className="w-0 h-0 opacity-0 absolute"
                    id="essence-filter"
                  />
                  <div className={`px-2 py-1 text-sm font-bold rounded ${onlyEssence ? 'bg-black text-white' : 'bg-white text-black border border-zinc-300'}`}>
                    蒂
                  </div>
                </label>
                <button onClick={() => setIsCreatingPost(true)} className="bg-black text-white px-4 py-2 text-sm flex items-center gap-2 hover:bg-zinc-800">
                  <PenSquare className="w-4 h-4" /> 发帖
                </button>
              </div>
              
              <div className="divide-y divide-zinc-100">
                {isLoading ? (
                  <div className="py-20 text-center text-zinc-400">加载中...</div>
                ) : (
                  displayPosts.filter(p => p.title.includes(searchQuery)).map(post => (
                    <div key={post.id} onClick={() => navigate(`/post/${post.id}`)} className="py-4 cursor-pointer hover:bg-zinc-50 flex gap-3">
                      <Avatar url={usersMap[post.user_id]?.avatar} className="w-10 h-10 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium flex items-center gap-2 flex-wrap">
                          {post.is_essence && (
                            <span className="inline-block px-2 py-0.5 bg-black text-white text-xs font-bold rounded flex-shrink-0">
                              蒂
                            </span>
                          )}
                          <span className="flex-1">{post.title}</span>
                        </h3>
                        <p className="text-sm text-zinc-500 line-clamp-2">{getPostPreview(post.content)}</p>
                        <div className="text-xs text-zinc-400 mt-1">
                          {post.category} • {usersMap[post.user_id]?.user_name} • {timeAgo(post.created_at)}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          } />

          <Route path="/post/:postId" element={
            <PostDetailPage user={user!} usersMap={usersMap} showToast={showToast} />
          } />

          <Route path="/profile/:userId" element={
            <UserProfile userId={user?.id || ''} onNavigateBack={() => navigate(-1)} onPostClick={(id) => navigate(`/post/${id}`)} />
          } />

          <Route path="/admin" element={
            user?.role === 'admin' ? <AdminPanel /> : <Navigate to="/feed" />
          } />
        </Routes>
      </main>

      {isCreatingPost && (
        <CreatePostModal 
          user={user!} onClose={() => setIsCreatingPost(false)} 
          onSuccess={() => { setIsCreatingPost(false); setRefreshKey(k => k + 1); }} 
          showToast={showToast} 
        />
      )}
    </div>
  );
}
