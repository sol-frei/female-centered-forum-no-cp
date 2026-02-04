import React, { useState, useEffect } from 'react';
import { ArrowLeft, Search, MessageSquare, ThumbsUp, Eye, ChevronDown } from 'lucide-react';
import { get_all_book_ratings } from '../services/storage';

type ToastType = 'success' | 'error' | 'warning' | 'info';

const PRINCIPLES = [
  { key: 'cp_is_female', text: '主角及CP均需为女性' },
  { key: 'no_men_important', text: '无重要男性角色占比' },
  { key: 'no_men_romance', text: '无男女感情线/暧昧线' },
  { key: 'female_centered', text: '强调女性主体性/友谊' }
];

// ✅ 统一样式
const LoadingSpinner = () => (
  <div className=\"py-20 flex items-center justify-center bg-white\">
    <div className=\"w-6 h-6 border-2 border-zinc-200 border-t-zinc-800 rounded-full animate-spin\"></div>
  </div>
);

export default function Bookshelf({ onNavigateBack, onBookClick, showToast }: any) {
  const [books, setBooks] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    get_all_book_ratings().then(data => {
      setBooks(data);
      setIsLoading(false);
    });
  }, []);

  if (isLoading) return <LoadingSpinner />;

  const filteredBooks = books.filter(b => 
    b.book_name.includes(searchQuery) || b.book_author.includes(searchQuery)
  );

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="flex items-center gap-4 mb-6">
        <ArrowLeft className="cursor-pointer" onClick={onNavigateBack} />
        <h1 className="text-xl font-bold">避雷书架</h1>
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-2.5 w-4 h-4 text-zinc-400" />
        <input 
          placeholder="搜索书名或作者..." 
          className="w-full pl-10 pr-4 py-2 border rounded-lg"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />
      </div>

      <div className="space-y-4">
        {filteredBooks.map(book => (
          <div key={book.id} className="border rounded-xl overflow-hidden bg-white">
            <div 
              className="p-4 flex justify-between items-center cursor-pointer"
              onClick={() => setExpandedId(expandedId === book.id ? null : book.id)}
            >
              <div>
                <div className="font-bold">{book.book_name} <span className="font-normal text-zinc-500">@{book.book_author}</span></div>
                <div className="text-sm text-zinc-500">平台: {book.book_platform} | 最终分: <span className="font-bold text-black">{book.final_score}</span></div>
              </div>
              <ChevronDown className={`transition-transform ${expandedId === book.id ? 'rotate-180' : ''}`} />
            </div>

            {expandedId === book.id && (
              <div className="p-4 border-t bg-zinc-50 space-y-4">
                <div className="bg-white p-3 border rounded-lg italic text-zinc-600">"{book.reviewer_comment}"</div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {PRINCIPLES.map(p => {
                    const value = book.principle_scores[p.key];
                    const remark = book.principle_remarks[p.key];
                    return (
                      <div key={p.key} className="text-sm p-3 border rounded bg-white">
                        <div className="flex gap-2">
                          <span className={value === 'yes' ? 'text-green-600' : 'text-red-600'}>
                            {value === 'yes' ? '✓' : '✗'}
                          </span>
                          <div>
                            <div className="font-medium">{p.text}</div>
                            {remark && <div className="text-xs text-zinc-500 mt-1">备注: {remark}</div>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {book.extra_deduction > 0 && (
                  <div className="p-3 bg-red-50 border border-red-100 rounded-lg text-sm">
                    <span className="font-bold text-red-700">额外扣分 ({book.extra_deduction}):</span> {book.extra_remark}
                  </div>
                )}

                <button 
                  onClick={() => onBookClick(book.post_id)}
                  className="w-full py-2 bg-black text-white rounded-lg text-sm"
                >
                  查看完整帖子
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
