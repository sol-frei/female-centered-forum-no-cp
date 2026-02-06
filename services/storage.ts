import { supabase } from './supabaseClient';
import { ToastType,User, Post, Category, Collection, Notification, SensitiveWords,BookRating } from '../types';


// 敏感词处理逻辑

// 只负责:发布前校验,发现敏感词直接拦截
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
    throw new Error('内容包含违禁词,发布失败');
  }
};


// 帖子操作 (Post Operations)


export const create_post = async (post_data: any) => {

  // ✅ 1️⃣ 提取真实文本内容进行敏感词检查(修复:正确处理JSON格式)
  let textToCheck = post_data.title || '';
  
  try {
    // 尝试解析content为JSON
    const contentBlocks = JSON.parse(post_data.content);
    if (Array.isArray(contentBlocks)) {
      // 只提取文本块的内容
      const textContent = contentBlocks
        .filter(block => block.type === 'text')
        .map(block => block.value)
        .join(' ');
      textToCheck += ' ' + textContent;
    } else {
      // 如果不是数组,当作普通文本处理
      textToCheck += ' ' + post_data.content;
    }
  } catch {
    // 解析失败,当作普通文本处理(兼容旧数据)
    textToCheck += ' ' + (post_data.content || '');
  }

  await check_sensitive_words(textToCheck);

  // ✅ 2️⃣ 真正插入数据库
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



// 获取帖子列表

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
    // 1. 获取当前点赞状态
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

    console.log('✅ 帖子数据:', currentPost);
    console.log('likes原始值:', currentPost.likes);
    console.log('likes类型:', typeof currentPost.likes);
    console.log('likes是数组吗?', Array.isArray(currentPost.likes));

    const safe_likes = Array.isArray(currentPost.likes) ? currentPost.likes : [];
    const is_liked = safe_likes.includes(user_id);
    
    console.log('当前点赞状态:', {
      safe_likes,
      safe_likes_type: typeof safe_likes,
      is_liked,
      likes_count: safe_likes.length
    });
    
    // 2. 计算新的点赞数组
    const new_likes = is_liked
      ? safe_likes.filter(id => id !== user_id) 
      : [...safe_likes, user_id];

    console.log('📝 第2步: 计算新的点赞数组');
    console.log('新点赞数组:', new_likes);
    console.log('新点赞数组类型:', typeof new_likes);
    console.log('新点赞数组是数组吗?', Array.isArray(new_likes));
    console.log('新点赞数组内容:', JSON.stringify(new_likes));

    // 3. 执行更新
    console.log('📤 第3步: 准备更新数据库...');
    console.log('更新内容:', { likes: new_likes });
    console.log('更新内容JSON:', JSON.stringify({ likes: new_likes }));
    
    const updatePayload = { likes: new_likes };
    console.log('updatePayload:', updatePayload);
    console.log('updatePayload.likes类型:', typeof updatePayload.likes);
    
    const { data: updateData, error: updateError } = await supabase
      .from('posts')
      .update(updatePayload)
      .eq('id', post_id)
      .select();

    console.log('📤 更新完成');
    console.log('更新结果:', { 
      success: !updateError,
      updateData, 
      updateError 
    });

    if (updateError) {
      console.error('❌ 更新失败 - 完整错误对象:', updateError);
      console.error('错误消息:', updateError.message);
      console.error('错误代码:', updateError.code);
      console.error('错误详情:', updateError.details);
      console.error('错误提示:', updateError.hint);
      throw updateError;
    }

    console.log('✅ 点赞操作成功!');
    console.log('==========================================');
    return new_likes;
    
  } catch (error: any) {
    console.error('❌❌❌ toggle_like_post 发生异常 ❌❌❌');
    console.error('异常对象:', error);
    console.error('异常消息:', error?.message);
    console.error('异常堆栈:', error?.stack);
    console.error('==========================================');
    throw error;
  }
};

// 收藏逻辑 (Collections)

export const toggle_collection = async (collection_id: string, post_id: string) => {
  // 1. 在关联表中查找是否存在该收藏记录
  const { data: existing } = await supabase
    .from('collection_posts') // 改为查询关联表
    .select('*')
    .eq('collection_id', collection_id)
    .eq('post_id', post_id)
    .maybeSingle();

  if (existing) {
    // 2. 如果已存在,则删除记录(取消收藏)
    await supabase
      .from('collection_posts')
      .delete()
      .eq('id', existing.id);
    return false;
  } else {
    // 3. 如果不存在,则插入记录(收藏成功)
    // 注意:这里只写 collection_id 和 post_id
    await supabase
      .from('collection_posts')
      .insert([{ 
        collection_id: collection_id, 
        post_id: post_id 
      }]);
    return true;
  }
};

// 专门负责去云端把所有人的名单取回来
export const get_all_users = async () => {
  const { data, error } = await supabase.from('users').select('*');
  if (error) throw error;
  return data;
};


//根据 ID 从云端获取单个用户信息

export const get_user = async (id: string) => {
  // 1. 去 users 表里查找
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', id)
    .maybeSingle(); // 意思是:如果找到了就给一个对象,没找到就给 null

  if (error) {
    console.error('获取用户信息失败:', error.message);
    throw error;
  }

  return data; // 返回查到的用户对象
};

// --- 帖子交互功能 ---

// 投票功能
export const vote_poll = async (post_id: string, opt_id: string, user_id: string) => {
  // 1. 获取最新的投票数据
  const { data: post } = await supabase.from('posts').select('poll').eq('id', post_id).single();
  if (!post || !post.poll) return;

  const new_poll = { ...post.poll };

  // 2. 🔴 关键修改:检查用户是否已经在任何选项中投过票
  const hasVoted = new_poll.options.some((opt: any) => 
    opt.votes && opt.votes.includes(user_id)
  );

  if (hasVoted) {
    // 如果已经投过票,直接抛出错误,阻止后续更新
    throw new Error('您已经参与过投票,结果不可更改');
  }

  // 3. 🟢 更新逻辑:只负责把用户 ID 加到选中的选项里
  new_poll.options = new_poll.options.map((opt: any) => {
    if (opt.id === opt_id) {
      return { 
        ...opt, 
        // 使用解构赋值确保原有的 votes 数组被保留,并加入新用户
        votes: [...(opt.votes || []), user_id] 
      };
    }
    return opt;
  });

  // 4. 更新数据库
  const { error } = await supabase.from('posts').update({ poll: new_poll }).eq('id', post_id);
  if (error) throw error;
};

//评论功能
/**
 * 添加评论(精简版:通知由数据库触发器处理)
 */
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
  post_user_id: string, // 触发器会自动处理,这个参数后续可以不用传了
  post_title: string    // 同上,这个也可以不用传了
) {
  // 1. 发布前敏感词拦截
  await check_sensitive_words(commentData.content);
  
  // 2. 插入评论本身
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
  
  // 3. ✅ 更新帖子的最后评论时间(用于顶帖排序)
  const { error: updateError } = await supabase
    .from('posts')
    .update({ last_comment_at: new Date().toISOString() })
    .eq('id', commentData.post_id);
  
  if (updateError) {
    console.error('更新帖子最后评论时间失败:', updateError);
    // 不抛出错误,因为评论已经成功添加
  }
  
  // 🎉 注意:这里删除了原来几十行关于 notifications 的判断和插入逻辑
  // 数据库触发器检测到 comments 表有新行时,会自动完成通知任务
  return data;
}

/**
 * 更新评论(替换原有的 update_comment 函数)
 * 新增功能:支持更新图片
 */
export async function update_comment(
  commentId: string, 
  content: string, 
  images?: string[]  // 新增:可选的图片数组
) {
  // ✅ ① 编辑前敏感词拦截(只拦截发布)
  await check_sensitive_words(content);
  const updateData: any = {
    content,
    updated_at: new Date().toISOString(),
  };
  // 如果传入了 images 参数,则更新图片
  if (images !== undefined) {
    updateData.images = images;
  }
  const { error } = await supabase
    .from('comments')
    .update(updateData)
    .eq('id', commentId);
  if (error) throw error;
}



/**
 * 切换评论点赞状态
 * ✅ 已修复：删除前端手动插入通知逻辑
 */
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

/**
 * 🟢 新增:获取用户的未读消息数量
 */
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

/**
 * 🟢 新增:批量标记用户所有消息为已读
 */
export const markAllNotificationsAsRead = async (userId: string): Promise<void> => {
  try {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('is_read', false); // 只更新未读的

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
      post_ids: []
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

/**
 * 切换用户封禁状态
 */
export const toggle_ban_user = async (userId: string, currentStatus: boolean) => {
  const { error } = await supabase
    .from('users')
    .update({ is_banned: !currentStatus })
    .eq('id', userId);

  if (error) throw error;
  return !currentStatus;
};

/**
 * 批量保存敏感词
 */
export const set_banned_words = async (words: string[]) => {
  // 先删除旧的,再插入新的(这是一种简单替换逻辑)
  await supabase.from('sensitive_words').delete().neq('id', '00000000-0000-0000-0000-000000000000'); // 清空
  
  const insertData = words.map(w => ({ word: w }));
  const { error } = await supabase.from('sensitive_words').insert(insertData);
  
  if (error) throw error;
};

/**
 * 获取所有敏感词列表
 */
export const get_banned_words = async () => {
  const { data, error } = await supabase.from('sensitive_words').select('word');
  if (error) throw error;
  return data.map(item => item.word);
};



/**
 * 云端生成新用户 (管理员用)
 * 同时在 Supabase Auth 和 users 表创建用户
 */
// 前端:createUser.ts
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

/**
 * 将通知标记为已读
 * @param notificationId 通知ID
 */
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




/**
 * 添加以下函数到 storage.ts 文件中
 */

/**
 * 创建图书评分
 * @param ratingData 评分数据
 * @returns 创建的评分记录
 */
export async function create_book_rating(ratingData: {
  post_id: string;
  user_id: string;
  user_name: string;
  book_name: string;
  book_author: string;
  book_platform: string;
  impressed_score: number;
  principle_scores: { [key: string]: 'yes' | 'no' | null };
  principle_remarks: { [key: string]: string };
  extra_deduction: number;
  extra_remark: string;
  final_score: number;
  reviewer_comment: string;
  reviewer_name:string
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
        impressed_score: ratingData.impressed_score,
        principle_scores: ratingData.principle_scores,
        principle_remarks: ratingData.principle_remarks,
        extra_deduction: ratingData.extra_deduction,
        extra_remark: ratingData.extra_remark,
        final_score: ratingData.final_score,
        reviewer_comment: ratingData.reviewer_comment,
        reviewer_name:ratingData.reviewer_name,
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

/**
 * 更新图书评分
 * @param ratingId 评分ID
 * @param updates 要更新的字段
 * @returns 更新后的评分记录
 */
export async function update_book_rating(
  ratingId: string,
  updates: Partial<BookRating>
): Promise<BookRating> {
  try {
    const { data, error } = await supabase
      .from('book_ratings')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', ratingId)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error: any) {
    console.error('更新图书评分失败:', error);
    throw new Error(`更新图书评分失败: ${error.message}`);
  }
}

/**
 * 删除图书评分
 * @param ratingId 评分ID
 */
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

/**
 * 根据帖子ID获取图书评分
 * @param postId 帖子ID
 * @returns 评分记录或null
 */
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

/**
 * 获取所有图书评分列表
 * @param options 查询选项
 * @returns 评分列表
 */
export async function get_all_book_ratings(options?: {
  sortBy?: 'latest' | 'highest' | 'lowest';
  limit?: number;
}): Promise<BookRating[]> {
  try {
    let query = supabase
      .from('book_ratings')
      .select('*');

    // 排序
    if (options?.sortBy === 'latest') {
      query = query.order('created_at', { ascending: false });
    } else if (options?.sortBy === 'highest') {
      query = query.order('final_score', { ascending: false });
    } else if (options?.sortBy === 'lowest') {
      query = query.order('final_score', { ascending: true });
    } else {
      query = query.order('created_at', { ascending: false });
    }

    // 限制数量
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

/**
 * 根据用户ID获取其评分列表
 * @param userId 用户ID
 * @returns 评分列表
 */
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

/**
 * 搜索图书评分
 * @param query 搜索关键词
 * @returns 匹配的评分列表
 */
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

/**
 * 获取图书评分统计信息
 * @returns 统计数据
 */
export async function get_book_rating_stats(): Promise<{
  total: number;
  averageScore: number;
  highScoreCount: number; // >= 8分
  mediumScoreCount: number; // 5-8分
  lowScoreCount: number; // < 5分
}> {
  try {
    const { data, error } = await supabase
      .from('book_ratings')
      .select('final_score');

    if (error) throw error;

    const ratings = data || [];
    const total = ratings.length;
    
    if (total === 0) {
      return {
        total: 0,
        averageScore: 0,
        highScoreCount: 0,
        mediumScoreCount: 0,
        lowScoreCount: 0,
      };
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
    return {
      total: 0,
      averageScore: 0,
      highScoreCount: 0,
      mediumScoreCount: 0,
      lowScoreCount: 0,
    };
  }
}

/**
 * 切换帖子的精华（蒂贴）状态
 */
export const toggle_essence_post = async (postId: string, isEssence: boolean) => {
  const { error } = await supabase
    .from('posts')
    .update({ is_essence: isEssence })
    .eq('id', postId);

  if (error) throw error;
  return isEssence;
};

/**
 * 添加帖子到合集 (供 PostDetailPage 调用的别名函数)
 */
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
