export type Role = 'admin' | 'user' | 'i女er';
export type ToastType = 'success' | 'error' | 'warning' | 'info';

// 用户信息

export interface User {
  id: string; // Used as login ID
  user_name: string; // Display name
  password: string;
  avatar?: string; // 存储来自 Storage user_images 桶的图片网址
  role: Role;
  is_first_login: boolean;
  is_banned: boolean;
  created_at: string;
}


// 论坛帖子信息

export interface Post {
  id: string;
  user_id: string;
  user_name: string;
  title: string;
  content: string;
  images?: string[]; // 存储来自 Storage forum_images 桶的图片网址
  category: Category;
  created_at: string;
  updated_at: string;
  is_essence: boolean; // "蒂" tag
  is_locked: boolean; // Admin locked
  likes: string[]; // user IDs
  poll?: Poll;
  view_count: number;
}

export type Category = 
  | '全部' 
  | '推书📖排雷' 
  | '讨论👊🏻i女' 
  | '求书🔍求作' 
  | '自荐🙋🏻分享' 
  | '组务❗组规';

export interface PollOption {
  id: string;
  text: string;
  votes: string[]; // user IDs
}

export interface Poll {
  question: string;
  options: PollOption[];
  isMultiple: boolean;
  deadline: string;
}

// 评论信息

export interface Comment {
  id: string;
  post_id: string;
  user_id: string;
  user_name: string;
  content: string;
  comment_images?: string[]; // 存储来自 Storage comment_images 桶的图片网址
  created_at: string;
  reply_to_id?: string|null; // For nested replies
  likes: string[]; // user IDs
}

// 通知信息

export interface Notification {
  id: string;
  user_id: string; // Recipient
  type: 'reply' | 'comment';
  from_user_id: string;
  from_user_name: string;
  post_id: string;
  post_title: string;
  content: string; // The comment content
  created_at: string;
  is_read: boolean;
}

// 收藏夹信息
export interface Collection {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
}

// 敏感词信息

export interface SensitiveWords {
  id: string;
  word: string;
  category: string;
  replacement: string;
  created_at: string;
  created_by: string;
}

// 应用程序状态

export interface AppState {
  users: User[];
  posts: Post[];
  categories: Category[];
  comments: Comment[];
  notifications: Notification[];
  collections: Collection[];
  sensitive_words: SensitiveWords[];
}