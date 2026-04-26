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

  const [showCreateInput, setShowCreateInput] = useState(false);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);

  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [renaming, setRenaming] = useState(false);

  // 点击任意位置关闭菜单（不用 ref，直接监听 document）
  useEffect(() => {
    if (!menuOpenId) return;
    const handler = (e: MouseEvent) => {
      // 如果点击的元素带有 data-menu 属性，说明是菜单内部，不关闭
      const target = e.target as HTMLElement;
      if (!target.closest('[data-menu]')) {
        setMenuOpenId(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpenId]);

  const fetchCollections = async () => {
    setLoading(true);
    const data = await get_collections(userId);
    setCollections(data);
    if (data.length) setSelectedId(prev => prev ?? data[0].id);
    setLoading(false);
  };

  useEffect(() => { fetchCollections(); }, [userId]);

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

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const created = await create_collection(userId, newName.trim());
      setCollections(prev => [created, ...prev]);
      setSelectedId(created.id);
      setNewName('');
      setShowCreateInput(false);
    } catch { alert('创建失败'); }
    finally { setCreating(false); }
  };

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
    } catch { alert('删除失败'); }
  };

  const startRename = (c: any) => {
    setMenuOpenId(null);
    setRenamingId(c.id);
    setRenameValue(c.name);
  };

  const handleRename = async () => {
    if (!renamingId || !renameValue.trim()) { setRenamingId(null); return; }
    setRenaming(true);
    try {
      await rename_collection(renamingId, renameValue.trim());
      setCollections(prev => prev.map(c => c.id === renamingId ? { ...c, name: renameValue.trim() } : c));
      setRenamingId(null);
    } catch { alert('重命名失败'); }
    finally { setRenaming(false); }
  };

  const handleRemovePost = async (postId: string) => {
    if (!selectedId) return;
    if (!confirm('取消收藏这篇帖子吗？')) return;
    try {
      await toggle_collection(selectedId, postId);
      setPosts(prev => prev.filter((p: any) => p.id !== postId));
    } catch { alert('取消收藏失败'); }
  };

  if (loading) return (
    <div className="flex justify-center py-12">
      <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
    </div>
  );

  return (
    <div className="flex flex-col gap-4">

      {/* 顶部横向标签栏 */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>

        {collections.map(c => (
          <div key={c.id} className="relative flex-shrink-0">
            {renamingId === c.id ? (
              <div className="flex items-center gap-1.5 px-3 py-2 border-2 border-black rounded-full bg-white">
                <input
                  autoFocus
                  value={renameValue}
                  onChange={e => setRenameValue(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleRename(); if (e.key === 'Escape') setRenamingId(null); }}
                  className="text-sm bg-transparent outline-none w-24"
                />
                <button
                  onClick={handleRename}
                  disabled={renaming}
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-green-500 text-white active:bg-green-600 flex-shrink-0"
                >
                  {renaming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => setRenamingId(null)}
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-zinc-200 text-zinc-600 active:bg-zinc-300 flex-shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div
                className={`flex items-center gap-0.5 pl-4 pr-1.5 py-2 rounded-full text-sm font-medium cursor-pointer transition-colors whitespace-nowrap select-none ${
                  selectedId === c.id
                    ? 'bg-zinc-900 text-white'
                    : 'bg-zinc-100 text-zinc-600 active:bg-zinc-200'
                }`}
              >
                <span onClick={() => setSelectedId(c.id)} className="pr-1">{c.name}</span>

                {/* ⋯ 按钮，用 data-menu 标记 */}
                <button
                  data-menu="trigger"
                  onClick={e => {
                    e.stopPropagation();
                    setMenuOpenId(menuOpenId === c.id ? null : c.id);
                  }}
                  className={`w-7 h-7 flex items-center justify-center rounded-full transition-colors flex-shrink-0 ${
                    selectedId === c.id
                      ? 'hover:bg-zinc-700 active:bg-zinc-600'
                      : 'hover:bg-zinc-200 active:bg-zinc-300'
                  }`}
                >
                  <MoreHorizontal className="w-4 h-4" />
                </button>

                {/* 下拉菜单 */}
                {menuOpenId === c.id && (
                  <div
                    data-menu="panel"
                    className="absolute left-0 top-full mt-2 z-50 bg-white border border-zinc-200 rounded-2xl shadow-xl py-1.5 w-36 overflow-hidden"
                  >
                    <button
                      data-menu="item"
                      onClick={e => { e.stopPropagation(); startRename(c); }}
                      className="w-full flex items-center gap-2.5 px-4 py-3 text-sm text-zinc-700 hover:bg-zinc-50 active:bg-zinc-100"
                    >
                      <Pencil className="w-4 h-4" /> 重命名
                    </button>
                    <div className="h-px bg-zinc-100 mx-2" />
                    <button
                      data-menu="item"
                      onClick={e => { e.stopPropagation(); handleDelete(c.id); }}
                      className="w-full flex items-center gap-2.5 px-4 py-3 text-sm text-red-500 hover:bg-red-50 active:bg-red-100"
                    >
                      <Trash2 className="w-4 h-4" /> 删除
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        {/* 新建按钮 */}
        {showCreateInput ? (
          <div className="flex items-center gap-1.5 px-3 py-2 border-2 border-dashed border-zinc-300 rounded-full flex-shrink-0">
            <input
              autoFocus
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') { setShowCreateInput(false); setNewName(''); } }}
              placeholder="收藏夹名称"
              className="text-sm bg-transparent outline-none w-24 placeholder-zinc-400"
            />
            <button
              onClick={handleCreate}
              disabled={creating || !newName.trim()}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-black text-white disabled:opacity-40 active:bg-zinc-700 flex-shrink-0"
            >
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            </button>
            <button
              onClick={() => { setShowCreateInput(false); setNewName(''); }}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-zinc-200 text-zinc-600 active:bg-zinc-300 flex-shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowCreateInput(true)}
            className="flex items-center gap-1 px-4 py-2 rounded-full text-sm text-zinc-500 bg-zinc-100 hover:bg-zinc-200 active:bg-zinc-300 transition-colors flex-shrink-0 whitespace-nowrap"
          >
            <Plus className="w-4 h-4" /> 新建
          </button>
        )}
      </div>

      {/* 帖子列表 */}
      {collections.length === 0 ? (
        <div className="text-center py-16 text-zinc-400">
          <FolderOpen className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p className="text-sm">还没有收藏夹，点击上方新建一个吧</p>
        </div>
      ) : postsLoading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="w-5 h-5 animate-spin text-zinc-300" />
        </div>
      ) : posts.length === 0 ? (
        <p className="text-center py-16 text-zinc-300 text-sm italic">这个收藏夹是空的</p>
      ) : (
        <div className="space-y-2">
          {posts.map((p: any) => (
            <div
              key={p.id}
              className="flex items-start gap-3 p-4 border border-zinc-200 rounded-xl hover:border-zinc-300 transition-all"
            >
              <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onPostClick(p.id)}>
                {/* 标题字体调大 */}
                <h4 className="font-bold text-zinc-900 mb-1 text-base line-clamp-1">{p.title}</h4>
                <div className="text-sm text-zinc-400 line-clamp-2">
                  <PostContent content={p.content} />
                </div>
              </div>
              <button
                onClick={() => handleRemovePost(p.id)}
                className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-xl text-zinc-300 hover:text-red-500 hover:bg-red-50 active:bg-red-100 transition-colors"
                title="取消收藏"
              >
                <BookmarkX className="w-5 h-5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
