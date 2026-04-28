import { supabase } from './supabaseClient';
import { ToastType, User, Post, Category, Collection, Notification, SensitiveWords, BookRating, Character, ReaderReview } from '../types';

/**
 * 修改后的敏感词处理逻辑
 * 如果发现敏感词，抛出包含具体词汇的错误
 */
export const check_sensitive_words = async (text: string): Promise<void> => {
  if (!text) return;

  const { data: words } = await supabase
    .from('sensitive_words')
    .select('word');

  if (!words || words.length === 0) return;

  const hitWord = words.find(({ word }) =>
    text.toLowerCase().includes(word.toLowerCase())
  );

  if (hitWord) {
    throw new Error(`内容包含违禁词 "${hitWord.word}"，发布失败`);
  }
};


// 帖子操作 (Post Operations)

export const create_post = async (post_data: any) => {
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
    textToCheck += ' ' + (post_data.content || '');
  }

  await check_sensitive_words(textToCheck);

  const { data, error } = await supabase
    .from('posts')
    .insert([{
      title: post_data.title,
      content: post_data.content,
      category: post_data.category,
      user_id: post_data.user_id,
      user_name: post_data.user_name,
      images: post_data.images || [],
      poll: post_data.poll || null,
      likes: [],
      view_count: 0,
      is_essence: false,
      is_locked: false,
    }])
    .select()
    .single();

  if (error) {
    console.error('Supabase 插入失败详情:', error);
    throw new Error(error.message);
  }

  return data;
};

export const get_posts = async (category: Category | '全部', sort: 'new' | 'essence') => {
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

export const toggle_like_post = async (post_id: string, user_id: string) => {
  console.log('==========================================');
  console.log('🔵 toggle_like_post 开始');
  console.log('参数:', { post_id, user_id });
  console.log('参数类型:', { 
    post_id_type: typeof post_id, 
    user_id_type: typeof user_id 
  });
  
  try {
    console.log('📥 第1步: 获取帖子数据...');
    const { data: currentPost, error: fetchError } = await supabase
      .from('posts')
      .select('likes')
      .eq('id', post_id)
      .single();

    console.log('📥 获取结果:', { 
      success: !fetchError,
      currentPost, 
      fetchError 
    });

    if (fetchError) {
      console.error('❌ 获取失败:', fetchError);
      throw new Error(`无法获取帖子数据: ${fetchError.message}`);
    }
    
    if (!currentPost) {
      console.error('❌ 帖子不存在');
      throw new Error("帖子不存在");
    }

    const safe_likes = Array.isArray(currentPost.likes) ? currentPost.likes : [];
    const is_liked = safe_likes.includes(user_id);
    
    const new_likes = is_liked
      ? safe_likes.filter(id => id !== user_id) 
      : [...safe_likes, user_id];

    const updatePayload = { likes: new_likes };
    
    const { data: updateData, error: updateError } = await supabase
      .from('posts')
      .update(updatePayload)
      .eq('id', post_id)
      .select();

    if (updateError) {
      console.error('❌ 更新失败 - 完整错误对象:', updateError);
      throw updateError;
    }

    console.log('✅ 点赞操作成功!');
    console.log('==========================================');
    return new_likes;
    
  } catch (error: any) {
    console.error('❌❌❌ toggle_like_post 发生异常 ❌❌❌');
    console.error('异常对象:', error);
    console.error('==========================================');
    throw error;
  }
};

// 收藏逻辑 (Collections)

export const toggle_collection = async (collection_id: string, post_id: string) => {
  const { data: existing } = await supabase
    .from('collection_posts')
    .select('*')
    .eq('collection_id', collection_id)
    .eq('post_id', post_id)
    .maybeSingle();

  if (existing) {
    await supabase
      .from('collection_posts')
      .delete()
      .eq('id', existing.id);
    return false;
  } else {
    await supabase
      .from('collection_posts')
      .insert([{ 
        collection_id: collection_id, 
        post_id: post_id 
      }]);
    return true;
  }
};

export const get_all_users = async () => {
  const { data, error } = await supabase.from('users').select('*');
  if (error) throw error;
  return data;
};

export const get_user = async (id: string) => {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.error('获取用户信息失败:', error.message);
    throw error;
  }

  return data;
};

// 投票功能
export const vote_poll = async (post_id: string, opt_id: string, user_id: string) => {
  const { data: post } = await supabase.from('posts').select('poll').eq('id', post_id).single();
  if (!post || !post.poll) return;

  const new_poll = { ...post.poll };

  const hasVoted = new_poll.options.some((opt: any) => 
    opt.votes && opt.votes.includes(user_id)
  );

  if (hasVoted) {
    throw new Error('您已经参与过投票,结果不可更改');
  }

  new_poll.options = new_poll.options.map((opt: any) => {
    if (opt.id === opt_id) {
      return { 
        ...opt, 
        votes: [...(opt.votes || []), user_id] 
      };
    }
    return opt;
  });

  const { error } = await supabase.from('posts').update({ poll: new_poll }).eq('id', post_id);
  if (error) throw error;
};

// 评论功能
export async function add_comment(
  commentData: {
    post_id: string;
    user_id: string;
    user_name: string;
    content: string;
    reply_to_id: string | null;
    images?: string[] | null;
    likes?: string[];
  },
  post_user_id: string,
  post_title: string
) {
  await check_sensitive_words(commentData.content);
  
  const { data, error } = await supabase
    .from('comments')
    .insert([{
      post_id: commentData.post_id,
      user_id: commentData.user_id,
      user_name: commentData.user_name,
      content: commentData.content,
      reply_to_id: commentData.reply_to_id,
      images: commentData.images || [],
      likes: commentData.likes || [],
      created_at: new Date().toISOString(),
    }])
    .select()
    .single();
  if (error) throw error;
  
  const { error: updateError } = await supabase
    .from('posts')
    .update({ last_comment_at: new Date().toISOString() })
    .eq('id', commentData.post_id);
  
  if (updateError) {
    console.error('更新帖子最后评论时间失败:', updateError);
  }
  
  return data;
}

export async function update_comment(
  commentId: string, 
  content: string, 
  images?: string[]
) {
  await check_sensitive_words(content);
  const updateData: any = {
    content,
    updated_at: new Date().toISOString(),
  };
  if (images !== undefined) {
    updateData.images = images;
  }
  const { error } = await supabase
    .from('comments')
    .update(updateData)
    .eq('id', commentId);
  if (error) throw error;
}

export async function toggle_like_comment(commentId: string, userId: string) {
  const { data: comment, error: fetchError } = await supabase
    .from('comments')
    .select('likes')
    .eq('id', commentId)
    .single();

  if (fetchError || !comment) throw fetchError;

  const currentLikes = comment.likes || [];
  const hasLiked = currentLikes.includes(userId);
  const newLikes = hasLiked
    ? currentLikes.filter((id: string) => id !== userId)
    : [...currentLikes, userId];

  const { error: updateError } = await supabase
    .from('comments')
    .update({ likes: newLikes })
    .eq('id', commentId);

  if (updateError) throw updateError;

  return newLikes;
}

export const get_posts_by_user = async (userId: string) => {
  const { data, error } = await supabase
    .from('posts')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
};

export const get_comments_by_post = async (postId: string) => {
  const { data, error } = await supabase
    .from('comments')
    .select('*')
    .eq('post_id', postId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data || [];
};

export const get_post_by_id = async (postId: string) => {
  const { data, error } = await supabase
    .from('posts')
    .select('*')
    .eq('id', postId)
    .single();

  if (error) throw error;
  return data;
};

export const update_post = async (postId: string, updates: any) => {
  await check_sensitive_words(updates.title || '');
  
  const { error } = await supabase
    .from('posts')
    .update({
      ...updates,
      updated_at: new Date().toISOString()
    })
    .eq('id', postId);

  if (error) throw error;
};

export const delete_post = async (postId: string) => {
  const { error } = await supabase
    .from('posts')
    .delete()
    .eq('id', postId);

  if (error) throw error;
};

export const getUnreadNotificationCount = async (userId: string): Promise<number> => {
  try {
    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_read', false);

    if (error) throw error;
    return count || 0;
  } catch (err) {
    console.error('获取未读消息数量失败:', err);
    return 0;
  }
};

export const markAllNotificationsAsRead = async (userId: string): Promise<void> => {
  try {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('is_read', false);

    if (error) throw error;
  } catch (err) {
    console.error('批量标记已读失败:', err);
    throw err;
  }
};

export const create_collection = async (userId: string, name: string) => {
  const { data, error } = await supabase
    .from('collections')
    .insert([{
      user_id: userId,
      name: name,
    }])
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const get_collections = async (userId: string) => {
  const { data, error } = await supabase
    .from('collections')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
};

export const delete_collection = async (collectionId: string) => {
  const { error } = await supabase
    .from('collections')
    .delete()
    .eq('id', collectionId);

  if (error) throw error;
};

export const rename_collection = async (collectionId: string, newName: string) => {
  const { error } = await supabase
    .from('collections')
    .update({ name: newName })
    .eq('id', collectionId);

  if (error) throw error;
};

export const get_collected_posts = async (collectionId: string) => {
  const { data, error } = await supabase
    .from('collection_posts')
    .select(`
      post_id,
      posts (*)
    `)
    .eq('collection_id', collectionId);

  if (error) throw error;
  return data?.map(item => item.posts).filter(Boolean) || [];
};

export const updateUser = async (userId: string, updates: Partial<User>) => {
  const { error } = await supabase
    .from('users')
    .update(updates)
    .eq('id', userId);

  if (error) throw error;
};

export const toggle_ban_user = async (userId: string, currentStatus: boolean) => {
  const { error } = await supabase
    .from('users')
    .update({ is_banned: !currentStatus })
    .eq('id', userId);

  if (error) throw error;
  return !currentStatus;
};

export const set_banned_words = async (words: string[]) => {
  await supabase.from('sensitive_words').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  
  const insertData = words.map(w => ({ word: w }));
  const { error } = await supabase.from('sensitive_words').insert(insertData);
  
  if (error) throw error;
};

export const get_banned_words = async () => {
  const { data, error } = await supabase.from('sensitive_words').select('word');
  if (error) throw error;
  return data.map(item => item.word);
};

export async function createUser(role: 'user' | 'admin' | 'i女er' = 'user') {
  const { data: sessionData } = await supabase.auth.getSession()

  const res = await fetch('/api/admin/create-user', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${sessionData.session?.access_token}`,
    },
    body: JSON.stringify({ role }),
  })

  if (!res.ok) {
    throw new Error(await res.text())
  }

  return res.json()
}

export async function markNotificationAsRead(notificationId: string) {
  try {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notificationId);

    if (error) throw error;
  } catch (error: any) {
    console.error('标记通知已读失败:', error.message);
  }
}

// ─────────────────────────────────────────
// 图书评分功能
// ─────────────────────────────────────────

export async function create_book_rating(ratingData: {
  post_id: string;
  user_id: string;
  user_name: string;
  book_name: string;
  book_author: string;
  book_platform: string;
  book_category: string;
  impressed_score: number;
  principle_scores: { [key: string]: 'yes' | 'no' | null };
  principle_remarks: { [key: string]: string };
  extra_deduction: number;
  extra_remark: string;
  final_score: number;
  reviewer_comment: string;
  reviewer_name: string;
  serial_status?: 'finished' | 'ongoing' | 'hiatus';
  recommendation_tag?: 'recommend' | 'warn';
  book_intro?: string;
  book_link?: string;
  book_characters?: Character[];
}): Promise<BookRating> {
  try {
    const { data, error } = await supabase
      .from('book_ratings')
      .insert([{
        post_id: ratingData.post_id,
        user_id: ratingData.user_id,
        user_name: ratingData.user_name,
        book_name: ratingData.book_name,
        book_author: ratingData.book_author,
        book_platform: ratingData.book_platform,
        book_category: ratingData.book_category,
        impressed_score: ratingData.impressed_score,
        principle_scores: ratingData.principle_scores,
        principle_remarks: ratingData.principle_remarks,
        extra_deduction: ratingData.extra_deduction,
        extra_remark: ratingData.extra_remark,
        final_score: ratingData.final_score,
        reviewer_comment: ratingData.reviewer_comment,
        reviewer_name: ratingData.reviewer_name,
        serial_status: ratingData.serial_status ?? null,
        recommendation_tag: ratingData.recommendation_tag ?? null,
        book_intro: ratingData.book_intro ?? null,
        book_link: ratingData.book_link ?? null,
        book_characters: ratingData.book_characters ?? [],
        reader_reviews: [],
        created_at: new Date().toISOString(),
      }])
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error: any) {
    console.error('创建图书评分失败:', error);
    throw new Error(`创建图书评分失败: ${error.message}`);
  }
}

export async function update_book_rating(
  ratingId: string,
  updates: Partial<BookRating>
): Promise<BookRating> {
  try {
    // 先执行 update，不用 .single() 避免 RLS 导致 PGRST116
    const { error } = await supabase
      .from('book_ratings')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', ratingId);

    if (error) throw error;

    // 更新成功后单独读取最新数据
    const { data, error: fetchError } = await supabase
      .from('book_ratings')
      .select('*')
      .eq('id', ratingId)
      .single();

    if (fetchError) throw fetchError;
    return data;
  } catch (error: any) {
    console.error('更新图书评分失败:', error);
    throw new Error(`更新图书评分失败: ${error.message}`);
  }
}

export async function delete_book_rating(ratingId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('book_ratings')
      .delete()
      .eq('id', ratingId);

    if (error) throw error;
  } catch (error: any) {
    console.error('删除图书评分失败:', error);
    throw new Error(`删除图书评分失败: ${error.message}`);
  }
}

export async function get_book_rating_by_post(postId: string): Promise<BookRating | null> {
  try {
    const { data, error } = await supabase
      .from('book_ratings')
      .select('*')
      .eq('post_id', postId)
      .maybeSingle();

    if (error) throw error;
    return data;
  } catch (error: any) {
    console.error('获取图书评分失败:', error);
    return null;
  }
}

export async function get_all_book_ratings(options?: {
  sortBy?: 'latest' | 'highest' | 'lowest';
  limit?: number;
}): Promise<BookRating[]> {
  try {
    let query = supabase
      .from('book_ratings')
      .select('*');

    if (options?.sortBy === 'highest') {
      query = query.order('final_score', { ascending: false });
    } else if (options?.sortBy === 'lowest') {
      query = query.order('final_score', { ascending: true });
    } else {
      query = query.order('created_at', { ascending: false });
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  } catch (error: any) {
    console.error('获取图书评分列表失败:', error);
    return [];
  }
}

export async function get_book_ratings_by_user(userId: string): Promise<BookRating[]> {
  try {
    const { data, error } = await supabase
      .from('book_ratings')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error: any) {
    console.error('获取用户图书评分失败:', error);
    return [];
  }
}

export async function search_book_ratings(query: string): Promise<BookRating[]> {
  try {
    const { data, error } = await supabase
      .from('book_ratings')
      .select('*')
      .or(`book_name.ilike.%${query}%,book_author.ilike.%${query}%`)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error: any) {
    console.error('搜索图书评分失败:', error);
    return [];
  }
}

export async function get_book_rating_stats(): Promise<{
  total: number;
  averageScore: number;
  highScoreCount: number;
  mediumScoreCount: number;
  lowScoreCount: number;
}> {
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

    return {
      total,
      averageScore: Number(averageScore.toFixed(2)),
      highScoreCount,
      mediumScoreCount,
      lowScoreCount,
    };
  } catch (error: any) {
    console.error('获取图书评分统计失败:', error);
    return { total: 0, averageScore: 0, highScoreCount: 0, mediumScoreCount: 0, lowScoreCount: 0 };
  }
}

export const toggle_essence_post = async (postId: string, isEssence: boolean) => {
  const { error } = await supabase
    .from('posts')
    .update({ is_essence: isEssence })
    .eq('id', postId);

  if (error) throw error;
  return isEssence;
};

export const addToCollection = async (collectionId: string, postId: string) => {
  const { data: existing } = await supabase
    .from('collection_posts')
    .select('id')
    .eq('collection_id', collectionId)
    .eq('post_id', postId)
    .maybeSingle();

  if (existing) return true;

  const { error } = await supabase
    .from('collection_posts')
    .insert([{ 
      collection_id: collectionId, 
      post_id: postId 
    }]);

  if (error) throw error;
  return true;
};

// ─────────────────────────────────────────
// 书架新功能：图片上传、详情更新、读者书评点赞
// ─────────────────────────────────────────

export async function upload_book_cover(
  bookRatingId: string,
  file: File
): Promise<string> {
  const fileExt = file.name.split('.').pop();
  const filePath = `${bookRatingId}/cover.${fileExt}`;

  const { error: uploadError } = await supabase.storage
    .from('book-covers')
    .upload(filePath, file, { upsert: true });

  if (uploadError) throw new Error(`封面上传失败: ${uploadError.message}`);

  const { data } = supabase.storage
    .from('book-covers')
    .getPublicUrl(filePath);

  await update_book_rating(bookRatingId, { cover_url: data.publicUrl });

  return data.publicUrl;
}

export async function upload_character_illustration(
  bookRatingId: string,
  charIndex: number,
  file: File,
  currentCharacters: Character[]
): Promise<Character[]> {
  const fileExt = file.name.split('.').pop();
  const filePath = `${bookRatingId}/char_${charIndex}.${fileExt}`;

  const { error: uploadError } = await supabase.storage
    .from('character-images')
    .upload(filePath, file, { upsert: true });

  if (uploadError) throw new Error(`插图上传失败: ${uploadError.message}`);

  const { data } = supabase.storage
    .from('character-images')
    .getPublicUrl(filePath);

  const updatedChars = currentCharacters.map((char, idx) =>
    idx === charIndex
      ? { ...char, illustration_url: data.publicUrl }
      : char
  );

  await update_book_rating(bookRatingId, { book_characters: updatedChars });

  return updatedChars;
}

export async function update_book_intro(
  bookRatingId: string,
  intro: string
): Promise<void> {
  await update_book_rating(bookRatingId, { book_intro: intro });
}

export async function update_book_link(
  bookRatingId: string,
  link: string
): Promise<void> {
  await update_book_rating(bookRatingId, { book_link: link });
}

export async function submit_reader_review(
  bookRatingId: string,
  currentReviews: ReaderReview[],
  newReview: {
    user_id: string;
    user_name: string;
    impression_score: number;
    review_text: string;
  }
): Promise<{ updatedReviews: ReaderReview[]; newImpressedScore: number; newFinalScore: number }> {
  // 1. 更新书评列表
  const existingIndex = currentReviews.findIndex(
    r => r.user_id === newReview.user_id
  );

  let updatedReviews: ReaderReview[];

  if (existingIndex >= 0) {
    updatedReviews = currentReviews.map((r, i) =>
      i === existingIndex
        ? {
            ...r,
            impression_score: newReview.impression_score,
            review_text: newReview.review_text,
          }
        : r
    );
  } else {
    const review: ReaderReview = {
      user_id: newReview.user_id,
      user_name: newReview.user_name,
      impression_score: newReview.impression_score,
      review_text: newReview.review_text,
      likes: 0,
      liked_by: [],
      created_at: new Date().toISOString(),
    };
    updatedReviews = [...currentReviews, review];
  }

  // 2. 读取当前书籍数据（需要 principles_deduction 和 extra_deduction 来重算）
  const { data: bookData, error: fetchError } = await supabase
    .from('book_ratings')
    .select('principle_scores, extra_deduction')
    .eq('id', bookRatingId)
    .single();

  if (fetchError) throw fetchError;

  // 3. 计算新的印象均分（所有读者印象分的平均值）
  const totalScore = updatedReviews.reduce((sum, r) => sum + r.impression_score, 0);
  const newImpressedScore = Math.round((totalScore / updatedReviews.length) * 10) / 10;

  // 4. 重新计算准则扣分，与 BookRatingModal.calculateFinalScore 逻辑完全一致：
  //    p1-p22：选 'yes'（有）扣1分；p23-p25（reverseScore）：选 'no'（没有）扣1分
  const REVERSE_SCORE_IDS = ['p23', 'p24', 'p25'];
  const principleScores: Record<string, 'yes' | 'no' | null> = bookData?.principle_scores || {};
  const principleDeduction = Object.entries(principleScores).reduce((sum, [id, answer]) => {
    if (REVERSE_SCORE_IDS.includes(id)) {
      return sum + (answer === 'no' ? 1 : 0);
    } else {
      return sum + (answer === 'yes' ? 1 : 0);
    }
  }, 0);

  const extraDeduction = bookData?.extra_deduction ?? 0;
  const newFinalScore = Math.round((newImpressedScore - principleDeduction - extraDeduction) * 10) / 10;

  // 5. 一次性写入书评列表 + 更新后的分数
  await update_book_rating(bookRatingId, {
    reader_reviews: updatedReviews,
    impressed_score: newImpressedScore,
    final_score: newFinalScore,
  });

  return { updatedReviews, newImpressedScore, newFinalScore };
}

export async function toggle_review_like(
  bookRatingId: string,
  currentReviews: ReaderReview[],
  reviewIndex: number,
  userId: string
): Promise<ReaderReview[]> {
  const review = currentReviews[reviewIndex];
  const alreadyLiked = review.liked_by.includes(userId);

  const updatedReviews = currentReviews.map((r, i) => {
    if (i !== reviewIndex) return r;
    return {
      ...r,
      likes: alreadyLiked ? r.likes - 1 : r.likes + 1,
      liked_by: alreadyLiked
        ? r.liked_by.filter(id => id !== userId)
        : [...r.liked_by, userId],
    };
  });

  await update_book_rating(bookRatingId, { reader_reviews: updatedReviews });
  return updatedReviews;
}
