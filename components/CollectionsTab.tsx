import React, { useState, useEffect } from 'react';
import {
  create_collection,
  delete_collection,
  get_collections,
  get_collected_posts,
  toggle_collection,
  rename_collection
} from '../services/storage';
import {
  Loader2, FolderOpen, Plus, Trash2, X,
  BookmarkX, Pencil, Check, ChevronDown, ChevronRight
} from 'lucide-react';
import PostContent from './PostContent';

// 单个收藏夹（含折叠）
function CollectionItem({
  collection,
  onDelete,
  onRename,
  onPostClick,
}: {
  collection: any;
  onDelete: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onPostClick: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [posts, setPosts] = useState<any[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [postsLoaded, setPostsLoaded] = useState(false);

  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(collection.name);
  const [renaming, setRenaming] = useState(false);

  const handleToggle = async () => {
    const next = !open;
    setOpen(next);
    if (next && !postsLoaded) {
      setPostsLoading(true);
      const data = await get_collected_posts(collection.id);
      setPosts(data as any[]);
      setPostsLoaded(true);
      setPostsLoading(false);
    }
  };

  const handleRenameConfirm = async () => {
    if (!renameValue.trim() || renameValue === collection.name) {
      setIsRenaming(false);
      return;
    }
    setRenaming(true);
    try {
      await rename_collection(collection.id, renameValue.trim());
      onRename(collection.id, renameValue.trim());
      setIsRenaming(false);
    } catch { alert('重命名失败'); }
    finally { setRenaming(false); }
  };

  const handleRemovePost = async (postId: string) => {
    if (!confirm('取消收藏这篇帖子吗？')) return;
    try {
      await toggle_collection(collection.id, postId);
      setPosts(prev => prev.filter((p: any) => p.id !== postId));
    } catch { alert('取消收藏失败'); }
  };

  return (
    <div className="border border-zinc-200 rounded-2xl overflow-hidden">
      {/* 收藏夹标题行 */}
      <div className="flex items-center gap-2 px-4 py-3.5 bg-white">
        {/* 展开箭头 */}
        <button
          onClick={handleToggle}
          className="text-zinc-400 flex-shrink-0"
        >
          {open
            ? <ChevronDown className="w-5 h-5" />
            : <ChevronRight className="w-5 h-5" />}
        </button>

        {isRenaming ? (
          /* 重命名输入框 */
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <input
              autoFocus
              value={renameValue}
              onChange={e => setRenameValue(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleRenameConfirm(); if (e.key === 'Escape') setIsRenaming(false); }}
              className="flex-1 min-w-0 text-base font-medium outline-none border-b-2 border-black bg-transparent py-0.5"
            />
            <button
              onClick={handleRenameConfirm}
              disabled={renaming}
              className="w-9 h-9 flex items-center justify-center rounded-full bg-green-500 text-white active:bg-green-600 flex-shrink-0"
            >
              {renaming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-5 h-5" />}
            </button>
            <button
              onClick={() => { setIsRenaming(false); setRenameValue(collection.name); }}
              className="w-9 h-9 flex items-center justify-center rounded-full bg-zinc-100 text-zinc-500 active:bg-zinc-200 flex-shrink-0"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        ) : (
          /* 正常展示 */
          <>
            <span
              className="flex-1 text-base font-semibold text-zinc-900 cursor-pointer truncate"
              onClick={handleToggle}
            >
              {collection.name}
            </span>
            {/* 重命名按钮 */}
            <button
              onClick={() => { setIsRenaming(true); setRenameValue(collection.name); }}
              className="w-9 h-9 flex items-center justify-center rounded-full text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 active:bg-zinc-200 flex-shrink-0"
              title="重命名"
            >
              <Pencil className="w-4 h-4" />
            </button>
            {/* 删除按钮 */}
            <button
              onClick={() => onDelete(collection.id)}
              className="w-9 h-9 flex items-center justify-center rounded-full text-zinc-400 hover:text-red-500 hover:bg-red-50 active:bg-red-100 flex-shrink-0"
              title="删除收藏夹"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </>
        )}
      </div>

      {/* 折叠内容 */}
      {open && (
        <div className="border-t border-zinc-100 bg-zinc-50">
          {postsLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-zinc-300" />
            </div>
          ) : posts.length === 0 ? (
            <p className="text-center py-8 text-zinc-300 text-sm italic">这个收藏夹是空的</p>
          ) : (
            <div className="divide-y divide-zinc-100">
              {posts.map((p: any) => (
                <div key={p.id} className="flex items-start gap-3 px-4 py-3.5 bg-white hover:bg-zinc-50 transition-colors">
                  <div
                    className="flex-1 min-w-0 cursor-pointer"
                    onClick={() => onPostClick(p.id)}
                  >
                    <h4 className="font-semibold text-zinc-900 text-base line-clamp-1 mb-0.5">{p.title}</h4>
                    <div className="text-sm text-zinc-400 line-clamp-1">
                      <PostContent content={p.content} />
                    </div>
                  </div>
                  <button
                    onClick={() => handleRemovePost(p.id)}
                    className="w-10 h-10 flex items-center justify-center rounded-xl text-zinc-300 hover:text-red-500 hover:bg-red-50 active:bg-red-100 transition-colors flex-shrink-0"
                    title="取消收藏"
                  >
                    <BookmarkX className="w-5 h-5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// 主组件
export function CollectionsTab({
  userId,
  onPostClick
}: {
  userId: string,
  onPostClick: (id: string) => void
}) {
  const [collections, setCollections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [showCreateInput, setShowCreateInput] = useState(false);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      const data = await get_collections(userId);
      setCollections(data);
      setLoading(false);
    };
    fetch();
  }, [userId]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const created = await create_collection(userId, newName.trim());
      setCollections(prev => [created, ...prev]);
      setNewName('');
      setShowCreateInput(false);
    } catch { alert('创建失败'); }
    finally { setCreating(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定删除这个收藏夹吗？')) return;
    try {
      await delete_collection(id);
      setCollections(prev => prev.filter(c => c.id !== id));
    } catch { alert('删除失败'); }
  };

  const handleRename = (id: string, name: string) => {
    setCollections(prev => prev.map(c => c.id === id ? { ...c, name } : c));
  };

  if (loading) return (
    <div className="flex justify-center py-12">
      <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
    </div>
  );

  return (
    <div className="flex flex-col gap-3">

      {/* 新建收藏夹 */}
      {showCreateInput ? (
        <div className="flex items-center gap-2 px-4 py-3 border-2 border-dashed border-zinc-300 rounded-2xl">
          <input
            autoFocus
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') { setShowCreateInput(false); setNewName(''); } }}
            placeholder="输入收藏夹名称"
            className="flex-1 text-base bg-transparent outline-none placeholder-zinc-300"
          />
          <button
            onClick={handleCreate}
            disabled={creating || !newName.trim()}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-black text-white disabled:opacity-40 active:bg-zinc-700 flex-shrink-0"
          >
            {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-5 h-5" />}
          </button>
          <button
            onClick={() => { setShowCreateInput(false); setNewName(''); }}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-zinc-100 text-zinc-500 active:bg-zinc-200 flex-shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      ) : (
        <button
          onClick={() => setShowCreateInput(true)}
          className="flex items-center gap-2 px-4 py-3 border border-dashed border-zinc-300 rounded-2xl text-zinc-500 text-base hover:border-zinc-500 hover:text-zinc-700 active:bg-zinc-50 transition-colors"
        >
          <Plus className="w-5 h-5" /> 新建收藏夹
        </button>
      )}

      {/* 收藏夹列表 */}
      {collections.length === 0 ? (
        <div className="text-center py-16 text-zinc-400">
          <FolderOpen className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p className="text-sm">还没有收藏夹</p>
        </div>
      ) : (
        collections.map(c => (
          <CollectionItem
            key={c.id}
            collection={c}
            onDelete={handleDelete}
            onRename={handleRename}
            onPostClick={onPostClick}
          />
        ))
      )}
    </div>
  );
}
