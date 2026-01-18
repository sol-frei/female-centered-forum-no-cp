import { supabase } from './supabaseClient';
import { AppState,User, Post, Category, Collection, Notification, SensitiveWords} from '../types';


// 1. 敏感词处理逻辑

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

export const toggle_like_post = async (post_id: string, user_id: string, current_likes: string[] = []) => {
  const safe_likes = Array.isArray(current_likes) ? current_likes : [];
  const is_liked= safe_likes.includes(user_id);
  const new_likes = is_liked
    ? safe_likes.filter(id => id !== user_id) 
    : [...safe_likes, user_id];

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
  const { data, error } = await supabase.from('profiles').select('*'); // 假设你的用户表叫 profiles
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

  const { data: new_comment, error: c_error } = await supabase
    .from('comments')
    .insert([{
      post_id: comment.post_id,
      user_id: comment.user_id,
      user_name: comment.user_name,
      content: filtered_content,
      reply_to_id: comment.reply_to_id || null
    }])
    .select()
    .single();

  if (c_error) throw c_error;

  if (post_user_id !== comment.user_id) {
    await supabase.from('notifications').insert([{
      user_id: post_user_id,
      type: comment.reply_to_id ? 'reply' : 'comment',
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
  const { error } = await supabase.from('comments').update({ content }).eq('id', comment_id);
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
