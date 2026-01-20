import { supabase } from './supabaseClient';
import { ToastType,User, Post, Category, Collection, Notification, SensitiveWords} from '../types';


// 敏感词处理逻辑

export const filter_sensitive_words = async (text: string): Promise<string> => {
  const { data: words } = await supabase.from('sensitive_words').select('word');
  if (!words || words.length === 0) return text;
  
  let filteredText = text;
  words.forEach(({ word }) => {
    const regex = new RegExp(word, 'gi');
    filteredText = filteredText.replace(regex, '***');
  });
  return filteredText;
};


// 帖子操作 (Post Operations)


export const create_post = async (post_data: any) => {


  const { data: banned_words} = await supabase.from('sensitive_words').select('word');
  const check_text = (post_data.title || '') + (post_data.content || '');
  const has_banned = banned_words?.some(b => check_text.includes(b.word));
  if (has_banned) throw new Error("内容包含违禁词，发布失败");// 敏感词预检

  const { data, error } = await supabase
    .from('posts')
    .insert([{
      title: post_data.title,
      content: post_data.content,
      category: post_data.category,
      author_id: post_data.author_id,      // 对应 SQL 的 author_id
      author_name: post_data.author_name,   // 对应 SQL 的 author_name
      images: post_data.images || [],
      poll: post_data.poll || null,
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
};//  插入数据库 (严格对应你 SQL 中的字段名)



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

export const toggle_like_post = async (post_id: string, author_id: string, current_likes: string[] = []) => {
  const safe_likes = Array.isArray(current_likes) ? current_likes : [];
  const is_liked= safe_likes.includes(author_id);
  const new_likes = is_liked
    ? safe_likes.filter(id => id !== author_id) 
    : [...safe_likes, author_id];

  const { error } = await supabase
    .from('posts')
    .update({ likes: new_likes })
    .eq('id', post_id);

  if (error) throw error;
  return new_likes;
};




// 收藏逻辑 (Collections)

export const toggle_collection = async (user_id: string, post_id: string) => {
  const { data: existing } = await supabase
    .from('collections')
    .select('*')
    .eq('user_id', user_id)
    .eq('post_id', post_id)
    .maybeSingle();

  if (existing) {
    await supabase.from('collections').delete().eq('id', existing.id);
    return false; // 代表取消收藏
  } else {
    await supabase.from('collections').insert([{ user_id: user_id, post_id: post_id }]);
    return true; // 代表收藏成功
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
  const { data: post } = await supabase.from('posts').select('poll').eq('id', post_id).single();
  if (!post || !post.poll) return;

  const new_poll = { ...post.poll };
  // 遍历所有选项，更新投票名单
  new_poll.options = new_poll.options.map((opt: any) => {
    // 先把用户从所有选项的投票名单里踢出来 (防止多选限制或重复投票)
    let votes = opt.votes.filter((id: string) => id !== user_id);
    // 如果是用户点的那个选项，就把他加进去
    if (opt.id === opt_id) {
      votes.push(user_id);
    }
    return { ...opt, votes };
  });

  const { error } = await supabase.from('posts').update({ poll: new_poll }).eq('id', post_id);
  if (error) throw error;
};

// --- 评论功能 ---

//评论与通知

export const add_comment = async (comment: any, post_user_id: string, post_title: string) => {
  const filtered_content = await filter_sensitive_words(comment.content);
  
  let clean_reply_id = (comment.reply_to_id && 
                        comment.reply_to_id !== 'undefined' && 
                        comment.reply_to_id !== '') 
    ? comment.reply_to_id 
    : null;
  
  // 验证母评论是否存在
  if (clean_reply_id) {
    const { data: parent_comment, error: parent_error } = await supabase
      .from('comments')
      .select('id')
      .eq('id', clean_reply_id)
      .single();
    
    if (parent_error || !parent_comment) {
      throw new Error(`无法回复：找不到 ID 为 ${clean_reply_id} 的评论`);
    }
  }
  
  const { data: new_comment, error: c_error } = await supabase
    .from('comments')
    .insert([{
      post_id: comment.post_id,
      user_id: comment.user_id,
      user_name: comment.user_name,
      content: filtered_content,
      reply_to_id: clean_reply_id
    }])
    .select()
    .single();
    
  if (c_error) throw c_error;
  
  // 通知逻辑
  if (post_user_id !== comment.user_id) {
    await supabase.from('notifications').insert([{
      user_id: post_user_id,
      type: clean_reply_id ? 'reply' : 'comment', 
      from_user_id: comment.user_id,
      from_user_name: comment.user_name,
      post_id: comment.post_id,
      post_title: post_title,
      content: filtered_content
    }]);
  }
  
  return new_comment;
};

// 修改评论

export const update_comment = async (comment_id: string, content: string) => {
  // 修改也需要过滤违禁词
  const filtered_content = await filter_sensitive_words(content);
  
  const { error } = await supabase
    .from('comments')
    .update({ content: filtered_content }) // 使用过滤后的内容
    .eq('id', comment_id);
    
  if (error) throw error;
};

//删除评论
 

export const delete_comment = async (comment_id: string) => {
  const { error } = await supabase.from('comments').delete().eq('id', comment_id);
  if (error) throw error;
};

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
    post_ids: [] // 初始收藏夹是空的
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
 * 将帖子添加到收藏夹
 * @param collectionId 收藏夹ID
 * @param postId 帖子ID
 * @returns 添加结果
 */
export async function addToCollection(collectionId: string, postId: string) {
  try {
    // 首先检查是否已经收藏
    const { data: existing } = await supabase
      .from('collection_posts')
      .select('*')
      .eq('collection_id', collectionId)
      .eq('post_id', postId)
      .single();

    if (existing) {
      throw new Error('该帖子已在此收藏夹中');
    }

    // 添加到收藏夹
    const { data, error } = await supabase
      .from('collection_posts')
      .insert({
        collection_id: collectionId,
        post_id: postId,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;

    // 更新收藏夹的帖子数量
    const { error: updateError } = await supabase.rpc('increment_collection_count', {
      collection_id: collectionId
    });

    if (updateError) {
      console.warn('更新收藏夹计数失败:', updateError);
      // 不抛出错误，因为主要操作已成功
    }

    return data;
  } catch (error: any) {
    console.error('添加到收藏夹失败:', error);
    throw new Error(`添加到收藏夹失败: ${error.message}`);
  }
}

/**
 * 更新帖子信息（这个函数和 update_post 功能重复，保留兼容性）
 * @param postId 帖子ID
 * @param updates 要更新的字段
 * @returns 更新后的帖子对象
 */
export async function updatePost(postId: string, updates: {
  title?: string;
  content?: string;
  category?: string;
  images?: string[];
  is_essence?: boolean;
  is_locked?: boolean;
  [key: string]: any;
}) {
  try {
    const { data, error } = await supabase
      .from('posts')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
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
    .eq('author_id', user_id) // ✅ 必须改为 author_id，因为数据库 posts 表里只有这一列
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
