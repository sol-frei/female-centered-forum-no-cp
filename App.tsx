import { supabase } from './services/supabaseClient';
import React, { useState, useEffect, useRef } from 'react';
import Landing from './components/Landing';
import { User, Post, Category, Collection } from './types';
import { getDB, getUser, createPost, getPosts, toggleLikePost, toggleEssence, deletePost, votePoll, addComment, getComments, updateUser, getUnreadNotificationCount, createCollection, addToCollection, updatePost, updateComment } from './services/storage';
import AdminPanel from './components/AdminPanel';
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

  const submit = () => {
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

      createPost(postData);
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
                  <button onClick={() => setImages(images.filter((_, idx) => idx !== i))} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5"><X className="w-3 h-3"/></button>
               </div>
             ))}
             <label className="cursor-pointer border border-dashed border-zinc-400 w-20 h-20 flex flex-col items-center justify-center hover:bg-zinc-50 text-zinc-500">
                <ImageIcon className="w-6 h-6 mb-1"/>
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
                  <input key={i} placeholder={`选项 ${i+1}`} value={opt} onChange={e => {
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

const PostDetail = ({ postId, user, usersMap, onBack, onViewProfile, onDelete, showToast }: { postId: string, user: User, usersMap: Record<string, User>, onBack: () => void, onViewProfile: (uid: string) => void, onDelete: () => void, showToast: (msg: string, type: ToastType) => void }) => {
  const [post, setPost] = useState<Post | undefined>(getDB().posts.find(p => p.id === postId));
  const [comments, setComments] = useState(getComments(postId));
  const [newComment, setNewComment] = useState('');
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [showCollectionModal, setShowCollectionModal] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');
  const [userCollections, setUserCollections] = useState<Collection[]>([]);
  
  // Edit States
  const [isEditingPost, setIsEditingPost] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editCategory, setEditCategory] = useState<Category>('讨论👊🏻i女');
  
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editCommentContent, setEditCommentContent] = useState('');

  const commentInputRef = useRef<HTMLTextAreaElement>(null);

  const isAdminOrInver = ['admin', 'i女er'].includes(user.role);

  // Check if post is editable (author & < 10 mins)
  const canEditPost = post && user.id === post.userId && (Date.now() - new Date(post.createdAt).getTime() < 10 * 60 * 1000);

  useEffect(() => {
    if(user) {
      setUserCollections(getDB().collections.filter(c => c.userId === user.id));
    }
  }, [user, showCollectionModal]);

  if (!post) return <div>帖子不存在</div>;

  const handleComment = () => {
    if (!newComment.trim()) return;
    try {
      addComment({
        id: Date.now().toString(),
        postId,
        userId: user.id,
        username: user.username,
        content: newComment,
        createdAt: new Date().toISOString(),
        likes: [],
        replyToId: replyTo || undefined
      });
      setNewComment('');
      setReplyTo(null);
      setComments(getComments(postId));
    } catch (e: any) {
      showToast(e.message, 'error');
    }
  };

  const handleVote = (optId: string) => {
    votePoll(postId, optId, user.id);
    setPost(getDB().posts.find(p => p.id === postId)); 
  };

  const handleCreateCollection = () => {
    if (!newCollectionName.trim()) return;
    createCollection(user.id, newCollectionName);
    setUserCollections(getDB().collections.filter(c => c.userId === user.id));
    setNewCollectionName('');
  };

  const startEditPost = () => {
    setEditTitle(post.title);
    setEditContent(post.content);
    setEditCategory(post.category);
    setIsEditingPost(true);
  };

  const savePostEdit = () => {
    try {
      updatePost(post.id, { title: editTitle, content: editContent, category: editCategory });
      setPost(getDB().posts.find(p => p.id === postId));
      setIsEditingPost(false);
      showToast('修改成功', 'success');
    } catch (e: any) {
      showToast(e.message, 'error');
    }
  };

  const startEditComment = (comment: any) => {
    setEditingCommentId(comment.id);
    setEditCommentContent(comment.content);
  };

  const saveCommentEdit = (commentId: string) => {
    try {
      updateComment(commentId, editCommentContent);
      setComments(getComments(postId));
      setEditingCommentId(null);
      showToast('评论修改成功', 'success');
    } catch (e: any) {
      showToast(e.message, 'error');
    }
  };

  return (
    <div className="flex flex-col min-h-screen">
      <div className="max-w-3xl mx-auto py-8 px-4 flex-1 pb-32 w-full">
        <button onClick={onBack} className="mb-4 text-sm text-zinc-500 hover:text-black">← 返回列表</button>
        
        {/* Post Content */}
        <div className="bg-white border border-zinc-200 p-6 shadow-sm mb-6">
          <div className="flex items-start gap-4 mb-4">
            <div className="flex-shrink-0 cursor-pointer" onClick={() => onViewProfile(post.userId)}>
                <Avatar url={usersMap[post.userId]?.avatar} className="w-12 h-12" />
            </div>
            <div className="flex-1">
              {isEditingPost ? (
                <div className="space-y-2 mb-4">
                   <select value={editCategory} onChange={e => setEditCategory(e.target.value as Category)} className="border p-1 text-sm">
                      {CATEGORIES.filter(c => c !== '全部').map(c => <option key={c} value={c}>{c}</option>)}
                   </select>
                   <input className="w-full border p-2 font-bold text-xl" value={editTitle} onChange={e => setEditTitle(e.target.value)} />
                </div>
              ) : (
                <h1 className="text-2xl font-bold mb-2">{post.title}</h1>
              )}
              
              <div className="text-sm text-zinc-500 flex gap-3 items-center">
                {!isEditingPost && <span className="bg-zinc-100 px-2 py-0.5 rounded text-xs">{post.category}</span>}
                <span onClick={() => onViewProfile(post.userId)} className="hover:underline cursor-pointer hover:text-black transition-colors">{post.username}</span>
                <span>{timeAgo(post.createdAt)}</span>
                {post.isEssence && <span className="bg-black text-white px-1.5 text-xs flex items-center">蒂</span>}
                {canEditPost && !isEditingPost && (
                  <button onClick={startEditPost} className="flex items-center gap-1 text-blue-600 hover:underline ml-2">
                    <Edit2 className="w-3 h-3"/> 修改
                  </button>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              {isAdminOrInver && (
                <>
                  <button onClick={() => { toggleEssence(post.id); setPost(getDB().posts.find(p => p.id === postId)); }} title="设为精华/取消" className="p-2 hover:bg-zinc-100 rounded"><Star className={`w-4 h-4 ${post.isEssence ? 'fill-black' : ''}`} /></button>
                  <button onClick={() => { deletePost(post.id); onDelete(); }} title="删除" className="p-2 hover:bg-red-50 text-red-600 rounded"><Trash2 className="w-4 h-4" /></button>
                </>
              )}
            </div>
          </div>

          {isEditingPost ? (
            <div className="mb-4">
               <textarea className="w-full border p-2 h-64" value={editContent} onChange={e => setEditContent(e.target.value)} />
               <div className="flex gap-2 mt-2">
                  <button onClick={savePostEdit} className="bg-black text-white px-3 py-1 text-sm">保存</button>
                  <button onClick={() => setIsEditingPost(false)} className="bg-zinc-200 px-3 py-1 text-sm">取消</button>
               </div>
            </div>
          ) : (
            <div className="prose prose-zinc max-w-none mb-8 whitespace-pre-wrap leading-relaxed text-zinc-800">
              {post.content}
            </div>
          )}
          
          {/* Images */}
          {post.images && post.images.length > 0 && (
            <div className="mb-8 space-y-4">
              {post.images.map((img, i) => (
                <img key={i} src={img} alt="post content" className="max-w-full rounded border border-zinc-100" />
              ))}
            </div>
          )}

          {/* Poll */}
          {post.poll && (
            <div className="bg-zinc-50 p-4 border border-zinc-200 mb-6">
              <h3 className="font-bold mb-3 flex justify-between">
                <span>📊 {post.poll.question}</span>
                <span className="text-xs font-normal text-zinc-500">{post.poll.isMultiple ? '多选' : '单选'} · {new Date(post.poll.deadline) < new Date() ? '已截止' : '进行中'}</span>
              </h3>
              <div className="space-y-2">
                {post.poll.options.map(opt => {
                  const totalVotes = post.poll!.options.reduce((acc, o) => acc + o.votes.length, 0);
                  const percent = totalVotes === 0 ? 0 : Math.round((opt.votes.length / totalVotes) * 100);
                  const isVoted = opt.votes.includes(user.id);
                  return (
                    <div key={opt.id} className="relative group cursor-pointer" onClick={() => handleVote(opt.id)}>
                      <div className="flex justify-between text-sm mb-1 z-10 relative">
                        <span className={isVoted ? 'font-bold' : ''}>{opt.text} {isVoted && '✓'}</span>
                        <span>{opt.votes.length}票 ({percent}%)</span>
                      </div>
                      <div className="h-2 bg-zinc-200 rounded-full overflow-hidden">
                        <div className="h-full bg-zinc-800 transition-all" style={{ width: `${percent}%` }}></div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-6 pt-4 border-t border-zinc-100 text-zinc-500 text-sm">
            <button 
              onClick={() => { toggleLikePost(post.id, user.id); setPost(getDB().posts.find(p => p.id === postId)); }}
              className={`flex items-center gap-1 hover:text-red-600 transition-colors ${post.likes.includes(user.id) ? 'text-red-600' : ''}`}
            >
              <Heart className={`w-4 h-4 ${post.likes.includes(user.id) ? 'fill-current' : ''}`} /> {post.likes.length} 赞
            </button>
            <button 
              onClick={() => setShowCollectionModal(true)}
              className="flex items-center gap-1 hover:text-blue-600 transition-colors"
            >
              <Bookmark className="w-4 h-4" /> 收藏
            </button>
          </div>
        </div>

        {/* Comments List */}
        <div className="space-y-4">
          {comments.map((comment, i) => {
            const parent = comment.replyToId ? comments.find(c => c.id === comment.replyToId) : null;
            const canEditComment = user.id === comment.userId && (Date.now() - new Date(comment.createdAt).getTime() < 10 * 60 * 1000);
            
            return (
                <div key={comment.id} className="bg-zinc-50 p-4 border-b border-zinc-200 text-sm flex gap-3">
                  <div className="flex-shrink-0 cursor-pointer" onClick={() => onViewProfile(comment.userId)}>
                      <Avatar url={usersMap[comment.userId]?.avatar} className="w-8 h-8" />
                  </div>
                  <div className="flex-1">
                      <div className="flex justify-between mb-2">
                        <span onClick={() => onViewProfile(comment.userId)} className="font-bold text-zinc-700 hover:underline cursor-pointer">{comment.username}</span>
                        <div className="flex gap-2 items-center">
                           <span className="text-zinc-400 text-xs">{timeAgo(comment.createdAt)}</span>
                           {canEditComment && editingCommentId !== comment.id && (
                             <button onClick={() => startEditComment(comment)} className="text-blue-600 text-xs hover:underline">修改</button>
                           )}
                        </div>
                      </div>
                      
                      {/* Quote Logic */}
                      {comment.replyToId && (
                        <div className="bg-zinc-100 p-2 text-xs text-zinc-500 mb-2 border-l-2 border-zinc-300">
                            {parent ? (
                                <>
                                  <span className="font-bold">@{parent.username}:</span> {parent.content}
                                </>
                            ) : (
                                <span className="italic">该评论已被删除</span>
                            )}
                        </div>
                      )}

                      {editingCommentId === comment.id ? (
                        <div className="mb-2">
                           <textarea className="w-full border p-2 text-sm" value={editCommentContent} onChange={e => setEditCommentContent(e.target.value)} />
                           <div className="flex gap-2 mt-1">
                              <button onClick={() => saveCommentEdit(comment.id)} className="bg-black text-white px-2 py-0.5 text-xs">保存</button>
                              <button onClick={() => setEditingCommentId(null)} className="bg-zinc-200 px-2 py-0.5 text-xs">取消</button>
                           </div>
                        </div>
                      ) : (
                        <p className="text-zinc-800 mb-2">{comment.content}</p>
                      )}
                      
                      <div className="flex gap-4 text-xs text-zinc-500">
                        <button onClick={() => { setReplyTo(comment.id); commentInputRef.current?.focus(); }} className="hover:underline">回复</button>
                      </div>
                  </div>
                </div>
            )
          })}
        </div>
      </div>

      {/* Sticky Bottom Input */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-zinc-200 p-3 shadow-[0_-2px_10px_rgba(0,0,0,0.05)] z-40">
        <div className="max-w-3xl mx-auto flex flex-col gap-2">
           {replyTo && (
              <div className="text-xs bg-zinc-50 p-2 border-l-2 border-black flex justify-between items-center">
                <span>
                  回复 <span className="font-bold">{comments.find(c => c.id === replyTo)?.username}</span>
                </span>
                <button onClick={() => setReplyTo(null)} className="text-zinc-400 hover:text-black"><X className="w-3 h-3"/></button>
              </div>
           )}
           <div className="flex gap-2">
             <textarea 
               ref={commentInputRef}
               value={newComment}
               onChange={e => setNewComment(e.target.value)}
               placeholder={replyTo ? "输入回复..." : "发表评论..."}
               className="flex-1 p-3 bg-zinc-50 border border-zinc-200 rounded-lg outline-none resize-none text-sm h-12 focus:bg-white focus:border-black transition-all"
             />
             <button onClick={handleComment} className="bg-black text-white px-4 rounded-lg flex items-center justify-center hover:bg-zinc-800 transition-colors">
               <Send className="w-4 h-4"/>
             </button>
           </div>
        </div>
      </div>

      {/* Collection Modal */}
      {showCollectionModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
          <div className="bg-white p-6 w-96 max-w-full shadow-lg">
            <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold">添加到收藏夹</h3>
                <button onClick={() => setShowCollectionModal(false)}><X className="w-4 h-4" /></button>
            </div>
            <div className="max-h-48 overflow-y-auto space-y-2 mb-4">
              {userCollections.length === 0 ? <p className="text-sm text-zinc-400">暂无收藏夹</p> : 
              userCollections.map(col => (
                <button 
                  key={col.id}
                  onClick={() => { addToCollection(col.id, post.id); setShowCollectionModal(false); showToast('已收藏', 'success'); }}
                  className="w-full text-left p-2 hover:bg-zinc-100 flex justify-between items-center border border-zinc-100"
                >
                  <span className="font-bold text-sm">{col.name}</span>
                  <span className="text-zinc-400 text-xs">{col.postIds.length} 篇</span>
                </button>
              ))}
            </div>
            <div className="flex gap-2 pt-2 border-t border-zinc-100">
              <input placeholder="新建收藏夹..." value={newCollectionName} onChange={e => setNewCollectionName(e.target.value)} className="border p-2 flex-1 text-sm outline-none" />
              <button onClick={handleCreateCollection} className="bg-black text-white px-3 text-sm">新建</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// --- Auth Components ---

const ChangePasswordModal = ({ user, onComplete }: { user: User, onComplete: (u: User) => void }) => {
  const [nickname, setNickname] = useState(user.username || '');
  const [pass1, setPass1] = useState('');
  const [pass2, setPass2] = useState('');
  const [showPass1, setShowPass1] = useState(false);
  const [showPass2, setShowPass2] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = () => {
    if (!nickname.trim()) {
      setError('请输入昵称');
      return;
    }
    if (!pass1 || !pass2) {
      setError('请输入新密码');
      return;
    }
    if (pass1 !== pass2) {
      setError('两次输入的密码不一致');
      return;
    }
    if (pass1.length < 6) {
      setError('密码长度至少6位');
      return;
    }
    
    const updated = updateUser(user.id, { username: nickname, password: pass1, isFirstLogin: false });
    if (updated) {
      onComplete(updated);
    } else {
      setError('更新失败');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
      <div className="bg-white p-8 max-w-md w-full text-center space-y-6 animate-in zoom-in-95">
        <h2 className="text-2xl font-bold">首次登录完善信息</h2>
        <p className="text-zinc-500 text-sm">为了您的账号安全，请设置昵称和新密码。</p>
        
        <div className="space-y-4">
          <div className="text-left">
            <label className="text-xs font-bold text-zinc-500 mb-1 block">昵称</label>
            <input 
              type="text" 
              placeholder="设置昵称" 
              className="w-full p-3 border border-zinc-300 outline-none focus:border-black"
              value={nickname}
              onChange={e => setNickname(e.target.value)}
            />
          </div>

          <div className="text-left relative">
            <label className="text-xs font-bold text-zinc-500 mb-1 block">新密码</label>
            <div className="relative">
              <input 
                type={showPass1 ? "text" : "password"} 
                placeholder="新密码 (至少6位)" 
                className="w-full p-3 border border-zinc-300 outline-none focus:border-black pr-10"
                value={pass1}
                onChange={e => setPass1(e.target.value)}
              />
              <button 
                 onClick={() => setShowPass1(!showPass1)}
                 className="absolute right-3 top-3.5 text-zinc-400 hover:text-black"
                 type="button"
               >
                 {showPass1 ? <EyeOff className="w-5 h-5"/> : <Eye className="w-5 h-5"/>}
               </button>
            </div>
          </div>

          <div className="text-left relative">
            <label className="text-xs font-bold text-zinc-500 mb-1 block">确认密码</label>
            <div className="relative">
              <input 
                type={showPass2 ? "text" : "password"} 
                placeholder="再次输入新密码" 
                className="w-full p-3 border border-zinc-300 outline-none focus:border-black pr-10"
                value={pass2}
                onChange={e => setPass2(e.target.value)}
              />
               <button 
                 onClick={() => setShowPass2(!showPass2)}
                 className="absolute right-3 top-3.5 text-zinc-400 hover:text-black"
                 type="button"
               >
                 {showPass2 ? <EyeOff className="w-5 h-5"/> : <Eye className="w-5 h-5"/>}
               </button>
            </div>
          </div>
        </div>

        {error && <p className="text-red-500 text-sm">{error}</p>}

        <button 
          onClick={handleSubmit}
          className="w-full bg-black text-white py-3 font-bold hover:bg-zinc-800 transition-colors"
        >
          确认修改并进入
        </button>
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
                 {showPass ? <EyeOff className="w-5 h-5"/> : <Eye className="w-5 h-5"/>}
               </button>
             </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-3 text-sm flex items-center gap-2">
            <X className="w-4 h-4"/> {error}
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
  
  // Toast State
  const [toast, setToast] = useState<{msg: string, type: ToastType} | null>(null);

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
            {/* Main Column */}
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
                    {getPosts(currentCategory, onlyEssence ? 'essence' : 'new')
                      .filter(p => p.title.includes(searchQuery) || p.content.includes(searchQuery))
                      .map(post => (
                      <div 
                        key={post.id} 
                        onClick={() => { setSelectedPostId(post.id); setView('post'); }}
                        className="py-4 hover:bg-zinc-50 cursor-pointer group transition-colors px-2"
                      >
                        <div className="flex items-start gap-3">
                           <div className="flex-shrink-0 pt-1" onClick={(e) => { e.stopPropagation(); handleViewProfile(post.userId); }}>
                              <Avatar url={usersMap[post.userId]?.avatar} className="w-10 h-10" />
                           </div>
                           <div className="flex-1">
                             <div className="flex items-center gap-2 mb-1">
                               {post.isEssence && <span className="bg-black text-white px-1 text-xs" title="精华帖">蒂</span>}
                               {post.poll && <span className="bg-zinc-200 text-zinc-600 px-1 text-xs rounded">投票</span>}
                               <h3 className="font-medium text-base group-hover:text-blue-800 transition-colors line-clamp-1">{post.title}</h3>
                             </div>
                             <p className="text-zinc-500 text-sm line-clamp-2 mb-2">{post.content.substring(0, 100)}...</p>
                             <div className="text-xs text-zinc-400 flex gap-3">
                               <span>{post.category}</span>
                               <span>•</span>
                               <span onClick={(e) => { e.stopPropagation(); handleViewProfile(post.userId); }} className="hover:text-black hover:underline">{post.username}</span>
                               <span>•</span>
                               <span>{timeAgo(post.createdAt)}</span>
                               <span className="ml-auto flex gap-3">
                                  <span className="flex items-center gap-1"><MessageSquare className="w-3 h-3" /> {getComments(post.id).length}</span>
                                  <span className="flex items-center gap-1"><Heart className="w-3 h-3" /> {post.likes.length}</span>
                               </span>
                             </div>
                           </div>
                        </div>
                      </div>
                    ))}
                    {getPosts(currentCategory, 'new').length === 0 && (
                      <div className="text-center py-20 text-zinc-400">暂无内容</div>
                    )}
                  </div>
                </div>
              )}
            </div>
            
            {/* Sidebar (Desktop) - CLEANED UP */}
            <div className="hidden md:block w-0">
               {/* Sidebar removed as requested for cleaner look */}
            </div>
          </div>
        )}
      </main>

      {isCreatingPost && (
        <CreatePostModal 
          user={user!} 
          onClose={() => setIsCreatingPost(false)} 
          onSuccess={() => { setIsCreatingPost(false); refreshData(); }}
          showToast={showToast}
        />
      )}
    </div>
  );
}