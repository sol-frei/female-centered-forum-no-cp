import { supabase } from '../services/supabaseClient';
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Landing from '../components/Landing';
import { User, Post, Category, Collection, Notification, SensitiveWords } from '../types';
import { get_all_users, get_user, create_post, get_posts, toggle_like_post, toggle_essence_post, delete_post, vote_poll, add_comment, update_post, getComments, updateUser, getUnreadNotificationCount, create_collection, addToCollection, updatePost, update_comment, toggle_lock_post, delete_comment,check_sensitive_words } from '../services/storage';
import AdminPanel from '../components/AdminPanel';
import ChangePasswordModal from '../components/ChangePasswordModal';
import UserProfile from '../components/UserProfile';
import Toast, { ToastType } from '../components/Toast';
import CreatePostModal from '../components/CreatePostModal';
import { uploadImage } from '../services/storageService';  // ✅ 新增这行
import { Search, LogOut, Menu, UserCircle, PenSquare, Heart, MessageCircle, MessageSquare, Trash2, X, Plus, Check, Star, Eye, EyeOff, Image as ImageIcon, Bookmark, Send, Edit2, MoreVertical } from 'lucide-react';
import PostContent from '../components/PostContent';


// 帖子详情组件
interface PostDetailProps {
  user: User;
  usersMap: Record<string, User>;
  showToast: (msg: string, type: ToastType) => void;
}

const PostDetail = ({
  user,
  usersMap,
  showToast,
}: PostDetailProps) => {
  // ✅ 使用 React Router 的 hooks
  const { postId } = useParams<{ postId: string }>();
  const navigate = useNavigate();

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
  const [editBlocks, setEditBlocks] = useState<any[]>([]); // ✅ 改为blocks数组
  const [editCategory, setEditCategory] = useState<Category>('讨论👊🏻i女');

  // 5. 编辑评论状态
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editCommentContent, setEditCommentContent] = useState('');

  // ✅ 新增：图片预览状态
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  
  // --- 数据初始加载 ---
  const fetchPostAndComments = async () => {
    if (!postId) return;
    
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

  // ✅ 新增:标记帖子为已读
  
  useEffect(() => {
  const markAsRead = async () => {
    if (!postId || !user) return;
    
    try {
      // 从 storage 读取已读列表
      const result = await window.storage.get(`read_posts_${user.id}`);
      const readPostIds = result?.value ? JSON.parse(result.value) : [];
      
      // 如果未读过,添加到列表
      if (!readPostIds.includes(postId)) {
        readPostIds.push(postId);
        await window.storage.set(`read_posts_${user.id}`, JSON.stringify(readPostIds));
        
        // 通知父组件更新状态
        window.dispatchEvent(new CustomEvent('post-read', { detail: { postId } }));
      }
    } catch (err) {
      console.error('标记已读失败:', err);
    }
  };

  markAsRead();
}, [postId, user]);


// ✅ 新增：监听图片预览事件
useEffect(() => {
  const handlePreviewImage = (e: any) => {
    setPreviewImage(e.detail.url);
  };
  
  window.addEventListener('preview-image', handlePreviewImage);
  
  return () => {
    window.removeEventListener('preview-image', handlePreviewImage);
  };
}, []);

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

  // ✅ 处理返回 - 使用 navigate
  const handleBack = () => {
    navigate(-1); // 返回上一页
  };

  // ✅ 处理查看用户资料 - 使用 navigate
  const handleViewProfile = (uid: string) => {
    navigate(`/profile/${uid}`);
  };

  // ✅ 处理删除帖子 - 使用 navigate
  const handleDeletePost = async () => {
    if (!post) return;
    
    try {
      await delete_post(post.id);
      showToast('帖子已删除', 'success');
      navigate('/'); // 删除后返回首页
    } catch (err: any) {
      showToast(`删除失败: ${err.message}`, 'error');
    }
  };

  // --- 渲染拦截 ---
  if (loading) return <div className="p-20 text-center text-zinc-500">正在努力加载内容...</div>;
  if (!post) return <div className="p-20 text-center text-zinc-500">未找到该帖子</div>;

  const author = usersMap[post.user_id];
  const hasLiked = (post.likes || []).includes(user.id);

  // --- 时间格式化 ---
  const timeAgo = (timestamp: string) => {
    const now = new Date();
    const then = new Date(timestamp);
    const seconds = Math.floor((now.getTime() - then.getTime()) / 1000);

    const intervals: { [key: string]: number } = {
      年: 31536000,
      月: 2592000,
      周: 604800,
      天: 86400,
      小时: 3600,
      分钟: 60,
      秒: 1,
    };

    for (const [label, sec] of Object.entries(intervals)) {
      const interval = Math.floor(seconds / sec);
      if (interval >= 1) return `${interval} ${label}前`;
    }
    return '刚刚';
  };

  // --- 头像组件 ---
  const Avatar = ({ url, className = "w-10 h-10" }: { url?: string; className?: string }) => {
    const src = url || "https://via.placeholder.com/40";
    return (
      <img
        src={src}
        alt="avatar"
        className={`${className} rounded-full border border-zinc-200 object-cover bg-zinc-100`}
        onError={(e) => { e.currentTarget.src = "https://via.placeholder.com/40"; }}
      />
    );
  };

  // ✅ 点赞帖子逻辑
  const handleLikePost = async () => {
    try {
      const updated = await toggle_like_post(post.id, user.id);
      setPost(updated);
    } catch (err: any) {
      showToast(`点赞失败: ${err.message}`, 'error');
    }
  };

  // ✅ 加精帖子逻辑
  const handleEssencePost = async () => {
    try {
      const updated = await toggle_essence_post(post.id);
      setPost(updated);
      showToast(updated.is_essence ? '已加精' : '已取消加精', 'success');
    } catch (err: any) {
      showToast(`操作失败: ${err.message}`, 'error');
    }
  };

  // ✅ 锁帖逻辑
  const handleLockPost = async () => {
    try {
      const updated = await toggle_lock_post(post.id);
      setPost(updated);
      showToast(updated.is_locked ? '帖子已锁定' : '帖子已解锁', 'success');
    } catch (err: any) {
      showToast(`操作失败: ${err.message}`, 'error');
    }
  };

  // ✅ 评论图片选择
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (commentImages.length + files.length > 3) {
      showToast('最多上传3张图片', 'error');
      return;
    }
    setCommentImages([...commentImages, ...files]);
  };

  const removeCommentImage = (index: number) => {
    setCommentImages(commentImages.filter((_, i) => i !== index));
  };

  // ✅ 评论逻辑（支持图片）
  const handleComment = async () => {
    if (!newComment.trim() && commentImages.length === 0) return;

    setUploadingComment(true);
    try {
      // 检查敏感词
      const sensitiveCheck = await check_sensitive_words(newComment);
      if (!sensitiveCheck.allowed) {
        showToast(`评论包含敏感词: ${sensitiveCheck.matched_words?.join(', ')}`, 'error');
        setUploadingComment(false);
        return;
      }

      // 上传图片
      let imageUrls: string[] = [];
      if (commentImages.length > 0) {
        try {
          imageUrls = await Promise.all(
            commentImages.map(file => uploadImage(file, 'comment-images'))
          );
        } catch (uploadErr: any) {
          showToast(`图片上传失败: ${uploadErr.message}`, 'error');
          setUploadingComment(false);
          return;
        }
      }

      const newCommentObj = {
        post_id: post.id,
        user_id: user.id,
        content: newComment.trim(),
        images: imageUrls,
        reply_to_id: replyToCommentId,
        likes: [],
        created_at: new Date().toISOString(),
      };

      const { data, error } = await supabase.from('comments').insert([newCommentObj]).select();
      if (error) throw error;

      setComments([...comments, data[0]]);
      setNewComment('');
      setReplyToCommentId(null);
      setCommentImages([]);
      
      if (commentInputRef.current) {
        commentInputRef.current.blur();
      }
    } catch (err: any) {
      showToast(`评论失败: ${err.message}`, 'error');
    } finally {
      setUploadingComment(false);
    }
  };

  // ✅ 点赞评论逻辑
  const handleLikeComment = async (commentId: string) => {
    const c = comments.find(c => c.id === commentId);
    if (!c) return;

    const likes = c.likes || [];
    const hasLiked = likes.includes(user.id);
    const newLikes = hasLiked ? likes.filter((id: string) => id !== user.id) : [...likes, user.id];

    try {
      const { error } = await supabase
        .from('comments')
        .update({ likes: newLikes })
        .eq('id', commentId);

      if (error) throw error;

      setComments(comments.map(com => com.id === commentId ? { ...com, likes: newLikes } : com));
    } catch (err: any) {
      showToast(`点赞失败: ${err.message}`, 'error');
    }
  };

  // ✅ 回复评论逻辑
  const handleReplyClick = (commentId: string, userName: string) => {
    setReplyToCommentId(commentId);
    setNewComment('');
    if (commentInputRef.current) {
      commentInputRef.current.focus();
    }
  };

  // ✅ 开始编辑评论
  const startEditComment = (commentId: string, content: string) => {
    setEditingCommentId(commentId);
    setEditCommentContent(content);
  };

  // ✅ 保存评论编辑
  const saveCommentEdit = async (commentId: string) => {
    if (!editCommentContent.trim()) {
      showToast('评论内容不能为空', 'error');
      return;
    }

    try {
      // 检查敏感词
      const sensitiveCheck = await check_sensitive_words(editCommentContent);
      if (!sensitiveCheck.allowed) {
        showToast(`评论包含敏感词: ${sensitiveCheck.matched_words?.join(', ')}`, 'error');
        return;
      }

      await update_comment(commentId, editCommentContent);
      setComments(comments.map(c => c.id === commentId ? { ...c, content: editCommentContent } : c));
      setEditingCommentId(null);
      setEditCommentContent('');
      showToast('评论已更新', 'success');
    } catch (err: any) {
      showToast(`更新失败: ${err.message}`, 'error');
    }
  };

  // ✅ 删除评论
  const handleDeleteComment = async (commentId: string) => {
    if (!window.confirm('确定删除这条评论吗？')) return;

    try {
      await delete_comment(commentId);
      setComments(comments.filter(c => c.id !== commentId));
      showToast('评论已删除', 'success');
    } catch (err: any) {
      showToast(`删除失败: ${err.message}`, 'error');
    }
  };

  // ✅ 开始编辑帖子
  const startEditPost = () => {
    setEditTitle(post.title);
    setEditBlocks(post.blocks || []);
    setEditCategory(post.category);
    setIsEditingPost(true);
  };

  // ✅ 保存帖子编辑
  const savePostEdit = async () => {
    if (!editTitle.trim()) {
      showToast('标题不能为空', 'error');
      return;
    }

    try {
      // 检查敏感词
      const titleCheck = await check_sensitive_words(editTitle);
      if (!titleCheck.allowed) {
        showToast(`标题包含敏感词: ${titleCheck.matched_words?.join(', ')}`, 'error');
        return;
      }

      // 检查所有文本块的敏感词
      for (const block of editBlocks) {
        if (block.type === 'text' && block.content) {
          const contentCheck = await check_sensitive_words(block.content);
          if (!contentCheck.allowed) {
            showToast(`内容包含敏感词: ${contentCheck.matched_words?.join(', ')}`, 'error');
            return;
          }
        }
      }

      const updated = await updatePost(post.id, {
        title: editTitle,
        blocks: editBlocks,
        category: editCategory,
      });

      setPost(updated);
      setIsEditingPost(false);
      showToast('帖子已更新', 'success');
    } catch (err: any) {
      showToast(`更新失败: ${err.message}`, 'error');
    }
  };

  // ✅ 收藏逻辑
  const handleAddToCollection = async (collectionId: string) => {
    try {
      await addToCollection(collectionId, post.id);
      showToast('已添加到收藏夹', 'success');
      setShowCollectionModal(false);
    } catch (err: any) {
      showToast(`收藏失败: ${err.message}`, 'error');
    }
  };

  const handleCreateCollection = async () => {
    if (!newCollectionName.trim()) {
      showToast('收藏夹名称不能为空', 'error');
      return;
    }

    try {
      const newCollection = await create_collection(user.id, newCollectionName);
      await addToCollection(newCollection.id, post.id);
      showToast('已创建收藏夹并添加', 'success');
      setNewCollectionName('');
      setShowCollectionModal(false);
    } catch (err: any) {
      showToast(`创建失败: ${err.message}`, 'error');
    }
  };

  return (
    <div className="max-w-3xl mx-auto pb-32">
      {/* 返回按钮 */}
      <div className="p-4 flex items-center gap-3 border-b">
        <button onClick={handleBack} className="text-zinc-600 hover:text-black">
          <X className="w-6 h-6" />
        </button>
        <h2 className="text-lg font-bold">帖子详情</h2>
      </div>

      {/* 帖子内容区 */}
      <div className="bg-white p-6">
        <div className="flex justify-between items-start mb-4">
          <div className="flex gap-3 items-start">
            <Avatar url={author?.avatar} />
            <div>
              <div className="flex items-center gap-2">
                <span 
                  onClick={() => handleViewProfile(post.user_id)} 
                  className="font-bold cursor-pointer hover:underline"
                >
                  {author?.user_name || '未知用户'}
                </span>
                {post.is_essence && (
                  <span className="bg-yellow-100 text-yellow-800 text-xs px-2 py-0.5 rounded">精华</span>
                )}
                {post.is_locked && (
                  <span className="bg-red-100 text-red-800 text-xs px-2 py-0.5 rounded">已锁定</span>
                )}
              </div>
              <div className="text-xs text-zinc-400 mt-1">{timeAgo(post.created_at)}</div>
            </div>
          </div>

          {/* 操作按钮 */}
          <div className="flex items-center gap-2">
            {user.id === post.user_id && !isEditingPost && (
              <button onClick={startEditPost} className="p-2 hover:bg-zinc-100 rounded">
                <Edit2 className="w-4 h-4" />
              </button>
            )}
            {user.is_admin && (
              <>
                <button onClick={handleEssencePost} className="p-2 hover:bg-zinc-100 rounded">
                  <Star className={`w-4 h-4 ${post.is_essence ? 'fill-yellow-500 text-yellow-500' : ''}`} />
                </button>
                <button onClick={handleLockPost} className="p-2 hover:bg-zinc-100 rounded">
                  {post.is_locked ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                </button>
              </>
            )}
            {(user.id === post.user_id || user.is_admin) && (
              <button onClick={handleDeletePost} className="p-2 hover:bg-red-100 rounded text-red-600">
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <button onClick={() => setShowCollectionModal(true)} className="p-2 hover:bg-zinc-100 rounded">
              <Bookmark className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 编辑模式 */}
        {isEditingPost ? (
          <div className="space-y-4">
            <input
              type="text"
              value={editTitle}
              onChange={e => setEditTitle(e.target.value)}
              className="w-full border p-3 text-xl font-bold"
              placeholder="标题"
            />
            <select
              value={editCategory}
              onChange={e => setEditCategory(e.target.value as Category)}
              className="border p-2"
            >
              <option value="讨论👊🏻i女">讨论👊🏻i女</option>
              <option value="提问🙋">提问🙋</option>
              <option value="分享📢">分享📢</option>
              <option value="公告📣">公告📣</option>
            </select>
            <div className="flex gap-2">
              <button onClick={savePostEdit} className="bg-black text-white px-4 py-2">保存</button>
              <button onClick={() => setIsEditingPost(false)} className="bg-zinc-200 px-4 py-2">取消</button>
            </div>
          </div>
        ) : (
          <>
            <h1 className="text-2xl font-bold mb-4">{post.title}</h1>
            <div className="mb-4">
              <span className="inline-block bg-zinc-100 text-zinc-700 px-3 py-1 text-sm">
                {post.category}
              </span>
            </div>
            <PostContent blocks={post.blocks || []} />
          </>
        )}

        {/* 互动按钮 */}
        <div className="flex items-center gap-6 mt-6 pt-4 border-t">
          <button
            onClick={handleLikePost}
            className={`flex items-center gap-2 transition-colors ${hasLiked ? 'text-red-600' : 'text-zinc-500 hover:text-red-600'}`}
          >
            <Heart className={`w-5 h-5 ${hasLiked ? 'fill-current' : ''}`} />
            <span>{post.likes?.length || 0}</span>
          </button>
          <button className="flex items-center gap-2 text-zinc-500">
            <MessageCircle className="w-5 h-5" />
            <span>{comments.length}</span>
          </button>
        </div>
      </div>

      {/* 收藏模态框 */}
      {showCollectionModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowCollectionModal(false)}>
          <div className="bg-white p-6 rounded-lg max-w-md w-full" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-4">添加到收藏夹</h3>
            <div className="space-y-2 mb-4">
              {userCollections.map(col => (
                <button
                  key={col.id}
                  onClick={() => handleAddToCollection(col.id)}
                  className="w-full text-left p-3 border hover:bg-zinc-50 rounded"
                >
                  {col.name}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newCollectionName}
                onChange={e => setNewCollectionName(e.target.value)}
                placeholder="新建收藏夹"
                className="flex-1 border p-2"
              />
              <button onClick={handleCreateCollection} className="bg-black text-white px-4">
                <Plus className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      )}

{/* ✅ 图片预览模态框 */}
{previewImage && (
  <div 
    className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50"
    onClick={() => setPreviewImage(null)}
  >
    <div className="relative max-w-[90vw] max-h-[90vh]">
      <button
        className="absolute -top-12 right-0 text-white hover:text-zinc-300"
        onClick={() => setPreviewImage(null)}
      >
        <X className="w-6 h-6" />
      </button>
      <img
        src={previewImage}
        alt="预览"
        className="max-w-full max-h-full object-contain rounded-lg"
        onClick={(e) => e.stopPropagation()}
      />
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
                          <span onClick={() => handleViewProfile(c.user_id)} className="hover:underline cursor-pointer">{commentAuthor?.user_name || '未知用户'}</span>
                          {isReply && repliedToAuthor && (
                            <span className="text-zinc-500 font-normal">回复
                              <span onClick={() => handleViewProfile(repliedToAuthor.id)} className="hover:underline cursor-pointer ml-1">@{repliedToAuthor.user_name}</span>
                            </span>
                          )}
                        </div>
                       <div className="text-zinc-400 font-normal text-xs flex items-center gap-2">
                       <span>{timeAgo(c.created_at)}</span>
  
                      {/* ✅ 1. 将 group 容器移出权限判断，让所有人都能看到"三个点"图标 */}
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
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg z-50">
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

export default PostDetail;
