import React, { useState, useEffect } from 'react';
import { ArrowLeft, Search, ChevronRight } from 'lucide-react';
import { get_all_book_ratings } from '../services/storage';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface BookshelfProps {
  onNavigateBack: () => void;
  onBookClick: (postId: string) => void;
  showToast: (msg: string, type: ToastType) => void;
}

const LoadingSpinner = () => (
  <div className="py-20 flex items-center justify-center bg-white">
    <div className="w-6 h-6 border-2 border-zinc-200 border-t-zinc-800 rounded-full animate-spin"></div>
  </div>
);

const BOOK_CATEGORIES = [
  '全部', '推荐', '排雷', '完结', '连载中', '断更', 
  '恐怖灵异', '科幻未来', '年代重制', '热血竞技'
];

export default function Bookshelf({ onNavigateBack, onBookClick, showToast }: BookshelfProps) {
  const [books, setBooks] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('全部');

  useEffect(() => { loadBooks(); }, []);

  const loadBooks = async () => {
    setIsLoading(true);
    try {
      // 这里的 API 保持不变
      const data = await get_all_book_ratings({ sortBy: 'latest' });
      setBooks(data);
    } catch (error) {
      showToast('加载书架失败', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // 模拟图片中的过滤逻辑
  const filteredBooks = books.filter(book => {
    const matchesSearch = searchQuery 
      ? (book.book_name.includes(searchQuery) || book.book_author.includes(searchQuery))
      : true;
    
    if (categoryFilter === '全部') return matchesSearch;
    if (categoryFilter === '推荐') return matchesSearch && book.final_score >= 8;
    if (categoryFilter === '排雷') return matchesSearch && book.final_score < 6;
    // 其他分类过滤...
    return matchesSearch && (book.book_category === categoryFilter || categoryFilter === '全部');
  });

  if (isLoading) return <LoadingSpinner />;

  return (
    <div className="min-h-screen bg-white">
      {/* ── 顶栏 ── */}
      <div className="sticky top-0 bg-white z-10 border-b border-zinc-100">
        <div className="max-w-3xl mx-auto px-4 pt-3 pb-4">
          {/* 状态行 */}
          <div className="flex justify-end items-center mb-4 text-zinc-400 text-xs gap-4">
            <span>共 {filteredBooks.length} 本</span>
            <button className="p-1"><ChevronRight className="w-4 h-4 rotate-90" /></button>
          </div>

          {/* 搜索框 */}
          <div className="relative mb-5">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索书名或作者..."
              className="w-full px-4 py-2.5 rounded-lg text-sm outline-none bg-zinc-50 border border-transparent focus:bg-white focus:border-zinc-200 transition-all"
            />
          </div>

          {/* 胶囊标签栏 */}
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
            {BOOK_CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className="flex-shrink-0 px-4 py-1.5 rounded-full text-sm transition-all"
                style={{
                  backgroundColor: categoryFilter === cat ? '#18181b' : '#f4f4f5',
                  color: categoryFilter === cat ? '#ffffff' : '#71717a'
                }}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── 书籍列表 ── */}
      <div className="max-w-3xl mx-auto">
        {filteredBooks.length === 0 ? (
          <div className="text-center py-20 text-sm text-zinc-400">暂无符合条件的书籍</div>
        ) : (
          <div className="divide-y divide-zinc-50">
            {filteredBooks.map((book, index) => (
              <div
                key={book.id}
                onClick={() => onBookClick(book.post_id)}
                className="flex items-center gap-4 px-4 py-5 hover:bg-zinc-50 active:bg-zinc-100 transition-colors cursor-pointer"
              >
                {/* 序号 */}
                <div className="w-4 text-sm font-medium text-zinc-900">
                  {index + 1}
                </div>

                {/* 封面占位符 */}
                <div 
                  className="flex-shrink-0 w-12 h-16 rounded border flex items-center justify-center bg-zinc-50"
                  style={{ borderColor: '#e4e4e7' }}
                >
                  <div className="w-4 h-5 border-2 border-zinc-200 rounded-sm" />
                </div>

                {/* 中间信息 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 mb-0.5">
                    <h3 className="text-[15px] font-bold text-zinc-900 truncate">
                      {book.book_name}
                    </h3>
                  </div>
                  <p className="text-sm text-zinc-500 mb-2 truncate">
                    {book.book_author}
                  </p>
                  
                  <div className="flex gap-1.5">
                    {/* 推荐/排雷 标签 */}
                    <span 
                      className="px-1.5 py-0.5 rounded text-[10px] font-bold text-white"
                      style={{ backgroundColor: book.final_score >= 8 ? '#18181b' : '#71717a' }}
                    >
                      {book.final_score >= 8 ? '推荐' : (book.final_score < 6 ? '排雷' : '点评')}
                    </span>
                    {/* 连载状态 */}
                    <span 
                      className="px-1.5 py-0.5 rounded text-[10px] bg-zinc-100 text-zinc-500 border border-zinc-200"
                    >
                      {book.book_status || '完结'}
                    </span>
                  </div>
                </div>

                {/* 右侧评分 */}
                <div 
                  className="text-2xl font-bold italic"
                  style={{ color: '#27272a' }}
                >
                  {book.final_score.toFixed(1)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 底部填充 */}
      <div className="h-20" />
      
      {/* 隐藏滚动条样式 */}
      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}
