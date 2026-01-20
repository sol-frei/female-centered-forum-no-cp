import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { Loader2, Bell, MessageCircle, Heart } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
// 👈 确保这里引入了你刚写的函数
import { markNotificationAsRead } from '../services/storage'; 

export function MessagesTab({ userId }: { userId: string }) {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const loadNotifications = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setNotifications(data || []);
    } catch (err: any) {
      console.error('加载消息失败:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();

    const channel = supabase
      .channel(`notifications_live_${userId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`
      }, () => {
        // 当数据库发生变化（包括标记已读）时，自动重新加载列表
        loadNotifications();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  // --- 新增：处理点击逻辑 ---
  const handleItemClick = async (n: any) => {
    // 1. 如果是未读，先标记已读
    if (!n.is_read) {
      await markNotificationAsRead(n.id);
      // 注意：这里不需要手动 setNotifications，
      // 因为上面的实时监听 channel 会自动捕获到数据库更新并触发 loadNotifications()
    }

    // 2. 执行跳转
    if (n.post_id) {
      // 如果你使用的是 HashRouter，navigate('/post/xxx') 会自动处理成 /#/post/xxx
      navigate(`/post/${n.post_id}`);
    }
  };

  const timeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
    if (diff < 60) return '刚刚';
    if (diff < 3600) return `${Math.floor(diff / 60)}分钟前`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}小时前`;
    return date.toLocaleDateString('zh-CN');
  };

  if (loading) {
    return (
      <div key="loader" className="flex justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
      </div>
    );
  }

  return (
    <div key="messages-root" className="space-y-4">
      {notifications.length === 0 ? (
        <div key="empty" className="text-center py-12 text-zinc-400 text-sm">
          <Bell className="w-12 h-12 mx-auto mb-3 text-zinc-300" />
          暂无消息
        </div>
      ) : (
        <div key="list" className="space-y-3">
          {notifications.map((n) => (
            <div
              key={n.id}
              // 👈 核心修改：绑定新的处理函数
              onClick={() => handleItemClick(n)}
              className={`p-4 border rounded-lg cursor-pointer transition-all hover:shadow-sm ${
                n.is_read 
                  ? 'bg-white border-zinc-100' 
                  : 'bg-blue-50/50 border-blue-100 shadow-sm ring-1 ring-blue-100' // 未读状态加个边框高亮
              }`}
            >
              <div className="flex gap-3">
                <div className="pt-1">
                  {n.type === 'like' ? <Heart className="w-4 h-4 text-red-500" /> : <MessageCircle className="w-4 h-4 text-blue-500" />}
                </div>
                <div className="flex-1">
                  <p className="text-sm text-zinc-800">
                    <span className="font-bold">{n.from_user_name}</span> 
                    {n.type === 'comment' ? ' 评论了你的帖子' : n.type === 'reply' ? ' 回复了你的评论' : ' 赞了你的帖子'}
                    {/* 如果未读，显示一个小红点 */}
                    {!n.is_read && <span className="inline-block w-2 h-2 bg-blue-500 rounded-full ml-2" />}
                  </p>
                  {n.content && (
                    <p className="mt-2 text-sm text-zinc-500 bg-zinc-50 p-2 rounded italic">"{n.content}"</p>
                  )}
                  <p className="mt-2 text-[10px] text-zinc-400">{timeAgo(n.created_at)}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}