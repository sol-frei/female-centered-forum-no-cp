import React, { useState, useEffect, useRef } from 'react';
import { 
  create_collection, 
  delete_collection, 
  get_collections,
  get_collected_posts,
  toggle_collection,
  rename_collection
} from '../services/storage';
import { Loader2, FolderOpen, Plus, Trash2, X, BookmarkX, MoreHorizontal, Pencil, Check } from 'lucide-react';
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

  // 收藏夹菜单（移动端友好）
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // 重命名
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [renaming, setRenaming] = useState(false);

  // 点击外部关闭菜单
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpenId(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // 加载收藏夹
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

  // 加载帖子
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

  // 创建
  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const created = await create_collection(userId, newName.trim());
      setCollections(prev => [created, ...prev]);
      setSelectedId(created.id);
      setNewName('');
      setShowCreateInput(false);
    } catch {
      alert('创建失败');
    } finally {
      setCreating(false);
    }
  };

  // 删除
  const handleDelete = async (collectionId: string) => {
    setMenuOpenId(null);
    if (!confirm('确定删除这个收藏夹吗？')) return;
    try {
      await delete_collection(collectionId);
      const remaining = collections.filter(c => c.id !== collectionId);
      setCollections(remaining);
      if (selectedId === collectionId) {
        setSelectedId(remaining[0]?.id ?? null);
        setPosts([]);
      }
    } catch {
      alert('删除失败');
    }
  };

  // 开始重命名
  const startRename = (c: any) => {
    setMenuOpenId(null);
    setRenamingId(c.id);
    setRenameValue(c.name);
  };

  // 确认重命名
  const handleRename = async () => {
    if (!renamingId || !renameValue.trim()) { setRenamingId(null); return; }
    setRenaming(true);
    try {
      await rename_collection(renamingId, renameValue.trim());
      setCollections(prev => prev.map(c => c.id === renamingId ? { ...c, name: renameValue.trim() } : c));
      setRenamingId(null);
    } catch {
      alert('重命名失败');
    } finally {
      setRenaming(false);
    }
  };

  // 取消收藏帖子
  const handleRemovePost = async (postId: string) => {
    if (!selectedId) return;
    if (!confirm('取消收藏这篇帖子吗？')) return;
    try {
      await toggle_collection(selectedId, postId);
      setPosts(prev => prev.filter((p: any) => p.id !== postId));
    } catch {
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

      {/* 新建收藏夹 */}
      <div className="flex items-center gap-2">
        {showCreateInput ? (
          <>
            <input
              autoFocus
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') { setShowCreateInput(false); setNewName(''); } }}
              placeholder="收藏夹名称"
              className="flex-1 px-3 py-2 border border-zinc-300 rounded-lg text-sm outline-none focus:border-black transition-colors"
            />
            <button
              onClick={handleCreate}
              disabled={creating || !newName.trim()}
              className="px-3 py-2 bg-black text-white text-sm rounded-lg disabled:opacity-40"
            >
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : '创建'}
            </button>
            <button onClick={() => { setShowCreateInput(false); setNewName(''); }} className="p-2 text-zinc-400">
              <X className="w-4 h-4" />
            </button>
          </>
        ) : (
          <button
            onClick={() => setShowCreateInput(true)}
            className="flex items-center gap-1.5 px-3 py-2 border border-dashed border-zinc-300 text-zinc-500 text-sm rounded-lg hover:border-black hover:text-black transition-colors"
          >
            <Plus className="w-4 h-4" />
            新建收藏夹
          </button>
        )}
      </div>

      {collections.length === 0 ? (
        <div className="text-center py-16 text-zinc-400">
          <FolderOpen className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p className="text-sm">还没有收藏夹，点击上方新建一个吧</p>
        </div>
      ) : (
        <div className="flex flex-col md:flex-row gap-4">

          {/* 左侧：收藏夹列表 */}
          <div className="w-full md:w-52 flex-shrink-0 space-y-1" ref={menuRef}>
            {collections.map(c => (
              <div key={c.id}>
                {renamingId === c.id ? (
                  /* 重命名输入框 */
                  <div className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-zinc-50 border border-zinc-300">
                    <input
                      autoFocus
                      value={renameValue}
                      onChange={e => setRenameValue(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleRename(); if (e.key === 'Escape') setRenamingId(null); }}
                      className="flex-1 text-sm bg-transparent outline-none min-w-0"
                    />
                    <button onClick={handleRename} disabled={renaming} className="text-green-600 flex-shrink-0">
                      {renaming ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                    </button>
                    <button onClick={() => setRenamingId(null)} className="text-zinc-400 flex-shrink-0">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  /* 正常收藏夹行 */
                  <div
                    className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-sm cursor-pointer transition-colors ${
                      selectedId === c.id ? 'bg-zinc-900 text-white' : 'hover:bg-zinc-100 text-zinc-700'
                    }`}
                    onClick={() => setSelectedId(c.id)}
                  >
                    <span className="truncate flex-1 mr-1">{c.name}</span>

                    {/* ⋯ 菜单按钮（常驻显示，手机可点） */}
                    <div className="relative flex-shrink-0">
                      <button
                        onClick={e => { e.stopPropagation(); setMenuOpenId(menuOpenId === c.id ? null : c.id); }}
                        className={`p-1 rounded transition-colors ${
                          selectedId === c.id ? 'hover:bg-zinc-700 text-zinc-300' : 'hover:bg-zinc-200 text-zinc-400'
                        }`}
                      >
                        <MoreHorizontal className="w-4 h-4" />
                      </button>

                      {/* 下拉菜单 */}
                      {menuOpenId === c.id && (
                        <div className="absolute right-0 top-full mt-1 z-50 bg-white border border-zinc-200 rounded-xl shadow-lg py-1 w-32">
                          <button
                            onClick={e => { e.stopPropagation(); startRename(c); }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
                          >
                            <Pencil className="w-3.5 h-3.5" /> 重命名
                          </button>
                          <button
                            onClick={e => { e.stopPropagation(); handleDelete(c.id); }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-500 hover:bg-red-50"
                          >
                            <Trash2 className="w-3.5 h-3.5" /> 删除
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* 右侧：帖子列表 */}
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
                  className="flex items-start gap-3 p-4 border border-zinc-200 rounded-xl hover:border-zinc-300 transition-all"
                >
                  {/* 帖子内容（可点击） */}
                  <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onPostClick(p.id)}>
                    <h4 className="font-bold text-zinc-900 mb-1 text-sm line-clamp-1">{p.title}</h4>
                    <div className="text-xs text-zinc-400 line-clamp-2">
                      <PostContent content={p.content} />
                    </div>
                  </div>
                  {/* 取消收藏按钮（常驻显示，手机可点） */}
                  <button
                    onClick={() => handleRemovePost(p.id)}
                    className="flex-shrink-0 p-1.5 rounded-lg text-zinc-300 hover:text-red-500 hover:bg-red-50 active:bg-red-100 transition-colors"
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
