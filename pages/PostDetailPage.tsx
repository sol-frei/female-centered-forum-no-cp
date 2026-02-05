import { supabase } from '../services/supabaseClient';
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { User, Post, Category, Collection, BookRating } from '../types'; // 导入 BookRating 类型
import { 
  toggle_like_post, 
  toggle_essence_post, 
  vote_poll, 
  add_comment, 
  update_post, 
  create_collection, 
  addToCollection, 
  check_sensitive_words,
  toggle_like_comment,
  get_book_rating_by_post // 导入获取评分函数
} from '../services/storage';

import { uploadImage } from '../services/storageService';
import { 
  Heart, MessageCircle, Trash2, X, Plus, Check, Star, 
  Image as ImageIcon, Bookmark, Send, Edit2, MoreVertical, ArrowLeft, UserCircle
} from 'lucide-react';

import PostContent from '../components/PostContent';
import { ToastType } from '../components/Toast';
import EditPostModal from '../components/EditPostModal';

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
  const [bookRating, setBookRating] = useState<BookRating | null>(null); // 新增评分状态

  // 评论与交互状态
  const [newComment, setNewComment] = useState('');
  const [replyToCommentId, setReplyToCommentId] = useState<string | null>(null);
  const [replyToComment, setReplyToComment] = useState<any | null>(null);
  const commentInputRef = useRef<HTMLTextAreaElement>(null);
  const [commentImages, setCommentImages] = useState<File[]>([]);
  const [commentImagePreviews, setCommentImagePreviews] = useState<string[]>([]);
  const [uploadingComment, setUploadingComment] = useState(false);
  const [isCommentExpanded, setIsCommentExpanded] = useState(false);

  // 收藏与编辑状态
  const [showCollectionModal, setShowCollectionModal] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');
  const [userCollections, setUserCollections] = useState<Collection[]>([]);
  const [isEditingPost, setIsEditingPost] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editBlocks, setEditBlocks] = useState<any[]>([]);
  const [editCategory, setEditCategory] = useState<Category>('讨论👊🏻i女');
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [selectedPollOption, setSelectedPollOption] = useState<number | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  
  // --- 获取数据 ---
  const fetchPostAndComments = async () => {
    if (!postId) return;
    setLoading(true);
    try {
      // 1. 获取帖子详情
      const { data: postData, error: postErr } = await supabase
        .from('posts')
        .select('*')
        .eq('id', postId)
        .single();
      if (postErr) throw postErr;

      // 2. 获取评论
      const { data: commentData, error: commentErr } = await supabase
        .from('comments')
        .select('*')
        .eq('post_id', postId)
        .order('created_at', { ascending: true });
      if (commentErr) throw commentErr;

      // 3. 加载图书评分（如果有）
      const rating = await get_book_rating_by_post(postId);
      setBookRating(rating);

      setPost(postData);
      setComments(commentData || []);
      
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

  // 实时订阅逻辑
  useEffect(() => {
    if (!postId) return;

    const commentsSubscription = supabase
      .channel(`comments:post_id=eq.${postId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comments', filter: `post_id=eq.${postId}` },
        (payload) => {
          if (payload.eventType === 'INSERT') setComments(prev => [...prev, payload.new]);
          else if (payload.eventType === 'UPDATE') setComments(prev => prev.map(c => c.id === payload.new.id ? payload.new : c));
          else if (payload.eventType === 'DELETE') setComments(prev => prev.filter(c => c.id !== payload.old.id));
        }
      ).subscribe();

    const postSubscription = supabase
      .channel(`post:id=eq.${postId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'posts', filter: `id=eq.${postId}` },
        (payload) => setPost(payload.new)
      ).subscribe();

    return () => {
      supabase.removeChannel(commentsSubscription);
      supabase.removeChannel(postSubscription);
    };
  }, [postId]);

  // 监听PostContent组件的图片预览事件
  useEffect(() => {
    const handlePreviewImage = (event: any) => {
      setPreviewImage(event.detail.url);
    };
    
    window.addEventListener('preview-image', handlePreviewImage);
    
    return () => {
      window.removeEventListener('preview-image', handlePreviewImage);
    };
  }, []);

  const loadUserCollections = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase.from('collections').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
      if (error) throw error;
      setUserCollections(data || []);
    } catch (err: any) { console.error('加载合集失败:', err); }
  };

  // --- 权限/交互处理逻辑 (保持原有逻辑不变) ---
  const isAdminOrInver = user ? ['admin', 'i女er'].includes(user.role) : false;
  const canEditPost = user && user.id === post?.user_id;
  const isLiked = post?.likes?.includes(user?.id);

  const handleBack = () => navigate(-1);
  const onViewProfile = (uid: string) => {
    console.log('跳转到用户主页, UID:', uid);
    navigate(`/profile/${uid}`);
  };

  const handleLike = async () => {
    if (!user || !post) return;
    const newLikes = isLiked ? post.likes.filter((id: string) => id !== user.id) : [...(post.likes || []), user.id];
    setPost({ ...post, likes: newLikes });
    try { await toggle_like_post(post.id, user.id); } 
    catch (e) { setPost({ ...post, likes: post.likes }); showToast('操作失败', 'error'); }
  };

  const handleEssence = async () => {
    if (!isAdminOrInver || !post) return;
    try {
      const newEssenceState = !post.is_essence;
      await toggle_essence_post(post.id, newEssenceState);
      showToast(newEssenceState ? '已设为蒂贴' : '已取消蒂贴', 'success');
      setPost({ ...post, is_essence: newEssenceState });
    } catch (e) { showToast('操作失败', 'error'); }
  };

  const handleVote = async (optionIndex: number) => {
    if (!user || selectedPollOption !== null || !post) return;
    setSelectedPollOption(optionIndex);
    const newVote = { user_id: user.id, option_index: optionIndex };
    setPost({ ...post, poll_votes: [...(post.poll_votes || []), newVote] });
    try { 
      await vote_poll(post.id, user.id, optionIndex);
      showToast('投票成功', 'success');
    } catch (e) {
      setSelectedPollOption(null);
      setPost({ ...post, poll_votes: post.poll_votes?.filter((v: any) => v.user_id !== user.id) });
      showToast('投票失败', 'error');
    }
  };

  // 评论/图片处理逻辑 (handleComment, handleReply, handleLikeComment 等保持不变...)
  const handleReply = (comment: any) => { setReplyToCommentId(comment.id); setReplyToComment(comment); commentInputRef.current?.focus(); };
  const cancelReply = () => { setReplyToCommentId(null); setReplyToComment(null); };
  const handleCommentImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length + commentImages.length > 9) { showToast('最多上传9张图片', 'error'); return; }
    setCommentImages(prev => [...prev, ...files]);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => setCommentImagePreviews(prev => [...prev, e.target?.result as string]);
      reader.readAsDataURL(file);
    });
  };
  const removeCommentImage = (index: number) => {
    setCommentImages(prev => prev.filter((_, i) => i !== index));
    setCommentImagePreviews(prev => prev.filter((_, i) => i !== index));
  };
  const handleComment = async () => {
    if (!newComment.trim() && commentImages.length === 0) { showToast("评论内容或图片不能为空", 'error'); return; }
    try {
      setUploadingComment(true);
      let imageUrls: string[] = [];
      if (commentImages.length > 0) {
        for (const file of commentImages) {
          const url = await uploadImage(file, 'comment_images', `comments/${user.id}`);
          imageUrls.push(url);
        }
      }
      await add_comment({ post_id: postId!, user_id: user.id, user_name: user.user_name, content: newComment, reply_to_id: replyToCommentId || null, images: imageUrls.length > 0 ? imageUrls : null, likes: [] }, post.user_id, post.title);
      setNewComment(''); setReplyToCommentId(null); setReplyToComment(null); setCommentImages([]); setCommentImagePreviews([]);
      showToast("评论成功", "success");
    } catch (e: any) { showToast(`评论失败: ${e.message}`, 'error'); } 
    finally { setUploadingComment(false); }
  };
  const handleLikeComment = async (commentId: string) => {
    if (!user) return;
    setComments(prev => prev.map(c => {
      if (c.id === commentId) {
        const isLiked = c.likes?.includes(user.id);
        return { ...c, likes: isLiked ? c.likes.filter((id: string) => id !== user.id) : [...(c.likes || []), user.id] };
      }
      return c;
    }));
    try { await toggle_like_comment(commentId, user.id); } 
    catch { showToast('操作失败', 'error'); fetchPostAndComments(); }
  };

  const openEditPost = () => {
    setEditTitle(post.title);
    try { setEditBlocks(JSON.parse(post.content)); } catch { setEditBlocks([{ type: 'text', value: post.content }]); }
    setEditCategory(post.category);
    setIsEditingPost(true);
  };

  const savePostEdit = async () => {
    try {
      const finalBlocks = editBlocks.filter(b => b.type === 'image' || b.value?.trim() !== '');
      await check_sensitive_words(editTitle + ' ' + JSON.stringify(finalBlocks));
      await update_post(post.id, { title: editTitle, content: JSON.stringify(finalBlocks), category: editCategory, updated_at: new Date().toISOString() });
      setIsEditingPost(false); showToast('帖子修改成功', 'success'); fetchPostAndComments();
    } catch (e: any) { showToast(e.message || '修改失败', 'error'); }
  };

  const handleCreateCollection = async () => {
    if (!newCollectionName.trim()) { showToast('请输入合集名称', 'error'); return; }
    try {
      const newCol = await create_collection(user.id, newCollectionName, '');
      if (newCol) { await addToCollection(newCol.id, post.id); showToast('已创建合集并收藏', 'success'); setShowCollectionModal(false); setNewCollectionName(''); loadUserCollections(); }
    } catch { showToast('创建失败', 'error'); }
  };

  const handleAddToCollection = async (collectionId: string) => {
    try { await addToCollection(collectionId, post.id); showToast('已添加到合集', 'success'); setShowCollectionModal(false); } 
    catch { showToast('添加失败', 'error'); }
  };

  // 投票展示组件
  const renderPollOptions = () => {
    if (!post.poll_options) return null;
    const totalVotes = post.poll_votes?.length || 0;
    return (
      <div className="my-4 space-y-2 bg-zinc-50 p-4 rounded-lg">
        <h4 className="font-bold text-sm mb-3">📊 投票</h4>
        {post.poll_options.map((option: string, index: number) => {
          const votes = post.poll_votes?.filter((v: any) => v.option_index === index).length || 0;
          const percentage = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;
          const isSelected = selectedPollOption === index;
          return (
            <button key={index} onClick={() => handleVote(index)} disabled={selectedPollOption !== null}
              className={`w-full text-left p-3 rounded-lg border-2 transition-all relative overflow-hidden ${isSelected ? 'border-black bg-black text-white' : selectedPollOption !== null ? 'border-zinc-200 bg-white cursor-not-allowed' : 'border-zinc-200 bg-white hover:border-black'}`}>
              {selectedPollOption !== null && <div className="absolute left-0 top-0 bottom-0 bg-zinc-100 transition-all" style={{ width: `${percentage}%` }} />}
              <div className="relative flex justify-between items-center">
                <span className="font-medium">{option}</span>
                {selectedPollOption !== null && <span className="text-sm">{percentage}% ({votes}票)</span>}
              </div>
            </button>
          );
        })}
        {selectedPollOption !== null && <p className="text-xs text-zinc-500 mt-2">总共 {totalVotes} 人投票</p>}
      </div>
    );
  };

  if (loading) return <div className="p-20 text-center text-zinc-500">正在努力加载内容...</div>;
  if (!post) return <div className="p-20 text-center text-zinc-500">未找到该帖子</div>;

  return (
    <div className="flex flex-col min-h-screen bg-white">
      {/* 顶部导航 */}
      <div className="sticky top-0 z-40 w-full bg-white/80 backdrop-blur-md border-b border-zinc-100 px-4 py-3 flex items-center justify-between">
        <button onClick={handleBack} className="text-zinc-600 hover:text-black font-medium flex items-center gap-2">
          <ArrowLeft className="w-5 h-5" /> 返回
        </button>
        {canEditPost && (
          <button onClick={() => setShowEditModal(true)} className="text-zinc-600 hover:text-black">
            <Edit2 className="w-5 h-5" />
          </button>
        )}
      </div>

      <main className="max-w-2xl mx-auto w-full px-4 py-6 pb-32">
        {/* 帖子头部 */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="cursor-pointer" onClick={() => onViewProfile(post.user_id)}>
                <Avatar url={usersMap[post.user_id]?.avatar} className="w-10 h-10" />
              </div>
              <div>
                <div className="font-medium text-base text-zinc-600 cursor-pointer hover:underline" onClick={() => onViewProfile(post.user_id)}>
                  {usersMap[post.user_id]?.user_name || '未知用户'}
                </div>
                <div className="text-xs text-zinc-400">{timeAgo(post.created_at)}</div>
              </div>
            </div>
            {isAdminOrInver && (
              <button onClick={handleEssence} className={`p-2 rounded-full ${post.is_essence ? 'text-yellow-500' : 'text-zinc-400 hover:text-yellow-500'}`}>
                <Star className="w-5 h-5" fill={post.is_essence ? 'currentColor' : 'none'} />
              </button>
            )}
          </div>

            <>
              <h1 className="text-2xl font-bold mb-4">{post.title}</h1>
              <PostContent content={post.content} className="prose prose-zinc max-w-none" />
              
              {/* 图书评分展示 - 修复问题1和问题2：黑白灰配色、去掉边框、修复勾选显示逻辑 */}
              {bookRating && (
                <div className="mt-6 bg-zinc-50 rounded-lg p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold flex items-center gap-2 text-zinc-800">
                      <span className="text-2xl">📚</span> 图书评分
                    </h3>
                    <div className="text-right">
                      <div className="text-3xl font-bold text-zinc-800">{bookRating.final_score.toFixed(1)}</div>
                      <div className="text-xs text-zinc-500">最终得分</div>
                    </div>
                  </div>

                  <div className="bg-white rounded-lg p-4 mb-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-base">
                      <div><span className="text-zinc-500">书名：</span><span className="font-medium text-zinc-800">{bookRating.book_name}</span></div>
                      <div><span className="text-zinc-500">作者：</span><span className="font-medium text-zinc-800">{bookRating.book_author}</span></div>
                      {bookRating.book_platform && (<div><span className="text-zinc-500">平台：</span><span className="font-medium text-zinc-800">{bookRating.book_platform}</span></div>)}
                      <div><span className="text-zinc-500">评分人：</span><span className="font-medium text-zinc-800">{bookRating.user_name}</span></div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3 mb-4">
                    <div className="bg-white rounded-lg p-3 text-center">
                      <div className="text-2xl font-bold text-zinc-700">{bookRating.impressed_score}</div>
                      <div className="text-xs text-zinc-500 mt-1">印象分</div>
                    </div>
                    <div className="bg-white rounded-lg p-3 text-center">
                      <div className="text-2xl font-bold text-zinc-700">-{(bookRating.impressed_score - bookRating.final_score - bookRating.extra_deduction).toFixed(1)}</div>
                      <div className="text-xs text-zinc-500 mt-1">准则扣分</div>
                    </div>
                    <div className="bg-white rounded-lg p-3 text-center">
                      <div className="text-2xl font-bold text-zinc-700">-{bookRating.extra_deduction}</div>
                      <div className="text-xs text-zinc-500 mt-1">额外扣分</div>
                    </div>
                  </div>

                  {bookRating.reviewer_comment && (
                    <div className="bg-white rounded-lg p-4">
                      <div className="text-base font-bold text-zinc-700 mb-2">爱女姐有话说</div>
                      <div className="text-base text-zinc-600 whitespace-pre-wrap">{bookRating.reviewer_comment}</div>
                    </div>
                  )}

                  <details className="mt-4">
                    <summary className="cursor-pointer text-base font-medium text-zinc-700 hover:text-zinc-900 select-none"> 查看详细评分准则</summary>
                    <div className="mt-3 bg-white rounded-lg p-4 space-y-2 max-h-96 overflow-y-auto">
                      {Object.entries(bookRating.principle_scores).map(([key, value]) => {
                        if (!value) return null;
                        const principleIndex = parseInt(key.replace('p', '')) - 1;
                        const principleTexts = [
                          '作者预收/写过/阅读男主文、bl、言情等非4B小说。', '连载中/断更/卡v/坑文等操作。', '文笔差 / 一般，剧情设定欠缺。', '评论区磕cp、吵架，作者关闭评论区等。', '作者现实其他骚操作（已婚、提男友、拒绝激女读者等）。', '描写氛围、语言、过于暧昧，女角色之间（非女主）关系有百合倾向。', '女男比例低于2：1。', '随父姓，默认任何角色随父姓，不单指主角，不指出也不批判也没改变。', '女性角色塑造不用心、刻板印象（取名随意、脸谱化、平面化）。', '服美役（白幼瘦、面部、高跟鞋、胸臀腿特写、衣服配饰等外貌方面的描写）。', '驴竞、拉踩其他女角色。', '忽略女性困难处境、物化女性。', '性别认知障碍，自称哥、爸、爷、弟等，女扮男装，女角色被称为先生等。', '扶持男性、接男儿，有男人分享女角色胜利果实/成果/遗产等。', '男性角色与女性角色存在单向/双向性缘。', '美化男性（母父对比、男性深情、男性友情、男性导师等）、偏爱男性。', '男性角色有高光、有成长线。', '掺腐（非批判）。', '存在厌女词、辱女词。', '存在男本位词。', '用性侵、造黄谣等方式惩罚女性。', '过度渲染女性苦楚，但反抗/觉醒占比少。', '是否有提到推广女权思想【没有扣分】。', '是否有明确反男权思想【没有扣分】。', '是否默认女性为第一性【没有扣分】。'
                        ];
                        const remark = bookRating.principle_remarks[key];
                        // 修复问题4和5：后三项（p23-p25）选'yes'是好的，显示绿色；去掉✓✗只保留圆圈
                        const isLastThreePrinciples = principleIndex >= 22 && principleIndex <= 24;
                        const shouldShowGreen = isLastThreePrinciples ? (value === 'yes') : (value !== 'yes');
                        
                        return (
                          <div key={key} className="text-base py-2">
                            <div className="flex items-start gap-2">
                              <span className={`flex-shrink-0 w-6 h-6 rounded-full border-2 ${shouldShowGreen ? 'border-green-600 bg-green-100' : 'border-red-600 bg-red-100'}`}>
                              </span>
                              <div className="flex-1">
                                <p className="text-zinc-700">{principleIndex + 1}. {principleTexts[principleIndex]}</p>
                                {remark && <p className="text-sm text-zinc-500 mt-1">备注: {remark}</p>}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </details>

                  {bookRating.extra_deduction > 0 && bookRating.extra_remark && (
                    <div className="mt-3 bg-zinc-100 rounded-lg p-3">
                      <p className="text-base font-bold text-zinc-800 mb-1">额外扣分原因</p>
                      <p className="text-base text-zinc-700">{bookRating.extra_remark}</p>
                    </div>
                  )}
                </div>
              )}
              {renderPollOptions()}
            </>
        </div>

        {/* 交互与评论区 */}
        <div className="flex gap-6 py-4 border-y border-zinc-100 text-zinc-500 mb-8">
          <button onClick={handleLike} className={`flex items-center gap-1 transition-colors ${isLiked ? 'text-red-500' : 'hover:text-red-500'}`}>
            <Heart className="w-5 h-5" fill={isLiked ? 'currentColor' : 'none'} /> {post.likes?.length || 0}
          </button>
          <button onClick={() => setShowCollectionModal(true)} className="flex items-center gap-1 hover:text-blue-500"><Bookmark className="w-5 h-5" /> 收藏</button>
          <button className="flex items-center gap-1"><MessageCircle className="w-5 h-5" /> {comments.length}</button>
        </div>

        <div className="space-y-6">
          {comments.length === 0 ? (
            <div className="text-center py-8 text-zinc-400">暂无评论~</div>
          ) : (
            comments.map(c => {
              const commentAuthor = usersMap[c.user_id];
              const repliedComment = c.reply_to_id ? comments.find(cm => cm.id === c.reply_to_id) : null;
              const isCommentLiked = c.likes?.includes(user?.id);
              
              return (
                <div key={c.id} className="flex gap-3 pb-4 border-b border-zinc-50">
                  <div 
                    className="cursor-pointer flex-shrink-0" 
                    onClick={() => onViewProfile(c.user_id)}
                  >
                    <Avatar url={commentAuthor?.avatar} className="w-8 h-8" />
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-center mb-1">
                      <span 
                        className="font-medium text-base text-zinc-600 cursor-pointer hover:text-zinc-900"
                        onClick={() => onViewProfile(c.user_id)}
                      >
                        {commentAuthor?.user_name || '未知用户'}
                      </span>
                      <span className="text-xs text-zinc-400">{timeAgo(c.created_at)}</span>
                    </div>
                    {/* 修复问题4：被回复评论完整显示 */}
                    {repliedComment && (
                      <div className="bg-zinc-50 pl-3 py-2 mb-2 text-sm rounded">
                        <div className="text-zinc-600">
                          <span 
                            className="cursor-pointer"
                            onClick={() => onViewProfile(repliedComment.user_id)}
                          >
                            @{usersMap[repliedComment.user_id]?.user_name}
                          </span>
                          : {repliedComment.content}
                        </div>
                      </div>
                    )}
                    <p className="text-zinc-800 text-base mb-2">{(c.content || '').replace(/^@\S+\s*/, '')}</p>
                    {/* 修复问题5：评论图片改为完整尺寸自适应显示 */}
                    {c.images?.map((img: string, idx: number) => (
                      <img key={idx} src={img} className="w-full max-w-md rounded mt-2 cursor-pointer" onClick={() => setPreviewImage(img)} alt="" />
                    ))}
                    <div className="flex items-center gap-4 mt-2">
                      <button onClick={() => handleLikeComment(c.id)} className={`text-xs flex items-center gap-1 ${isCommentLiked ? 'text-red-500' : 'text-zinc-500 hover:text-red-500'}`}>
                        <Heart className="w-3 h-3" fill={isCommentLiked ? 'currentColor' : 'none'} /> {c.likes?.length || 0}
                      </button>
                      <button onClick={() => handleReply(c)} className="text-xs text-zinc-500 hover:text-black flex items-center gap-1"><MessageCircle className="w-3 h-3" /> 回复</button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </main>

      {/* 修复问题3：底部输入框添加图片预览 */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4 shadow-lg">
        <div className="max-w-2xl mx-auto">
          {replyToComment && (
            <div className="bg-zinc-50 border border-zinc-200 rounded-lg p-2 mb-2 flex items-start justify-between">
              <div className="flex-1 text-sm text-zinc-700 line-clamp-1">回复 @{usersMap[replyToComment.user_id]?.user_name}: {replyToComment.content}</div>
              <button onClick={cancelReply} className="p-1 hover:bg-zinc-200 rounded"><X className="w-4 h-4" /></button>
            </div>
          )}
          {/* 添加图片预览区域 */}
          {commentImagePreviews.length > 0 && (
            <div className="flex gap-2 mb-2 flex-wrap">
              {commentImagePreviews.map((preview, idx) => (
                <div key={idx} className="relative">
                  <img src={preview} className="w-16 h-16 object-cover rounded" alt="" />
                  <button 
                    onClick={() => removeCommentImage(idx)}
                    className="absolute -top-1 -right-1 bg-black text-white rounded-full w-5 h-5 flex items-center justify-center text-xs hover:bg-zinc-700"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-2 items-start">
            <label className="cursor-pointer p-2 hover:bg-zinc-100 rounded-lg flex-shrink-0">
              <ImageIcon className="w-5 h-5 text-zinc-500" /><input type="file" accept="image/*" multiple onChange={handleCommentImageSelect} className="hidden" />
            </label>
            <textarea 
              ref={commentInputRef} 
              value={newComment} 
              onChange={e => setNewComment(e.target.value)} 
              className={`flex-1 bg-zinc-100 rounded-lg p-2 text-sm outline-none resize-none transition-all ${isCommentExpanded ? 'h-48' : 'h-10'}`}
              placeholder="写下你的评论..." 
            />
            <button 
              onClick={() => setIsCommentExpanded(!isCommentExpanded)}
              className="p-2 hover:bg-zinc-100 rounded-lg text-zinc-500 flex-shrink-0 h-10"
              title={isCommentExpanded ? "收起" : "展开"}
            >
              {isCommentExpanded ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                </svg>
              )}
            </button>
            <button onClick={handleComment} disabled={uploadingComment || (!newComment.trim() && commentImages.length === 0)} className="bg-black text-white px-4 rounded-lg text-sm font-bold disabled:bg-zinc-300 flex-shrink-0 h-10">发送</button>
          </div>
        </div>
      </div>

      {/* 收藏 & 预览 Modal */}
      {showCollectionModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowCollectionModal(false)}>
          <div className="bg-white rounded-lg max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-lg mb-4">收藏到合集</h3>
            <div className="space-y-3 mb-4 max-h-60 overflow-y-auto">
              {userCollections.map(col => (
                <button key={col.id} onClick={() => handleAddToCollection(col.id)} className="w-full text-left p-3 border rounded-lg hover:border-black">{col.name}</button>
              ))}
            </div>
            <div className="flex gap-2 border-t pt-4">
              <input type="text" value={newCollectionName} onChange={e => setNewCollectionName(e.target.value)} placeholder="新建合集" className="flex-1 border rounded-lg px-3 py-2 text-sm" />
              <button onClick={handleCreateCollection} className="bg-black text-white px-4 py-2 rounded-lg text-sm">创建</button>
            </div>
          </div>
        </div>
      )}

   {/* 编辑帖子弹窗 */}
  {showEditModal && (
  <EditPostModal
    user={user}
    post={post}
    bookRating={bookRating}
    onClose={() => setShowEditModal(false)}
    onSuccess={() => {
      setShowEditModal(false);
      fetchPostAndComments();
    }}
    showToast={showToast}
  />
)} 
      {/* 图片预览弹窗 - 黑色背景白色× */}
      {previewImage && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4" onClick={() => setPreviewImage(null)}>
          <button 
            onClick={() => setPreviewImage(null)}
            className="absolute top-6 right-6 w-12 h-12 bg-black rounded-full flex items-center justify-center text-white text-4xl"
          >
            ×
          </button>
          <img src={previewImage} className="max-w-full max-h-full" alt="" />
        </div>
      )}


      
    </div>
  );
};


export default PostDetailPage;
