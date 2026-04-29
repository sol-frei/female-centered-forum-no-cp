export type Role = 'admin' | 'user' | 'i女er';
export type ToastType = 'success' | 'error' | 'warning' | 'info';

// 用户信息
export interface User {
  id: string;
  user_name: string;
  password: string;
  avatar?: string;
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
  images?: string[];
  category: Category;
  created_at: string;
  updated_at: string;
  is_essence: boolean;
  is_locked: boolean;
  likes: string[];
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
  votes: string[];
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
  comment_images?: string[];
  created_at: string;
  reply_to_id?: string | null;
  likes: string[];
}

// 通知信息
export interface Notification {
  id: string;
  user_id: string;
  type: 'reply' | 'comment';
  from_user_id: string;
  from_user_name: string;
  post_id: string;
  post_title: string;
  content: string;
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

// 收藏夹中的帖子关联信息
export interface CollectionPost {
  id: string;
  collection_id: string;
  post_id: string;
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

// 人物介绍接口
export interface Character {
  name: string;
  role: string;          // 如 '主角', '配角'
  avatar?: string;
  illustration_url?: string; // 新增：人物插图
}

// 读者书评接口（新增）
export interface ReaderReview {
  user_id: string;
  user_name: string;
  impression_score: number;  // 读者印象分 1-10
  review_text: string;
  likes: number;
  liked_by: string[];        // 点赞用户的 user_id 列表
  created_at: string;
}

// 书籍打分信息
export interface BookRating {
  id: string;
  post_id: string;
  user_id: string;
  user_name: string;

  // 书籍基础信息
  book_name: string;
  book_author: string;
  book_platform: string;
  book_category: string;
  serial_status?: 'finished' | 'ongoing' | 'hiatus'; // 替换原 book_status
  recommendation_tag?: 'recommend' | 'warn';          // 新增：推荐/排雷

  // 详情页内容
  cover_url?: string;              // 新增：封面图片URL
  book_link?: string;              // 推荐/排雷帖链接
  book_intro?: string;             // 书籍简介
  book_characters?: Character[];   // 主要人物数组
  reader_reviews?: ReaderReview[]; // 新增：读者书评列表

  // 评分核心数据
  impressed_score: number;
  principle_scores: { [key: string]: 'yes' | 'no' | null };
  principle_remarks: { [key: string]: string };
  extra_deduction: number;
  extra_remark: string;
  final_score: number;

  // 元数据
  reviewer_name: string;
  reviewer_comment?: string | null;
  original_impressed_score?: number; // 原始印象分（修改前的备份）
  created_at: string;
  updated_at?: string;
}
