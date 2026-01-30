import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../services/supabaseClient';

import { User, Category, Collection } from '../types';
import {
  add_comment,
  toggle_like_post,
  toggle_essence_post,
  vote_poll,
  create_collection,
  addToCollection,
  update_post,
  check_sensitive_words,
} from '../services/storage';

import { uploadImage } from '../services/storageService';

import Avatar from '../components/Avatar';
import PostContent from '../components/PostContent';
import { ToastType } from '../components/Toast';

import {
  Heart,
  MessageCircle,
  Trash2,
  X,
  Plus,
  Check,
  Star,
  Image as ImageIcon,
  Bookmark,
  Send,
  Edit2,
  MoreVertical,
} from 'lucide-react';

interface PostDetailPageProps {
  user: User;
  usersMap: Record<string, User>;
  onViewProfile: (uid: string) => void;
  showToast: (msg: string, type: ToastType) => void;
}

const PostDetailPage: React.FC<PostDetailPageProps> = ({
  user,
  usersMap,
  onViewProfile,
  showToast,
}) => {
  const { postId } = useParams<{ postId: string }>();
  const navigate = useNavigate();

  // ---------------- 基础状态 ----------------
  const [post, setPost] = useState<any | null>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // ---------------- 评论状态 ----------------
  const [newComment, setNewComment] = useState('');
  const [replyToCommentId, setReplyToCommentId] = useState<string | null>(null);
  const commentInputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [commentImages, setCommentImages] = useState<File[]>([]);
  const [uploadingComment, setUploadingComment] = useState(false);

  // ---------------- 收藏 ----------------
  const [showCollectionModal, setShowCollectionModal] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');
  const [userCollections, setUserCollections] = useState<Collection[]>([]);

  // ---------------- 编辑帖子 ----------------
  const [isEditingPost, setIsEditingPost] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editBlocks, setEditBlocks] = useState<any[]>([]);
  const [editCategory, setEditCategory] = useState<Category>('讨论👊🏻i女');

  // ---------------- 预览 ----------------
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // ================= 数据加载 =================
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

      const { data: commentData } = await supabase
        .from('comments')
        .select('*')
        .eq('post_id', postId)
        .order('created_at', { ascending: true });

      setPost(postData);
      setComments(commentData || []);
    } catch (e: any) {
      showToast(e.message || '加载失败', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPostAndComments();
  }, [postId]);

  // ================= 编辑保存 =================
  const savePostEdit = async () => {
    try {
      const finalBlocks = editBlocks.filter(b =>
        b.type === 'text' ? b.value.trim() !== '' : true
      );

      if (!finalBlocks.length) {
        showToast('内容不能为空', 'error');
        return;
      }

      const textContent = finalBlocks
        .filter(b => b.type === 'text')
        .map(b => b.value)
        .join(' ');

      await check_sensitive_words(editTitle + ' ' + textContent);

      await update_post(post.id, {
        title: editTitle,
        content: JSON.stringify(finalBlocks),
        category: editCategory,
        updated_at: new Date().toISOString(),
      });

      setIsEditingPost(false);
      showToast('修改成功', 'success');
    } catch (e: any) {
      showToast(e.message || '修改失败', 'error');
    }
  };

  // ================= 评论 =================
  const handleComment = async () => {
    if (!newComment.trim() && !commentImages.length) {
      showToast('评论不能为空', 'error');
      return;
    }

    try {
      setUploadingComment(true);
      await add_comment(
        {
          post_id: postId!,
          user_id: user.id,
          user_name: user.user_name,
          content: newComment,
          reply_to_id: replyToCommentId,
          images: null,
          likes: [],
        },
        post.user_id,
        post.title
      );

      setNewComment('');
      setReplyToCommentId(null);
      showToast('评论成功', 'success');
    } catch (e: any) {
      showToast(e.message, 'error');
    } finally {
      setUploadingComment(false);
    }
  };

  // ================= 渲染拦截 =================
  if (loading) return <div className="p-20 text-center">加载中…</div>;
  if (!post) return <div className="p-20 text-center">帖子不存在</div>;

  const canEditPost = user.id === post.user_id;
  const isAdminOrInver = ['admin', 'i女er'].includes(user.role);

  return (
    <div className="min-h-screen bg-zinc-50">
      {/* 顶部返回 */}
      <div className="sticky top-0 bg-white z-40 border-b px-3">
        <button
          onClick={() => navigate(-1)}
          className="py-2 text-sm text-zinc-600 hover:text-black"
        >
          ← 返回
        </button>
      </div>

      {/* 帖子主体 */}
      <div className="bg-white border-b px-4 py-6">
        <h1 className="text-2xl font-bold text-center mb-2">{post.title}</h1>

        {!isEditingPost ? (
          <PostContent content={post.content} />
        ) : (
          <textarea
            className="w-full border p-3"
            value={editTitle}
            onChange={e => setEditTitle(e.target.value)}
          />
        )}

        {canEditPost && !isEditingPost && (
          <button
            onClick={() => {
              setEditTitle(post.title);
              setEditBlocks(JSON.parse(post.content));
              setEditCategory(post.category);
              setIsEditingPost(true);
            }}
            className="text-blue-600 text-sm mt-3"
          >
            <Edit2 className="inline w-4 h-4" /> 编辑
          </button>
        )}

        {isEditingPost && (
          <div className="mt-4 flex gap-2">
            <button onClick={savePostEdit} className="bg-black text-white px-4 py-2">
              保存
            </button>
            <button onClick={() => setIsEditingPost(false)} className="px-4 py-2">
              取消
            </button>
          </div>
        )}
      </div>

      {/* 评论区 */}
      <div className="p-4 space-y-4">
        {comments.map(c => (
          <div key={c.id} className="border-b pb-4">
            <div className="font-bold">{usersMap[c.user_id]?.user_name}</div>
            <p className="text-zinc-700">{c.content}</p>
          </div>
        ))}
      </div>

      {/* 底部评论输入 */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-3 flex gap-2">
        <textarea
          ref={commentInputRef}
          value={newComment}
          onChange={e => setNewComment(e.target.value)}
          className="flex-1 border p-2"
          placeholder="发表评论..."
        />
        <button
          onClick={handleComment}
          className="bg-black text-white px-4 flex items-center"
        >
          <Send className="w-4 h-4 mr-1" /> 发送
        </button>
      </div>
    </div>
  );
};

export default PostDetailPage;
