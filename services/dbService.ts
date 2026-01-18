
import { supabase } from './supabaseClient';
import { Post } from '../types'; // 导入你的 Post 标准

// 1. 获取所有帖子（增加了分页和类型保护）
export const fetchAllPosts = async (): Promise<Post[]> => {
  const { data, error } = await supabase
    .from('posts')
    .select('*')
    .order('created_at', { ascending: false }) 
    .range(0, 19); // 每次只搬 20 个，不贪心
  
  if (error) {
    console.error('获取失败:', error.message);
    return [];
  }
  return data as Post[]; 
};

// 2. 检查用户角色（增加了错误处理）
export const checkUserRole = async (userId: string): Promise<string> => {
  const { data, error } = await supabase
    .from('users')
    .select('role')
    .eq('id', userId)
    .single();

  if (error) {
    console.error('检查权限失败:', error.message);
    return 'user'; // 出错了就当成普通人，比较安全
  }

  return data?.role || 'user';
};