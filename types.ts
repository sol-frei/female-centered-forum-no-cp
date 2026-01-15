export type Role = 'admin' | 'user' | 'i女er';

export interface User {
  id: string; // Used as login ID
  username: string; // Display name
  password: string;
  avatar?: string; // Base64 image string
  role: Role;
  isFirstLogin: boolean;
  isBanned: boolean;
  createdAt: string;
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
  votes: string[]; // User IDs
}

export interface Poll {
  question: string;
  options: PollOption[];
  isMultiple: boolean;
  deadline: string;
}

export interface Comment {
  id: string;
  postId: string;
  userId: string;
  username: string;
  content: string;
  createdAt: string;
  replyToId?: string; // For nested replies
  likes: string[]; // User IDs
}

export interface Post {
  id: string;
  userId: string;
  username: string;
  title: string;
  content: string;
  images?: string[]; // Base64 strings
  category: Category;
  createdAt: string;
  updatedAt: string;
  isEssence: boolean; // "蒂" tag
  isLocked: boolean; // Admin locked
  likes: string[]; // User IDs
  poll?: Poll;
  viewCount: number;
}

export interface Notification {
  id: string;
  userId: string; // Recipient
  type: 'reply' | 'comment';
  fromUserId: string;
  fromUsername: string;
  postId: string;
  postTitle: string;
  content: string; // The comment content
  createdAt: string;
  isRead: boolean;
}

export interface Collection {
  id: string;
  userId: string;
  name: string;
  postIds: string[];
  createdAt: string;
}

export interface AppState {
  users: User[];
  posts: Post[];
  comments: Comment[];
  notifications: Notification[];
  collections: Collection[];
  bannedWords: string[];
}