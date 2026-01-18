import { supabase } from './services/supabaseClient';
import React, { useState, useEffect, useRef } from 'react';
import Landing from './components/Landing';
import { User, Post, Category, Collection, Notification, SensitiveWords } from './types';
import { getDB, getUser, createPost, getPosts, toggleLikePost, toggleEssence, deletePost, votePoll, addComment, getComments, updateUser, getUnreadNotificationCount, createCollection, addToCollection, updatePost, updateComment } from './services/storage';
import AdminPanel from './components/AdminPanel';
import ChangePasswordModal from './components/ChangePasswordModal';
import UserProfile from './components/UserProfile';
import Toast, { ToastType } from './components/Toast';
import { Search, LogOut, Menu, UserCircle, PenSquare, Heart, MessageSquare, Trash2, X, Plus, Check, Star, Lock, Eye, EyeOff, Image as ImageIcon, Bookmark, Send, Edit2 } from 'lucide-react';


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
    return <img src={url} alt="Avatar" className={`${className} rounded-full object-cover bg-zinc-100 border border-zinc-100`} />;
  }
  return <UserCircle className={`${className} text-zinc-300`} />;
};

// --- Standalone Sub-components ---

const CreatePostModal = ({ user, onClose, onSuccess, showToast }: { user: User, onClose: () => void, onSuccess: () => void, showToast: (msg: string, type: ToastType) => void }) => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [cat, setCat] = useState<Category>('讨论👊🏻i女');
  const [hasPoll, setHasPoll] = useState(false);
  const [pollQ, setPollQ] = useState('');
  const [pollOpts, setPollOpts] = useState(['', '']);
  const [isMulti, setIsMulti] = useState(false);
  const [days, setDays] = useState(3);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 1024 * 1024) {
        showToast('图片过大，请上传小于1MB的图片', 'error');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          setImages([...images, reader.result]);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const submit = async () => {
    if (!title.trim()) {
      showToast("请输入标题", 'error');
      return;
    }
    if (!content.trim()) {
      showToast("请输入内容", 'error');
      return;
    }
    if (!cat) {
      showToast("请选择分类", 'error');
      return;
    }

    try {
      const postData: any = {
        id: Date.now().toString(),
        userId: user.id,
        username: user.username,
        title,
        content,
        images,
        category: cat,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isEssence: false,
        isLocked: false,
        likes: [],
        viewCount: 0
      };

      if (hasPoll) {
        if (!pollQ || pollOpts.some(o => !o)) throw new Error("请完善投票信息");
        postData.poll = {
          question: pollQ,
          options: pollOpts.map((t, i) => ({ id: i.toString(), text: t, votes: [] })),
          isMultiple: isMulti,
          deadline: new Date(Date.now() + days * 86400000).toISOString()
        };
      }

      await createPost(postData);
      onSuccess();
    } catch (e: any) {
      showToast(e.message, 'error');
    }
  };

  return (
    <div className="fixed inset-0 bg-white z-50 overflow-y-auto">
      <div className="max-w-2xl mx-auto p-6 space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold">发布新帖</h2>
          <button onClick={onClose}><X className="w-6 h-6" /></button>
        </div>

        <div className="space-y-4">
          <select value={cat} onChange={(e) => setCat(e.target.value as Category)} className="w-full p-3 border border-zinc-300">
            {CATEGORIES.filter(c => c !== '全部').map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <input placeholder="标题 (建议加上前缀如 [推书])" value={title} onChange={e => setTitle(e.target.value)} className="w-full p-3 border border-zinc-300 font-bold" />
          <textarea placeholder="正文内容..." value={content} onChange={e => setContent(e.target.value)} className="w-full h-48 p-3 border border-zinc-300" />

          <div className="flex flex-wrap gap-4 items-center">
            {images.map((img, i) => (
              <div key={i} className="relative w-20 h-20 border">
                <img src={img} alt="preview" className="w-full h-full object-cover" />
                <button onClick={() => setImages(images.filter((_, idx) => idx !== i))} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5"><X className="w-3 h-3" /></button>
              </div>
            ))}
            <label className="cursor-pointer border border-dashed border-zinc-400 w-20 h-20 flex flex-col items-center justify-center hover:bg-zinc-50 text-zinc-500">
              <ImageIcon className="w-6 h-6 mb-1" />
              <span className="text-xs">添加图片</span>
              <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
            </label>
          </div>

          <div className="border p-4 rounded-sm">
            <label className="flex items-center gap-2 font-bold cursor-pointer">
              <input type="checkbox" checked={hasPoll} onChange={e => setHasPoll(e.target.checked)} />
              发起投票
            </label>
            {hasPoll && (
              <div className="mt-4 space-y-3 pl-4 border-l-2 border-zinc-200">
                <input placeholder="投票问题" value={pollQ} onChange={e => setPollQ(e.target.value)} className="w-full p-2 border" />
                {pollOpts.map((opt, i) => (
                  <input key={i} placeholder={`选项 ${i + 1}`} value={opt} onChange={e => {
                    const newOpts = [...pollOpts];
                    newOpts[i] = e.target.value;
                    setPollOpts(newOpts);
                  }} className="w-full p-2 border" />
                ))}
                <button onClick={() => setPollOpts([...pollOpts, ''])} className="text-sm text-blue-600">+ 增加选项</button>
                <div className="flex gap-4 text-sm">
                  <label><input type="checkbox" checked={isMulti} onChange={e => setIsMulti(e.target.checked)} /> 多选</label>
                  <label>持续天数: <input type="number" value={days} onChange={e => setDays(Number(e.target.value))} className="w-16 border" /></label>
                </div>
              </div>
            )}
          </div>

          <button onClick={submit} className="w-full bg-black text-white py-3 font-bold hover:bg-zinc-800">发布</button>
        </div>
      </div>
    </div>
  );
};

// --- 最终整合修正版 PostDetail ---
const PostDetail = ({ postId, user, usersMap, onBack, onViewProfile, onDelete, showToast }: { 
  postId: string, 
  user: User, 
  usersMap: Record<string, User>, 
  onBack: () => void, 
  onViewProfile: (uid: string) => void, 
  onDelete: () => void, 
  showToast: (msg: string, type: ToastType) => void 
}) => {
  // 1. 基础状态
  const [post, setPost] = useState<any>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // 2. 编辑与交互状态
  const [isEditingPost, setIsEditingPost] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [newComment, setNewComment] = useState('');
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [showCollectionModal, setShowCollectionModal] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');
  const commentInputRef = useRef<HTMLTextAreaElement>(null);

  // 3. 数据初始加载
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const { data: postData } = await supabase.from('posts').select('*').eq('id', postId).single();
        const { data: commentData } = await supabase.from('comments').select('*').eq('post_id', postId).order('created_at', { ascending: true });
        setPost(postData);
        setComments(commentData || []);
      } catch (err) {
        showToast("内容加载失败", "error");
      } finally {
        setLoading(false);
      }
    };
    if (postId) loadData();
  }, [postId]);

  // 4. 实时订阅
  useEffect(() => {
    const channel = supabase.channel(`post_sync_${postId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'posts', filter: `id=eq.${postId}` }, payload => setPost(payload.new))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comments', filter: `post_id=eq.${postId}` }, () => {
        supabase.from('comments').select('*').eq('post_id', postId).then(({ data }) => setComments(data || []));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [postId]);

  // 5. 渲染拦截（白屏克星）
  if (loading) return <div className="p-20 text-center text-zinc-500">正在努力加载内容...</div>;
  if (!post) return <div className="p-20 text-center text-zinc-500">未找到该帖子</div>;

  // 6. 权限计算
  const isAdminOrInver = user ? ['admin', 'i女er'].includes(user.role) : false;
  const postTime = post.created_at || post.createdAt || new Date().toISOString();
  const canEditPost = user.id === post.userId && (Date.now() - new Date(postTime).getTime() < 10 * 60 * 1000);

  // 7. 处理函数
  const handleComment = async () => {
    if (!newComment.trim()) return;
    const { error } = await supabase.from('comments').insert({
      post_id: postId,
      user_id: user.id,
      username: user.username,
      content: newComment,
      reply_to_id: replyTo
    });
    if (error) showToast("发送失败", "error");
    else {
      setNewComment('');
      setReplyTo(null);
    }
  };

  return (
    <div className="flex flex-col min-h-screen">
      <div className="max-w-3xl mx-auto py-8 px-4 flex-1 pb-32 w-full">
        <button onClick={onBack} className="mb-4 text-sm text-zinc-500 hover:text-black">← 返回列表</button>

        <div className="bg-white border border-zinc-200 p-6 shadow-sm mb-6">
          <div className="flex items-start gap-4 mb-4">
            <div className="flex-shrink-0 cursor-pointer" onClick={() => onViewProfile(post.userId)}>
              <Avatar url={usersMap[post.userId]?.avatar} className="w-12 h-12" />
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-bold mb-2">{post.title}</h1>
              <div className="text-sm text-zinc-500 flex gap-3 items-center">
                <span className="bg-zinc-100 px-2 py-0.5 rounded text-xs">{post.category}</span>
                <span className="hover:underline cursor-pointer">{post.username}</span>
                <span>{timeAgo(postTime)}</span>
                {(post.is_essence || post.isEssence) && <span className="bg-black text-white px-1.5 text-xs">蒂</span>}
                {canEditPost && (
                  <button onClick={() => { setEditContent(post.content); setIsEditingPost(true); }} className="text-blue-600 hover:underline ml-2">修改</button>
                )}
              </div>
            </div>
            {isAdminOrInver && (
              <div className="flex gap-2">
                <button onClick={async () => { await supabase.from('posts').update({ is_essence: !post.is_essence }).eq('id', post.id); }} className="p-2 hover:bg-zinc-100 rounded">
                  <Star className={`w-4 h-4 ${post.is_essence ? 'fill-yellow-500' : ''}`} />
                </button>
                <button onClick={async () => { await deletePost(post.id); onDelete(); }} className="p-2 hover:bg-red-50 text-red-600 rounded"><Trash2 className="w-4 h-4" /></button>
              </div>
            )}
          </div>

          {isEditingPost ? (
            <div className="space-y-2">
              <textarea className="w-full border p-2 h-64" value={editContent} onChange={e => setEditContent(e.target.value)} />
              <div className="flex gap-2">
                <button onClick={async () => { await supabase.from('posts').update({ content: editContent }).eq('id', post.id); setIsEditingPost(false); }} className="bg-black text-white px-3 py-1 text-sm">保存</button>
                <button onClick={() => setIsEditingPost(false)} className="bg-zinc-200 px-3 py-1 text-sm">取消</button>
              </div>
            </div>
          ) : (
            <div className="prose max-w-none mb-8 whitespace-pre-wrap leading-relaxed">{post.content}</div>
          )}
        </div>

        {/* 评论列表 */}
        <div className="space-y-4">
          {comments.map(c => (
            <div key={c.id} className="bg-zinc-50 p-4 border-b border-zinc-200 text-sm">
              <div className="flex justify-between mb-2 font-bold">{c.username} <span className="text-zinc-400 font-normal text-xs">{timeAgo(c.created_at)}</span></div>
              <p>{c.content}</p>
            </div>
          ))}
        </div>
      </div>

      {/* 底部输入框 */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-3">
        <div className="max-w-3xl mx-auto flex gap-2">
          <textarea 
            ref={commentInputRef}
            value={newComment}
            onChange={e => setNewComment(e.target.value)}
            className="flex-1 border rounded p-2 h-12 text-sm"
            placeholder="发表评论..."
          />
          <button onClick={handleComment} className="bg-black text-white px-4 rounded"><Send className="w-4 h-4"/></button>
        </div>
      </div>
    </div>
  );
};

// 从环境变量获取管理员暗号
const Login = ({ onLogin }: { onLogin: (u: User) => void }) => {
  const [id, setId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showPass, setShowPass] = useState(false);

  // ✅ 必须放在 Login 组件的大括号内部，handleLogin 的外面
  const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD;

  const handleLogin = async () => {
    if (!id || !password) {
      setError('请输入 ID 和密码');
      return;
    }

    // 1. 管理员暗号登录逻辑
    if (id === 'admin') {
      if (password === ADMIN_PASSWORD) {
        // 使用 await 调用你导入的 supabase
        const { data } = await supabase
          .from('users')
          .select('*')
          .eq('id', 'admin')
          .single();

        if (data) {
          onLogin(data as User); // ✅ 用 'as User' 消除类型红线
        } else {
          // 如果数据库没数据，给一个默认的管理员对象
          onLogin({
            id: 'admin',
            username: '管理员',
            role: 'admin',
            isFirstLogin: false,
            isBanned: false,
            createdAt: new Date().toISOString()
          } as User);
        }
        return;
      } else {
        setError('管理员暗号错误');
        return;
      }
    }

    // 2. 普通用户本地登录逻辑
    const user = getUser(id);
    if (user && user.password === password) {
      onLogin(user);
    } else {
      setError('账号或密码错误');
    }
  };
  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold">登录小组</h2>
          <p className="mt-2 text-zinc-500">请输入管理员分发的 ID 和密码</p>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-bold text-zinc-700">用户 ID</label>
            <input
              value={id}
              onChange={e => setId(e.target.value)}
              className="w-full p-3 border border-zinc-300 outline-none focus:border-black transition-colors bg-zinc-50 focus:bg-white"
              placeholder="输入 ID..."
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-zinc-700">密码</label>
            <div className="relative">
              <input
                type={showPass ? "text" : "password"}
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full p-3 border border-zinc-300 outline-none focus:border-black transition-colors bg-zinc-50 focus:bg-white pr-10"
                placeholder="输入密码..."
              />
              <button
                onClick={() => setShowPass(!showPass)}
                className="absolute right-3 top-3.5 text-zinc-400 hover:text-black"
              >
                {showPass ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-3 text-sm flex items-center gap-2">
            <X className="w-4 h-4" /> {error}
          </div>
        )}

        <button
          onClick={handleLogin}
          className="w-full bg-black text-white py-4 font-bold text-lg hover:bg-zinc-800 transition-transform active:scale-[0.99]"
        >
          立即登录
        </button>

        <p className="text-center text-xs text-zinc-400">
          如忘记密码或 ID，请联系管理员重置
        </p>
      </div>
    </div>
  );
};

// --- Main App Component ---

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [view, setView] = useState<'landing' | 'login' | 'feed' | 'admin' | 'post' | 'profile'>('landing');
  const [currentCategory, setCurrentCategory] = useState<Category | '全部'>('全部');
  const [searchQuery, setSearchQuery] = useState('');
  const [onlyEssence, setOnlyEssence] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [targetProfileId, setTargetProfileId] = useState<string | null>(null);
  const [isCreatingPost, setIsCreatingPost] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0); // Force re-render list
  const [unreadCount, setUnreadCount] = useState(0);
  const [usersMap, setUsersMap] = useState<Record<string, User>>({});

  const [displayPosts, setDisplayPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Toast State
  const [toast, setToast] = useState<{ msg: string, type: ToastType } | null>(null);

  useEffect(() => {
    const savedUser = sessionStorage.getItem('currentUser');
    if (savedUser) {
      const u = JSON.parse(savedUser);
      const freshUser = getUser(u.id);
      if (freshUser && !freshUser.isBanned) {
        setUser(freshUser);
        setView('feed');
      }
    }
  }, []);
  // --- 粘贴开始 ---
  useEffect(() => {
    const loadPosts = async () => {
      setIsLoading(true);
      try {
        // 这里的 getPosts 是你之前修改的异步 Supabase 版本
        const data = await getPosts(currentCategory, onlyEssence ? 'essence' : 'new');
        setDisplayPosts(data || []);
      } catch (err) {
        console.error("加载帖子失败:", err);
      } finally {
        setIsLoading(false);
      }
    };

    loadPosts();
  }, [currentCategory, onlyEssence, refreshKey]); // 监听这些变量，实现自动刷新
  // --- 粘贴结束 ---

  useEffect(() => {
    if (!user) return;
    // Initial fetch
    const db = getDB();
    const map: Record<string, User> = {};
    db.users.forEach(u => map[u.id] = u);
    setUsersMap(map);
    setUnreadCount(getUnreadNotificationCount(user.id));

    const interval = setInterval(() => {
      setUnreadCount(getUnreadNotificationCount(user.id));
      const db = getDB();
      const map: Record<string, User> = {};
      db.users.forEach(u => map[u.id] = u);
      setUsersMap(map);
    }, 2000);

    return () => clearInterval(interval);
  }, [user]);

  const showToast = (msg: string, type: ToastType) => {
    setToast({ msg, type });
  };

  const handleLogin = (u: User) => {
    if (u.isFirstLogin) {
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

  const handleLogout = () => {
    setUser(null);
    sessionStorage.removeItem('currentUser');
    setView('landing');
  };

  const handleViewProfile = (userId: string) => {
    setTargetProfileId(userId);
    setView('profile');
    setSelectedPostId(null);
  };

  const refreshData = () => {
    setRefreshKey(prev => prev + 1);
  };

  if (user && user.isFirstLogin) {
    return (
      <ChangePasswordModal user={user} onComplete={handleUpdateProfile} />
    );
  }

  if (view === 'landing') {
    return <Landing onLoginClick={() => setView('login')} />;
  }

  if (view === 'login') {
    return <Login onLogin={handleLogin} />;
  }

  const isAdminOrInver = user ? ['admin', 'i女er'].includes(user.role) : false;

  return (
    <div className="min-h-screen bg-white text-zinc-900">
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      {/* Navbar */}
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
              />
              <Search className="w-4 h-4 absolute left-2.5 top-2 text-zinc-400" />
            </div>

            <div className="flex items-center gap-2 border-l pl-4 border-zinc-200">
              <div onClick={() => handleViewProfile(user!.id)} className="flex items-center gap-2 cursor-pointer hover:bg-zinc-50 p-1 rounded-full transition-colors">
                <div className="relative">
                  <Avatar url={user?.avatar} className="w-6 h-6" />
                  {unreadCount > 0 && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border border-white"></span>}
                </div>
                <span className="text-sm font-bold hidden sm:block">{user?.username}</span>
              </div>

              {isAdminOrInver && (
                <button onClick={() => setView('admin')} className="p-2 hover:bg-zinc-100 rounded-full" title="管理后台">
                  <Menu className="w-5 h-5" />
                </button>
              )}
              <button onClick={handleLogout} className="p-2 hover:bg-zinc-100 rounded-full" title="退出">
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Category Nav */}
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
                {/* Filters bar */}
                <div className="flex justify-between items-center pb-2 border-b border-zinc-100">
                  <div className="flex gap-4 text-sm">
                    <label className="flex items-center gap-1 cursor-pointer select-none">
                      <input type="checkbox" checked={onlyEssence} onChange={e => setOnlyEssence(e.target.checked)} className="accent-black" />
                      只看精华 <span className="bg-black text-white text-[10px] px-1">蒂</span>
                    </label>
                  </div>
                  <button 
                    onClick={() => setIsCreatingPost(true)}
                    className="bg-black text-white px-4 py-2 text-sm font-medium flex items-center gap-2 hover:bg-zinc-800 transition-shadow shadow-md"
                  >
                    <PenSquare className="w-4 h-4" /> 发帖
                  </button>
                </div>

                {/* Post List */}
                <div className="space-y-0 divide-y divide-zinc-100">
                  {isLoading ? (
                    <div className="py-20 text-center text-zinc-400">正在加载内容...</div>
                  ) : (
                    <>
                      {(displayPosts || []).length > 0 ? (
                        displayPosts
                          .filter(p => (p.title || '').includes(searchQuery) || (p.content || '').includes(searchQuery))
                          .map(post => (
                            <div 
                              key={post.id} 
                              onClick={() => { setSelectedPostId(post.id); setView('post'); }}
                              className="py-4 hover:bg-zinc-50 cursor-pointer group transition-colors px-2"
                            >
                              <div className="flex items-start gap-3">
                                <div className="flex-shrink-0 pt-1" onClick={(e) => { e.stopPropagation(); handleViewProfile(post.user_id); }}>
                                  <Avatar url={usersMap[post.user_id]?.avatar} className="w-10 h-10" />
                                </div>
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    {post.is_essence && <span className="bg-black text-white px-1 text-xs" title="精华帖">蒂</span>}
                                    <h3 className="font-medium text-base group-hover:text-blue-800 transition-colors line-clamp-1">{post.title}</h3>
                                  </div>
                                  <p className="text-zinc-500 text-sm line-clamp-2 mb-2">{(post.content || '').substring(0, 100)}...</p>
                                  <div className="text-xs text-zinc-400 flex gap-3">
                                    <span>{post.category}</span>
                                    <span>•</span>
                                    <span className="hover:text-black hover:underline">{post.author_name || '匿名用户'}</span>
                                    <span>•</span>
                                    <span>{timeAgo(post.created_at)}</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))
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