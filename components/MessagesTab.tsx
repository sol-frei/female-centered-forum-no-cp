import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { Loader2, Bell, MessageCircle, Heart } from 'lucide-react';

export function MessagesTab({ 
  userId, 
  onPostClick 
}: { 
  userId: string, 
  onPostClick: (id: string) => void 
}) {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
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
        // 当数据库发生变化时,自动重新加载列表
        loadNotifications();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  // 🟢 简化点击处理:直接跳转,不需要标记已读(因为进入主页已经全部标记为已读了)
  const handleItemClick = (notification: any) => {
    if (notification.post_id) {
      onPostClick(notification.post_id);
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
    <div key="messages-root" className="space-y-3">
      {notifications.length === 0 ? (
        <div key="empty" className="text-center py-16 text-zinc-400 text-sm">
          <Bell className="w-10 h-10 mx-auto mb-3 text-zinc-300" />
          暂无消息
        </div>
      ) : (
        <div key="list" className="space-y-2">
          {notifications.map((n) => (
            <div
              key={n.id}
              onClick={() => handleItemClick(n)}
              className="p-3.5 border rounded-xl cursor-pointer transition-all hover:shadow-sm bg-white border-zinc-200 hover:border-zinc-300"
            >
              <div className="flex gap-3">
                <div className="pt-0.5">
                  {n.type === 'like' ? (
                    <Heart className="w-4 h-4 text-red-500" />
                  ) : (
                    <MessageCircle className="w-4 h-4 text-blue-500" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-zinc-800">
                    <span className="font-semibold">{n.from_user_name}</span> 
                    {n.type === 'comment' ? ' 评论了你的帖子' : n.type === 'reply' ? ' 回复了你的评论' : ' 赞了你'}
                  </p>
                  {n.content && (
                    <p className="mt-1.5 text-xs text-zinc-600 bg-zinc-50 p-2 rounded-lg line-clamp-2">
                      {n.content}
                    </p>
                  )}
                  <p className="mt-1.5 text-[10px] text-zinc-400">{timeAgo(n.created_at)}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
