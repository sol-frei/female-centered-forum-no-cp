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
  const [unreadIds, setUnreadIds] = useState<Set<string>>(new Set());
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

      const list = data || [];

      setUnreadIds(prev => {
        if (prev.size === 0) {
          const ids = new Set(list.filter((n: any) => !n.is_read).map((n: any) => n.id as string));
          return ids;
        }
        return prev;
      });

      setNotifications(list);
    } catch (err: any) {
      console.error('加载消息失败:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setUnreadIds(new Set());
    loadNotifications();

    const channel = supabase
      .channel(`notifications_live_${userId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`
      }, () => {
        loadNotifications();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

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
      <div className="flex justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
      </div>
    );
  }

  return (
    <div>
      {notifications.length === 0 ? (
        // ✅ 空状态字体放大
        <div className="text-center py-16 text-zinc-400 text-base">
          <Bell className="w-10 h-10 mx-auto mb-3 text-zinc-300" />
          暂无消息
        </div>
      ) : (
        <div>
          {notifications.map((n) => {
            const isNew = unreadIds.has(n.id);
            return (
              <div
                key={n.id}
                onClick={() => handleItemClick(n)}
                // ✅ 去掉边框和圆角，改为底部分隔线，未读用左侧色条区分
                className={`py-4 px-1 border-b border-zinc-100 cursor-pointer transition-all hover:bg-zinc-50 ${
                  isNew ? 'border-l-2 border-l-red-400 pl-3' : ''
                }`}
              >
                <div className="flex gap-3">
                  <div className="pt-0.5 relative shrink-0">
                    {n.type === 'like' ? (
                      // ✅ 图标放大
                      <Heart className="w-5 h-5 text-red-500" />
                    ) : (
                      <MessageCircle className="w-5 h-5 text-blue-500" />
                    )}
                    {isNew && (
                      <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-red-500 rounded-full" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    {/* ✅ 用户名 + 动作文字：text-sm → text-base */}
                    <p className={`text-base text-zinc-800 ${isNew ? 'font-semibold' : ''}`}>
                      <span className="font-semibold">{n.from_user_name}</span>
                      {n.type === 'comment' ? ' 评论了你的帖子' : n.type === 'reply' ? ' 回复了你的评论' : ' 赞了你'}
                    </p>
                    {n.content && (
                      // ✅ 内容摘要：text-xs → text-sm，背景色去掉改为左缩进线条风格
                      <p className="mt-1.5 text-sm text-zinc-500 pl-3 border-l-2 border-zinc-200 line-clamp-2">
                        {n.content}
                      </p>
                    )}
                    {/* ✅ 时间：text-[10px] → text-xs */}
                    <p className="mt-1.5 text-xs text-zinc-400">{timeAgo(n.created_at)}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
