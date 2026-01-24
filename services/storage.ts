import { supabase } from './supabaseClient';
import { ToastType,User, Post, Category, Collection, Notification, SensitiveWords} from '../types';


// 敏感词处理逻辑

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


// 帖子操作 (Post Operations)


export const create_post = async (post_data: any) => {

  // ✅ 1️⃣ 统一敏感词拦截（发布前）
  const check_text =
    (post_data.title || '') + (post_data.content || '');

  await check_sensitive_words(check_text);

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

// 点赞/取消点赞

export const toggle_like_post = async (post_id: string, user_id: string) => {
  // 1. 先从数据库获取最新的点赞数据
  const { data: currentPost, error: fetchError } = await supabase
    .from('posts')
    .select('likes')
    .eq('id', post_id)
    .single();

  if (fetchError || !currentPost) throw new Error("无法获取帖子数据");

  const safe_likes = Array.isArray(currentPost.likes) ? currentPost.likes : [];
  const is_liked = safe_likes.includes(user_id);
  
  const new_likes = is_liked
    ? safe_likes.filter(id => id !== user_id) 
    : [...safe_likes, user_id];

  // 2. 更新数据库
  const { error: updateError } = await supabase
    .from('posts')
    .update({ likes: new_likes })
    .eq('id', post_id);

  if (updateError) throw updateError;
  return new_likes;
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
    // 2. 如果已存在，则删除记录（取消收藏）
    await supabase
      .from('collection_posts')
      .delete()
      .eq('id', existing.id);
    return false;
  } else {
    // 3. 如果不存在，则插入记录（收藏成功）
    // 注意：这里只写 collection_id 和 post_id
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
    .maybeSingle(); // 意思是：如果找到了就给一个对象，没找到就给 null

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

  // 2. 🔴 关键修改：检查用户是否已经在任何选项中投过票
  const hasVoted = new_poll.options.some((opt: any) => 
    opt.votes && opt.votes.includes(user_id)
  );

  if (hasVoted) {
    // 如果已经投过票，直接抛出错误，阻止后续更新
    throw new Error('您已经参与过投票，结果不可更改');
  }

  // 3. 🟢 更新逻辑：只负责把用户 ID 加到选中的选项里
  new_poll.options = new_poll.options.map((opt: any) => {
    if (opt.id === opt_id) {
      return { 
        ...opt, 
        // 使用解构赋值确保原有的 votes 数组被保留，并加入新用户
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
 * 添加评论（精简版：通知由数据库触发器处理）
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
  post_user_id: string, // 触发器会自动处理，这个参数后续可以不用传了
  post_title: string    // 同上，这个也可以不用传了
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
  
  // 3. ✅ 更新帖子的最后评论时间（用于顶帖排序）
  const { error: updateError } = await supabase
    .from('posts')
    .update({ last_comment_at: new Date().toISOString() })
    .eq('id', commentData.post_id);
  
  if (updateError) {
    console.error('更新帖子最后评论时间失败:', updateError);
    // 不抛出错误，因为评论已经成功添加
  }
  
  // 🎉 注意：这里删除了原来几十行关于 notifications 的判断和插入逻辑
  // 数据库触发器检测到 comments 表有新行时，会自动完成通知任务
  return data;
}

/**
 * 更新评论（替换原有的 update_comment 函数）
 * 新增功能：支持更新图片
 */
export async function update_comment(
  commentId: string, 
  content: string, 
  images?: string[]  // 新增：可选的图片数组
) {
  // ✅ ① 编辑前敏感词拦截（只拦截发布）
  await check_sensitive_words(content);
  const updateData: any = {
    content,
    updated_at: new Date().toISOString(),
  };
  // 如果传入了 images 参数，则更新图片
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
 * 删除评论（替换原有的 delete_comment 函数）
 * 功能保持不变，但确保完整性
 */
export async function delete_comment(commentId: string) {
  const { error } = await supabase
    .from('comments')
    .delete()
    .eq('id', commentId);

  if (error) throw error;
}

/**
 * 切换评论点赞（精简版）
 */
export async function toggle_like_comment(commentId: string, userId: string) {
  // 1. 获取当前评论信息
  const { data: comment, error: fetchError } = await supabase
    .from('comments')
    .select('likes, user_id, post_id')
    .eq('id', commentId)
    .single();

  if (fetchError) throw fetchError;

  const currentLikes = comment.likes || [];
  const hasLiked = currentLikes.includes(userId);
  
  // 2. 切换点赞状态
  const newLikes = hasLiked
    ? currentLikes.filter((id: string) => id !== userId)
    : [...currentLikes, userId];

  const { error: updateError } = await supabase
    .from('comments')
    .update({ likes: newLikes })
    .eq('id', commentId);

  if (updateError) throw updateError;

  // 🎉 这里原本有一大段手动 insert notifications 的代码，现在也删掉了
  // 如果你为“点赞表”也写了触发器，它会自动生效

  return { hasLiked: !hasLiked, likesCount: newLikes.length };
}

/**
 * 获取评论列表（你已经有这个函数了，不需要重复添加）
 * 保持你现有的 getComments 函数不变即可
 */
// export async function getComments(postId: string) {
//   // 你已经有这个函数了，在 storage.ts 第 451-465 行
// }

// --- 帖子管理 (管理员功能) ---

//切换精华状态

export const toggle_essence_post = async (post_id: string, is_essence: boolean) => {
  const { error } = await supabase.from('posts').update({ is_essence }).eq('id', post_id);
  if (error) throw error;
};

// 切换锁定状态
 
export const toggle_lock_post = async (post_id: string, is_locked: boolean) => {
  const { error } = await supabase.from('posts').update({ is_locked }).eq('id', post_id);
  if (error) throw error;
};

//更新帖子内容 (修改帖子)

export const update_post = async (post_id: string, update_data: any) => {
  const { error } = await supabase.from('posts').update(update_data).eq('id', post_id);
  if (error) throw error;
};

//删除帖子

export const delete_post = async (post_id: string) => {
  const { error } = await supabase.from('posts').delete().eq('id', post_id);
  if (error) throw error;
};

// --- 收藏功能 ---

//创建新收藏夹

export const create_collection = async (user_id: string, name: string) => {
  const { error } = await supabase.from('collections').insert([{
    user_id,
    name,
  }]);
  if (error) throw error;
};


/**
 * 获取指定帖子的所有评论
 * @param postId 帖子ID
 * @returns 评论列表
 */
export async function getComments(postId: string) {
  try {
    const { data, error } = await supabase
      .from('comments')
      .select('*')
      .eq('post_id', postId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (error: any) {
    console.error('获取评论失败:', error);
    throw new Error(`获取评论失败: ${error.message}`);
  }
}

/**
 * 更新用户信息
 * @param userId 用户ID
 * @param updates 要更新的字段
 * @returns 更新后的用户对象
 */
export async function updateUser(userId: string, updates: {
  user_name?: string;
  avatar?: string;
  bio?: string;
  password?: string;
  is_first_login?: boolean;
  [key: string]: any;
}) {
  try {
    const { data, error } = await supabase
      .from('users')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error: any) {
    console.error('更新用户信息失败:', error);
    throw new Error(`更新用户信息失败: ${error.message}`);
  }
}

/**
 * 获取用户未读通知数量
 * @param userId 用户ID
 * @returns 未读通知数量
 */
export async function getUnreadNotificationCount(userId: string): Promise<number> {
  try {
    const { data, error, count } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_read', false);

    if (error) throw error;
    return count || 0;
  } catch (error: any) {
    console.error('获取未读通知数量失败:', error);
    return 0; // 失败时返回0，不影响主流程
  }
}

/**
 * 将帖子添加到收藏夹 (修正版)
 * @param collectionId 收藏夹的 UUID
 * @param postId 帖子的 UUID
 */
export async function addToCollection(collectionId: string, postId: string) {
  try {
    // 1. 检查是否已经收藏：操作目标改为 collection_posts 关联表
    const { data: existing, error: checkError } = await supabase
      .from('collection_posts')
      .select('id')
      .eq('collection_id', collectionId)
      .eq('post_id', postId)
      .maybeSingle(); // 使用 maybeSingle 避免找不到记录时抛出异常

    if (checkError) throw checkError;

    if (existing) {
      throw new Error('该帖子已在此收藏夹中');
    }

    // 2. 添加到关联表：建立收藏夹与帖子的绑定关系
    const { data, error } = await supabase
      .from('collection_posts')
      .insert({
        collection_id: collectionId,
        post_id: postId
      })
      .select()
      .single();

    if (error) throw error;

    // 3. (可选) 更新计数逻辑：如果你的数据库有 rpc，请确保参数名正确
    // 通常关联表模式下，计数可以通过 SQL 聚合函数完成，不一定需要手动维护
    
    return data;
  } catch (error: any) {
    console.error('添加到收藏夹失败:', error);
    throw new Error(error.message || '添加到收藏夹失败');
  }
}
/**
 * 更新帖子信息（这个函数和 update_post 功能重复，保留兼容性）
 * @param postId 帖子ID
 * @param updates 要更新的字段
 * @returns 更新后的帖子对象
 */
export async function updatePost(
  postId: string,
  updates: {
    title?: string;
    content?: string;
    category?: string;
    images?: string[];
    is_essence?: boolean;
    is_locked?: boolean;
    [key: string]: any;
  }
) {
  try {
    // ✅ ① 只有在更新文字时才拦截
    const checkText =
      (updates.title ?? '') + (updates.content ?? '');

    if (checkText) {
      await check_sensitive_words(checkText);
    }

    // ✅ ② 再执行真正的更新
    const { data, error } = await supabase
      .from('posts')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', postId)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error: any) {
    console.error('更新帖子失败:', error);
    throw new Error(`更新帖子失败: ${error.message}`);
  }
}

/**
 * 获取特定用户的帖子列表 (用于个人主页)
 */
export const get_posts_by_user = async (user_id: string) => {
  const { data, error } = await supabase
    .from('posts')
    .select('*')
    .eq('user_id', user_id) // ✅ 必须改为 user_id，因为数据库 posts 表里只有这一列
    .order('created_at', { ascending: false });

  if (error) {
    console.error('获取用户帖子失败:', error.message);
    throw error;
  }

  return data || [];
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
  // 先删除旧的，再插入新的（这是一种简单替换逻辑）
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
// 前端：createUser.ts
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
