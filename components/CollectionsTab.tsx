import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { Loader2, Trash2, FolderOpen } from 'lucide-react';


export function CollectionsTab({ 
  userId, 
  onPostClick 
}: { 
  userId: string, 
  onPostClick: (id: string) => void 
}) {
  const [collections, setCollections] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // 加载所有收藏夹
  useEffect(() => {
    const fetchCollections = async () => {
      setLoading(true);
      const { data } = await supabase
        .from('collections')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      
      setCollections(data || []);
      if (data?.length) setSelectedId(data[0].id);
      setLoading(false);
    };
    fetchCollections();
  }, [userId]);

  // 加载选中收藏夹内的帖子
  useEffect(() => {
    if (!selectedId) return;
    const fetchPosts = async () => {
      const { data } = await supabase
        .from('collection_posts')
        .select('posts(*)')
        .eq('collection_id', selectedId);
      
      // 这里的 data 结构通常是 [{ posts: {...} }]
      setPosts(data?.map(item => item.posts).filter(Boolean) || []);
    };
    fetchPosts();
  }, [selectedId]);

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-zinc-400" /></div>;

  if (!collections.length) {
    return (
      <div className="text-center py-12 text-zinc-400">
        <FolderOpen className="w-12 h-12 mx-auto mb-2 opacity-20" />
        <p>还没有创建收藏夹</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row gap-6">
      {/* 左侧收藏夹列表 */}
      <div className="w-full md:w-48 space-y-2">
        {collections.map(c => (
          <button
            key={c.id}
            onClick={() => setSelectedId(c.id)}
            className={`w-full text-left px-4 py-2 rounded-md text-sm transition-colors ${
              selectedId === c.id ? 'bg-zinc-900 text-white' : 'hover:bg-zinc-100 text-zinc-600'
            }`}
          >
            {c.name}
          </button>
        ))}
      </div>

      {/* 右侧帖子预览 */}
      <div className="flex-1 space-y-3">
        {posts.length ? posts.map(p => (
          <div 
            key={p.id}
            onClick={() => onPostClick(p.id)}
            className="p-4 border border-zinc-200 rounded-lg hover:border-zinc-400 cursor-pointer transition-all"
          >
            <h4 className="font-bold text-zinc-900 mb-1">{p.title}</h4>
            <p className="text-sm text-zinc-500 line-clamp-2">{p.content}</p>
          </div>
        )) : (
          <p className="text-center py-20 text-zinc-300 text-sm italic">这个收藏夹是空的</p>
        )}
      </div>
    </div>
  );
}