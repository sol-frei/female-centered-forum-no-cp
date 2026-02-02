import { supabase } from '../services/supabaseClient';
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { User, Post, Category, Collection } from '../types';
import { 
  toggle_like_post, 
  toggle_essence_post, 
  vote_poll, 
  add_comment, 
  update_post, 
  create_collection, 
  addToCollection, 
  check_sensitive_words,
  delete_comment,
  toggle_like_comment
} from '../services/storage';
import { uploadImage } from '../services/storageService';
import { 
  Heart, MessageCircle, Trash2, X, Plus, Check, Star, 
  Image as ImageIcon, Bookmark, Send, Edit2, MoreVertical, ArrowLeft, UserCircle
} from 'lucide-react';
import PostContent from '../components/PostContent';
import { ToastType } from '../components/Toast';

// Avatar 组件
const Avatar = ({ url, className = "w-8 h-8" }: { url?: string; className?: string }) => {
  if (url) return <img src={url} alt="头像" className={`${className} rounded-full object-cover border border-zinc-100`} />;
  return <UserCircle className={`${className} text-zinc-300`} />;
};

const CATEGORIES: Category[] = ['全部', '推书📖排雷', '讨论👊🏻i女', '求书🔍求作', '自荐🙋🏻分享', '组务❗组规'];

// 辅助函数：时间格式化
function timeAgo(dateInput: string | Date): string {
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (seconds < 60) return '刚刚';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}小时前`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}天前`;
  return `${Math.floor(days / 30)}个月前`;
}

interface PostDetailProps {
  user: User;
  usersMap: Record<string, User>;
  showToast: (msg: string, type: ToastType) => void;
}

const PostDetailPage = ({
  user,
  usersMap,
  showToast,
}: PostDetailProps) => {
  const { postId } = useParams<{ postId: string }>();
  const navigate = useNavigate();

  const [post, setPost] = useState<any | null>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // 评论与交互
  const [newComment, setNewComment] = useState('');
  const [replyToCommentId, setReplyToCommentId] = useState<string | null>(null);
  const [replyToComment, setReplyToComment] = useState<any | null>(null);
  const commentInputRef = useRef<HTMLTextAreaElement>(null);
  const [commentImages, setCommentImages] = useState<File[]>([]);
  const [commentImagePreviews, setCommentImagePreviews] = useState<string[]>([]);
  const [uploadingComment, setUploadingComment] = useState(false);
  const commentsEndRef = useRef<HTMLDivElement>(null);

  // 收藏与编辑
  const [showCollectionModal, setShowCollectionModal] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');
  const [userCollections, setUserCollections] = useState<Collection[]>([]);
  const [isEditingPost, setIsEditingPost] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editBlocks, setEditBlocks] = useState<any[]>([]);
  const [editCategory, setEditCategory] = useState<Category>('讨论👊🏻i女');
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // 投票
  const [selectedPollOption, setSelectedPollOption] = useState<number | null>(null);

  // --- 🆕 实时订阅评论 ---
  useEffect(() => {
    if (!postId) return;

    // 订阅新评论
    const commentsSubscription = supabase
      .channel(`comments:post_id=eq.${postId}`)
      .on(
        'postgres_changes',
        {
          event: '*', // 监听所有事件：INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'comments',
          filter: `post_id=eq.${postId}`
        },
        (payload) => {
          console.log('评论更新:', payload);
          
          if (payload.eventType === 'INSERT') {
            // 新评论插入
            setComments(prev => [...prev, payload.new]);
          } else if (payload.eventType === 'UPDATE') {
            // 评论更新（点赞等）
            setComments(prev => 
              prev.map(c => c.id === payload.new.id ? payload.new : c)
            );
          } else if (payload.eventType === 'DELETE') {
            // 评论删除
            setComments(prev => prev.filter(c => c.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    // 订阅帖子更新（点赞、投票等）
    const postSubscription = supabase
      .channel(`post:id=eq.${postId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'posts',
          filter: `id=eq.${postId}`
        },
        (payload) => {
          console.log('帖子更新:', payload);
          setPost(payload.new);
        }
      )
      .subscribe();

    // 清理订阅
    return () => {
      supabase.removeChannel(commentsSubscription);
      supabase.removeChannel(postSubscription);
    };
  }, [postId]);

  // --- 获取数据 ---
  const fetchPostAndComments = async () => {
    if (!postId) return;
    setLoading(true);
    try {
      const { data: postData, error: postErr } = await supabase
        .from('posts')
        .select('*')
        .eq('id', postId)
        .single();
      if (postErr) throw postErr;

      const { data: commentData, error: commentErr } = await supabase
        .from('comments')
        .select('*')
        .eq('post_id', postId)
        .order('created_at', { ascending: true });
      if (commentErr) throw commentErr;

      setPost(postData);
      setComments(commentData || []);
      
      // 检查用户是否已投票
      if (postData.poll_options && user) {
        const userVoted = postData.poll_votes?.find((v: any) => v.user_id === user.id);
        if (userVoted) setSelectedPollOption(userVoted.option_index);
      }
    } catch (err: any) {
      showToast(`内容加载失败: ${err.message}`, "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPostAndComments();
    if (user) {
      loadUserCollections();
    }
  }, [postId, user]);

  const loadUserCollections = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('collections')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setUserCollections(data || []);
    } catch (err: any) {
      console.error('加载合集失败:', err);
    }
  };

  // --- 权限/状态计算 ---
  if (loading) return <div className="p-20 text-center text-zinc-500">正在努力加载内容...</div>;
  if (!post) return <div className="p-20 text-center text-zinc-500">未找到该帖子</div>;

  const isAdminOrInver = user ? ['admin', 'i女er'].includes(user.role) : false;
  const canEditPost = user && user.id === post.user_id;
  const isLiked = post.likes?.includes(user?.id);

  // --- 处理逻辑 ---
  const handleBack = () => navigate(-1);
  const onViewProfile = (uid: string) => navigate(`/profile/${uid}`);

  const handleLike = async () => {
    if (!user) return;
    
    // 🆕 乐观更新：立即更新 UI
    const newLikes = isLiked 
      ? post.likes.filter((id: string) => id !== user.id)
      : [...(post.likes || []), user.id];
    setPost({ ...post, likes: newLikes });
    
    try {
      await toggle_like_post(post.id, user.id);
      // 实时订阅会自动同步最新状态给其他用户
    } catch (e: any) {
      // 如果失败，回滚到原状态
      setPost({ ...post, likes: post.likes });
      showToast('操作失败', 'error');
    }
  };

  const handleEssence = async () => {
    if (!isAdminOrInver) return;
    try {
      const newEssenceState = !post.is_essence;
      await toggle_essence_post(post.id, newEssenceState);
      showToast(newEssenceState ? '已设为蒂贴' : '已取消蒂贴', 'success');
      // 立即更新本地状态
      setPost({ ...post, is_essence: newEssenceState });
    } catch (e: any) {
      showToast('操作失败', 'error');
    }
  };

  const handleVote = async (optionIndex: number) => {
    if (!user || selectedPollOption !== null) return;
    
    // 🆕 乐观更新：立即显示投票结果
    setSelectedPollOption(optionIndex);
    const newVote = { user_id: user.id, option_index: optionIndex };
    setPost({
      ...post,
      poll_votes: [...(post.poll_votes || []), newVote]
    });
    
    try {
      await vote_poll(post.id, user.id, optionIndex);
      showToast('投票成功', 'success');
      // 实时订阅会自动同步最新投票结果给其他用户
    } catch (e: any) {
      // 如果失败，回滚状态
      setSelectedPollOption(null);
      setPost({
        ...post,
        poll_votes: post.poll_votes?.filter((v: any) => v.user_id !== user.id)
      });
      showToast('投票失败', 'error');
    }
  };

  const handleReply = (comment: any) => {
    setReplyToCommentId(comment.id);
    setReplyToComment(comment);
    commentInputRef.current?.focus();
  };

  const cancelReply = () => {
    setReplyToCommentId(null);
    setReplyToComment(null);
  };

  const handleCommentImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length + commentImages.length > 9) {
      showToast('最多上传9张图片', 'error');
      return;
    }
    setCommentImages(prev => [...prev, ...files]);
    
    // 生成预览
    files.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setCommentImagePreviews(prev => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removeCommentImage = (index: number) => {
    setCommentImages(prev => prev.filter((_, i) => i !== index));
    setCommentImagePreviews(prev => prev.filter((_, i) => i !== index));
  };

  // 🆕 优化后的评论提交函数
  const handleComment = async () => {
    if (!user) return;
    if (!newComment.trim() && commentImages.length === 0) return;

    setUploadingComment(true);
    try {
      // 检查敏感词
      const sensitiveCheck = await check_sensitive_words(newComment);
      if (!sensitiveCheck.isValid) {
        showToast(`评论包含敏感词: ${sensitiveCheck.foundWords?.join(', ')}`, 'error');
        setUploadingComment(false);
        return;
      }

      // 上传图片
      let imageUrls: string[] = [];
      if (commentImages.length > 0) {
        for (const img of commentImages) {
          try {
            const url = await uploadImage(img, 'comments');
            if (url) imageUrls.push(url);
          } catch (err) {
            console.error('图片上传失败:', err);
          }
        }
      }

      // 添加评论
      await add_comment({
        post_id: postId!,
        user_id: user.id,
        content: newComment,
        images: imageUrls,
        reply_to_id: replyToCommentId
      });

      // 🆕 不调用 fetchPostAndComments()，让实时订阅自动更新评论列表
      // 清空输入
      setNewComment('');
      setCommentImages([]);
      setCommentImagePreviews([]);
      setReplyToCommentId(null);
      setReplyToComment(null);

      showToast('评论成功', 'success');

      // 🆕 可选：自动滚动到评论区底部查看新评论
      setTimeout(() => {
        commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 300);

    } catch (err: any) {
      showToast(`评论失败: ${err.message}`, 'error');
    } finally {
      setUploadingComment(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!window.confirm('确认删除这条评论？')) return;
    try {
      await delete_comment(commentId);
      // 🆕 不刷新，让实时订阅自动删除评论
      showToast('评论已删除', 'success');
    } catch (err: any) {
      showToast('删除失败', 'error');
    }
  };

  const handleLikeComment = async (commentId: string) => {
    if (!user) return;
    
    // 🆕 乐观更新：立即更新评论点赞状态
    setComments(prev => prev.map(c => {
      if (c.id === commentId) {
        const isLiked = c.likes?.includes(user.id);
        const newLikes = isLiked
          ? c.likes.filter((id: string) => id !== user.id)
          : [...(c.likes || []), user.id];
        return { ...c, likes: newLikes };
      }
      return c;
    }));
    
    try {
      await toggle_like_comment(commentId, user.id);
      // 实时订阅会自动同步最新状态给其他用户
    } catch (err: any) {
      // 如果失败，重新获取评论以回滚状态
      showToast('操作失败', 'error');
      const { data } = await supabase
        .from('comments')
        .select('*')
        .eq('post_id', postId)
        .order('created_at', { ascending: true });
      if (data) setComments(data);
    }
  };

  const handleCreateCollection = async () => {
    if (!user || !newCollectionName.trim()) return;
    try {
      const newCol = await create_collection(user.id, newCollectionName.trim());
      showToast('合集创建成功', 'success');
      setUserCollections(prev => [newCol, ...prev]);
      setNewCollectionName('');
    } catch (err: any) {
      showToast('创建失败', 'error');
    }
  };

  const handleAddToCollection = async (collectionId: string) => {
    try {
      await addToCollection(collectionId, post.id);
      showToast('已添加到合集', 'success');
      setShowCollectionModal(false);
      await loadUserCollections();
    } catch (err: any) {
      showToast('添加失败', 'error');
    }
  };

  const handleSaveEdit = async () => {
    if (!editTitle.trim()) {
      showToast('标题不能为空', 'error');
      return;
    }
    try {
      const sensitiveCheck = await check_sensitive_words(editTitle);
      if (!sensitiveCheck.isValid) {
        showToast(`标题包含敏感词: ${sensitiveCheck.foundWords?.join(', ')}`, 'error');
        return;
      }

      await update_post(post.id, {
        title: editTitle,
        content_blocks: editBlocks,
        category: editCategory
      });

      showToast('编辑成功', 'success');
      setIsEditingPost(false);
      // 🆕 不刷新，让实时订阅自动更新帖子
      setPost({
        ...post,
        title: editTitle,
        content_blocks: editBlocks,
        category: editCategory
      });
    } catch (err: any) {
      showToast('编辑失败', 'error');
    }
  };

  const startEditPost = () => {
    setEditTitle(post.title);
    setEditBlocks(post.content_blocks || []);
    setEditCategory(post.category);
    setIsEditingPost(true);
  };

  const postAuthor = usersMap[post.user_id];

  // --- 渲染 ---
  return (
    <div className="min-h-screen bg-white pb-32">
      {/* 顶部导航 */}
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-2xl mx-auto p-4 flex items-center gap-3">
          <button onClick={handleBack} className="p-2 hover:bg-zinc-100 rounded-full">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-bold flex-1">帖子详情</h1>
          <div className="flex gap-2">
            {canEditPost && (
              <button
                onClick={startEditPost}
                className="p-2 hover:bg-zinc-100 rounded-full"
              >
                <Edit2 className="w-5 h-5" />
              </button>
            )}
            <button
              onClick={() => setShowCollectionModal(true)}
              className="p-2 hover:bg-zinc-100 rounded-full"
            >
              <Bookmark className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto p-4 space-y-6">
        {/* 帖子内容 */}
        <div className="bg-white rounded-lg">
          {/* 作者信息 */}
          <div className="flex items-center justify-between mb-4">
            <div 
              className="flex items-center gap-3 cursor-pointer"
              onClick={() => postAuthor && onViewProfile(postAuthor.id)}
            >
              <Avatar url={postAuthor?.avatar} className="w-10 h-10" />
              <div>
                <div className="font-medium text-base">{postAuthor?.user_name || '未知用户'}</div>
                <div className="text-xs text-zinc-400">{timeAgo(post.created_at)}</div>
              </div>
            </div>
            {isAdminOrInver && (
              <button
                onClick={handleEssence}
                className={`p-2 rounded-full ${post.is_essence ? 'bg-yellow-100 text-yellow-600' : 'hover:bg-zinc-100'}`}
              >
                <Star className="w-5 h-5" fill={post.is_essence ? 'currentColor' : 'none'} />
              </button>
            )}
          </div>

          {/* 标题 */}
          <h2 className="text-xl font-bold mb-2">{post.title}</h2>
          
          {/* 分类标签 */}
          <div className="flex gap-2 mb-4">
            <span className="px-3 py-1 bg-zinc-100 text-zinc-600 text-xs rounded-full">
              {post.category}
            </span>
            {post.is_essence && (
              <span className="px-3 py-1 bg-yellow-100 text-yellow-600 text-xs rounded-full flex items-center gap-1">
                <Star className="w-3 h-3" fill="currentColor" />
                蒂贴
              </span>
            )}
          </div>

          {/* 内容块 */}
          <PostContent blocks={post.content_blocks || []} onImageClick={setPreviewImage} />

          {/* 投票 */}
          {post.poll_options && post.poll_options.length > 0 && (
            <div className="mt-4 p-4 bg-zinc-50 rounded-lg">
              <div className="font-medium mb-3">投票</div>
              <div className="space-y-2">
                {post.poll_options.map((opt: string, idx: number) => {
                  const votes = post.poll_votes?.filter((v: any) => v.option_index === idx).length || 0;
                  const totalVotes = post.poll_votes?.length || 0;
                  const percentage = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;
                  const isSelected = selectedPollOption === idx;
                  const canVote = user && selectedPollOption === null;

                  return (
                    <button
                      key={idx}
                      onClick={() => canVote && handleVote(idx)}
                      disabled={!canVote}
                      className={`w-full p-3 rounded-lg border transition-all text-left relative overflow-hidden ${
                        isSelected ? 'border-black bg-zinc-100' : 'border-zinc-200 hover:border-zinc-400'
                      } ${!canVote ? 'cursor-default' : 'cursor-pointer'}`}
                    >
                      <div 
                        className="absolute inset-0 bg-zinc-200 transition-all"
                        style={{ width: `${percentage}%` }}
                      />
                      <div className="relative flex items-center justify-between">
                        <span className="font-medium">{opt}</span>
                        {selectedPollOption !== null && (
                          <span className="text-sm text-zinc-600">{percentage}% ({votes}票)</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
              {selectedPollOption !== null && (
                <div className="text-xs text-zinc-500 mt-3">
                  总计 {post.poll_votes?.length || 0} 票
                </div>
              )}
            </div>
          )}

          {/* 互动按钮 */}
          <div className="flex items-center gap-6 mt-4 pt-4 border-t">
            <button 
              onClick={handleLike}
              className={`flex items-center gap-2 ${isLiked ? 'text-red-500' : 'text-zinc-500 hover:text-red-500'}`}
            >
              <Heart className="w-5 h-5" fill={isLiked ? 'currentColor' : 'none'} />
              <span className="text-sm font-medium">{post.likes?.length || 0}</span>
            </button>
            <button className="flex items-center gap-2 text-zinc-500 hover:text-black">
              <MessageCircle className="w-5 h-5" />
              <span className="text-sm font-medium">{comments.length}</span>
            </button>
          </div>
        </div>

        {/* 评论区 */}
        <div className="space-y-6">
          {comments.length === 0 ? (
            <div className="text-center py-8 text-zinc-400">暂无评论，快来写下你的想法吧~</div>
          ) : (
            comments.map(c => {
              const commentAuthor = usersMap[c.user_id];
              const repliedComment = c.reply_to_id ? comments.find(cm => cm.id === c.reply_to_id) : null;
              const repliedUser = repliedComment ? usersMap[repliedComment.user_id] : null;
              const isCommentLiked = c.likes?.includes(user?.id);
              
              return (
                <div key={c.id} className="flex gap-3 pb-4 border-b border-zinc-50">
                  <Avatar url={commentAuthor?.avatar} className="w-8 h-8 flex-shrink-0" />
                  <div className="flex-1">
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-medium text-base text-zinc-600">{commentAuthor?.user_name || '未知用户'}</span>
                      <span className="text-xs text-zinc-400">{timeAgo(c.created_at)}</span>
                    </div>
                    
                    {/* 显示被回复的内容 */}
                    {repliedComment && repliedUser && (
                      <div className="bg-zinc-50 pl-3 py-2 mb-2 text-sm rounded">                
                        <div className="text-zinc-600 line-clamp-2">
                         {repliedUser.user_name}:
                          {repliedComment.content}
                        </div>
                      </div>
                    )}
                    
                    <p className="text-zinc-800 text-base mb-2">
                    {(c.content || '').replace(/^@\S+\s*/, '')}
                    </p>

                    
                    {/* 评论图片 */}
                    {c.images && c.images.length > 0 && (
                      <div className="grid grid-cols-3 gap-2 my-2">
                        {c.images.map((img: string, idx: number) => (
                          <img 
                            key={idx} 
                            src={img} 
                            alt="" 
                            className="w-full h-24 object-cover rounded cursor-pointer hover:opacity-90"
                            onClick={() => setPreviewImage(img)}
                          />
                        ))}
                      </div>
                    )}
                    
                    <div className="flex items-center gap-4 mt-2">
                      <button 
                        onClick={() => handleLikeComment(c.id)}
                        className={`text-xs flex items-center gap-1 ${isCommentLiked ? 'text-red-500' : 'text-zinc-500 hover:text-red-500'}`}
                      >
                        <Heart className="w-3 h-3" fill={isCommentLiked ? 'currentColor' : 'none'} />
                        {c.likes?.length || 0}
                      </button>
                      <button
                        onClick={() => handleReply(c)}
                        className="text-xs text-zinc-500 hover:text-black flex items-center gap-1"
                      >
                        <MessageCircle className="w-3 h-3" />
                        回复
                      </button>
                      {(user?.id === c.user_id || isAdminOrInver) && (
                        <button
                          onClick={() => handleDeleteComment(c.id)}
                          className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1"
                        >
                          <Trash2 className="w-3 h-3" />
                          删除
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
          {/* 🆕 用于自动滚动的锚点 */}
          <div ref={commentsEndRef} />
        </div>
      </main>

      {/* 底部输入框 */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4 shadow-lg">
        <div className="max-w-2xl mx-auto">
          {/* 回复提示 */}
          {replyToComment && (
            <div className="bg-zinc-50 border border-zinc-200 rounded-lg p-2 mb-2 flex items-start justify-between">
              <div className="flex-1">
                <div className="text-xs text-zinc-500 mb-1">
                  回复 @{usersMap[replyToComment.user_id]?.user_name}:
                </div>
                <div className="text-sm text-zinc-700 line-clamp-1">
                  {replyToComment.content}
                </div>
              </div>
              <button onClick={cancelReply} className="p-1 hover:bg-zinc-200 rounded">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
          
          {/* 图片预览 */}
          {commentImagePreviews.length > 0 && (
            <div className="flex gap-2 mb-2 overflow-x-auto">
              {commentImagePreviews.map((preview, idx) => (
                <div key={idx} className="relative flex-shrink-0">
                  <img src={preview} alt="" className="w-16 h-16 object-cover rounded" />
                  <button
                    onClick={() => removeCommentImage(idx)}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
          
          <div className="flex gap-2">
            <label className="cursor-pointer p-2 hover:bg-zinc-100 rounded-lg">
              <ImageIcon className="w-5 h-5 text-zinc-500" />
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleCommentImageSelect}
                className="hidden"
              />
            </label>
            <textarea
              ref={commentInputRef}
              value={newComment}
              onChange={e => setNewComment(e.target.value)}
              className="flex-1 bg-zinc-100 rounded-lg p-2 text-sm outline-none resize-none h-10 focus:bg-white focus:ring-1 focus:ring-black"
              placeholder={replyToComment ? `回复 @${usersMap[replyToComment.user_id]?.user_name}...` : "写下你的评论..."}
            />
            <button 
              onClick={handleComment}
              disabled={uploadingComment || (!newComment.trim() && commentImages.length === 0)}
              className="bg-black text-white px-4 rounded-lg text-sm font-bold disabled:bg-zinc-300 disabled:cursor-not-allowed flex items-center gap-1"
            >
              {uploadingComment ? '发送中...' : (
                <>
                  <Send className="w-4 h-4" />
                  发送
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* 收藏模态框 */}
      {showCollectionModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4" onClick={() => setShowCollectionModal(false)}>
          <div className="bg-white rounded-lg max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg">收藏到合集</h3>
              <button onClick={() => setShowCollectionModal(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-3 mb-4 max-h-60 overflow-y-auto">
              {userCollections.map(col => (
                <button
                  key={col.id}
                  onClick={() => handleAddToCollection(col.id)}
                  className="w-full text-left p-3 border border-zinc-200 rounded-lg hover:border-black transition-colors"
                >
                  <div className="font-medium">{col.name}</div>
                  <div className="text-xs text-zinc-500 mt-1">{col.post_ids?.length || 0} 篇帖子</div>
                </button>
              ))}
            </div>
            
            <div className="border-t pt-4">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newCollectionName}
                  onChange={e => setNewCollectionName(e.target.value)}
                  placeholder="新建合集名称"
                  className="flex-1 border border-zinc-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-black"
                />
                <button
                  onClick={handleCreateCollection}
                  className="bg-black text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-zinc-800 flex items-center gap-1"
                >
                  <Plus className="w-4 h-4" />
                  创建
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 图片预览 */}
      {previewImage && (
        <div className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center p-4" onClick={() => setPreviewImage(null)}>
          <img src={previewImage} alt="" className="max-w-full max-h-full" />
          <button
            onClick={() => setPreviewImage(null)}
            className="absolute top-4 right-4 text-white bg-black bg-opacity-50 rounded-full p-2"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
      )}

      {/* 🆕 编辑帖子模态框 */}
      {isEditingPost && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4" onClick={() => setIsEditingPost(false)}>
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg">编辑帖子</h3>
              <button onClick={() => setIsEditingPost(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">标题</label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={e => setEditTitle(e.target.value)}
                  className="w-full border border-zinc-200 rounded-lg px-3 py-2 outline-none focus:border-black"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">分类</label>
                <select
                  value={editCategory}
                  onChange={e => setEditCategory(e.target.value as Category)}
                  className="w-full border border-zinc-200 rounded-lg px-3 py-2 outline-none focus:border-black"
                >
                  {CATEGORIES.filter(c => c !== '全部').map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
              
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setIsEditingPost(false)}
                  className="px-4 py-2 border border-zinc-200 rounded-lg hover:bg-zinc-50"
                >
                  取消
                </button>
                <button
                  onClick={handleSaveEdit}
                  className="px-4 py-2 bg-black text-white rounded-lg hover:bg-zinc-800"
                >
                  保存
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PostDetailPage;
