import { supabase } from './supabaseClient';
import { User, Post, Comment, Category, Notification, Collection } from '../types';

// ==============================
// 1. 敏感词处理逻辑
// ==============================
// 建议从数据库获取，这里保留一个基础过滤函数
export const filterSensitiveWords = async (text: string): Promise<string> => {
  const { data: words } = await supabase.from('sensitive_words').select('word');
  if (!words) return text;
  
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

// 创建帖子
export const createPost = async (postData: Partial<Post>) => {
  // 1. 敏感词预检
  const { data: bannedWords } = await supabase.from('sensitive_words').select('word');
  const hasBanned = bannedWords?.some(b => postData.title?.includes(b.word) || postData.content?.includes(b.word));
  if (hasBanned) throw new Error("内容包含违禁词，发布失败");

  // 2. 插入数据库
  const { data, error } = await supabase
    .from('posts')
    .insert([{
      title: postData.title,
      content: postData.content,
      category: postData.category,
      user_id: postData.userId,     // 对应 SQL 中的 user_id
      username: postData.username,  // 对应 SQL 中的 username
      images: postData.images || [],
      poll: postData.poll || null
    }])
    .select()
    .single();

  if (error) throw error;
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

  // 默认按时间倒序
  query = query.order('created_at', { ascending: false });

  const { data, error } = await query;
  if (error) throw error;
  return data;
};

// 点赞/取消点赞
export const toggleLikePost = async (postId: string, userId: string, currentLikes: string[]) => {
  const isLiked = currentLikes.includes(userId);
  const newLikes = isLiked 
    ? currentLikes.filter(id => id !== userId) 
    : [...currentLikes, userId];

  const { error } = await supabase
    .from('posts')
    .update({ likes: newLikes })
    .eq('id', postId);

  if (error) throw error;
};

// ==============================
// 3. 评论与通知 (Comments & Notifications)
// ==============================

export const addComment = async (comment: Comment, postUserId: string, postTitle: string) => {
  // 1. 敏感词过滤
  const filteredContent = await filterSensitiveWords(comment.content);

  // 2. 插入评论
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

  // 3. 自动创建通知 (发给贴主，除非是贴主自己评论)
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

export const getComments = async (postId: string) => {
  const { data, error } = await supabase
    .from('comments')
    .select('*')
    .eq('post_id', postId)
    .order('created_at', { ascending: true });
    
  if (error) throw error;
  return data;
};

// ==============================
// 4. 通知操作 (Notification Operations)
// ==============================

export const markNotificationsRead = async (userId: string) => {
  await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', userId)
    .eq('is_read', false);
};

// ==============================
// 5. 收藏逻辑 (Collections)
// ==============================
// 这里采用你新建立的独立 collections 表
export const toggleCollection = async (userId: string, postId: string) => {
  // 先检查是否已收藏
  const { data } = await supabase
    .from('collections')
    .select('*')
    .eq('user_id', userId)
    .eq('post_id', postId)
    .single();

  if (data) {
    // 取消收藏
    await supabase.from('collections').delete().eq('id', data.id);
  } else {
    // 添加收藏
    await supabase.from('collections').insert([{ user_id: userId, post_id: postId }]);
  }
};