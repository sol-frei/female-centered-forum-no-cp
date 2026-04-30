import React, { useState, useEffect, useMemo } from 'react';
import { ArrowLeft, Search, SlidersHorizontal, X, Check } from 'lucide-react';
import { get_all_book_ratings } from '../services/storage';
import { BookRating } from '../types';

// ... (LoadingSpinner, BOOK_CATEGORIES, STATUS_LABEL, TAG_LABEL 保持不变)

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
  
  // 筛选状态管理
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [activeChip, setActiveChip] = useState('all');

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
    } catch {
      showToast('加载失败', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const filtered = useMemo(() => {
    return books
      .filter(book => {
        const q = searchQuery.toLowerCase();
        const matchesSearch = !searchQuery || 
          book.book_name.toLowerCase().includes(q) || 
          book.book_author.toLowerCase().includes(q);
        
        const matchesChip = activeChip === 'all' || 
          (activeChip === 'recommend' && book.recommendation_tag === 'recommend') ||
          (activeChip === 'warn' && book.recommendation_tag === 'warn') ||
          (activeChip === 'finished' && book.serial_status === 'finished') ||
          (activeChip === 'ongoing' && book.serial_status === 'ongoing') ||
          (activeChip === 'hiatus' && book.serial_status === 'hiatus') ||
          book.book_category === activeChip;

        return matchesSearch && matchesChip;
      })
      .sort((a, b) => b.final_score - a.final_score);
  }, [books, searchQuery, activeChip]);

  const globalRanked = useMemo(() => [...books].sort((a, b) => b.final_score - a.final_score), [books]);

  if (isLoading) return <LoadingSpinner />;

  return (
    <div className="min-h-screen bg-white text-zinc-900 font-sans">
      {/* ── 顶栏 ── */}
      <div className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-zinc-100">
        <div className="max-w-2xl mx-auto px-4">
          <div className="h-14 flex items-center justify-between">
            <button onClick={onNavigateBack} className="p-2 -ml-2 text-zinc-600 hover:text-black">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-base font-semibold">书架清单</h1>
            <div className="w-9"></div> {/* 占位平衡 */}
          </div>

          {/* 搜索与筛选触发栏 */}
          <div className="pb-3 flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="搜索书名、作者..."
                className="w-full bg-zinc-100 border-none rounded-xl py-2.5 pl-10 pr-4 text-sm focus:ring-2 focus:ring-zinc-200 transition-all"
              />
            </div>
            <button 
              onClick={() => setIsFilterOpen(true)}
              className={`p-2.5 rounded-xl border transition-all ${
                activeChip !== 'all' 
                ? 'bg-zinc-900 border-zinc-900 text-white' 
                : 'bg-white border-zinc-200 text-zinc-600'
              }`}
            >
              <SlidersHorizontal className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* ── 书籍列表 ── */}
      <div className="max-w-2xl mx-auto px-4 py-2">
        <div className="flex justify-between items-center py-4 text-xs font-medium text-zinc-400 uppercase tracking-wider">
          <span>共 {filtered.length} 本藏书</span>
          {activeChip !== 'all' && (
            <span className="text-zinc-900 bg-zinc-100 px-2 py-0.5 rounded">正在筛选: {activeChip}</span>
          )}
        </div>

        {filtered.map((book) => {
          const rank = globalRanked.findIndex(b => b.id === book.id) + 1;
          return (
            <div
              key={book.id}
              onClick={() => onBookDetailClick(book)}
              className="group flex items-center gap-4 py-4 active:bg-zinc-50 transition-colors border-b border-zinc-50 last:border-0"
            >
              <div className={`w-6 text-center text-sm font-bold ${rank <= 3 ? 'text-zinc-900' : 'text-zinc-300'}`}>
                {rank.toString().padStart(2, '0')}
              </div>
              
              <div className="w-12 h-16 bg-zinc-100 rounded shadow-sm overflow-hidden flex-shrink-0">
                {book.cover_url ? (
                  <img src={book.cover_url} className="w-full h-full object-cover" alt="" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center opacity-20"><BookIcon /></div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-zinc-900 text-[15px] truncate group-active:text-zinc-600">
                  {book.book_name}
                </h3>
                <p className="text-zinc-500 text-xs mt-0.5">{book.book_author}</p>
                <div className="flex gap-2 mt-2">
                  {book.recommendation_tag === 'recommend' && (
                    <span className="px-1.5 py-0.5 bg-zinc-900 text-white text-[10px] font-bold rounded">TOP</span>
                  )}
                  <span className="px-1.5 py-0.5 border border-zinc-200 text-zinc-500 text-[10px] rounded">
                    {book.book_category || '其他'}
                  </span>
                </div>
              </div>

              <div className="text-right">
                <div className="text-lg font-black italic text-zinc-900">
                  {book.final_score.toFixed(1)}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── 筛选抽屉 (Overlay) ── */}
      {isFilterOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setIsFilterOpen(false)} />
          <div className="relative bg-white rounded-t-3xl max-h-[85vh] overflow-y-auto animate-in slide-in-from-bottom duration-300">
            <div className="sticky top-0 bg-white px-6 py-4 border-b border-zinc-100 flex justify-between items-center">
              <h2 className="font-bold text-lg">筛选条件</h2>
              <button onClick={() => setIsFilterOpen(false)} className="p-1"><X className="w-6 h-6" /></button>
            </div>
            
            <div className="p-6 space-y-8">
              <section>
                <h3 className="text-xs font-bold text-zinc-400 mb-4 uppercase">推荐状态</h3>
                <div className="flex flex-wrap gap-2">
                  {['all', 'recommend', 'warn'].map(k => (
                    <FilterChip 
                      key={k} 
                      label={k === 'all' ? '全部' : (k === 'recommend' ? '精选推荐' : '避雷警示')} 
                      active={activeChip === k} 
                      onClick={() => setActiveChip(k)} 
                    />
                  ))}
                </div>
              </section>

              <section>
                <h3 className="text-xs font-bold text-zinc-400 mb-4 uppercase">书籍分类</h3>
                <div className="grid grid-cols-3 gap-2">
                  {BOOK_CATEGORIES.map(c => (
                    <FilterChip 
                      key={c} 
                      label={c} 
                      active={activeChip === c} 
                      onClick={() => setActiveChip(c)} 
                    />
                  ))}
                </div>
              </section>
            </div>

            <div className="p-6 pt-0">
              <button 
                onClick={() => setIsFilterOpen(false)}
                className="w-full bg-zinc-900 text-white py-4 rounded-2xl font-bold active:scale-[0.98] transition-transform"
              >
                查看 ({filtered.length}) 本书籍
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// 辅助组件
function FilterChip({ label, active, onClick }: { label: string, active: boolean, onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2 ${
        active 
        ? 'bg-zinc-900 text-white shadow-lg shadow-zinc-200' 
        : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
      }`}
    >
      {active && <Check className="w-3.5 h-3.5" />}
      {label}
    </button>
  );
}
