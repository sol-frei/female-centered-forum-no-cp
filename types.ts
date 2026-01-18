export type Role = 'admin' | 'user' | 'i女er';

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

export interface Comment {
  id: string;
  post_id: string;
  user_id: string;
  user_name: string;
  content: string;
  created_at: string;
  reply_to_id?: string; // For nested replies
  likes: string[]; // user IDs
}

export interface Post {
  id: string;
  author_id: string;
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
  viewCount: number;
}

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

export interface Collection {
  id: string;
  user_id: string;
  name: string;
  post_ids: string[];
  created_at: string;
}

export interface AppState {
  users: User[];
  posts: Post[];
  comments: Comment[];
  notifications: Notification[];
  collections: Collection[];
  bannedWords: string[];
}