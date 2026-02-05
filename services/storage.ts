import { supabase } from './supabaseClient';
import { ToastType, User, Post, Category, Collection, Notification, SensitiveWords, BookRating } from '../types';

// ==========================================
// 1. 敏感词处理逻辑
// ==========================================

// 只负责：发布前校验，发现敏感词直接拦截
export const check_sensitive_words = async (text: string): Promise<void> => {
  if (!text) return;

  const { data: words } = await supabase
    .from('sensitive_words')
    .select('word');

  if (!words || words.length === 0) return;

  const hit = words.some(({ word }) =>
    text.toLowerCase().includes(word.toLowerCase())
  );

  if (hit) {
    throw new Error('内容包含违禁词，发布失败');
  }
};

// ==========================================
// 2. 帖子操作 (Post Operations)
// ==========================================

export const create_post = async (post_data: any) => {
  // 提取真实文本内容进行敏感词检查
  let textToCheck = post_data.title || '';
  try {
    const contentBlocks = JSON.parse(post_data.content);
    if (Array.isArray(contentBlocks)) {
      const textContent = contentBlocks
        .filter(block => block.type === 'text')
        .map(block => block.value)
        .join(' ');
      textToCheck += ' ' + textContent;
    } else {
      textToCheck += ' ' + post_data.content;
    }
  } catch {
    textToCheck += ' ' + post_data.content;
  }

  await check_sensitive_words(textToCheck);

  const { data, error } = await supabase
    .from('posts')
    .insert([post_data])
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const update_post = async (postId: string, updates: any) => {
  if (updates.title) await check_sensitive_words(updates.title);
  
  const { data, error } = await supabase
    .from('posts')
    .update(updates)
    .eq('id', postId)
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const delete_post = async (postId: string) => {
  const { error } = await supabase
    .from('posts')
    .delete()
    .eq('id', postId);

  if (error) throw error;
};

/**
 * 切换帖子的加精（蒂贴）状态 - PostDetailPage 调用
 */
export const toggle_essence_post = async (postId: string, isEssence: boolean) => {
  const { error } = await supabase
    .from('posts')
    .update({ is_essence: isEssence })
    .eq('id', postId);

  if (error) throw error;
  return isEssence;
};

export const toggle_like_post = async (postId: string, userId: string, isLiked: boolean) => {
  if (isLiked) {
    const { error } = await supabase
      .from('post_likes')
      .delete()
      .match({ post_id: postId, user_id: userId });
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from('post_likes')
      .insert([{ post_id: postId, user_id: userId }]);
    if (error) throw error;
  }
};

/**
 * 投票功能 - 已修正参数顺序匹配 PostDetailPage 调用
 */
export const vote_poll = async (postId: string, userId: string, optionIndex: number) => {
  const { error } = await supabase
    .from('poll_votes')
    .insert([{ 
      post_id: postId, 
      user_id: userId, 
      option_index: optionIndex 
    }]);

  if (error) throw error;
};

// ==========================================
// 3. 评论操作 (Comment Operations)
// ==========================================

export const add_comment = async (comment_data: any) => {
  await check_sensitive_words(comment_data.content);

  const { data, error } = await supabase
    .from('comments')
    .insert([comment_data])
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const delete_comment = async (commentId: string) => {
  const { error } = await supabase
    .from('comments')
    .delete()
    .eq('id', commentId);

  if (error) throw error;
};

export const toggle_like_comment = async (commentId: string, userId: string, isLiked: boolean) => {
  if (isLiked) {
    await supabase.from('comment_likes').delete().match({ comment_id: commentId, user_id: userId });
  } else {
    await supabase.from('comment_likes').insert([{ comment_id: commentId, user_id: userId }]);
  }
};

// ==========================================
// 4. 合集操作 (Collection Operations)
// ==========================================

export const create_collection = async (userId: string, name: string) => {
  const { data, error } = await supabase
    .from('collections')
    .insert([{ user_id: userId, name }])
    .select()
    .single();

  if (error) throw error;
  return data;
};

/**
 * 添加到合集 - PostDetailPage 调用
 */
export const addToCollection = async (collectionId: string, postId: string) => {
  const { error } = await supabase
    .from('collection_posts')
    .insert([{ collection_id: collectionId, post_id: postId }]);

  if (error) {
    if (error.code === '23505') return; 
    throw error;
  }
};

// ==========================================
// 5. 图书评分 (Book Rating Operations)
// ==========================================

/**
 * 获取所有图书评分列表 - Bookshelf.tsx 调用
 */
export const get_all_book_ratings = async () => {
  const { data, error } = await supabase
    .from('book_ratings')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
};

export const get_book_rating_by_post = async (postId: string) => {
  const { data, error } = await supabase
    .from('book_ratings')
    .select('*')
    .eq('post_id', postId)
    .maybeSingle();

  if (error) throw error;
  return data;
};

export const create_book_rating = async (rating_data: any) => {
  const { data, error } = await supabase
    .from('book_ratings')
    .insert([rating_data])
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const update_book_rating = async (postId: string, updates: any) => {
  const { data, error } = await supabase
    .from('book_ratings')
    .update(updates)
    .eq('post_id', postId)
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const delete_book_rating = async (postId: string) => {
  const { error } = await supabase
    .from('book_ratings')
    .delete()
    .eq('post_id', postId);

  if (error) throw error;
};

// ==========================================
// 6. 管理员及统计功能
// ==========================================

export async function get_all_sensitive_words() {
  const { data, error } = await supabase
    .from('sensitive_words')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function add_sensitive_word(word: string) {
  const { data, error } = await supabase
    .from('sensitive_words')
    .insert([{ word }])
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function delete_sensitive_word(id: string) {
  const { error } = await supabase
    .from('sensitive_words')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

export async function ban_user(userId: string, reason: string, until: string) {
  const { error } = await supabase
    .from('users')
    .update({ 
      is_banned: true,
      ban_reason: reason,
      ban_until: until
    })
    .eq('id', userId);
  if (error) throw error;
}

export async function unban_user(userId: string) {
  const { error } = await supabase
    .from('users')
    .update({ 
      is_banned: false,
      ban_reason: null,
      ban_until: null
    })
    .eq('id', userId);
  if (error) throw error;
}

export async function search_book_ratings(query: string) {
  try {
    const { data, error } = await supabase
      .from('book_ratings')
      .select('*')
      .or(`book_name.ilike.%${query}%,reviewer_name.ilike.%${query}%`)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error: any) {
    console.error('搜索图书评分失败:', error);
    return [];
  }
}

export async function get_book_rating_stats() {
  try {
    const { data, error } = await supabase
      .from('book_ratings')
      .select('final_score');

    if (error) throw error;

    const ratings = data || [];
    const total = ratings.length;
    
    if (total === 0) {
      return { total: 0, averageScore: 0, highScoreCount: 0, mediumScoreCount: 0, lowScoreCount: 0 };
    }

    const sum = ratings.reduce((acc, r) => acc + r.final_score, 0);
    const averageScore = sum / total;
    const highScoreCount = ratings.filter(r => r.final_score >= 8).length;
    const mediumScoreCount = ratings.filter(r => r.final_score >= 5 && r.final_score < 8).length;
    const lowScoreCount = ratings.filter(r => r.final_score < 5).length;

    return { total, averageScore, highScoreCount, mediumScoreCount, lowScoreCount };
  } catch (error) {
    console.error('获取统计失败:', error);
    return { total: 0, averageScore: 0, highScoreCount: 0, mediumScoreCount: 0, lowScoreCount: 0 };
  }
}
