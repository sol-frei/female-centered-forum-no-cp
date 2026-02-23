import React, { useState, useEffect } from 'react';
import { ArrowLeft, Search, ChevronDown } from 'lucide-react';
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

const BOOK_CATEGORIES = [
  '现代都市', '古代言情', '玄幻奇幻', '科幻未来',
  '悬疑推理', '历史架空', '校园青春', '职场商战', '武侠仙侠', '其他',
];

// 分类标签颜色映射
const CATEGORY_COLORS: Record<string, string> = {
  '现代都市': 'bg-blue-50 text-blue-600 border-blue-200',
  '古代言情': 'bg-pink-50 text-pink-600 border-pink-200',
  '玄幻奇幻': 'bg-purple-50 text-purple-600 border-purple-200',
  '科幻未来': 'bg-cyan-50 text-cyan-600 border-cyan-200',
  '悬疑推理': 'bg-amber-50 text-amber-700 border-amber-200',
  '历史架空': 'bg-orange-50 text-orange-600 border-orange-200',
  '校园青春': 'bg-green-50 text-green-600 border-green-200',
  '职场商战': 'bg-slate-50 text-slate-600 border-slate-200',
  '武侠仙侠': 'bg-red-50 text-red-600 border-red-200',
  '其他': 'bg-zinc-50 text-zinc-500 border-zinc-200',
};

export default function Bookshelf({ onNavigateBack, onBookClick, showToast }: BookshelfProps) {
  const [books, setBooks] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('latest');
  const [filterBy, setFilterBy] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
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
    .filter(book => {
      if (categoryFilter !== 'all') return book.book_category === categoryFilter;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'latest') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      if (sortBy === 'highest') return b.final_score - a.final_score;
      if (sortBy === 'lowest') return a.final_score - b.final_score;
      return 0;
    });

  // 评分框样式（手机端缩小）
  const getScoreStyle = (score: number) => {
    if (score >= 8) return { box: 'text-green-600 bg-green-50 border-green-200', dot: 'bg-green-500' };
    if (score >= 5) return { box: 'text-yellow-600 bg-yellow-50 border-yellow-200', dot: 'bg-yellow-500' };
    return { box: 'text-red-600 bg-red-50 border-red-200', dot: 'bg-red-500' };
  };

  if (isLoading) return <LoadingSpinner />;

  return (
    <div className="min-h-screen bg-zinc-50">
      {/* 顶栏 */}
      <div className="sticky top-0 bg-white border-b border-zinc-200 z-10 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-3">
          {/* 标题行 */}
          <div className="flex items-center gap-3 mb-3">
            <button onClick={onNavigateBack} className="p-1.5 hover:bg-zinc-100 rounded-full transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-xl font-bold">书架</h1>
            <span className="ml-auto text-xs text-zinc-400 bg-zinc-100 px-2 py-1 rounded-full">
              共 {filteredAndSortedBooks.length} 本
            </span>
          </div>

          {/* 搜索框 */}
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索书名或作者..."
              className="w-full pl-9 pr-4 py-2 border border-zinc-200 rounded-lg text-sm bg-zinc-50 focus:bg-white focus:border-zinc-400 outline-none transition-all"
            />
          </div>

          {/* 筛选行 */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="flex-shrink-0 px-3 py-1.5 border border-zinc-200 rounded-lg text-xs bg-white text-zinc-700 outline-none"
            >
              <option value="latest">最新评分</option>
              <option value="highest">评分最高</option>
              <option value="lowest">评分最低</option>
            </select>
            <select
              value={filterBy}
              onChange={(e) => setFilterBy(e.target.value)}
              className="flex-shrink-0 px-3 py-1.5 border border-zinc-200 rounded-lg text-xs bg-white text-zinc-700 outline-none"
            >
              <option value="all">全部分数</option>
              <option value="high">高分 ≥8</option>
              <option value="medium">中等 5-8</option>
              <option value="low">低分 &lt;5</option>
            </select>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="flex-shrink-0 px-3 py-1.5 border border-zinc-200 rounded-lg text-xs bg-white text-zinc-700 outline-none"
            >
              <option value="all">全部分类</option>
              {BOOK_CATEGORIES.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* 书籍列表 */}
      <div className="max-w-5xl mx-auto px-3 sm:px-4 py-4">
        {filteredAndSortedBooks.length === 0 ? (
          <div className="text-center py-20 text-zinc-400 text-sm">暂无符合条件的书籍</div>
        ) : (
          <div className="space-y-3">
            {filteredAndSortedBooks.map((book) => {
              const scoreStyle = getScoreStyle(book.final_score);
              return (
                <div key={book.id} className="bg-white border border-zinc-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                  {/* 书籍主信息行 */}
                  <div className="p-3 sm:p-4 flex items-center gap-3">
                    {/* 评分框：手机端更紧凑 */}
                    <div className={`flex-shrink-0 w-14 h-14 sm:w-16 sm:h-16 rounded-xl border-2 flex items-center justify-center ${scoreStyle.box}`}>
                      <div className="text-xl sm:text-2xl font-bold leading-none">{book.final_score.toFixed(1)}</div>
                    </div>

                    {/* 书籍文字信息 */}
                    <div className="flex-1 min-w-0">
                      {/* 书名：允许换行，不截断 */}
                      <h3 className="text-sm sm:text-base font-bold leading-snug mb-1 text-zinc-900 break-words">
                        {book.book_name}
                      </h3>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <p className="text-xs text-zinc-500">{book.book_author}</p>
                        {book.book_category && (
                          <span className={`text-xs px-1.5 py-0.5 rounded-full border font-medium ${CATEGORY_COLORS[book.book_category] || CATEGORY_COLORS['其他']}`}>
                            {book.book_category}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-zinc-400 mt-0.5">
                        {book.reviewer_name} · {new Date(book.created_at).toLocaleDateString()}
                      </p>
                    </div>

                    {/* 展开按钮 */}
                    <button
                      onClick={() => setExpandedBookId(expandedBookId === book.id ? null : book.id)}
                      className="flex-shrink-0 p-1.5 hover:bg-zinc-100 rounded-full transition-colors"
                    >
                      <ChevronDown className={`w-4 h-4 text-zinc-400 transition-transform duration-200 ${expandedBookId === book.id ? 'rotate-180' : ''}`} />
                    </button>
                  </div>

                  {/* 展开内容：准则详情 */}
                  {expandedBookId === book.id && (
                    <div className="border-t border-zinc-100 bg-zinc-50/50 p-3 sm:p-4">
                      <div className="bg-white rounded-xl border border-zinc-100 p-3 space-y-0 max-h-96 overflow-y-auto">
                        {Object.entries(book.principle_scores).map(([key, value], entryIndex) => {
                          if (!value) return null;
                          const idx = parseInt(key.replace('p', '')) - 1;
                          const isLastThree = idx >= 22;
                          const shouldBeGreen = isLastThree ? value === 'yes' : value === 'no';
                          return (
                            <div
                              key={key}
                              className="flex gap-2.5 py-2.5"
                            >
                              {/* 实心填充的圆点 */}
                              <span className={`flex-shrink-0 w-4 h-4 rounded-full mt-0.5 ${shouldBeGreen ? 'bg-green-500' : 'bg-red-500'}`} />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm leading-relaxed text-zinc-700">{PRINCIPLES_TEXT[idx]}</p>
                                {book.principle_remarks[key] && (
                                  <p className="text-xs text-zinc-400 mt-1 bg-zinc-50 rounded px-2 py-1">
                                    备注：{book.principle_remarks[key]}
                                  </p>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <button
                        onClick={() => onBookClick(book.post_id)}
                        className="mt-3 w-full py-2.5 bg-zinc-900 text-white rounded-xl text-sm font-medium hover:bg-zinc-700 transition-colors"
                      >
                        查看完整帖子
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}