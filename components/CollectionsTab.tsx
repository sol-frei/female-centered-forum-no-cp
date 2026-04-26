import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { 
  create_collection, 
  delete_collection, 
  get_collections,
  get_collected_posts,
  toggle_collection
} from '../services/storage';
import { Loader2, FolderOpen, Plus, Trash2, X, BookmarkX } from 'lucide-react';
import PostContent from './PostContent';

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
  const [postsLoading, setPostsLoading] = useState(false);

  // 创建收藏夹
  const [showCreateInput, setShowCreateInput] = useState(false);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);

  // 加载所有收藏夹
  const fetchCollections = async () => {
    setLoading(true);
    const data = await get_collections(userId);
    setCollections(data);
    if (data.length) setSelectedId(prev => prev ?? data[0].id);
    setLoading(false);
  };

  useEffect(() => {
    fetchCollections();
  }, [userId]);

  // 加载选中收藏夹内的帖子
  useEffect(() => {
    if (!selectedId) return;
    const fetchPosts = async () => {
      setPostsLoading(true);
      const data = await get_collected_posts(selectedId);
      setPosts(data as any[]);
      setPostsLoading(false);
    };
    fetchPosts();
  }, [selectedId]);

  // 创建收藏夹
  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const created = await create_collection(userId, newName.trim());
      setCollections(prev => [created, ...prev]);
      setSelectedId(created.id);
      setNewName('');
      setShowCreateInput(false);
    } catch (e) {
      alert('创建失败');
    } finally {
      setCreating(false);
    }
  };

  // 删除收藏夹
  const handleDeleteCollection = async (collectionId: string) => {
    if (!confirm('确定删除这个收藏夹吗？其中的收藏记录也会一并清除。')) return;
    try {
      await delete_collection(collectionId);
      const remaining = collections.filter(c => c.id !== collectionId);
      setCollections(remaining);
      if (selectedId === collectionId) {
        setSelectedId(remaining[0]?.id ?? null);
        setPosts([]);
      }
    } catch (e) {
      alert('删除失败');
    }
  };

  // 取消收藏帖子
  const handleRemovePost = async (postId: string) => {
    if (!selectedId) return;
    try {
      await toggle_collection(selectedId, postId);
      setPosts(prev => prev.filter((p: any) => p.id !== postId));
    } catch (e) {
      alert('取消收藏失败');
    }
  };

  if (loading) return (
    <div className="flex justify-center py-12">
      <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      {/* 顶部：创建收藏夹 */}
      <div className="flex items-center gap-2">
        {showCreateInput ? (
          <>
            <input
              autoFocus
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
              placeholder="收藏夹名称"
              className="flex-1 px-3 py-1.5 border border-zinc-300 rounded-lg text-sm outline-none focus:border-black transition-colors"
            />
            <button
              onClick={handleCreate}
              disabled={creating || !newName.trim()}
              className="px-3 py-1.5 bg-black text-white text-sm rounded-lg disabled:opacity-40 hover:bg-zinc-800 transition-colors"
            >
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : '创建'}
            </button>
            <button
              onClick={() => { setShowCreateInput(false); setNewName(''); }}
              className="p-1.5 text-zinc-400 hover:text-black"
            >
              <X className="w-4 h-4" />
            </button>
          </>
        ) : (
          <button
            onClick={() => setShowCreateInput(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-dashed border-zinc-300 text-zinc-500 text-sm rounded-lg hover:border-black hover:text-black transition-colors"
          >
            <Plus className="w-4 h-4" />
            新建收藏夹
          </button>
        )}
      </div>

      {collections.length === 0 ? (
        <div className="text-center py-16 text-zinc-400">
          <FolderOpen className="w-12 h-12 mx-auto mb-2 opacity-20" />
          <p className="text-sm">还没有收藏夹</p>
        </div>
      ) : (
        <div className="flex flex-col md:flex-row gap-4">
          {/* 左侧收藏夹列表 */}
          <div className="w-full md:w-48 space-y-1 flex-shrink-0">
            {collections.map(c => (
              <div
                key={c.id}
                className={`group flex items-center justify-between px-3 py-2 rounded-lg text-sm cursor-pointer transition-colors ${
                  selectedId === c.id
                    ? 'bg-zinc-900 text-white'
                    : 'hover:bg-zinc-100 text-zinc-600'
                }`}
                onClick={() => setSelectedId(c.id)}
              >
                <span className="truncate flex-1">{c.name}</span>
                <button
                  onClick={e => { e.stopPropagation(); handleDeleteCollection(c.id); }}
                  className={`ml-1 p-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity ${
                    selectedId === c.id
                      ? 'hover:bg-zinc-700 text-zinc-300'
                      : 'hover:bg-zinc-200 text-zinc-400'
                  }`}
                  title="删除收藏夹"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>

          {/* 右侧帖子列表 */}
          <div className="flex-1 space-y-2 min-w-0">
            {postsLoading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="w-5 h-5 animate-spin text-zinc-300" />
              </div>
            ) : posts.length === 0 ? (
              <p className="text-center py-16 text-zinc-300 text-sm italic">这个收藏夹是空的</p>
            ) : (
              posts.map((p: any) => (
                <div
                  key={p.id}
                  className="group relative p-4 border border-zinc-200 rounded-xl hover:border-zinc-400 cursor-pointer transition-all"
                  onClick={() => onPostClick(p.id)}
                >
                  <h4 className="font-bold text-zinc-900 mb-1 pr-8 text-sm line-clamp-1">{p.title}</h4>
                  <div className="text-xs text-zinc-400 line-clamp-2">
                    <PostContent content={p.content} />
                  </div>
                  {/* 取消收藏按钮 */}
                  <button
                    onClick={e => { e.stopPropagation(); handleRemovePost(p.id); }}
                    className="absolute top-3 right-3 p-1 rounded opacity-0 group-hover:opacity-100 text-zinc-300 hover:text-red-500 hover:bg-red-50 transition-all"
                    title="取消收藏"
                  >
                    <BookmarkX className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
