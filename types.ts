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
// 数据来源：book_ratings_full 视图（book_ratings + book_details 合并）
// book_ratings：评分核心数据，RLS 保护，仅发帖人可写
// book_details：扩展展示数据，所有登录用户可写
export interface BookRating {
  // ── 来自 book_ratings（评分核心，RLS 保护）──
  id: string;
  post_id: string;
  user_id: string;
  user_name: string;
  book_name: string;
  book_author: string;
  book_platform: string;
  book_category: string;
  original_impressed_score: number;  // 评分人录入的原始印象分，编辑时回填此值
  principle_scores: { [key: string]: 'yes' | 'no' | null };
  principle_remarks: { [key: string]: string };
  extra_deduction: number;
  extra_remark: string;
  reviewer_name: string;
  reviewer_comment?: string | null;
  created_at: string;
  updated_at?: string;

  // ── 来自 book_details（扩展展示，所有登录用户可写）──
  serial_status?: 'finished' | 'ongoing' | 'hiatus';
  recommendation_tag?: 'recommend' | 'warn';
  cover_url?: string;
  book_link?: string;
  book_intro?: string;
  book_characters?: Character[];
  reader_reviews?: ReaderReview[];

  // ── 由视图自动计算，只读，勿手动写入数据库 ──
  impressed_score: number;  // 原始印象分与读者印象分的平均值
  final_score: number;      // impressed_score - 准则扣分 - extra_deduction
}
