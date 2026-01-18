import { supabase } from './supabaseClient';
import { AppState,User, Post, Category, Collection, Notification, SensitiveWords} from '../types';

// ==============================
// 1. 敏感词处理逻辑
// ==============================
export const filterSensitiveWords = async (text: string): Promise<string> => {
  const { data: words } = await supabase.from('sensitive_words').select('word');
  if (!words || words.length === 0) return text;
  
  let filteredText = text;
  words.forEach(({ word }) => {
    const regex = new RegExp(word, 'gi');
    filteredText = filteredText.replace(regex, '***');
  });
  return filteredText;
};

// ==============================
// 2. 帖子操作 (Post Operations)
// ==============================

export const createPost = async (postData: any) => {
  // 1. 敏感词预检
  const { data: bannedWords } = await supabase.from('sensitive_words').select('word');
  const checkText = (postData.title || '') + (postData.content || '');
  const hasBanned = bannedWords?.some(b => checkText.includes(b.word));
  if (hasBanned) throw new Error("内容包含违禁词，发布失败");

  // 2. 插入数据库 (严格对应你 SQL 中的字段名)
  const { data, error } = await supabase
    .from('posts')
    .insert([{
      title: postData.title,
      content: postData.content,
      category: postData.category,
      author_id: postData.author_id,      // 对应 SQL 的 author_id
      author_name: postData.author_name,   // 对应 SQL 的 author_name
      images: postData.images || [],
      poll: postData.poll || null,
      likes: [],                     // 初始化空数组
      view_count: 0 ,                 // 初始化浏览量
      is_essence: false,              // 图片里叫 is_essence
      is_locked: false,           // 图片里叫 is_locked
    }])
    .select()
    .single();

  if (error) {
    console.error('Supabase 插入失败详情:', error);
    throw new Error(error.message);
  }
  return data;
};

// 获取帖子列表
export const getPosts = async (category: Category | '全部', sort: 'new' | 'essence') => {
  let query = supabase.from('posts').select('*');

  if (category !== '全部') {
    query = query.eq('category', category);
  }
  if (sort === 'essence') {
    query = query.eq('is_essence', true);
  }

  query = query.order('created_at', { ascending: false });

  const { data, error } = await query;
  if (error) throw error;
  return data;
};

// 点赞/取消点赞
export const toggleLikePost = async (postId: string, userId: string, currentLikes: string[] = []) => {
  const safeLikes = Array.isArray(currentLikes) ? currentLikes : [];
  const isLiked = safeLikes.includes(userId);
  const newLikes = isLiked 
    ? safeLikes.filter(id => id !== userId) 
    : [...safeLikes, userId];

  const { error } = await supabase
    .from('posts')
    .update({ likes: newLikes })
    .eq('id', postId);

  if (error) throw error;
  return newLikes;
};

// ==============================
// 3. 评论与通知
// ==============================

export const addComment = async (comment: any, postUserId: string, postTitle: string) => {
  const filteredContent = await filterSensitiveWords(comment.content);

  const { data: newComment, error: cError } = await supabase
    .from('comments')
    .insert([{
      post_id: comment.postId,
      user_id: comment.userId,
      username: comment.username,
      content: filteredContent,
      reply_to_id: comment.replyToId || null
    }])
    .select()
    .single();

  if (cError) throw cError;

  if (postUserId !== comment.userId) {
    await supabase.from('notifications').insert([{
      user_id: postUserId,
      type: comment.replyToId ? 'reply' : 'comment',
      from_user_id: comment.userId,
      from_username: comment.username,
      post_id: comment.postId,
      post_title: postTitle,
      content: filteredContent
    }]);
  }

  return newComment;
};

// ==============================
// 4. 收藏逻辑 (Collections)
// ==============================
export const toggleCollection = async (userId: string, postId: string) => {
  const { data: existing } = await supabase
    .from('collections')
    .select('*')
    .eq('user_id', userId)
    .eq('post_id', postId)
    .maybeSingle();

  if (existing) {
    await supabase.from('collections').delete().eq('id', existing.id);
    return false; // 代表取消收藏
  } else {
    await supabase.from('collections').insert([{ user_id: userId, post_id: postId }]);
    return true; // 代表收藏成功
  }
};