import { supabase } from './supabaseClient';
import { AppState, User, Post, Comment, Category, Notification, Collection } from '../types';

const STORAGE_KEY = 'HERSTORY_FORUM_DB_V2'; // Version bump for schema change

const INITIAL_STATE: AppState = {
  users: [
    {
      id: 'admin',
      username: '管理员',
      password: 'admin', // Default password
      role: 'admin',
      isFirstLogin: false,
      isBanned: false,
      createdAt: new Date().toISOString(),
    }
  ],
  posts: [
    {
      id: '1',
      userId: 'admin',
      username: '管理员',
      title: '【必读】本组组规 & 核心精神',
      content: '欢迎来到女主无cp/无男主小说交流中心。本组旨在分享和推荐女主自立自强、发展事业的小说。严禁推荐言情、耽美、男频。女性为第一性，爱女永不停歇！',
      category: '组务❗组规',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isEssence: true,
      isLocked: true,
      likes: [],
      viewCount: 1024
    }
  ],
  comments: [],
  notifications: [],
  collections: [],
  bannedWords: ['娇妻', '恋爱脑', '生子']
};

// Helper to load/save
export const getDB = (): AppState => {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_STATE));
    return INITIAL_STATE;
  }
  const db = JSON.parse(stored);
  if (!db.collections) db.collections = []; // Migration safety
  return db;
};

export const saveDB = (state: AppState) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
};

// --- User Operations ---
export const getUser = (id: string) => {
  const db = getDB();
  return db.users.find(u => u.id === id);
};

export const createUser = (role: 'user' | 'admin' = 'user') => {
  const db = getDB();
  const id = Math.random().toString(36).substring(2, 10); // Random ID
  const password = Math.random().toString(36).substring(2, 10); // Random Password
  
  const newUser: User = {
    id,
    username: id,
    password,
    role,
    isFirstLogin: true,
    isBanned: false,
    createdAt: new Date().toISOString()
  };
  
  db.users.push(newUser);
  saveDB(db);
  return newUser;
};

export const updateUser = (id: string, updates: Partial<User>) => {
  const db = getDB();
  const idx = db.users.findIndex(u => u.id === id);
  if (idx === -1) return null;
  
  db.users[idx] = { ...db.users[idx], ...updates };
  saveDB(db);
  return db.users[idx];
};

// ✅ 1. 确保函数前加了 async (异步关键字)
export const createPost = async (post: Post) => {
  const db = getDB();

  // 保留你原有的敏感词检查逻辑
  const hasBannedWord = db.bannedWords.some(word => 
    post.title.includes(word) || post.content.includes(word)
  );
  
  if (hasBannedWord) {
    throw new Error("帖子内容包含违禁词，无法发布");
  }

  // ✅ 2. 核心：将数据插入 Supabase 数据库
  const { data, error } = await supabase
    .from('posts')
    .insert([
      {
        title: post.title,
        content: post.content,
        category: post.category,
        // 把原先的 author_id 改为对应 post 里的 userId
        author_id: post.userId,      // ✅ 对应 types.ts 里的 userId
        author_name: post.username,  // ✅ 对应 types.ts 里的 username
        created_at: new Date().toISOString()
      }
    ])
    .select();

  if (error) {
    console.error('保存到数据库失败:', error.message);
    throw new Error('保存失败: ' + error.message);
  }

  // 3. 同时更新一下本地缓存以便立即看到效果
  db.posts.unshift(data[0]);
  saveDB(db);

  return data[0]; 
};

export const updatePost = (postId: string, updates: Partial<Pick<Post, 'title' | 'content' | 'category'>>) => {
  const db = getDB();
  const idx = db.posts.findIndex(p => p.id === postId);
  if (idx === -1) return;

  const post = db.posts[idx];
  
  // Check banned words
  const checkText = (updates.title || post.title) + (updates.content || post.content);
  const hasBannedWord = db.bannedWords.some(word => checkText.includes(word));
  
  if (hasBannedWord) {
    throw new Error("帖子内容包含违禁词，无法修改");
  }

  db.posts[idx] = { ...post, ...updates, updatedAt: new Date().toISOString() };
  saveDB(db);
};

export const getPosts = (category: Category | '全部', sort: 'new' | 'essence') => {
  const db = getDB();
  let filtered = db.posts;
  
  if (category !== '全部') {
    filtered = filtered.filter(p => p.category === category);
  }
  
  if (sort === 'essence') {
    filtered = filtered.filter(p => p.isEssence);
  } else {
    // Sort by Date Desc
    filtered = filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }
  return filtered;
};

export const toggleLikePost = (postId: string, userId: string) => {
  const db = getDB();
  const post = db.posts.find(p => p.id === postId);
  if (post) {
    if (post.likes.includes(userId)) {
      post.likes = post.likes.filter(id => id !== userId);
    } else {
      post.likes.push(userId);
    }
    saveDB(db);
  }
};

export const votePoll = (postId: string, optionId: string, userId: string) => {
  const db = getDB();
  const post = db.posts.find(p => p.id === postId);
  if (!post || !post.poll) return;
  
  const poll = post.poll;
  
  // Check deadline
  if (new Date() > new Date(poll.deadline)) return;

  // Remove existing vote if not multiple
  if (!poll.isMultiple) {
    poll.options.forEach(opt => {
      opt.votes = opt.votes.filter(id => id !== userId);
    });
  }

  const option = poll.options.find(o => o.id === optionId);
  if (option) {
    if (option.votes.includes(userId)) {
      option.votes = option.votes.filter(id => id !== userId); // toggle off
    } else {
      option.votes.push(userId);
    }
  }
  saveDB(db);
};

// --- Comment Operations ---
export const addComment = (comment: Comment) => {
  const db = getDB();
  // Check banned words
  const hasBannedWord = db.bannedWords.some(word => 
    comment.content.includes(word)
  );
  
  if (hasBannedWord) {
    throw new Error("评论内容包含违禁词");
  }
  
  db.comments.push(comment);

  // --- Create Notification ---
  const post = db.posts.find(p => p.id === comment.postId);
  if (post) {
    let targetUserId = post.userId;
    let type: 'comment' | 'reply' = 'comment';

    // If replying to a specific comment
    if (comment.replyToId) {
      const parentComment = db.comments.find(c => c.id === comment.replyToId);
      if (parentComment) {
        targetUserId = parentComment.userId;
        type = 'reply';
      }
    }

    // Don't notify self
    if (targetUserId !== comment.userId) {
      const notification: Notification = {
        id: Date.now().toString(),
        userId: targetUserId,
        type,
        fromUserId: comment.userId,
        fromUsername: comment.username,
        postId: post.id,
        postTitle: post.title,
        content: comment.content,
        createdAt: new Date().toISOString(),
        isRead: false
      };
      if (!db.notifications) db.notifications = []; // Safety check for old DBs
      db.notifications.unshift(notification);
    }
  }

  saveDB(db);
};

export const updateComment = (commentId: string, content: string) => {
  const db = getDB();
  const idx = db.comments.findIndex(c => c.id === commentId);
  if (idx === -1) return;

  // Check banned words
  const hasBannedWord = db.bannedWords.some(word => content.includes(word));
  if (hasBannedWord) {
    throw new Error("评论内容包含违禁词，无法修改");
  }

  db.comments[idx].content = content;
  saveDB(db);
};

export const getComments = (postId: string) => {
  const db = getDB();
  return db.comments.filter(c => c.postId === postId);
};

// --- Notification Operations ---
export const getUnreadNotificationCount = (userId: string) => {
  const db = getDB();
  return (db.notifications || []).filter(n => n.userId === userId && !n.isRead).length;
};

export const markNotificationsRead = (userId: string) => {
  const db = getDB();
  if (!db.notifications) return;
  db.notifications.forEach(n => {
    if (n.userId === userId) n.isRead = true;
  });
  saveDB(db);
};

// --- Collection Operations ---
export const createCollection = (userId: string, name: string) => {
  const db = getDB();
  const newCol: Collection = {
    id: Date.now().toString(),
    userId,
    name,
    postIds: [],
    createdAt: new Date().toISOString()
  };
  if (!db.collections) db.collections = [];
  db.collections.push(newCol);
  saveDB(db);
};

export const addToCollection = (collectionId: string, postId: string) => {
  const db = getDB();
  const col = db.collections.find(c => c.id === collectionId);
  if (col && !col.postIds.includes(postId)) {
    col.postIds.push(postId);
    saveDB(db);
  }
};

// --- Admin Operations ---
export const setBannedWords = (words: string[]) => {
  const db = getDB();
  db.bannedWords = words;
  saveDB(db);
};

export const toggleBanUser = (userId: string) => {
  const db = getDB();
  const user = db.users.find(u => u.id === userId);
  // Admin and i女er cannot be banned
  if (user && !['admin', 'i女er'].includes(user.role)) {
    user.isBanned = !user.isBanned;
    saveDB(db);
  }
};

export const toggleEssence = (postId: string) => {
  const db = getDB();
  const post = db.posts.find(p => p.id === postId);
  if (post) {
    post.isEssence = !post.isEssence;
    saveDB(db);
  }
};

export const deletePost = (postId: string) => {
  const db = getDB();
  db.posts = db.posts.filter(p => p.id !== postId);
  saveDB(db);
};