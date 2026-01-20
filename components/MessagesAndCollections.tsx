import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { Loader2, Bell, MessageCircle, Heart, Trash2, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// ==================== 消息组件 ====================
export function MessagesTab({ userId }: { userId: string }) {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    loadNotifications();

    const channel = supabase
      .channel(`notifications_${userId}`)
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

  const loadNotifications = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setNotifications(data || []);
    } catch (err: any) {
      console.error('加载消息失败:', err?.message || err);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId);

      if (error) throw error;

      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
      );
    } catch (err: any) {
      console.error('标记已读失败:', err?.message || err);
    }
  };

  const markAllAsRead = async () => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', userId)
        .eq('is_read', false);

      if (error) throw error;
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch (err: any) {
      console.error('全部标记已读失败:', err?.message || err);
    }
  };

  const deleteNotification = async (notificationId: string) => {
    if (!confirm('确定要删除这条消息吗？')) return;

    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId);

      if (error) throw error;
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
    } catch (err: any) {
      console.error('删除消息失败:', err?.message || err);
      alert('删除失败');
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'comment':
        return <MessageCircle className="w-5 h-5 text-blue-600" />;
      case 'reply':
        return <MessageCircle className="w-5 h-5 text-green-600" />;
      case 'like':
        return <Heart className="w-5 h-5 text-red-600" />;
      default:
        return <Bell className="w-5 h-5 text-zinc-400" />;
    }
  };

  const getNotificationText = (notification: any) => {
    switch (notification.type) {
      case 'comment':
        return (
          <>
            <span className="font-bold">{notification.from_user_name}</span> 评论了你的帖子
            <span className="font-medium">《{notification.post_title}》</span>
          </>
        );
      case 'reply':
        return (
          <>
            <span className="font-bold">{notification.from_user_name}</span> 回复了你的评论
          </>
        );
      case 'like':
        return (
          <>
            <span className="font-bold">{notification.from_user_name}</span> 赞了你的帖子
            <span className="font-medium">《{notification.post_title}》</span>
          </>
        );
      default:
        return '新通知';
    }
  };

  const timeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return '刚刚';
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) return `${diffInMinutes}分钟前`;
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}小时前`;
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 30) return `${diffInDays}天前`;
    return date.toLocaleDateString('zh-CN');
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
      </div>
    );
  }

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <div className="space-y-4">
      {notifications.length > 0 && (
        <div className="flex justify-between items-center pb-3 border-b border-zinc-200">
          <span className="text-sm text-zinc-600">
            {unreadCount > 0 ? `${unreadCount} 条未读` : '全部已读'}
          </span>
          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className="text-sm text-blue-600 hover:underline"
            >
              全部标记为已读
            </button>
          )}
        </div>
      )}

      {notifications.length === 0 ? (
        <div className="text-center py-12 text-zinc-400 text-sm">
          <Bell className="w-12 h-12 mx-auto mb-3 text-zinc-300" />
          暂无消息
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map(notification => (
            <div
              key={notification.id}
              className={`p-4 border rounded-lg transition-colors cursor-pointer ${
                notification.is_read
                  ? 'bg-white border-zinc-200'
                  : 'bg-blue-50 border-blue-200'
              }`}
              onClick={() => {
                if (!notification.is_read) markAsRead(notification.id);
                if (notification.post_id) navigate(`/post/${notification.post_id}`);
              }}
            >
              <div className="flex gap-3">
                <div className="flex-shrink-0 pt-1">
                  {getNotificationIcon(notification.type)}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm mb-1">
                    {getNotificationText(notification)}
                  </p>

                  {notification.content && (
                    <p className="text-sm text-zinc-500 bg-zinc-50 p-2 rounded mt-2 line-clamp-2">
                      {notification.content}
                    </p>
                  )}

                  <div className="flex items-center gap-3 mt-2">
                    <span className="text-xs text-zinc-400">
                      {timeAgo(notification.created_at)}
                    </span>
                  </div>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteNotification(notification.id);
                  }}
                  className="flex-shrink-0 p-2 text-zinc-400 hover:text-red-600 transition-colors"
                  aria-label="删除消息"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ==================== 收藏组件 ====================
export function CollectionsTab({ userId }: { userId: string }) {
  const [collections, setCollections] = useState<any[]>([]);
  const [selectedCollection, setSelectedCollection] = useState<string | null>(null);
  const [collectedPosts, setCollectedPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    loadCollections();
  }, [userId]);

  useEffect(() => {
    if (selectedCollection) {
      loadCollectedPosts(selectedCollection);
    } else {
      setCollectedPosts([]);
    }
  }, [selectedCollection]);

  const loadCollections = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('collections')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setCollections(data || []);
      if (data && data.length > 0) {
        setSelectedCollection(data[0].id);
      }
    } catch (err: any) {
      console.error('加载收藏夹失败:', err?.message || err);
    } finally {
      setLoading(false);
    }
  };

  const loadCollectedPosts = async (collectionId: string) => {
    try {
      const { data: collectionPosts, error: cpError } = await supabase
        .from('collection_posts')
        .select('post_id')
        .eq('collection_id', collectionId);

      if (cpError) throw cpError;

      if (!collectionPosts || collectionPosts.length === 0) {
        setCollectedPosts([]);
        return;
      }

      const postIds = collectionPosts.map(cp => cp.post_id);

      if (postIds.length === 0) {
        setCollectedPosts([]);
        return;
      }

      const { data: posts, error: postsError } = await supabase
        .from('posts')
        .select('*')
        .in('id', postIds)
        .order('created_at', { ascending: false });

      if (postsError) throw postsError;

      setCollectedPosts(posts || []);
    } catch (err: any) {
      console.error('加载收藏的帖子失败:', err?.message || err);
      setCollectedPosts([]);
    }
  };

  const removeFromCollection = async (postId: string) => {
    if (!selectedCollection || !confirm('确定要从收藏夹中移除这篇帖子吗？')) return;

    try {
      const { error } = await supabase
        .from('collection_posts')
        .delete()
        .eq('collection_id', selectedCollection)
        .eq('post_id', postId);

      if (error) throw error;

      setCollectedPosts(prev => prev.filter(p => p.id !== postId));
    } catch (err: any) {
      console.error('移除收藏失败:', err?.message || err);
      alert('移除失败');
    }
  };

  const deleteCollection = async (collectionId: string) => {
    if (!confirm('确定要删除这个收藏夹吗？收藏夹内的所有帖子也会被移除。')) return;

    try {
      const { error } = await supabase
        .from('collections')
        .delete()
        .eq('id', collectionId);

      if (error) throw error;

      setCollections(prev => prev.filter(c => c.id !== collectionId));

      if (selectedCollection === collectionId) {
        const remaining = collections.filter(c => c.id !== collectionId);
        setSelectedCollection(remaining.length > 0 ? remaining[0].id : null);
      }
    } catch (err: any) {
      console.error('删除收藏夹失败:', err?.message || err);
      alert('删除失败');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
      </div>
    );
  }

  if (collections.length === 0) {
    return (
      <div className="text-center py-12 text-zinc-400 text-sm">
        <div className="w-16 h-16 mx-auto mb-3 bg-zinc-100 rounded-full flex items-center justify-center">
          <span className="text-2xl">📚</span>
        </div>
        暂无收藏夹
        <p className="mt-2 text-xs">在帖子详情页点击收藏按钮即可创建收藏夹</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      {/* 左侧：收藏夹列表 */}
      <div className="md:col-span-1 space-y-2">
        <h3 className="text-sm font-bold text-zinc-600 mb-3">我的收藏夹</h3>
        {collections.map(collection => (
          <div
            key={collection.id}
            className={`group p-3 border rounded-lg cursor-pointer transition-colors ${
              selectedCollection === collection.id
                ? 'bg-black text-white border-black'
                : 'bg-white border-zinc-200 hover:border-zinc-400'
            }`}
            onClick={() => setSelectedCollection(collection.id)}
          >
            <div className="flex justify-between items-start">
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{collection.name}</div>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  deleteCollection(collection.id);
                }}
                className={`p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity ${
                  selectedCollection === collection.id
                    ? 'hover:bg-white/20'
                    : 'hover:bg-zinc-100'
                }`}
                aria-label="删除收藏夹"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* 右侧：所选收藏夹内的帖子列表 */}
      <div className="md:col-span-3">
        {selectedCollection && (
          <>
            <h3 className="text-sm font-bold text-zinc-600 mb-3">
              {collections.find(c => c.id === selectedCollection)?.name}
            </h3>

            {collectedPosts.length === 0 ? (
              <div className="text-center py-12 text-zinc-400 text-sm border border-dashed border-zinc-200 rounded-lg">
                这个收藏夹还是空的
              </div>
            ) : (
              <div className="space-y-3">
                {collectedPosts.map(post => (
                  <div
                    key={post.id}
                    className="group p-4 border border-zinc-200 rounded-lg hover:bg-zinc-50 transition-colors cursor-pointer"
                    onClick={() => navigate(`/post/${post.id}`)}
                  >
                    <div className="flex justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium mb-2 line-clamp-1 group-hover:text-blue-600 transition-colors">
                          {post.title}
                        </h4>
                        <p className="text-sm text-zinc-500 line-clamp-2 mb-2">
                          {post.content}
                        </p>
                        <div className="flex items-center gap-3 text-xs text-zinc-400">
                          <span className="bg-zinc-100 px-2 py-0.5 rounded text-zinc-600">
                            {post.category}
                          </span>
                          <span>•</span>
                          <span>{new Date(post.created_at).toLocaleDateString('zh-CN')}</span>
                        </div>
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeFromCollection(post.id);
                        }}
                        className="flex-shrink-0 p-2 text-zinc-400 hover:text-red-600 transition-colors opacity-0 group-hover:opacity-100"
                        aria-label="移除收藏"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}