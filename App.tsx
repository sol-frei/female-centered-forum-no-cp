import { supabase } from './services/supabaseClient';
import React, { useState, useEffect, useRef } from 'react';
import Landing from './components/Landing';
import { User, Post, Category, Collection, Notification, SensitiveWords } from './types';
import { get_all_users, get_user, create_post, get_posts, toggle_like_post, toggle_essence_post, delete_post, vote_poll, add_comment, update_post, getComments, updateUser, getUnreadNotificationCount, create_collection, addToCollection, updatePost, update_comment, toggle_lock_post, delete_comment,check_sensitive_words } from './services/storage';
import AdminPanel from './components/AdminPanel';
import ChangePasswordModal from './components/ChangePasswordModal';
import UserProfile from './components/UserProfile';
import Toast, { ToastType } from './components/Toast';
import CreatePostModal from "./components/CreatePostModal";
import { Search, LogOut, Menu, UserCircle, PenSquare, Heart, MessageCircle, MessageSquare, Trash2, X, Plus, Check, Star, Eye, EyeOff, Image as ImageIcon, Bookmark, Send, Edit2, MoreVertical } from 'lucide-react';

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
    return <img src={url} alt="用户头像" className={`${className} rounded-full object-cover bg-zinc-100 border border-zinc-100`} />;
  }
  return <UserCircle className={`${className} text-zinc-300`} />;
};

// 帖子详情组件
interface PostDetailProps {
  postId: string;
  user: User;
  usersMap: Record<string, User>;
  onBack: () => void;
  onViewProfile: (uid: string) => void;
  onDelete: () => void;
  showToast: (msg: string, type: ToastType) => void;
}

const PostDetail = ({
  postId,
  user,
  usersMap,
  onBack,
  onViewProfile,
  onDelete,
  showToast,
}: PostDetailProps) => {
  // 1. 基础状态
  const [post, setPost] = useState<any | null>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // 2. 评论与交互状态
  const [newComment, setNewComment] = useState('');
  const [replyToCommentId, setReplyToCommentId] = useState<string | null>(null);
  const commentInputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 新增：评论图片上传
  const [commentImages, setCommentImages] = useState<File[]>([]);
  const [uploadingComment, setUploadingComment] = useState(false);

  // 3. 收藏状态
  const [showCollectionModal, setShowCollectionModal] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');
  const [userCollections, setUserCollections] = useState<Collection[]>([]);

  // 4. 编辑帖子状态
  const [isEditingPost, setIsEditingPost] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editCategory, setEditCategory] = useState<Category>('讨论👊🏻i女');

  // 5. 编辑评论状态
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editCommentContent, setEditCommentContent] = useState('');

  // --- 数据初始加载 ---
  const fetchPostAndComments = async () => {
    setLoading(true);
    try {
      const { data: postData, error: postError } = await supabase
        .from('posts')
        .select('*')
        .eq('id', postId)
        .single();

      if (postError) throw postError;

      const { data: commentData, error: commentError } = await supabase
        .from('comments')
        .select('*')
        .eq('post_id', postId)
        .order('created_at', { ascending: true });

      if (commentError) throw commentError;

      setPost(postData);
      setComments(commentData || []);
    } catch (err: any) {
      showToast(`内容加载失败: ${err.message}`, "error");
      setPost(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (postId) {
      fetchPostAndComments();
    }
  }, [postId]);

  // --- 实时订阅 ---
  useEffect(() => {
    if (!postId) return;

    const postChannel = supabase.channel(`post_${postId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'posts', filter: `id=eq.${postId}` }, payload => {
        setPost(payload.new);
      })
      .subscribe();

    const commentsChannel = supabase
         .channel(`comments_for_${postId}`)
         .on('postgres_changes', { 
         event: '*', 
         schema: 'public', 
         table: 'comments', 
         filter: `post_id=eq.${postId}` 
         }, async (payload) => {
     try {
      const { data } = await supabase
        .from('comments')
        .select('*')
        .eq('post_id', postId)
        .order('created_at', { ascending: true });
      setComments(data || []);
    } catch (err) {
      console.error("获取评论失败:", err);
    }
    })
  .subscribe();

    return () => {
      supabase.removeChannel(postChannel);
      supabase.removeChannel(commentsChannel);
    };
  }, [postId]);

  // --- 收藏列表加载 ---
  useEffect(() => {
    const fetchCollections = async () => {
      if (user && showCollectionModal) {
        try {
          const { data, error } = await supabase
            .from('collections')
            .select('*')
            .eq('user_id', user.id);

          if (error) throw error;
          setUserCollections(data || []);
        } catch (err: any) {
          showToast(`获取收藏夹失败: ${err.message}`, 'error');
        }
      }
    };
    fetchCollections();
  }, [user, showCollectionModal]);

  // --- 渲染拦截 ---
  if (loading) return <div className="p-20 text-center text-zinc-500">正在努力加载内容...</div>;
  if (!post) return <div className="p-20 text-center text-zinc-500">未找到该帖子</div>;

  // --- 权限计算 ---
  const isAdminOrInver = user ? ['admin', 'i女er'].includes(user.role) : false;
  const postCreatedAt = post.created_at || post.createdAt || new Date().toISOString();
  const canEditPost = user && user.id === post.user_id;
  // --- 处理图片选择 ---
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    
    const files = Array.from(e.target.files);
    if (files.length + commentImages.length > 3) {
      showToast("最多只能上传3张图片", "error");
      return;
    }

    setCommentImages(prev => [...prev, ...files]);
    
    // 清空 input 的值，允许重复选择同一文件
    e.target.value = '';
  };

  const removeCommentImage = (index: number) => {
    setCommentImages(prev => prev.filter((_, i) => i !== index));
  };

  // --- 上传图片到 Supabase Storage ---
  const uploadCommentImages = async (): Promise<string[]> => {
    const uploadedUrls: string[] = [];
    
    for (const file of commentImages) {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}_${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('comment_images')
        .upload(filePath, file);

      if (uploadError) {
        throw new Error(`图片上传失败: ${uploadError.message}`);
      }

      const { data: { publicUrl } } = supabase.storage
        .from('comment_images')
        .getPublicUrl(filePath);

      uploadedUrls.push(publicUrl);
    }

    return uploadedUrls;
  };

  // --- 处理评论提交 ---
  const handleComment = async () => {
    if (!newComment.trim() && commentImages.length === 0) {
      showToast("评论内容或图片不能为空", 'error');
      return;
    }

    try {
      setUploadingComment(true);

      // 上传图片
      let imageUrls: string[] = [];
      if (commentImages.length > 0) {
        imageUrls = await uploadCommentImages();
      }

      await add_comment({
        post_id: postId,
        user_id: user.id,
        user_name: user.user_name,
        content: newComment,
        reply_to_id: replyToCommentId || null,
        images: imageUrls.length > 0 ? imageUrls : null,
        likes: [],
      },
      post.user_id,
      post.title
      );

      setNewComment('');
      setReplyToCommentId(null);
      setCommentImages([]);
      showToast("评论成功", "success");
    } catch (e: any) {
      showToast(`评论失败: ${e.message}`, 'error');
    } finally {
      setUploadingComment(false);
    }
  };

  // --- 点赞评论 ---
  const handleLikeComment = async (commentId: string) => {
    try {
      const comment = comments.find(c => c.id === commentId);
      if (!comment) return;

      const currentLikes = comment.likes || [];
      const hasLiked = currentLikes.includes(user.id);
      const newLikes = hasLiked 
        ? currentLikes.filter((id: string) => id !== user.id)
        : [...currentLikes, user.id];

      const { error } = await supabase
        .from('comments')
        .update({ likes: newLikes })
        .eq('id', commentId);

      if (error) throw error;
    } catch (e: any) {
      showToast(`操作失败: ${e.message}`, 'error');
    }
  };

  const handleVote = async (optId: string) => {
    try {
      if (new Date(post.poll.deadline) < new Date()) {
        showToast("投票已截止", "error");
        return;
      }
      await vote_poll(post.id, optId, user.id);
      showToast("投票成功", "success");
    } catch (e: any) {
      showToast(`投票失败: ${e.message}`, 'error');
    }
  };



  const handleAddToCollection = async (collectionId: string, collectionName: string) => {
    try {
      await addToCollection(collectionId, postId);
      showToast(`已收藏到 ${collectionName}`, 'success');
      setShowCollectionModal(false);
    } catch (e: any) {
      showToast(`收藏失败: ${e.message}`, 'error');
    }
  };

  const savePostEdit = async () => {
    try {
    // 1. 先进行敏感词校验 (如果不通过，它会直接 throw Error)
    // 校验标题和内容
    await check_sensitive_words(editTitle + editContent);

    // 2. 校验通过后，执行更新
    await update_post(post.id, {
      title: editTitle,
      content: editContent,
      category: editCategory,
      updated_at: new Date().toISOString(),
    });

    setIsEditingPost(false);
    showToast('帖子修改成功', 'success');
  } catch (e: any) {
    // 这里会捕获到 check_sensitive_words 抛出的 "内容包含违禁词，发布失败"
    showToast(e.message || '修改失败', 'error');
  }
  };

  const handleDeletePost = async () => {
    if (!window.confirm("确定要删除这篇帖子吗？")) return;
    try {
      await delete_post(post.id);
      showToast('帖子已删除', 'success');
      onDelete();
    } catch (e: any) {
      showToast(`删除失败: ${e.message}`, 'error');
    }
  };

  const startEditComment = (comment: any) => {
    setEditingCommentId(comment.id);
    setEditCommentContent(comment.content);
  };

  const saveCommentEdit = async (commentId: string) => {
    try {
      await update_comment(commentId, editCommentContent);
      setEditingCommentId(null);
      showToast('评论修改成功', 'success');
    } catch (e: any) {
      showToast(`修改失败: ${e.message}`, 'error');
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!window.confirm("确定要删除这条评论吗？")) return;
    try {
      await delete_comment(commentId);
      showToast('评论已删除', 'success');
    } catch (e: any) {
      showToast(`删除失败: ${e.message}`, 'error');
    }
  };

  const handleReplyClick = (commentId: string, AuthorName: string) => {
    setReplyToCommentId(commentId);
    setNewComment(`@${AuthorName} `);
    commentInputRef.current?.focus();
  };

  return (
    <div className="flex flex-col min-h-screen">
    <div className="w-full flex-1 pb-32 relative">
   <div className="sticky top-[7rem] md:top-12 z-40 w-full bg-white px-3">
    <button onClick={onBack} className="inline-flex items-center gap-1 py-2 text-sm font-medium text-zinc-700 hover:text-black transition-all">
      ← 返回
    </button>
 </div>
        {/* 帖子内容 */}
         <div className="bg-white border-t border-b border-zinc-200 shadow-sm mb-6">
          <div className="px-3 py-4">
          <div className="flex items-start gap-4 mb-4">
            <div className="flex-shrink-0 cursor-pointer" onClick={() => onViewProfile(post.user_id)}>
              <Avatar url={usersMap[post.user_id]?.avatar} className="w-12 h-12" />
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
                <span onClick={() => onViewProfile(post.user_id)} className="hover:underline cursor-pointer hover:text-black transition-colors">{usersMap[post.user_id]?.user_name || '未知用户'}</span>
                <span>{timeAgo(postCreatedAt)}</span>
                 {/* 如果更新时间晚于创建时间，显示“已编辑” */}
                {post.updated_at && post.updated_at !== post.created_at && (
                <span className="text-[10px] text-zinc-400 ml-1">(已编辑)</span>
                 )}
                {(post.is_essence || post.isEssence) && <span className="bg-black text-white px-1.5 text-xs flex items-center">蒂</span>}
  
               {canEditPost && !isEditingPost && (
                   <button 
                  onClick={() => { 
                  setEditTitle(post.title); 
                  setEditContent(post.content); 
                  setEditCategory(post.category); 
                  setIsEditingPost(true); 
                 }} 
                className="flex items-center gap-1 text-blue-600 hover:underline ml-2"
                >
               <Edit2 className="w-3 h-3" /> 修改
               </button>
                )}
              </div>
            </div>

            {isAdminOrInver && (
              <div className="flex gap-2">
                <button onClick={async () => { await toggle_essence_post(post.id, !post.is_essence); }} title="设为精华/取消" className="p-2 hover:bg-zinc-100 rounded">
                  <Star className={`w-4 h-4 ${post.is_essence ? 'fill-yellow-500 text-yellow-500' : ''}`} />
                </button>
              </div>
            )}
          </div>

          {/* 帖子正文 */}
          {isEditingPost ? (
            <div className="mb-4">
              <textarea className="w-full border p-2 h-64" value={editContent} onChange={e => setEditContent(e.target.value)} />
              <div className="flex gap-2 mt-2">
                <button onClick={savePostEdit} className="bg-black text-white px-3 py-1 text-sm">保存</button>
                <button onClick={() => setIsEditingPost(false)} className="bg-zinc-200 px-3 py-1 text-sm">取消</button>
              </div>
            </div>
          ) : (
            <div className="prose prose-zinc w-full max-w-full mb-8 whitespace-pre-wrap leading-relaxed text-zinc-800">
              {post.content}
            </div>
          )}

          {/* 图片展示 */}
          {post.images && post.images.length > 0 && (
            <div className="mb-8 space-y-4">
              {post.images.map((img: string, i: number) => (
                <img key={i} src={img} alt={`帖子图片 ${i + 1}`} className="max-w-full rounded border border-zinc-100" />
              ))}
            </div>
          )}

          {/* 投票区 */}
          {post.poll && (
            <div className="bg-zinc-50 p-4 border border-zinc-200 mb-6 rounded-md">
              <h3 className="font-bold mb-3 flex justify-between items-center">
                <span>📊 {post.poll.question}</span>
                <span className="text-xs font-normal text-zinc-500">{post.poll.isMultiple ? '多选' : '单选'} · {new Date(post.poll.deadline) < new Date() ? '已截止' : '进行中'}</span>
              </h3>
              <div className="space-y-2">
                {post.poll.options.map((opt: any) => {
                  const totalVotes = post.poll!.options.reduce((acc: number, o: any) => acc + (o.votes?.length || 0), 0);
                  const percent = totalVotes === 0 ? 0 : Math.round(((opt.votes?.length || 0) / totalVotes) * 100);
                  const isVoted = opt.votes?.includes(user.id);
                  const pollActive = new Date(post.poll.deadline) >= new Date();

                  return (
                    <div key={opt.id} className={`relative group ${pollActive ? 'cursor-pointer hover:bg-zinc-100' : 'cursor-not-allowed'}`} onClick={() => pollActive && handleVote(opt.id)}>
                      <div className="flex justify-between text-sm mb-1 z-10 relative px-2 py-1">
                        <span className={isVoted ? 'font-bold' : ''}>{opt.text} {isVoted && '✓'}</span>
                        <span>{(opt.votes?.length || 0)}票 ({percent}%)</span>
                      </div>
                      <div className="h-2 bg-zinc-200 rounded-full overflow-hidden mx-2">
                        <div className="h-full bg-zinc-800 transition-all" style={{ width: `${percent}%` }}></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 底部互动操作 */}
          <div className="flex gap-6 pt-4 border-t border-zinc-100 text-zinc-500 text-sm">
            <button
              onClick={async () => { 
                try {
                  await toggle_like_post(post.id, user.id);
                } catch (e: any) {
                  showToast(`点赞失败: ${e.message}`, 'error');
                }
              }}
              className={`flex items-center gap-1 hover:text-red-600 transition-colors ${post.likes?.includes(user.id) ? 'text-red-600' : ''}`}
            >
              <Heart className={`w-4 h-4 ${post.likes?.includes(user.id) ? 'fill-current' : ''}`} /> {(post.likes?.length || 0)} 赞
            </button>
            <button
              onClick={() => setShowCollectionModal(true)}
              className="flex items-center gap-1 hover:text-blue-600 transition-colors"
            >
              <Bookmark className="w-4 h-4" /> 收藏
            </button>
            <button onClick={() => commentInputRef.current?.focus()} className="flex items-center gap-1 hover:text-zinc-800 transition-colors">
              <MessageCircle className="w-4 h-4" /> {(comments?.length || 0)} 评论
            </button>
          </div>
        </div>
      </div>


{/* ✅ 收藏夹选择弹窗 - 添加到帖子内容区域之后 */}
{showCollectionModal && (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowCollectionModal(false)}>
    <div className="bg-white rounded-lg p-6 max-w-md w-full max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-bold">选择收藏夹</h3>
        <button onClick={() => setShowCollectionModal(false)} className="p-1 hover:bg-zinc-100 rounded">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* 创建新收藏夹 */}
      <div className="mb-4 p-3 bg-zinc-50 rounded-lg">
        <div className="flex gap-2">
          <input
            type="text"
            value={newCollectionName}
            onChange={e => setNewCollectionName(e.target.value)}
            placeholder="新建收藏夹名称..."
            className="flex-1 px-3 py-2 border border-zinc-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-black"
          />
          <button
            onClick={async () => {
              if (!newCollectionName.trim()) {
                showToast('请输入收藏夹名称', 'error');
                return;
              }
              try {
                await create_collection(user.id, newCollectionName.trim());
                showToast('收藏夹创建成功', 'success');
                setNewCollectionName('');
                // 重新加载收藏夹列表
                const { data } = await supabase
                  .from('collections')
                  .select('*')
                  .eq('user_id', user.id);
                setUserCollections(data || []);
              } catch (e: any) {
                showToast(`创建失败: ${e.message}`, 'error');
              }
            }}
            className="px-4 py-2 bg-black text-white rounded text-sm hover:bg-zinc-800 flex items-center gap-1"
          >
            <Plus className="w-4 h-4" /> 创建
          </button>
        </div>
      </div>

      {/* 收藏夹列表 */}
      <div className="space-y-2">
        {userCollections.length === 0 ? (
          <div className="text-center py-8 text-zinc-400 text-sm">
            暂无收藏夹，请先创建一个
          </div>
        ) : (
          userCollections.map((collection) => (
            <button
              key={collection.id}
              onClick={() => handleAddToCollection(collection.id, collection.name)}
              className="w-full text-left px-4 py-3 border border-zinc-200 rounded-lg hover:bg-zinc-50 hover:border-zinc-300 transition-all flex items-center justify-between group"
            >
              <span className="font-medium">{collection.name}</span>
              <Check className="w-5 h-5 text-zinc-400 group-hover:text-black opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          ))
        )}
      </div>
    </div>
  </div>
)}

        {/* 评论列表 */}
        <div className="space-y-4 mt-6">
          {comments.length === 0 ? (
            <div className="text-center text-zinc-500 p-8 border border-zinc-200">暂无评论，快来发表你的看法吧！</div>
          ) : (
            comments.map((c: any) => {
              const commentAuthor = usersMap[c.user_id];
              const isAuthor = user.id === c.user_id;
              const isReply = c.reply_to_id;
              const repliedToComment = isReply ? comments.find(com => com.id === c.reply_to_id) : null;
              const repliedToAuthor = repliedToComment ? usersMap[repliedToComment.user_id] : null;
              const hasLiked = (c.likes || []).includes(user.id);

              return (
                <div key={c.id} className="bg-white px-0 py-4 border-b border-zinc-200">
                  <div className="flex gap-3">
                    <div className="flex-shrink-0">
                      <Avatar url={commentAuthor?.avatar} className="w-8 h-8" />
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between items-center mb-1">
                        <div className="font-bold flex items-center gap-1">
                          <span onClick={() => onViewProfile(c.user_id)} className="hover:underline cursor-pointer">{commentAuthor?.user_name || '未知用户'}</span>
                          {isReply && repliedToAuthor && (
                            <span className="text-zinc-500 font-normal">回复
                              <span onClick={() => onViewProfile(repliedToAuthor.id)} className="hover:underline cursor-pointer ml-1">@{repliedToAuthor.user_name}</span>
                            </span>
                          )}
                        </div>
                       <div className="text-zinc-400 font-normal text-xs flex items-center gap-2">
                       <span>{timeAgo(c.created_at)}</span>
  
                      {/* ✅ 1. 将 group 容器移出权限判断，让所有人都能看到“三个点”图标 */}
                      <div className="relative group">
                      <MoreVertical className="w-4 h-4 cursor-pointer text-zinc-500 hover:text-black p-0.5" />
    
                     <div className="absolute right-0 top-[80%] pt-2 w-24 hidden group-hover:block z-20">
                     <div className="bg-white border border-zinc-200 rounded-md shadow-lg overflow-hidden py-1">
        
                      {/* ✅ 2. 回复按钮：不设权限拦截，所有人点击任何评论都能看到 */}
                      <button 
                      onClick={(e) => {
                      e.stopPropagation();
                      handleReplyClick(c.id, c.user_name || '管理员');
                      }} 
                      className="block w-full text-left px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-100"
                      >
                     回复
                     </button>
                  </div>
               </div> 
             </div>
            </div>
         </div>

                      {/* 显示被回复的评论内容 */}
                      {isReply && repliedToComment && (
                        <div className="bg-zinc-50 border-l-2 border-zinc-300 pl-3 py-2 mb-2 text-xs text-zinc-600">
                          <div className="font-semibold mb-1">@{repliedToAuthor?.user_name}:</div>
                          <div className="line-clamp-2">{repliedToComment.content}</div>
                          {repliedToComment.images && repliedToComment.images.length > 0 && (
                            <div className="text-zinc-400 mt-1">[图片]</div>
                          )}
                        </div>
                      )}

                      {c.id === editingCommentId ? (
                        <div className="space-y-2 mt-2">
                         <textarea className="w-full border p-2 h-20 text-base leading-relaxed" value={editCommentContent} onChange={e => setEditCommentContent(e.target.value)} />
                          <div className="flex gap-2">
                            <button onClick={() => saveCommentEdit(c.id)} className="bg-black text-white px-3 py-1 text-xs">保存</button>
                            <button onClick={() => setEditingCommentId(null)} className="bg-zinc-200 px-3 py-1 text-xs">取消</button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <p className="whitespace-pre-wrap mb-2 leading-relaxed text-zinc-800">{c.content}</p>
                          
                          {/* 评论图片展示 */}
                          {c.images && c.images.length > 0 && (
                            <div className="grid grid-cols-3 gap-2 mt-2">
                              {c.images.map((img: string, idx: number) => (
                                <img 
                                  key={idx} 
                                  src={img} 
                                  alt={`评论图片 ${idx + 1}`} 
                                  className="w-full h-24 object-cover rounded border border-zinc-200 cursor-pointer hover:opacity-80"
                                  onClick={() => window.open(img, '_blank')}
                                />
                              ))}
                            </div>
                          )}

                          {/* 评论点赞按钮 */}
                          <div className="flex items-center gap-4 mt-2 text-xs">
                            <button
                              onClick={() => handleLikeComment(c.id)}
                              className={`flex items-center gap-1 transition-colors ${hasLiked ? 'text-red-600' : 'text-zinc-400 hover:text-red-600'}`}
                            >
                              <Heart className={`w-3.5 h-3.5 ${hasLiked ? 'fill-current' : ''}`} />
                              {(c.likes?.length || 0) > 0 && <span>{c.likes.length}</span>}
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* 底部评论输入框 */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg">
        <div className="max-w-[95%]  mx-auto p-3">
          {/* 已选择图片显示 */}
          {commentImages.length > 0 && (
            <div className="flex gap-2 mb-2 text-sm text-zinc-600">
              <span>已选择 {commentImages.length} 张图片</span>
              {commentImages.map((file, idx) => (
                <span key={idx} className="flex items-center gap-1">
                  {file.name.substring(0, 10)}...
                  <button
                    onClick={() => removeCommentImage(idx)}
                    className="text-red-500 hover:text-red-700"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleImageSelect}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingComment || commentImages.length >= 3}
              className="p-2 hover:bg-zinc-100 rounded disabled:opacity-50 disabled:cursor-not-allowed"
              title="添加图片 (最多3张)"
            >
              <ImageIcon className="w-5 h-5 text-zinc-500" />
            </button>
            
            <textarea
              ref={commentInputRef}
              value={newComment}
              onChange={e => setNewComment(e.target.value)}
              disabled={uploadingComment}
              className="flex-1 border rounded p-2 h-12 text-sm focus:outline-none focus:ring-2 focus:ring-black resize-none disabled:opacity-50"
              placeholder={replyToCommentId ? `回复 @${usersMap[comments.find(c => c.id === replyToCommentId)?.user_id]?.user_name || '未知用户'}:` : "发表评论..."}
              aria-label="评论输入框"
            />
            <button 
              onClick={handleComment} 
              disabled={uploadingComment}
              className="bg-black text-white px-4 rounded-md flex items-center justify-center hover:bg-zinc-800 transition-colors disabled:bg-zinc-400 disabled:cursor-not-allowed" 
              aria-label="发送评论"
            >
              {uploadingComment ? (
                <span className="text-xs">发送中...</span>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-1" /> 发送
                </>
              )}
            </button>
          </div>

          {replyToCommentId && (
            <div className="text-xs text-zinc-500 mt-1">
              正在回复 @{usersMap[comments.find(c => c.id === replyToCommentId)?.user_id]?.user_name || '未知用户'}
              <button onClick={() => { setReplyToCommentId(null); setNewComment(''); }} className="ml-2 text-red-500 hover:underline">取消回复</button>
            </div>
          )}
        </div>
      </div>


    </div>
  );
};


//Login组件


const Login = ({ onLogin }: { onLogin: (u: any) => void }) => {
  const [loginIdInput, setLoginIdInput] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD;

  const handleLogin = async () => {
    setError('');
    if (!loginIdInput || !password) {
      setError('请输入 ID 和密码');
      return;
    }

    try {
      setLoading(true);

      // --- 情况 A：管理员账号登录 ---
      if (loginIdInput.toLowerCase() === 'admin') {
        if (password === ADMIN_PASSWORD) {
          const { data, error: adminErr } = await supabase
            .from('users')
            .select('*')
            .eq('role', 'admin')
            .limit(1)
            .single();

          if (adminErr || !data) {
            setError('管理员账号尚未在数据库中初始化');
            return;
          }
          onLogin(data);
          return;
        } else {
          setError('管理员密码错误');
          return;
        }
      }

      // --- 情况 B：普通用户登录（使用 Supabase Auth）---
      
      // 1. 先从数据库查询用户信息（通过 login_id 获取 email）
      const { data: userData, error: queryError } = await supabase
        .from('users')
        .select('*')
        .eq('login_id', loginIdInput)
        .single();

      if (queryError || !userData) {
        setError('账号不存在，请检查 ID 是否输入正确');
        return;
      }

      if (userData.is_banned) {
        setError('该账号已被封禁，无法登录');
        return;
      }

      // 2. 使用 Supabase Auth 登录（创建 session）
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: userData.email,
        password: password,
      });

      if (authError) {
        console.error('登录失败:', authError);
        if (authError.message.includes('Invalid login credentials')) {
          setError('密码错误');
        } else {
          setError('登录失败: ' + authError.message);
        }
        return;
      }

      console.log('✅ 登录成功, Session 已创建:', authData.session);
      console.log('✅ 用户信息:', authData.user);

      // 3. 登录成功，传递完整的用户信息
      onLogin({
        ...userData,
        auth_id: authData.user.id, // Supabase Auth 的 ID
      });

    } catch (e: any) {
      console.error('系统错误:', e);
      setError(`系统错误: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tighter">登录小组</h2>
          <p className="mt-2 text-zinc-500 text-sm">请输入管理员分发的 6 位短 ID 和密码</p>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-zinc-400">用户 ID</label>
            <input
              value={loginIdInput}
              onChange={e => setLoginIdInput(e.target.value)}
              disabled={loading}
              className="w-full p-4 border border-zinc-200 outline-none focus:border-black transition-all bg-zinc-50 focus:bg-white font-mono disabled:opacity-50"
              placeholder="例如: AX79P2"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-zinc-400">密码</label>
            <div className="relative">
              <input
                type={showPass ? "text" : "password"}
                value={password}
                onChange={e => setPassword(e.target.value)}
                disabled={loading}
                className="w-full p-4 border border-zinc-200 outline-none focus:border-black transition-all bg-zinc-50 focus:bg-white pr-12 font-mono disabled:opacity-50"
                placeholder="请输入密码"
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                disabled={loading}
                className="absolute right-4 top-4 text-zinc-400 hover:text-black disabled:opacity-50"
              >
                {showPass ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-4 text-sm flex items-center gap-2 animate-in fade-in slide-in-from-top-1">
            <X className="w-4 h-4 flex-shrink-0" /> {error}
          </div>
        )}

        <button
          onClick={handleLogin}
          disabled={loading}
          className="w-full bg-black text-white py-4 font-bold text-lg hover:bg-zinc-800 transition-all active:scale-[0.98] shadow-lg shadow-zinc-200 disabled:bg-zinc-400 disabled:cursor-not-allowed"
        >
          {loading ? '登录中...' : '确认登录'}
        </button>

        <div className="text-center space-y-1">
          <p className="text-[10px] text-zinc-400">
            ID 是唯一的通行证，请妥善保管
          </p>
          <p className="text-[10px] text-zinc-300">
            Supabase Cloud Backend Connected
          </p>
        </div>
      </div>
    </div>
  );
};

// 主应用组件
export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [view, setView] = useState<'landing' | 'login' | 'feed' | 'admin' | 'post' | 'profile'>('landing');
  const [currentCategory, setCurrentCategory] = useState<Category | '全部'>('全部');
  const [searchQuery, setSearchQuery] = useState('');
  const [onlyEssence, setOnlyEssence] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [targetProfileId, setTargetProfileId] = useState<string | null>(null);
  const [isCreatingPost, setIsCreatingPost] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [usersMap, setUsersMap] = useState<Record<string, User>>({});
  const [displayPosts, setDisplayPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Toast 状态
  const [toast, setToast] = useState<{ msg: string, type: ToastType } | null>(null);

  // ✅ 修改后的初始化用户登录状态
  useEffect(() => {
    const initAuth = async () => {
      try {
        // 1. 先检查 Supabase Auth Session
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          // 如果没有 session，清除本地缓存
          sessionStorage.removeItem('currentUser');
          return;
        }

        // 2. 如果有 session，获取用户信息
        const freshUser = await get_user(session.user.id);
        
        if (freshUser) {
          // 检查是否被封禁
          if (freshUser.is_banned) {
            sessionStorage.removeItem('currentUser');
            await supabase.auth.signOut();
            setUser(null);
            setView('login');
            setToast({ msg: '账号已被封禁', type: 'error' });
            return;
          }
          
          // 更新本地状态
          setUser(freshUser);
          sessionStorage.setItem('currentUser', JSON.stringify(freshUser));
          setView('feed');
        }
      } catch (err) {
        console.error("获取用户信息失败:", err);
        // 如果获取失败，清除状态
        sessionStorage.removeItem('currentUser');
        await supabase.auth.signOut();
      }
    };

    initAuth();
  }, []);

  // 加载帖子列表
  useEffect(() => {
    const loadPosts = async () => {
      setIsLoading(true);
      try {
        const data = await get_posts(currentCategory, onlyEssence ? 'essence' : 'new');
        setDisplayPosts(data || []);
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

  const showToast = (msg: string, type: ToastType) => {
    setToast({ msg, type });
  };

  const handleLogin = (u: User) => {
    if (u.is_first_login) {
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

  // ✅ 修改后的退出登录函数
  const handleLogout = async () => {
    try {
      // 1. 调用 Supabase Auth 退出登录
      await supabase.auth.signOut();
      console.log('✅ Supabase Auth 已退出');
    } catch (error) {
      console.error('退出登录时出错:', error);
    } finally {
      // 2. 清除本地状态
      setUser(null);
      sessionStorage.removeItem('currentUser');
      setView('landing');
    }
  };

  const handleViewProfile = (userId: string) => {
    setTargetProfileId(userId);
    setView('profile');
    setSelectedPostId(null);
  };

  const refreshData = () => {
    setRefreshKey(prev => prev + 1);
  };

  // 首次登录修改密码
  if (user && user.is_first_login) {
    return <ChangePasswordModal user={user} onComplete={handleUpdateProfile} />;
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

      {/* 导航栏 */}
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
                aria-label="搜索帖子"
              />
              <Search className="w-4 h-4 absolute left-2.5 top-2 text-zinc-400" />
            </div>

            <div className="flex items-center gap-2 border-l pl-4 border-zinc-200">
              <div onClick={() => handleViewProfile(user!.id)} className="flex items-center gap-2 cursor-pointer hover:bg-zinc-50 p-1 rounded-full transition-colors">
                <div className="relative">
                  <Avatar url={user?.avatar} className="w-6 h-6" />
                  {unreadCount > 0 && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border border-white"></span>}
                </div>
                <span className="text-sm font-bold hidden sm:block">{user?.user_name}</span>
              </div>

              {isAdminOrInver && (
                <button onClick={() => setView('admin')} className="p-2 hover:bg-zinc-100 rounded-full" title="管理后台" aria-label="管理后台">
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
              onClick={() => { setCurrentCategory(c); setView('feed'); setSelectedPostId(null); }}
              className={`px-3 py-1.5 text-sm rounded-full whitespace-nowrap transition-colors ${currentCategory === c ? 'bg-black text-white' : 'bg-zinc-100 text-zinc-600'}`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* 主内容区 */}
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
                                      <span className="hover:text-black hover:underline">{usersMap[post.user_id]?.user_name || '未知用户'}</span>
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
