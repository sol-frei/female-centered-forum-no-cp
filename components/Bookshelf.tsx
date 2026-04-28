import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Search } from 'lucide-react';
import { get_all_book_ratings } from '../services/storage';
import { BookRating } from '../types';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface BookshelfProps {
  onNavigateBack: () => void;
  onBookClick: (postId: string) => void;
  onBookDetailClick: (book: BookRating) => void;
  showToast: (msg: string, type: ToastType) => void;
}

const LoadingSpinner = () => (
  <div className="py-20 flex items-center justify-center bg-white">
    <div className="w-6 h-6 border-2 border-zinc-200 border-t-zinc-800 rounded-full animate-spin"></div>
  </div>
);

const BOOK_CATEGORIES = [
  '热血竞技', '西幻史诗', '姼想奇幻', '科幻未来', '恐怖灵异', '无限快穿',
  '性别战争', '年代重制', '悬疑推理', '东方架空', '校园青春', '职场商战',
  '武侠仙侠', '其他',
];

const STATUS_LABEL: Record<string, string> = {
  finished: '完结',
  ongoing: '连载中',
  hiatus: '断更',
};

const TAG_LABEL: Record<string, string> = {
  recommend: '推荐',
  warn: '排雷',
};

const FILTER_CHIPS = [
  { key: 'all', label: '全部' },
  { key: 'recommend', label: '推荐' },
  { key: 'warn', label: '排雷' },
  { key: 'finished', label: '完结' },
  { key: 'ongoing', label: '连载中' },
  { key: 'hiatus', label: '断更' },
  ...BOOK_CATEGORIES.map(c => ({ key: c, label: c })),
];

function BookIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"
      style={{ width: 18, height: 18, opacity: 0.2 }}>
      <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
    </svg>
  );
}

export default function Bookshelf({
  onNavigateBack,
  onBookClick,
  onBookDetailClick,
  showToast,
}: BookshelfProps) {
  const [books, setBooks] = useState<BookRating[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeChip, setActiveChip] = useState('all');
  const chipsRef = useRef<HTMLDivElement>(null);

  useEffect(() => { loadBooks(); }, []);

  const loadBooks = async () => {
    setIsLoading(true);
    try {
      const data = await get_all_book_ratings({ sortBy: 'highest' });
      setBooks(data);
    } catch {
      showToast('加载书架失败', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const filtered = books
    .filter(book => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return (
        book.book_name.toLowerCase().includes(q) ||
        book.book_author.toLowerCase().includes(q)
      );
    })
    .filter(book => {
      if (activeChip === 'all') return true;
      if (activeChip === 'recommend') return book.recommendation_tag === 'recommend';
      if (activeChip === 'warn') return book.recommendation_tag === 'warn';
      if (activeChip === 'finished') return book.serial_status === 'finished';
      if (activeChip === 'ongoing') return book.serial_status === 'ongoing';
      if (activeChip === 'hiatus') return book.serial_status === 'hiatus';
      return book.book_category === activeChip;
    })
    .sort((a, b) => b.final_score - a.final_score);

  // 全局排名（不受筛选影响）
  const globalRanked = [...books].sort((a, b) => b.final_score - a.final_score);

  if (isLoading) return <LoadingSpinner />;

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#fafafa' }}>

      {/* ── 顶栏 ── */}
      <div className="sticky top-0 z-40 w-full bg-white/80 backdrop-blur-md border-b border-zinc-100">
        <div className="max-w-2xl mx-auto px-4">

          {/* 返回按钮行 */}
          <div className="py-3 flex items-center justify-between">
            <button onClick={onNavigateBack} className="text-zinc-600 hover:text-black font-medium flex items-center gap-2">
              <ArrowLeft className="w-5 h-5" /> <span className="text-base">返回</span>
            </button>
            <span
              className="text-sm px-2.5 py-1 rounded-full"
              style={{ color: '#71717a', backgroundColor: '#f4f4f5' }}
            >
              共 {filtered.length} 本
            </span>
          </div>

          {/* 搜索框 */}
          <div className="relative mb-2.5" style={{ display: 'flex', alignItems: 'center' }}>
            <Search
              className="w-4 h-4"
              style={{
                color: '#a1a1aa',
                position: 'absolute',
                left: 12,
                top: '50%',
                transform: 'translateY(-50%)',
                pointerEvents: 'none',
              }}
            />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="搜索书名或作者…"
              className="w-full outline-none"
              style={{
                fontSize: 15,
                paddingLeft: 36,
                paddingRight: 12,
                paddingTop: 9,
                paddingBottom: 9,
                border: '0.5px solid #e4e4e7',
                borderRadius: 10,
                backgroundColor: '#fafafa',
                color: '#18181b',
              }}
            />
          </div>

          {/* 筛选芯片 */}
          <div
            ref={chipsRef}
            className="flex gap-2 overflow-x-auto pb-2.5"
            style={{ scrollbarWidth: 'none' }}
          >
            {FILTER_CHIPS.map(chip => (
              <button
                key={chip.key}
                onClick={() => setActiveChip(chip.key)}
                className="flex-shrink-0 transition-colors"
                style={{
                  fontSize: 13,
                  padding: '5px 12px',
                  borderRadius: 20,
                  border: '0.5px solid',
                  borderColor: activeChip === chip.key ? '#18181b' : '#e4e4e7',
                  backgroundColor: activeChip === chip.key ? '#18181b' : '#ffffff',
                  color: activeChip === chip.key ? '#ffffff' : '#52525b',
                  whiteSpace: 'nowrap',
                }}
              >
                {chip.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── 书籍列表 ── */}
      <div className="max-w-2xl mx-auto px-4 py-3">
        {filtered.length === 0 ? (
          <div
            className="text-center py-20"
            style={{ fontSize: 15, color: '#a1a1aa' }}
          >
            没有符合条件的书籍
          </div>
        ) : (
          <div>
            {filtered.map(book => {
              const rank = globalRanked.findIndex(b => b.id === book.id) + 1;
              return (
                <div
                  key={book.id}
                  className="flex items-center gap-3 py-3.5 cursor-pointer"
                  style={{ borderBottom: '0.5px solid #f4f4f5' }}
                  onClick={() => onBookDetailClick(book)}
                >
                  {/* 排名 */}
                  <div
                    className="flex-shrink-0 text-center"
                    style={{
                      minWidth: 22,
                      fontSize: 15,
                      fontWeight: rank <= 3 ? 600 : 400,
                      color: '#18181b',
                    }}
                  >
                    {rank}
                  </div>

                  {/* 封面 */}
                  <div
                    className="flex-shrink-0 flex items-center justify-center overflow-hidden"
                    style={{
                      width: 48,
                      height: 66,
                      borderRadius: 4,
                      backgroundColor: '#f4f4f5',
                      border: '0.5px solid #e4e4e7',
                    }}
                  >
                    {book.cover_url
                      ? <img src={book.cover_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <BookIcon />
                    }
                  </div>

                  {/* 信息 */}
                  <div className="flex-1 min-w-0">
                    <div
                      className="font-medium mb-0.5 truncate"
                      style={{ fontSize: 16, color: '#18181b' }}
                    >
                      {book.book_name}
                    </div>
                    <div
                      className="mb-1.5 truncate"
                      style={{ fontSize: 13, color: '#71717a' }}
                    >
                      {book.book_author}
                    </div>
                    <div className="flex gap-1.5 flex-wrap">
                      {book.recommendation_tag && (
                        <span
                          style={{
                            fontSize: 12,
                            padding: '2px 8px',
                            borderRadius: 20,
                            border: '0.5px solid',
                            borderColor: book.recommendation_tag === 'recommend' ? '#18181b' : '#e4e4e7',
                            backgroundColor: book.recommendation_tag === 'recommend' ? '#18181b' : 'transparent',
                            color: book.recommendation_tag === 'recommend' ? '#ffffff' : '#71717a',
                          }}
                        >
                          {TAG_LABEL[book.recommendation_tag]}
                        </span>
                      )}
                      {book.serial_status && (
                        <span
                          style={{
                            fontSize: 12,
                            padding: '2px 8px',
                            borderRadius: 20,
                            border: '0.5px solid #e4e4e7',
                            color: '#71717a',
                          }}
                        >
                          {STATUS_LABEL[book.serial_status]}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* 评分 */}
                  <div
                    className="flex-shrink-0 font-semibold"
                    style={{ fontSize: 18, color: '#18181b' }}
                  >
                    {book.final_score.toFixed(1)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
