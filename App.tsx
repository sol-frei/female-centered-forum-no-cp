import { supabase } from './services/supabaseClient';
import React, { useState, useEffect, useRef } from 'react';
import Landing from './components/Landing';
import { User, Post, Category, Collection, Notification, SensitiveWords,ToastType} from './types';
import { get_all_users, get_user, create_post, get_posts, toggle_like_post, toggle_essence_post, delete_post, vote_poll, add_comment, update_post,getComments, updateUser, getUnreadNotificationCount, create_collection, addToCollection, updatePost, update_comment,toggle_lock_post,delete_comment } from './services/storage';
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

// 发布帖子

interface PostDetailProps {
  post_id: string;
  user: User;
  users_map: Record<string, User>; // 改为下划线
  onBack: () => void;
  onViewProfile: (uid: string) => void;
  onDelete: () => void; // 帖子被删除后的回调
  showToast: (msg: string, type: ToastType) => void;
}

const PostDetail = ({
  post_id,
  user,
  users_map, // 改为下划线
  onBack,
  onViewProfile,
  onDelete,
  showToast,
}: PostDetailProps) => {
  // 1. 基础状态 (保持实时订阅带来的 any 类型，后续随着表结构稳定可以细化)
  const [post, setPost] = useState<any | null>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // 2. 评论与交互状态
  const [new_comment, setNewComment] = useState(''); // 改为下划线
  const [reply_to_comment_id, setReplyToCommentId] = useState<string | null>(null); // 改为下划线，精确到评论ID
  const commentInputRef = useRef<HTMLTextAreaElement>(null);

  // 3. 收藏状态
  const [show_collection_modal, setShowCollectionModal] = useState(false); // 改为下划线
  const [new_collection_name, setNewCollectionName] = useState(''); // 改为下划线
  const [user_collections, setUserCollections] = useState<Collection[]>([]); // 改为下划线

  // 4. 编辑帖子状态
  const [is_editing_post, setIsEditingPost] = useState(false); // 改为下划线
  const [edit_title, setEditTitle] = useState(''); // 改为下划线
  const [edit_content, setEditContent] = useState(''); // 改为下划线
  const [edit_category, setEditCategory] = useState<Category>('讨论👊🏻i女'); // 改为下划线

  // 5. 编辑评论状态
  const [editing_comment_id, setEditingCommentId] = useState<string | null>(null); // 改为下划线
  const [edit_comment_content, setEditCommentContent] = useState(''); // 改为下划线

  // --- 数据初始加载 ---
  const fetchPostAndComments = async () => {
    setLoading(true);
    try {
      // 优化：直接从 Supabase 获取带有关联的 Post 数据
      const { data: post_data, error: post_error } = await supabase
        .from('posts')
        .select('*') // 你也可以在这里 select('*, comments(*)') 来一次性获取评论，但实时订阅会单独处理
        .eq('id', post_id)
        .single();

      if (post_error) throw post_error;

      // 获取评论
      const { data: comment_data, error: comment_error } = await supabase
        .from('comments')
        .select('*')
        .eq('post_id', post_id)
        .order('created_at', { ascending: true }); // 确保评论按时间排序

      if (comment_error) throw comment_error;

      setPost(post_data);
      setComments(comment_data || []);
      // 每次加载帖子时，增加浏览量（可选功能，如果需要后端函数）
      // await update_post_view_count(post_id);
    } catch (err: any) {
      showToast(`内容加载失败: ${err.message}`, "error");
      setPost(null); // 加载失败则清空帖子
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (post_id) {
      fetchPostAndComments();
    }
  }, [post_id]); // 帖子ID变化时重新加载数据

  // --- 实时订阅 ---
  useEffect(() => {
    if (!post_id) return;

    // 订阅帖子本身的更新 (点赞数、精华、锁定状态等)
    const post_channel = supabase.channel(`post_${post_id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'posts', filter: `id=eq.${post_id}` }, payload => {
        setPost(payload.new);
      })
      .subscribe();

    // 订阅评论的更新 (新增、修改、删除)
    const comments_channel = supabase.channel(`comments_for_${post_id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comments', filter: `post_id=eq.${post_id}` }, () => {
        // 当评论表有任何变化时，重新获取评论列表
        supabase.from('comments').select('*').eq('post_id', post_id).order('created_at', { ascending: true })
          .then(({ data }) => setComments(data || []))
          .catch(err => console.error("实时获取评论失败:", err));
      })
      .subscribe();

    // 清理函数：组件卸载时取消订阅
    return () => {
      supabase.removeChannel(post_channel);
      supabase.removeChannel(comments_channel);
    };
  }, [post_id]); // 帖子ID变化时重新订阅

  // --- 收藏列表加载 ---
  useEffect(() => {
    const fetchCollections = async () => {
      if (user && show_collection_modal) { // 仅当用户存在且模态框显示时加载
        try {
          const { data, error } = await supabase
            .from('collections')
            .select('*')
            .eq('user_id', user.id); // 确保你的 collections 表有 user_id 列

          if (error) throw error;
          setUserCollections(data || []);
        } catch (err: any) {
          showToast(`获取收藏夹失败: ${err.message}`, 'error');
        }
      }
    };
    fetchCollections();
  }, [user, show_collection_modal]); // 当用户或模态框状态变化时加载收藏夹

  // --- 渲染拦截 (加载中和未找到) ---
  if (loading) return <div className="p-20 text-center text-zinc-500">正在努力加载内容...</div>;
  if (!post) return <div className="p-20 text-center text-zinc-500">未找到该帖子</div>;


  // --- 权限计算 (统一用下划线) ---
  const is_admin_or_inver = user ? ['admin', 'i女er'].includes(user.role) : false;
  // 适配旧数据和新数据可能的命名差异
  const post_created_at = post.created_at || post.createdAt || new Date().toISOString();
  // 作者只能在10分钟内修改自己的帖子
  const can_edit_post_in_time = user.id === post.author_id && (Date.now() - new Date(post_created_at).getTime() < 10 * 60 * 1000); // 注意这里的 post.author_id

  // --- 处理函数 ---

  // 处理评论提交
  const handle_comment = async () => { // 改为下划线
    if (!new_comment.trim()) {
      showToast("评论内容不能为空", 'error');
      return;
    }
    try {
      // ✅ 使用云端函数 add_comment
      await add_comment({
        post_id: post_id,
        user_id: user.id,
        user_name: user.user_name,
        content: new_comment,
        reply_to_id: reply_to_comment_id || undefined, // 如果没有回复对象就是 undefined
      });
      setNewComment('');
      setReplyToCommentId(null);
      // 实时订阅会自动更新评论，这里不需要手动 setComments
      showToast("评论成功", "success");
    } catch (e: any) {
      showToast(`评论失败: ${e.message}`, 'error');
    }
  };

  // 处理投票
  const handle_vote = async (opt_id: string) => { // 改为下划线
    try {
      // 检查是否已截止
      if (new Date(post.poll.deadline) < new Date()) {
        showToast("投票已截止", "error");
        return;
      }
      // ✅ 使用云端函数 vote_poll
      await vote_poll(post.id, opt_id, user.id);
      // 实时订阅会自动更新 post 状态，不需要手动 setPost
      showToast("投票成功", "success");
    } catch (e: any) {
      showToast(`投票失败: ${e.message}`, 'error');
    }
  };

  // 创建新收藏夹
  const handle_create_collection = async () => { // 改为下划线
    if (!new_collection_name.trim()) return;
    try {
      // ✅ 使用云端函数 create_collection
      await create_collection(user.id, new_collection_name); // 确保函数参数对应
      setNewCollectionName('');
      // 重新获取收藏夹列表
      const { data, error } = await supabase.from('collections').select('*').eq('user_id', user.id);
      if (error) throw error;
      setUserCollections(data || []);
      showToast('收藏夹创建成功', 'success');
    } catch (e: any) {
      showToast(`创建收藏夹失败: ${e.message}`, 'error');
    }
  };

  // 保存帖子编辑
  const save_post_edit = async () => { // 改为下划线
    try {
      // ✅ 使用云端函数 update_post
      await update_post(post.id, {
        title: edit_title,
        content: edit_content,
        category: edit_category,
        updated_at: new Date().toISOString(), // 更新时间
      });
      // 实时订阅会自动更新 post 状态，不需要手动 setPost
      setIsEditingPost(false);
      showToast('帖子修改成功', 'success');
    } catch (e: any) {
      showToast(`修改失败: ${e.message}`, 'error');
    }
  };

  // 删除帖子
  const handle_delete_post = async () => { // 改为下划线
    if (!window.confirm("确定要删除这篇帖子吗？")) return;
    try {
      // ✅ 使用云端函数 delete_post
      await delete_post(post.id);
      showToast('帖子已删除', 'success');
      onDelete(); // 通知父组件帖子已删除，可能需要返回列表页
    } catch (e: any) {
      showToast(`删除失败: ${e.message}`, 'error');
    }
  };

  // 开始编辑评论
  const start_edit_comment = (comment: any) => { // 改为下划线
    setEditingCommentId(comment.id);
    setEditCommentContent(comment.content);
  };

  // 保存评论编辑
  const save_comment_edit = async (comment_id: string) => { // 改为下划线
    try {
      // ✅ 使用云端函数 update_comment
      await update_comment(comment_id, edit_comment_content);
      // 实时订阅会自动更新评论，不需要手动 setComments
      setEditingCommentId(null);
      showToast('评论修改成功', 'success');
    } catch (e: any) {
      showToast(`修改失败: ${e.message}`, 'error');
    }
  };

  // 删除评论
  const handle_delete_comment = async (comment_id: string) => { // 改为下划线
    if (!window.confirm("确定要删除这条评论吗？")) return;
    try {
      // ✅ 使用云端函数 delete_comment
      await delete_comment(comment_id);
      // 实时订阅会自动更新评论
      showToast('评论已删除', 'success');
    } catch (e: any) {
      showToast(`删除失败: ${e.message}`, 'error');
    }
  };

  // 点击回复按钮
  const handle_reply_click = (comment_id: string, author_name: string) => { // 改为下划线
    setReplyToCommentId(comment_id);
    setNewComment(`@${author_name} `); // 预填充评论框
    commentInputRef.current?.focus(); // 聚焦输入框
  };


  return (
    <div className="flex flex-col min-h-screen">
      <div className="max-w-3xl mx-auto py-8 px-4 flex-1 pb-32 w-full">
        <button onClick={onBack} className="mb-4 text-sm text-zinc-500 hover:text-black">← 返回列表</button>

        {/* 帖子内容 */}
        <div className="bg-white border border-zinc-200 p-6 shadow-sm mb-6">
          <div className="flex items-start gap-4 mb-4">
            {/* 作者头像和信息 */}
            <div className="flex-shrink-0 cursor-pointer" onClick={() => onViewProfile(post.author_id)}> {/* 注意 post.author_id */}
              <Avatar url={users_map[post.author_id]?.avatar} className="w-12 h-12" />
            </div>
            <div className="flex-1">
              {is_editing_post ? (
                <div className="space-y-2 mb-4">
                  <select value={edit_category} onChange={e => setEditCategory(e.target.value as Category)} className="border p-1 text-sm">
                    {CATEGORIES.filter(c => c !== '全部').map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <input className="w-full border p-2 font-bold text-xl" value={edit_title} onChange={e => setEditTitle(e.target.value)} />
                </div>
              ) : (
                <h1 className="text-2xl font-bold mb-2">{post.title}</h1>
              )}

              <div className="text-sm text-zinc-500 flex gap-3 items-center">
                {!is_editing_post && <span className="bg-zinc-100 px-2 py-0.5 rounded text-xs">{post.category}</span>}
                <span onClick={() => onViewProfile(post.author_id)} className="hover:underline cursor-pointer hover:text-black transition-colors">{users_map[post.author_id]?.user_name || post.author_name}</span> {/* 注意 post.author_id 和 user_name */}
                <span>{timeAgo(post_created_at)}</span>
                {(post.is_essence || post.isEssence) && <span className="bg-black text-white px-1.5 text-xs flex items-center">蒂</span>}
                {post.is_locked && <span className="bg-red-600 text-white px-1.5 text-xs flex items-center">🔒</span>}

                {/* 编辑帖子按钮 */}
                {can_edit_post_in_time && !is_editing_post && (
                  <button onClick={() => { setEditTitle(post.title); setEditContent(post.content); setEditCategory(post.category); setIsEditingPost(true); }} className="flex items-center gap-1 text-blue-600 hover:underline ml-2">
                    <Edit2 className="w-3 h-3" /> 修改
                  </button>
                )}
              </div>
            </div>

            {/* 管理员操作按钮 */}
            {is_admin_or_inver && (
              <div className="flex gap-2">
                <button onClick={async () => { await toggle_essence_post(post.id, !post.is_essence); }} title="设为精华/取消" className="p-2 hover:bg-zinc-100 rounded">
                  <Star className={`w-4 h-4 ${post.is_essence ? 'fill-yellow-500 text-yellow-500' : ''}`} />
                </button>
                <button onClick={async () => { await toggle_lock_post(post.id, !post.is_locked); }} title="锁定/解锁帖子" className="p-2 hover:bg-zinc-100 rounded">
                  <Lock className={`w-4 h-4 ${post.is_locked ? 'fill-red-500 text-red-500' : ''}`} /> {/* 假设 Lock 图标已经导入 */}
                </button>
                <button onClick={handle_delete_post} title="删除" className="p-2 hover:bg-red-50 text-red-600 rounded">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* 帖子正文 */}
          {is_editing_post ? (
            <div className="mb-4">
              <textarea className="w-full border p-2 h-64" value={edit_content} onChange={e => setEditContent(e.target.value)} />
              <div className="flex gap-2 mt-2">
                <button onClick={save_post_edit} className="bg-black text-white px-3 py-1 text-sm">保存</button>
                <button onClick={() => setIsEditingPost(false)} className="bg-zinc-200 px-3 py-1 text-sm">取消</button>
              </div>
            </div>
          ) : (
            <div className="prose prose-zinc max-w-none mb-8 whitespace-pre-wrap leading-relaxed text-zinc-800">
              {post.content}
            </div>
          )}

          {/* 图片展示 */}
          {post.images && post.images.length > 0 && (
            <div className="mb-8 space-y-4">
              {post.images.map((img: string, i: number) => (
                <img key={i} src={img} alt="post content" className="max-w-full rounded border border-zinc-100" />
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
                {post.poll.options.map((opt: any) => { // 类型any，因为poll的结构可能复杂
                  const totalVotes = post.poll!.options.reduce((acc: number, o: any) => acc + (o.votes?.length || 0), 0);
                  const percent = totalVotes === 0 ? 0 : Math.round(((opt.votes?.length || 0) / totalVotes) * 100);
                  const is_voted = opt.votes?.includes(user.id); // 改为下划线

                  const poll_active = new Date(post.poll.deadline) >= new Date();

                  return (
                    <div key={opt.id} className={`relative group ${poll_active ? 'cursor-pointer hover:bg-zinc-100' : 'cursor-not-allowed'}`} onClick={() => poll_active && handle_vote(opt.id)}>
                      <div className="flex justify-between text-sm mb-1 z-10 relative px-2 py-1">
                        <span className={is_voted ? 'font-bold' : ''}>{opt.text} {is_voted && '✓'}</span>
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


          {/* 底部互动操作：点赞，评论，收藏 */}
          <div className="flex gap-6 pt-4 border-t border-zinc-100 text-zinc-500 text-sm">
            <button
              onClick={async () => { await toggle_like_post(post.id, user.id); }} // 使用云端函数
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

        {/* 评论列表 */}
        <div className="space-y-4 mt-6">
          {comments.length === 0 ? (
            <div className="text-center text-zinc-500 p-8 border border-zinc-200 rounded-md">暂无评论，快来发表你的看法吧！</div>
          ) : (
            comments.map((c: any) => { // 确保 c 的类型正确
              const comment_author = users_map[c.user_id]; // 根据 user_id 查找用户
              const is_author = user.id === c.user_id; // 判断是否是评论作者
              const is_reply = c.reply_to_id;
              const replied_to_comment = is_reply ? comments.find(com => com.id === c.reply_to_id) : null;
              const replied_to_author = replied_to_comment ? users_map[replied_to_comment.user_id] : null;

              return (
                <div key={c.id} className="bg-white p-4 border-b border-zinc-200 text-sm flex gap-3">
                  <div className="flex-shrink-0">
                    <Avatar url={comment_author?.avatar} className="w-8 h-8" />
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-center mb-1">
                      <div className="font-bold flex items-center gap-1">
                        <span onClick={() => onViewProfile(c.user_id)} className="hover:underline cursor-pointer">{comment_author?.user_name || c.user_name}</span>
                        {is_reply && replied_to_author && (
                          <span className="text-zinc-500 font-normal">回复
                            <span onClick={() => onViewProfile(replied_to_author.id)} className="hover:underline cursor-pointer ml-1">@{replied_to_author.user_name}</span>
                          </span>
                        )}
                      </div>
                      <div className="text-zinc-400 font-normal text-xs flex items-center gap-2">
                        <span>{timeAgo(c.created_at)}</span>
                        {(is_author || is_admin_or_inver) && (
                          <div className="relative group">
                            <MoreVertical className="w-4 h-4 cursor-pointer text-zinc-500 hover:text-black" />
                            <div className="absolute right-0 top-full mt-1 w-24 bg-white border border-zinc-200 rounded-md shadow-lg hidden group-hover:block z-10">
                              {is_author && c.id === editing_comment_id ? ( // 处于编辑状态
                                <button onClick={() => setEditingCommentId(null)} className="block w-full text-left px-3 py-2 text-red-600 hover:bg-zinc-50">取消编辑</button>
                              ) : is_author && ( // 可以编辑
                                <button onClick={() => start_edit_comment(c)} className="block w-full text-left px-3 py-2 text-blue-600 hover:bg-zinc-50">编辑</button>
                              )}
                              {(is_author || is_admin_or_inver) && ( // 可以删除
                                <button onClick={() => handle_delete_comment(c.id)} className="block w-full text-left px-3 py-2 text-red-600 hover:bg-zinc-50">删除</button>
                              )}
                              <button onClick={() => handle_reply_click(c.id, comment_author?.user_name || c.user_name)} className="block w-full text-left px-3 py-2 text-zinc-700 hover:bg-zinc-50">回复</button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    {c.id === editing_comment_id ? (
                      <div className="space-y-2 mt-2">
                        <textarea className="w-full border p-2 h-20 text-sm" value={edit_comment_content} onChange={e => setEditCommentContent(e.target.value)} />
                        <div className="flex gap-2">
                          <button onClick={() => save_comment_edit(c.id)} className="bg-black text-white px-3 py-1 text-xs">保存</button>
                          <button onClick={() => setEditingCommentId(null)} className="bg-zinc-200 px-3 py-1 text-xs">取消</button>
                        </div>
                      </div>
                    ) : (
                      <p className="whitespace-pre-wrap">{c.content}</p>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* 底部评论输入框 */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-3 shadow-lg">
        <div className="max-w-3xl mx-auto flex gap-2">
          <textarea
            ref={commentInputRef}
            value={new_comment}
            onChange={e => setNewComment(e.target.value)}
            className="flex-1 border rounded p-2 h-12 text-sm focus:outline-none focus:ring-2 focus:ring-black"
            placeholder={reply_to_comment_id ? `回复 @${users_map[comments.find(c => c.id === reply_to_comment_id)?.user_id]?.user_name || '未知用户'}:` : "发表评论..."}
          />
          <button onClick={handle_comment} className="bg-black text-white px-4 rounded-md flex items-center justify-center hover:bg-zinc-800 transition-colors">
            <Send className="w-4 h-4 mr-1" /> 发送
          </button>
        </div>
        {reply_to_comment_id && (
          <div className="max-w-3xl mx-auto text-xs text-zinc-500 mt-1">
            正在回复 @{users_map[comments.find(c => c.id === reply_to_comment_id)?.user_id]?.user_name || '未知用户'}
            <button onClick={() => { setReplyToCommentId(null); setNewComment(''); }} className="ml-2 text-red-500 hover:underline">取消回复</button>
          </div>
        )}
      </div>

      {/* 收藏模态框 (放在最外层 div 内) */}
      {show_collection_modal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-sm">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">收藏到</h3>
              <button onClick={() => setShowCollectionModal(false)} className="text-zinc-500 hover:text-black"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3 mb-4">
              <input
                type="text"
                value={new_collection_name}
                onChange={e => setNewCollectionName(e.target.value)}
                placeholder="创建新收藏夹..."
                className="w-full p-2 border border-zinc-300 rounded"
              />
              <button onClick={handle_create_collection} className="w-full bg-black text-white p-2 rounded">创建并收藏</button>
            </div>
            <div className="max-h-40 overflow-y-auto border-t border-zinc-200 pt-3">
              {user_collections.length === 0 ? (
                <p className="text-zinc-500 text-sm text-center">暂无收藏夹</p>
              ) : (
                user_collections.map(collection => (
                  <div key={collection.id} className="flex justify-between items-center p-2 hover:bg-zinc-50 rounded">
                    <span>{collection.name}</span>
                    <button
                      onClick={async () => {
                        // TODO: 将帖子添加到现有收藏夹的逻辑
                        showToast(`已收藏到 ${collection.name}`, 'success');
                        setShowCollectionModal(false);
                      }}
                      className="bg-blue-600 text-white px-3 py-1 text-xs rounded hover:bg-blue-700"
                    >
                      收藏
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
//登录页面


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
            user_name: '管理员',
            role: 'admin',
            is_first_login: false,
            is_banned: false,
            created_at: new Date().toISOString()
          } as User);
        }
        return;
      } else {
        setError('管理员暗号错误');
        return;
      }
    }

    // 2. 普通用户本地登录逻辑
    const user = get_user(id);
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
  const [selectedpost_id, setSelectedpost_id] = useState<string | null>(null);
  const [targetProfileId, setTargetProfileId] = useState<string | null>(null);
  const [isCreatingPost, setIsCreatingPost] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0); // Force re-render list
  const [unreadCount, setUnreadCount] = useState(0);
  const [usersMap, set_users_map] = useState<Record<string, User>>({});

  const [displayPosts, setDisplayPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Toast State
  const [toast, setToast] = useState<{ msg: string, type: ToastType } | null>(null);

  useEffect(() => {
    const savedUser = sessionStorage.getItem('currentUser');
    if (savedUser) {
      const u = JSON.parse(savedUser);
      const freshUser = get_user(u.id);
      if (freshUser && !freshUser.is_banned) {
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
        // 这里的 get_posts 是你之前修改的异步 Supabase 版本
        const data = await get_posts(currentCategory, onlyEssence ? 'essence' : 'new');
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

  const refresh_data = async () => {
    // 1. 去云端拿名单
    const users_list = await get_all_users();
    
    // 2. 把名单整理成机器人好记的格式（Map）
    const map: Record<string, User> = {};
    users_list.forEach(u => map[u.id] = u);
    
    // 3. 让屏幕更新
    set_users_map(map);
  };

  refresh_data();
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