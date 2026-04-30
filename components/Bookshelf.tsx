import React, { useState, useEffect, useMemo } from 'react';
import { ArrowLeft, Search, SlidersHorizontal, X, Check, Book as BookIcon } from 'lucide-react';
import { get_all_book_ratings } from '../services/storage';
import { BookRating } from '../types';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface BookshelfProps {
  onNavigateBack: () => void;
  onBookDetailClick: (book: BookRating) => void;
  showToast: (msg: string, type: ToastType) => void;
  cachedBooks?: BookRating[] | null;
  onBooksLoaded?: (books: BookRating[]) => void;
}

const BOOK_CATEGORIES = [
  '热血竞技', '西幻史诗', '姼想奇幻', '科幻未来', '恐怖灵异', '无限快穿',
  '性别战争', '年代重制', '悬疑推理', '东方架空', '校园青春', '职场商战',
  '武侠仙侠', '其他',
];

const STATUS_OPTIONS = [
  { key: 'all', label: '全部状态' },
  { key: 'finished', label: '已完结' },
  { key: 'ongoing', label: '连载中' },
  { key: 'hiatus', label: '已断更' },
];

const EVAL_OPTIONS = [
  { key: 'all', label: '全部评价' },
  { key: 'recommend', label: '推荐' },
  { key: 'warn', label: '排雷' },
];

const LoadingSpinner = () => (
  <div className="py-20 flex items-center justify-center bg-white">
    <div className="w-6 h-6 border-2 border-zinc-200 border-t-zinc-800 rounded-full animate-spin"></div>
  </div>
);

export default function Bookshelf({
  onNavigateBack,
  onBookDetailClick,
  showToast,
  cachedBooks,
  onBooksLoaded,
}: BookshelfProps) {
  const [books, setBooks] = useState<BookRating[]>([]);
  const [isLoading, setIsLoading] = useState(!cachedBooks);
  const [searchQuery, setSearchQuery] = useState('');
  
  // 筛选状态
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filterConfig, setFilterConfig] = useState({
    category: 'all',
    status: 'all',
    eval: 'all'
  });

  useEffect(() => {
    if (cachedBooks) {
      setBooks(cachedBooks);
      return;
    }
    loadBooks();
  }, []);

  const loadBooks = async () => {
    setIsLoading(true);
    try {
      const data = await get_all_book_ratings({ sortBy: 'highest' });
      setBooks(data);
      onBooksLoaded?.(data);
    } catch (err) {
      showToast('加载书架失败', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // 核心筛选逻辑
  const filteredBooks = useMemo(() => {
    return books
      .filter(book => {
        const q = searchQuery.toLowerCase();
        const matchesSearch = !searchQuery || 
          book.book_name.toLowerCase().includes(q) || 
          book.book_author.toLowerCase().includes(q);
        
        const matchesCat = filterConfig.category === 'all' || book.book_category === filterConfig.category;
        const matchesStatus = filterConfig.status === 'all' || book.serial_status === filterConfig.status;
        const matchesEval = filterConfig.eval === 'all' || book.recommendation_tag === filterConfig.eval;

        return matchesSearch && matchesCat && matchesStatus && matchesEval;
      })
      .sort((a, b) => b.final_score - a.final_score);
  }, [books, searchQuery, filterConfig]);

  const globalRanked = useMemo(() => [...books].sort((a, b) => b.final_score - a.final_score), [books]);

  const hasActiveFilters = filterConfig.category !== 'all' || filterConfig.status !== 'all' || filterConfig.eval !== 'all';

  if (isLoading) return <LoadingSpinner />;

  return (
    <div className="min-h-screen bg-white text-zinc-900 select-none font-sans">
      {/* ── 顶栏 ── */}
      <div className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-zinc-100">
        <div className="max-w-2xl mx-auto px-4">
          <div className="h-14 flex items-center justify-between">
            <button onClick={onNavigateBack} className="p-2 -ml-2 text-zinc-500 hover:text-black transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="w-9" /> 
          </div>

          <div className="pb-3 flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="搜索书名或作者..."
                className="w-full bg-zinc-100 border-none rounded-xl py-2 pl-10 pr-4 text-sm focus:ring-2 focus:ring-zinc-200 transition-all placeholder:text-zinc-400"
              />
            </div>
            <button 
              onClick={() => setIsFilterOpen(true)}
              className={`p-2.5 rounded-xl border transition-all relative ${
                hasActiveFilters 
                ? 'bg-zinc-900 border-zinc-900 text-white' 
                : 'bg-white border-zinc-200 text-zinc-600 active:bg-zinc-50'
              }`}
            >
              <SlidersHorizontal className="w-5 h-5" />
              {hasActiveFilters && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 border-2 border-white rounded-full"></span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ── 列表区域 ── */}
      <div className="max-w-2xl mx-auto px-4 py-2">
        <div className="flex justify-between items-center py-4 text-[11px] font-bold text-zinc-400 uppercase tracking-widest">
          <span>{filteredBooks.length} 本</span>
          {hasActiveFilters && (
            <button 
              onClick={() => setFilterConfig({ category: 'all', status: 'all', eval: 'all' })}
              className="text-zinc-900 hover:underline"
            >
              重置重选
            </button>
          )}
        </div>

        {filteredBooks.length === 0 ? (
          <div className="py-20 text-center text-zinc-400 text-sm">没找到相关的书籍</div>
        ) : (
          <div className="divide-y divide-zinc-50">
            {filteredBooks.map((book) => {
              const rank = globalRanked.findIndex(b => b.id === book.id) + 1;
              return (
                <div
                  key={book.id}
                  onClick={() => onBookDetailClick(book)}
                  className="flex items-center gap-4 py-5 cursor-pointer active:opacity-60 transition-opacity"
                >
                  {/* 修改1：排名序号全部改为黑色 (text-zinc-900) */}
                  <div className="w-6 text-center text-sm font-black text-zinc-900">
                    {rank}
                  </div>
                  
                  <div className="w-12 h-16 bg-zinc-100 rounded-md shadow-[0_2px_8px_rgba(0,0,0,0.05)] overflow-hidden flex-shrink-0 border border-zinc-100">
                    {book.cover_url ? (
                      <img src={book.cover_url} className="w-full h-full object-cover" alt="" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center opacity-20"><BookIcon size={18} /></div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-zinc-900 text-base leading-tight truncate">
                      {book.book_name}
                    </h3>
                    <p className="text-zinc-500 text-xs mt-1 font-medium">{book.book_author}</p>
                    
                    {/* 修改2：删除了标签展示区域 (Tag section removed) */}
                  </div>

                  <div className="text-right">
                    <div className="text-xl font-black italic tracking-tighter text-zinc-900">
                      {book.final_score.toFixed(1)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── 筛选抽屉面板 ── */}
      {isFilterOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity" onClick={() => setIsFilterOpen(false)} />
          <div className="relative bg-white rounded-t-[32px] max-h-[85vh] flex flex-col shadow-2xl animate-in slide-in-from-bottom duration-300">
            
            <div className="flex items-center justify-between px-6 py-5 border-b border-zinc-50">
              <h2 className="font-black text-xl">筛选条件</h2>
              <button onClick={() => setIsFilterOpen(false)} className="p-2 bg-zinc-100 rounded-full text-zinc-500 active:scale-90 transition-transform">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-8 pb-10">
              <section>
                <h3 className="text-[11px] font-black text-zinc-400 mb-4 tracking-widest uppercase">推荐指数</h3>
                <div className="flex flex-wrap gap-2">
                  {EVAL_OPTIONS.map(opt => (
                    <FilterButton 
                      key={opt.key}
                      label={opt.label}
                      active={filterConfig.eval === opt.key}
                      onClick={() => setFilterConfig(prev => ({ ...prev, eval: opt.key }))}
                    />
                  ))}
                </div>
              </section>

              <section>
                <h3 className="text-[11px] font-black text-zinc-400 mb-4 tracking-widest uppercase">创作状态</h3>
                <div className="flex flex-wrap gap-2">
                  {STATUS_OPTIONS.map(opt => (
                    <FilterButton 
                      key={opt.key}
                      label={opt.label}
                      active={filterConfig.status === opt.key}
                      onClick={() => setFilterConfig(prev => ({ ...prev, status: opt.key }))}
                    />
                  ))}
                </div>
              </section>

              <section>
                <h3 className="text-[11px] font-black text-zinc-400 mb-4 tracking-widest uppercase">频道类别</h3>
                <div className="grid grid-cols-3 gap-2">
                  <FilterButton 
                    label="全部类别"
                    active={filterConfig.category === 'all'}
                    onClick={() => setFilterConfig(prev => ({ ...prev, category: 'all' }))}
                  />
                  {BOOK_CATEGORIES.map(cat => (
                    <FilterButton 
                      key={cat}
                      label={cat}
                      active={filterConfig.category === cat}
                      onClick={() => setFilterConfig(prev => ({ ...prev, category: cat }))}
                    />
                  ))}
                </div>
              </section>
            </div>

            <div className="p-6 border-t border-zinc-50 bg-white/80 backdrop-blur-md">
              <button 
                onClick={() => setIsFilterOpen(false)}
                className="w-full bg-zinc-900 text-white py-4 rounded-2xl font-bold text-[15px] active:scale-[0.98] transition-all shadow-xl shadow-zinc-200"
              >
                确认并查看 ({filteredBooks.length})
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FilterButton({ label, active, onClick }: { label: string, active: boolean, onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-1.5 ${
        active 
        ? 'bg-zinc-900 text-white shadow-md' 
        : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200 active:scale-95'
      }`}
    >
      {active && <Check className="w-3.5 h-3.5" />}
      {label}
    </button>
  );
}
