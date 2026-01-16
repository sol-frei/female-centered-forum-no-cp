import { supabase } from './supabaseClient';

// 获取所有帖子
export const fetchAllPosts = async () => {
  const { data, error } = await supabase
    .from('posts')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error('获取失败:', error.message);
    return [];
  }
  return data;
};

// 获取用户真实权限 (比如检测是否为 i-nver)
export const checkUserRole = async (userId: string) => {
  const { data } = await supabase
    .from('users')
    .select('role')
    .eq('id', userId)
    .single();
  return data?.role || 'user';
};