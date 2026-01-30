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
    // ✅ 1. 过滤掉空文本块
    const finalBlocks = editBlocks.filter(block => {
      if (block.type === 'text') {
        return block.value.trim() !== '';
      }
      return true; // 保留所有图片块
    });
    
    if (finalBlocks.length === 0) {
      showToast('内容不能为空', 'error');
      return;
    }
    
    // ✅ 2. 提取文本内容进行敏感词校验
    const textContent = finalBlocks
      .filter(block => block.type === 'text')
      .map(block => block.value)
      .join(' ');
    
    await check_sensitive_words(editTitle + ' ' + textContent);

    // ✅ 3. 校验通过后，执行更新（content序列化为JSON）
    await update_post(post.id, {
      title: editTitle,
      content: JSON.stringify(finalBlocks),
      category: editCategory,
      updated_at: new Date().toISOString(),
    });

    setIsEditingPost(false);
    showToast('帖子修改成功', 'success');
  } catch (e: any) {
    showToast(e.message || '修改失败', 'error');
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
   <div className="sticky top-[7.5rem] md:top-14 z-40 w-full bg-white px-3">
    <button onClick={() => navigate(-1)} className="inline-flex items-center gap-1 py-2 text-sm font-medium text-zinc-700 hover:text-black transition-all">
      ← 返回
    </button>
 </div>
        {/* 帖子内容 */}
         <div className="bg-white border-t border-b border-zinc-200 mb-6">
          <div className="px-3 py-4">
          <div className="flex items-start gap-4 mb-4">
            <div className="flex-shrink-0 cursor-pointer" onClick={() => navigate(`/profile/${post.user_id}`)}>
              <Avatar url={usersMap[post.user_id]?.avatar} className="w-12 h-12" />
            </div>
            <div className="flex-1">
              {isEditingPost ? (
                <div className="space-y-2 mb-4">
                  <select value={editCategory} onChange={e => setEditCategory(e.target.value as Category)} className="border p-1 text-sm">
                    {CATEGORIES.filter(c => c !== '全部').map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <input className="w-full border p-2 font-bold text-xl text-center" value={editTitle} onChange={e => setEditTitle(e.target.value)} />
                </div>
              ) : (
                <h1 className="text-2xl font-bold mb-2 text-center">{post.title}</h1>
              )}

              <div className="text-sm text-zinc-500 flex gap-3 items-center justify-center">
            
                <span onClick={() => navigate(`/profile/${post.user_id}`)} className="hover:underline cursor-pointer hover:text-black transition-colors">{usersMap[post.user_id]?.user_name || '未知用户'}</span>
                <span>{timeAgo(postCreatedAt)}</span>
                 {/* 如果更新时间晚于创建时间，显示“已编辑” */}
                {post.updated_at && post.updated_at !== post.created_at && (
                <span className="text-[10px] text-zinc-400 ml-1">(已编辑)</span>
                 )}
                
  
               {canEditPost && !isEditingPost && (
                   <button 
  onClick={() => { 
    setEditTitle(post.title);
    
    // ✅ 解析现有内容为blocks
    try {
      const blocks = JSON.parse(post.content);
      if (Array.isArray(blocks)) {
        setEditBlocks(blocks);
      } else {
        // 旧格式，转换为单个文本块
        setEditBlocks([{ type: 'text', value: post.content }]);
      }
    } catch {
      // 解析失败，当作纯文本
      setEditBlocks([{ type: 'text', value: post.content }]);
    }
    
    setEditCategory(post.category); 
    setIsEditingPost(true); 
  }} 
  className="flex items-center gap-1 text-blue-600 hover:underline ml-2"
>
  <Edit2 className="w-3 h-3" /> 
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

{/* 编辑帖子*/}
{isEditingPost ? (
  <div className="mb-4">
    {/* ✅ 图文混排编辑器 */}
    <div className="space-y-4 border border-zinc-300 rounded-lg p-4 bg-zinc-50">
      {editBlocks.map((block, index) => {
        if (block.type === 'text') {
          return (
            <div key={index} className="relative">
              <textarea
                value={block.value}
                onChange={e => {
                  const newBlocks = [...editBlocks];
                  newBlocks[index] = { ...block, value: e.target.value };
                  setEditBlocks(newBlocks);
                }}
                className="w-full p-3 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black resize-none bg-white"
                rows={4}
                placeholder="编辑文本..."
              />
              {/* 只有多个块时才显示删除按钮 */}
              {editBlocks.length > 1 && (
                <button
                  onClick={() => setEditBlocks(editBlocks.filter((_, i) => i !== index))}
                  className="absolute top-2 right-2 p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                  title="删除此文本块"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          );
        }
        
        if (block.type === 'image') {
          return (
            <div key={index} className="relative group">
              <img
                src={block.url}
                alt={`图片 ${index + 1}`}
                className="w-full max-h-96 object-contain rounded-lg border border-zinc-200"
              />
              <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                {/* ✅ 新增：替换图片按钮 */}
                <label className="bg-blue-600 text-white p-1.5 rounded-full cursor-pointer hover:bg-blue-700 shadow-lg transition-colors">
                  <ImageIcon className="w-4 h-4" />
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      
                      // 验证文件
                      if (!file.type.startsWith('image/')) {
                        showToast('只能上传图片文件', 'error');
                        return;
                      }
                      if (file.size > 5 * 1024 * 1024) {
                        showToast('图片不能超过5MB', 'error');
                        return;
                      }
                      
                      try {
                        // 显示上传提示
                        showToast('正在上传新图片...', 'info');
                        
                        // ✅ 修复：直接使用已导入的 uploadImage（不再使用动态导入）
                        const newUrl = await uploadImage(file, 'forum_images', `posts/${user.id}`);
                        
                        // 替换块中的图片URL
                        const newBlocks = [...editBlocks];
                        newBlocks[index] = { type: 'image', url: newUrl };
                        setEditBlocks(newBlocks);
                        
                        showToast('图片替换成功', 'success');
                        e.target.value = ''; // 清空input
                      } catch (err: any) {
                        showToast(`上传失败: ${err.message}`, 'error');
                      }
                    }}
                  />
                </label>
                
                {/* 删除图片按钮 */}
                <button
                  onClick={() => setEditBlocks(editBlocks.filter((_, i) => i !== index))}
                  className="bg-red-600 text-white p-1.5 rounded-full hover:bg-red-700 shadow-lg transition-colors"
                  title="删除图片"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        }
        
        return null;
      })}
      
      <div className="text-xs text-zinc-500 bg-blue-50 p-2 rounded border border-blue-200">
        💡 提示：可以修改文本内容、删除文本块或图片、替换图片（鼠标悬停在图片上查看操作按钮）
      </div>
    </div>
    
    <div className="flex gap-2 mt-4">
      <button 
        onClick={savePostEdit} 
        className="bg-black text-white px-4 py-2 text-sm rounded hover:bg-zinc-800 transition-colors"
      >
        保存修改
      </button>
      <button 
        onClick={() => setIsEditingPost(false)} 
        className="bg-zinc-200 px-4 py-2 text-sm rounded hover:bg-zinc-300 transition-colors"
      >
        取消
      </button>
    </div>
  </div>
) : (
  <PostContent 
    content={post.content} 
    className="prose prose-zinc w-full max-w-full mb-8" 
  />
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

{previewImage && (
  <div 
    className="fixed inset-0 bg-black/90 flex items-center justify-center z-[60] p-4" 
    onClick={() => setPreviewImage(null)}
  >
    <div className="relative max-w-5xl max-h-[90vh] w-full h-full flex items-center justify-center">
      <button
        onClick={() => setPreviewImage(null)}
        className="absolute top-4 right-4 bg-white/10 hover:bg-white/20 text-white p-2 rounded-full backdrop-blur-sm transition-colors z-10"
        title="关闭"
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
                          <span onClick={() => navigate(`/profile/${c.user_id}`)} className="hover:underline cursor-pointer">{commentAuthor?.user_name || '未知用户'}</span>
                          {isReply && repliedToAuthor && (
                            <span className="text-zinc-500 font-normal">回复
                              <span onClick={() => navigate(`/profile/${repliedToAuthor.id}`)} className="hover:underline cursor-pointer ml-1">@{repliedToAuthor.user_name}</span>
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
