import React, { useState, useEffect } from 'react';
import { ArrowLeft, Search, ChevronDown } from 'lucide-react';
import { get_all_book_ratings } from '../services/storage';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface BookshelfProps {
  onNavigateBack: () => void;
  onBookClick: (postId: string) => void;
  showToast: (msg: string, type: ToastType) => void;
}

// ✅ 统一样式：黑色旋转圆圈
const LoadingSpinner = () => (
  <div className="py-20 flex items-center justify-center bg-white">
    <div className="w-6 h-6 border-2 border-zinc-200 border-t-zinc-800 rounded-full animate-spin"></div>
  </div>
);

const PRINCIPLES_TEXT = [
  '作者预收/写过/阅读男主文、bl、言情等非4B小说。',
  '连载中/断更/卡v/坑文等操作。',
  '文笔差 / 一般，剧情设定欠缺。',
  '评论区磕cp、吵架，作者关闭评论区等。',
  '作者现实其他骚操作（已婚、提男友、拒绝激女读者等）。',
  '描写氛围、语言、过于暧昧，女角色之间（非女主）关系有百合倾向。',
  '女男比例低于2：1。',
  '随父姓，默认任何角色随父姓，不单指主角，不指出也不批判也没改变。',
  '女性角色塑造不用心、刻板印象（取名随意、脸谱化、平面化）。',
  '服美役（白幼瘦、面部、高跟鞋、胸臀腿特写、衣服配饰等外貌方面的描写）。',
  '驴竞、拉踩其他女角色。',
  '忽略女性困难处境、物化女性。',
  '性别认知障碍，自称哥、爸、爷、弟等，女扮男装，女角色被称为先生等。',
  '扶持男性、接男儿，有男人分享女角色胜利果实/成果/遗产等。',
  '男性角色与女性角色存在单向/双向性缘。',
  '美化男性（母父对比、男性深情、男性友情、男性导师等）、偏爱男性。',
  '男性角色有高光、有成长线。',
  '掺腐（非批判）。',
  '存在厌女词、辱女词（s|b、m|d、cao、草字头等，包括但不限于这类词）。',
  '存在男本位词:男|女、父|母、师父、师叔、徒弟等，嫖娼、妓女、嫁娶、奴才、婢女等偏旁为女的贬义词。',
  '用性侵、造黄谣等方式x惩罚女性、描写角色x行为等。',
  '过度渲染女性苦楚/雄堕，但反抗/觉醒内容占比很少。',
  '是否有提到推广或倡导女权的思想和行为【没有需扣分】。',
  '是否有明确的反男权思想和行为【没有需扣分】。',
  '是否默认女性为第一性【没有需扣分】。',
];

export default function Bookshelf({ onNavigateBack, onBookClick, showToast }: BookshelfProps) {
  const [books, setBooks] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('latest');
  const [filterBy, setFilterBy] = useState('all');
  const [expandedBookId, setExpandedBookId] = useState<string | null>(null);

  useEffect(() => {
    loadBooks();
  }, []);

  const loadBooks = async () => {
    setIsLoading(true);
    try {
      const data = await get_all_book_ratings({ sortBy: 'latest' });
      setBooks(data);
    } catch (error) {
      showToast('加载书架失败', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const filteredAndSortedBooks = books
    .filter(book => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return book.book_name.toLowerCase().includes(query) || book.book_author.toLowerCase().includes(query);
      }
      return true;
    })
    .filter(book => {
      if (filterBy === 'high') return book.final_score >= 8;
      if (filterBy === 'medium') return book.final_score >= 5 && book.final_score < 8;
      if (filterBy === 'low') return book.final_score < 5;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'latest') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      if (sortBy === 'highest') return b.final_score - a.final_score;
      if (sortBy === 'lowest') return a.final_score - b.final_score;
      return 0;
    });

  const getScoreColor = (score: number) => {
    if (score >= 8) return 'text-green-600 bg-green-50 border-green-200';
    if (score >= 5) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    return 'text-red-600 bg-red-50 border-red-200';
  };

  if (isLoading) return <LoadingSpinner />;

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="sticky top-0 bg-white border-b border-zinc-200 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4 mb-4">
            <button onClick={onNavigateBack} className="p-2 hover:bg-zinc-100 rounded-full transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-2xl font-bold">书架</h1>
          </div>
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索书名或作者..."
              className="w-full pl-10 pr-4 py-2 border border-zinc-300 rounded-lg"
            />
          </div>
          <div className="flex gap-2">
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="px-3 py-1.5 border rounded-lg text-sm bg-white">
              <option value="latest">最新评分</option>
              <option value="highest">评分最高</option>
              <option value="lowest">评分最低</option>
            </select>
            <select value={filterBy} onChange={(e) => setFilterBy(e.target.value)} className="px-3 py-1.5 border rounded-lg text-sm bg-white">
              <option value="all">全部评分</option>
              <option value="high">高分 (8分以上)</option>
              <option value="medium">中等 (5-8分)</option>
              <option value="low">低分 (5分以下)</option>
            </select>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6">
        {filteredAndSortedBooks.length === 0 ? (
          <div className="text-center py-20 text-zinc-400">暂无书籍评分</div>
        ) : (
          <div className="space-y-4">
            {filteredAndSortedBooks.map((book) => (
              <div key={book.id} className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
                <div className="p-4 flex items-start gap-4">
                  <div className={`flex-shrink-0 w-20 h-20 rounded-lg border-2 flex flex-col items-center justify-center ${getScoreColor(book.final_score)}`}>
                    <div className="text-3xl font-bold">{book.final_score.toFixed(1)}</div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-bold mb-1 line-clamp-1">{book.book_name}</h3>
                    <p className="text-sm text-zinc-600">作者: {book.book_author}</p>
                    <p className="text-xs text-zinc-500">评分人: {book.reviewer_name} · {new Date(book.created_at).toLocaleDateString()}</p>
                  </div>
                  <button onClick={() => setExpandedBookId(expandedBookId === book.id ? null : book.id)} className="p-2 hover:bg-zinc-100 rounded-full">
                    <ChevronDown className={`w-5 h-5 transition-transform ${expandedBookId === book.id ? 'rotate-180' : ''}`} />
                  </button>
                </div>

                {expandedBookId === book.id && (
                  <div className="border-t border-zinc-200 bg-zinc-50 p-4">
                    <div className="bg-white rounded-lg border p-4 space-y-2 max-h-96 overflow-y-auto">
                      {Object.entries(book.principle_scores).map(([key, value]) => {
                        if (!value) return null;
                        const idx = parseInt(key.replace('p', '')) - 1;
                        return (
                          <div key={key} className="text-sm border-b pb-2 flex gap-2">
                            <span className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${value === 'yes' ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                              {value === 'yes' ? '✗' : '✓'}
                            </span>
                            <div>
                                <p>{PRINCIPLES_TEXT[idx]}</p>
                                {book.principle_remarks[key] && <p className="text-xs text-zinc-400 mt-1">备注: {book.principle_remarks[key]}</p>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <button onClick={() => onBookClick(book.post_id)} className="mt-4 w-full py-2 bg-black text-white rounded-lg text-sm font-medium">查看完整帖子</button>
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
