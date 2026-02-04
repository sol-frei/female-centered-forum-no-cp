import React, { useState, useEffect } from 'react';
import { ArrowLeft, Search, MessageSquare, ThumbsUp, Eye, ChevronDown } from 'lucide-react';
import { get_all_book_ratings } from '../services/storage';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface BookRatingData {
  book_name: string;
  book_author: string;
  book_platform: string;
  impressed_score: number;
  principle_scores: { [key: string]: 'yes' | 'no' | null };
  principle_remarks: { [key: string]: string };
  extra_deduction: number;
  extra_remark: string;
  final_score: number;
  reviewer_comment: string;
}

interface BookshelfProps {
  onNavigateBack: () => void;
  onBookClick: (postId: string) => void;
  showToast: (msg: string, type: ToastType) => void;
}

interface BookWithRating extends BookRatingData {
  id: string;
  post_id: string;
  reviewer_id: string;
  reviewer_name: string;
  created_at: string;
}

// 统一的旋转圆圈组件
const LoadingSpinner = () => (
  <div className="py-20 flex items-center justify-center bg-white">
    <div className="w-6 h-6 border-2 border-zinc-200 border-t-zinc-800 rounded-full animate-spin"></div>
  </div>
);

const PRINCIPLES = [
  { key: 'cp_is_female', text: '主角及CP均需为女性' },
  { key: 'no_men_important', text: '无重要男性角色占比' },
  { key: 'no_men_romance', text: '无男女感情线/暧昧线' },
  { key: 'female_centered', text: '强调女性主体性/友谊' }
];

export default function Bookshelf({ onNavigateBack, onBookClick, showToast }: BookshelfProps) {
  const [books, setBooks] = useState<BookWithRating[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    const loadBooks = async () => {
      setIsLoading(true);
      try {
        const data = await get_all_book_ratings();
        setBooks(data);
      } catch (err) {
        showToast('加载书架失败', 'error');
      } finally {
        setIsLoading(false);
      }
    };
    loadBooks();
  }, []);

  // 统一加载效果
  if (isLoading) return <LoadingSpinner />;

  const filteredBooks = books.filter(b => 
    b.book_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    b.book_author.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button onClick={onNavigateBack} className="p-2 hover:bg-zinc-100 rounded-full">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-2xl font-bold">避雷书架</h1>
        </div>

        {/* Search */}
        <div className="relative mb-8">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
          <input
            type="text"
            placeholder="搜索书名、作者..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-zinc-100 border-none rounded-xl focus:ring-2 focus:ring-black transition-all"
          />
        </div>

        {filteredBooks.length === 0 ? (
          <div className="text-center py-20 text-zinc-400">暂无相关书籍记录</div>
        ) : (
          <div className="grid gap-4">
            {filteredBooks.map((book) => (
              <div key={book.id} className="bg-white border border-zinc-200 rounded-2xl overflow-hidden hover:border-zinc-300 transition-all">
                <div 
                  className="p-5 cursor-pointer flex items-center justify-between"
                  onClick={() => setExpandedId(expandedId === book.id ? null : book.id)}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-bold text-lg">{book.book_name}</h3>
                      <span className="text-sm text-zinc-500">@{book.book_author}</span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-zinc-500">
                      <span>平台: {book.book_platform}</span>
                      <span className="flex items-center gap-1">
                        评分: <span className="font-bold text-black">{book.final_score}</span>
                      </span>
                    </div>
                  </div>
                  <ChevronDown className={`w-5 h-5 text-zinc-400 transition-transform ${expandedId === book.id ? 'rotate-180' : ''}`} />
                </div>

                {expandedId === book.id && (
                  <div className="px-5 pb-5 border-t border-zinc-100 bg-zinc-50/50 pt-5 animate-in slide-in-from-top-2 duration-200">
                    <div className="grid md:grid-cols-2 gap-6">
                      {/* 左侧：评语 */}
                      <div>
                        <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-3">审阅者评价</h4>
                        <p className="text-zinc-700 leading-relaxed text-sm bg-white p-4 rounded-xl border border-zinc-100">
                          {book.reviewer_comment}
                        </p>
                      </div>

                      {/* 右侧：原则判定 */}
                      <div>
                        <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-3">原则判定</h4>
                        <div className="space-y-2">
                          {PRINCIPLES.map(({ key, text }) => {
                            const value = book.principle_scores[key];
                            const remark = book.principle_remarks[key];
                            return (
                              <div key={key} className="bg-white p-3 rounded-xl border border-zinc-100">
                                <div className="flex items-start gap-3">
                                  <span className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center text-xs shrink-0 ${
                                    value === 'yes' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                  }`}>
                                    {value === 'yes' ? '✓' : '✗'}
                                  </span>
                                  <div>
                                    <p className="text-sm font-medium">{text}</p>
                                    {remark && <p className="text-xs text-zinc-500 mt-1">备注: {remark}</p>}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => onBookClick(book.post_id)}
                      className="mt-6 w-full py-3 bg-black text-white rounded-xl hover:bg-zinc-800 transition-colors font-medium text-sm"
                    >
                      查看完整评测贴
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
