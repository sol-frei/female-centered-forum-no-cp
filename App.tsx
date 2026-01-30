import { supabase } from './services/supabaseClient';
import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';

// 导入页面与类型
import Landing from './components/Landing';
import PostDetailPage from './pages/PostDetailPage';
import LoginPage from './pages/LoginPage';
import AdminPanel from './components/AdminPanel';
import UserProfile from './components/UserProfile';
import Toast, { ToastType } from './components/Toast';
import CreatePostModal from './components/CreatePostModal';
import { User, Post, Category } from './types';
import { get_all_users, get_posts } from './services/storage';
import { Search, LogOut, Menu, UserCircle, PenSquare, Shield } from 'lucide-react';

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
  return date.toLocaleDateString();
}

const Avatar = ({ url, className }: { url?: string; className?: string }) => (
  <div className={`bg-zinc-200 rounded-full overflow-hidden flex-shrink-0 ${className}`}>
    {url ? <img src={url} alt="avatar" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-zinc-400">?</div>}
  </div>
);

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [usersMap, setUsersMap] = useState<Record<string, User>>({});
  const [loading, setLoading] = useState(true);
  const [isCreatingPost, setIsCreatingPost] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: ToastType } | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const showToast = (msg: string, type: ToastType = 'info') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  // 初始化加载
  useEffect(() => {
    const sessionUser = localStorage.getItem('forum_user');
    if (sessionUser) setUser(JSON.parse(sessionUser));
    
    const loadData = async () => {
      try {
        const [allPosts, allUsers] = await Promise.all([get_posts(), get_all_users()]);
        setPosts(allPosts);
        const map: Record<string, User> = {};
        allUsers.forEach(u => map[u.id] = u);
        setUsersMap(map);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [refreshKey]);

  if (loading) return <div className="min-h-screen flex items-center justify-center">加载中...</div>;
  if (!user) return <LoginPage onLogin={(u) => { setUser(u); localStorage.setItem('forum_user', JSON.stringify(u)); }} />;

  return (
    <Router>
      <AppContent 
        user={user} 
        setUser={setUser}
        posts={posts} 
        usersMap={usersMap} 
        showToast={showToast} 
        setIsCreatingPost={setIsCreatingPost}
        isCreatingPost={isCreatingPost}
        setRefreshKey={setRefreshKey}
      />
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </Router>
  );
}

function AppContent({ user, setUser, posts, usersMap, showToast, setIsCreatingPost, isCreatingPost, setRefreshKey }: any) {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('forum_user');
    setUser(null);
    navigate('/');
  };

  const getPostPreview = (content: string) => {
    try {
      const blocks = JSON.parse(content);
      return blocks.find((b: any) => b.type === 'text')?.value || '';
    } catch {
      return content;
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50">
      <nav className="bg-white border-b border-zinc-200 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <h1 className="font-bold text-xl tracking-tighter cursor-pointer" onClick={() => navigate('/')}>FORUM</h1>
          
          <div className="flex items-center gap-4">
            {/* 管理员入口 */}
            {user.role === 'admin' && (
              <button onClick={() => navigate('/admin')} className="p-2 hover:bg-zinc-100 rounded-full text-purple-600" title="管理后台">
                <Shield className="w-5 h-5" />
              </button>
            )}
            
            <button onClick={() => setIsCreatingPost(true)} className="p-2 hover:bg-zinc-100 rounded-full">
              <PenSquare className="w-5 h-5" />
            </button>
            
            <div className="group relative">
              <div className="cursor-pointer" onClick={() => navigate(`/profile/${user.id}`)}>
                <Avatar url={user.avatar} className="w-8 h-8" />
              </div>
              <div className="absolute right-0 top-full pt-2 hidden group-hover:block w-48">
                <div className="bg-white border border-zinc-200 rounded-lg shadow-xl py-1 overflow-hidden">
                  <button onClick={() => navigate(`/profile/${user.id}`)} className="w-full px-4 py-2 text-left text-sm hover:bg-zinc-50 flex items-center gap-2">
                    <UserCircle className="w-4 h-4" /> 个人主页
                  </button>
                  <button onClick={handleLogout} className="w-full px-4 py-2 text-left text-sm hover:bg-red-50 text-red-600 flex items-center gap-2">
                    <LogOut className="w-4 h-4" /> 退出登录
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto py-6 px-4">
        <Routes>
          <Route path="/" element={
            <div className="space-y-4">
              <div className="bg-white border border-zinc-200 rounded-xl divide-y divide-zinc-100 overflow-hidden">
                {posts.map((post: any) => (
                  <div key={post.id} onClick={() => navigate(`/post/${post.id}`)} className="p-4 cursor-pointer hover:bg-zinc-50 flex gap-4">
                    <Avatar url={usersMap[post.user_id]?.avatar} className="w-12 h-12" />
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-zinc-900 truncate">{post.title}</h3>
                      <p className="text-sm text-zinc-500 line-clamp-2 mt-1">{getPostPreview(post.content)}</p>
                      <div className="text-[10px] text-zinc-400 mt-2 flex items-center gap-2">
                        <span className="bg-zinc-100 px-2 py-0.5 rounded text-zinc-600">{post.category}</span>
                        <span>{usersMap[post.user_id]?.user_name}</span>
                        <span>•</span>
                        <span>{timeAgo(post.created_at)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          } />

          <Route path="/post/:postId" element={
            <PostDetailPage user={user} usersMap={usersMap} showToast={showToast} />
          } />

          <Route path="/profile/:userId" element={
            <UserProfile userId={user.id} onNavigateBack={() => navigate(-1)} onPostClick={(id) => navigate(`/post/${id}`)} />
          } />

          {/* 管理员路由：带权限保护 */}
          <Route path="/admin" element={
            user.role === 'admin' ? <AdminPanel /> : <Navigate to="/" replace />
          } />
        </Routes>
      </main>

      {isCreatingPost && (
        <CreatePostModal 
          user={user} onClose={() => setIsCreatingPost(false)} 
          onSuccess={() => { setIsCreatingPost(false); setRefreshKey(k => k + 1); }} 
          showToast={showToast} 
        />
      )}
    </div>
  );
}
