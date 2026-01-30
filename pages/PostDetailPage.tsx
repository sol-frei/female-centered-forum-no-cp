import { supabase } from '../services/supabaseClient';
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom'; // ✅ 引入路由钩子
import { User, Post, Category, Collection } from '../types';
import { 
  toggle_like_post, 
  toggle_essence_post, 
  vote_poll, 
  add_comment, 
  update_post, 
  create_collection, 
  addToCollection, 
  check_sensitive_words 
} from '../services/storage';
import { uploadImage } from '../services/storageService';
import { 
  Heart, MessageCircle, Trash2, X, Plus, Check, Star, 
  Image as ImageIcon, Bookmark, Send, Edit2, MoreVertical 
} from 'lucide-react';
import PostContent from '../components/PostContent';
import { ToastType } from '../components/Toast';

// 模拟 Avatar 组件（如果你的项目中已有该组件，请直接 import）
const Avatar = ({ url, className }: { url?: string; className?: string }) => (
  <div className={`bg-zinc-200 rounded-full overflow-hidden ${className}`}>
    {url ? <img src={url} alt="avatar" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-zinc-400">?</div>}
  </div>
);

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
  return date.toLocaleDateString();
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
  const { postId } = useParams<{ postId: string }>(); // ✅ 从 URL 中获取 postId
  const navigate = useNavigate(); // ✅ 用于路由跳转

  const [post, setPost] = useState<any | null>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // 评论与交互
  const [newComment, setNewComment] = useState('');
  const [replyToCommentId, setReplyToCommentId] = useState<string | null>(null);
  const commentInputRef = useRef<HTMLTextAreaElement>(null);
  const [commentImages, setCommentImages] = useState<File[]>([]);
  const [uploadingComment, setUploadingComment] = useState(false);

  // 收藏与编辑
  const [showCollectionModal, setShowCollectionModal] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');
  const [userCollections, setUserCollections] = useState<Collection[]>([]);
  const [isEditingPost, setIsEditingPost] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editBlocks, setEditBlocks] = useState<any[]>([]);
  const [editCategory, setEditCategory] = useState<Category>('讨论👊🏻i女');
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // --- 获取数据 ---
  const fetchPostAndComments = async () => {
    if (!postId) return;
    setLoading(true);
    try {
      const { data: postData, error: postErr } = await supabase.from('posts').select('*').eq('id', postId).single();
      if (postErr) throw postErr;

      const { data: commentData, error: commentErr } = await supabase
        .from('comments')
        .select('*')
        .eq('post_id', postId)
        .order('created_at', { ascending: true });
      if (commentErr) throw commentErr;

      setPost(postData);
      setComments(commentData || []);
    } catch (err: any) {
      showToast(`内容加载失败: ${err.message}`, "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPostAndComments();
  }, [postId]);

  // --- 权限/状态计算 ---
  if (loading) return <div className="p-20 text-center text-zinc-500">正在努力加载内容...</div>;
  if (!post) return <div className="p-20 text-center text-zinc-500">未找到该帖子</div>;

  const isAdminOrInver = user ? ['admin', 'i女er'].includes(user.role) : false;
  const canEditPost = user && user.id === post.user_id;

  // --- 处理逻辑 ---
  const handleBack = () => navigate(-1); // ✅ 返回上一页
  const onViewProfile = (uid: string) => navigate(`/profile/${uid}`); // ✅ 跳转个人主页

  const handleComment = async () => {
    if (!newComment.trim() && commentImages.length === 0) {
      showToast("评论内容或图片不能为空", 'error');
      return;
    }
    try {
      setUploadingComment(true);
      let imageUrls: string[] = [];
      if (commentImages.length > 0) {
        for (const file of commentImages) {
          const url = await uploadImage(file, 'comment_images', `comments/${user.id}`);
          imageUrls.push(url);
        }
      }

      await add_comment({
        post_id: postId!,
        user_id: user.id,
        user_name: user.user_name,
        content: newComment,
        reply_to_id: replyToCommentId || null,
        images: imageUrls.length > 0 ? imageUrls : null,
        likes: [],
      }, post.user_id, post.title);

      setNewComment('');
      setReplyToCommentId(null);
      setCommentImages([]);
      showToast("评论成功", "success");
      fetchPostAndComments(); // 刷新
    } catch (e: any) {
      showToast(`评论失败: ${e.message}`, 'error');
    } finally {
      setUploadingComment(false);
    }
  };

  const savePostEdit = async () => {
    try {
      const finalBlocks = editBlocks.filter(b => b.type === 'image' || b.value?.trim() !== '');
      await check_sensitive_words(editTitle + ' ' + JSON.stringify(finalBlocks));
      await update_post(post.id, {
        title: editTitle,
        content: JSON.stringify(finalBlocks),
        category: editCategory,
        updated_at: new Date().toISOString(),
      });
      setIsEditingPost(false);
      showToast('帖子修改成功', 'success');
      fetchPostAndComments();
    } catch (e: any) {
      showToast(e.message || '修改失败', 'error');
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-white">
      {/* 顶部导航 */}
      <div className="sticky top-0 z-40 w-full bg-white/80 backdrop-blur-md border-b border-zinc-100 px-4 py-2 flex items-center">
        <button onClick={handleBack} className="text-zinc-600 hover:text-black font-medium">
          ← 返回
        </button>
      </div>

      <main className="max-w-2xl mx-auto w-full px-4 py-6 pb-32">
        {/* 帖子头部 */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="cursor-pointer" onClick={() => onViewProfile(post.user_id)}>
              <Avatar url={usersMap[post.user_id]?.avatar} className="w-10 h-10" />
            </div>
            <div>
              <div className="font-bold text-sm" onClick={() => onViewProfile(post.user_id)}>
                {usersMap[post.user_id]?.user_name || '未知用户'}
              </div>
              <div className="text-xs text-zinc-400">{timeAgo(post.created_at)}</div>
            </div>
          </div>

          {isEditingPost ? (
            <div className="space-y-3">
              <input 
                className="w-full text-xl font-bold border-b p-2 outline-none focus:border-black" 
                value={editTitle} 
                onChange={e => setEditTitle(e.target.value)} 
              />
              <div className="flex gap-2">
                <button onClick={savePostEdit} className="bg-black text-white px-4 py-1 text-sm rounded">保存</button>
                <button onClick={() => setIsEditingPost(false)} className="bg-zinc-100 px-4 py-1 text-sm rounded">取消</button>
              </div>
            </div>
          ) : (
            <>
              <h1 className="text-2xl font-bold mb-4">{post.title}</h1>
              <PostContent content={post.content} className="prose prose-zinc" />
            </>
          )}
        </div>

        {/* 交互区 */}
        <div className="flex gap-6 py-4 border-y border-zinc-50 text-zinc-500 mb-8">
          <button className="flex items-center gap-1 hover:text-red-500">
            <Heart className="w-5 h-5" /> {post.likes?.length || 0}
          </button>
          <button onClick={() => setShowCollectionModal(true)} className="flex items-center gap-1 hover:text-blue-500">
            <Bookmark className="w-5 h-5" /> 收藏
          </button>
          <button className="flex items-center gap-1">
            <MessageCircle className="w-5 h-5" /> {comments.length}
          </button>
        </div>

        {/* 评论区 */}
        <div className="space-y-6">
          <h3 className="font-bold text-lg">全部评论</h3>
          {comments.map(c => (
            <div key={c.id} className="flex gap-3 pb-4 border-b border-zinc-50">
              <Avatar url={usersMap[c.user_id]?.avatar} className="w-8 h-8 flex-shrink-0" />
              <div className="flex-1">
                <div className="flex justify-between items-center mb-1">
                  <span className="font-bold text-sm">{usersMap[c.user_id]?.user_name}</span>
                  <span className="text-xs text-zinc-400">{timeAgo(c.created_at)}</span>
                </div>
                <p className="text-zinc-800 text-sm">{c.content}</p>
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* 底部输入框 */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4">
        <div className="max-w-2xl mx-auto flex gap-2">
          <textarea
            ref={commentInputRef}
            value={newComment}
            onChange={e => setNewComment(e.target.value)}
            className="flex-1 bg-zinc-100 rounded-lg p-2 text-sm outline-none resize-none h-10 focus:bg-white focus:ring-1 focus:ring-black"
            placeholder="写下你的评论..."
          />
          <button 
            onClick={handleComment}
            disabled={uploadingComment}
            className="bg-black text-white px-4 rounded-lg text-sm font-bold disabled:bg-zinc-300"
          >
            {uploadingComment ? '...' : '发送'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PostDetailPage;
