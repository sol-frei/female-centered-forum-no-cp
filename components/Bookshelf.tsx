import React, { useState, useEffect } from 'react';
import { ArrowLeft, Star, Filter, Search, MessageSquare, ThumbsUp, Eye, ChevronDown } from 'lucide-react';
import { BookRatingData } from './BookRatingModal';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface BookshelfProps {
  onNavigateBack: () => void;
  onBookClick: (bookId: string) => void;
  showToast: (msg: string, type: ToastType) => void;
}

interface BookWithRating {
  id: string;
  post_id: string;
  book_name: string;
  book_author: string;
  book_platform: string;
  final_score: number;
  impressed_score: number;
  reviewer_id: string;
  reviewer_name: string;
  reviewer_comment: string;
  created_at: string;
  rating_details: BookRatingData;
  comments_count?: number;
  likes_count?: number;
  views_count?: number;
}

type SortOption = 'latest' | 'highest' | 'lowest';
type FilterOption = 'all' | 'high' | 'medium' | 'low';

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
  const [books, setBooks] = useState<BookWithRating[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('latest');
  const [filterBy, setFilterBy] = useState<FilterOption>('all');
  const [expandedBookId, setExpandedBookId] = useState<string | null>(null);

  useEffect(() => {
    loadBooks();
  }, []);

  const loadBooks = async () => {
    setIsLoading(true);
    try {
      // TODO: 从数据库加载书籍评分数据
      // 这里需要调用 storage.ts 中的函数获取所有带评分的帖子
      // const data = await get_book_ratings();
      // setBooks(data);
      
      // 临时模拟数据
      const mockBooks: BookWithRating[] = [];
      setBooks(mockBooks);
    } catch (error) {
      showToast('加载书架失败', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // 过滤和排序
  const filteredAndSortedBooks = books
    .filter(book => {
      // 搜索过滤
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          book.book_name.toLowerCase().includes(query) ||
          book.book_author.toLowerCase().includes(query)
        );
      }
      return true;
    })
    .filter(book => {
      // 分数过滤
      if (filterBy === 'high') return book.final_score >= 8;
      if (filterBy === 'medium') return book.final_score >= 5 && book.final_score < 8;
      if (filterBy === 'low') return book.final_score < 5;
      return true;
    })
    .sort((a, b) => {
      // 排序
      if (sortBy === 'latest') {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      if (sortBy === 'highest') {
        return b.final_score - a.final_score;
      }
      if (sortBy === 'lowest') {
        return a.final_score - b.final_score;
      }
      return 0;
    });

  const getScoreColor = (score: number) => {
    if (score >= 8) return 'text-green-600 bg-green-50 border-green-200';
    if (score >= 5) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    return 'text-red-600 bg-red-50 border-red-200';
  };

  const getScoreLabel = (score: number) => {
    if (score >= 8) return '推荐';
    if (score >= 5) return '一般';
    return '排雷';
  };

  const toggleExpand = (bookId: string) => {
    setExpandedBookId(expandedBookId === bookId ? null : bookId);
  };

  return (
    <div className="min-h-screen bg-zinc-50">
      {/* 头部 */}
      <div className="sticky top-0 bg-white border-b border-zinc-200 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4 mb-4">
            <button
              onClick={onNavigateBack}
              className="p-2 hover:bg-zinc-100 rounded-full transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-2xl font-bold">书架</h1>
          </div>

          {/* 搜索框 */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索书名或作者..."
              className="w-full pl-10 pr-4 py-2 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
            />
          </div>

          {/* 筛选和排序 */}
          <div className="flex gap-2 overflow-x-auto pb-2">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="px-3 py-1.5 border border-zinc-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-black"
            >
              <option value="latest">最新评分</option>
              <option value="highest">评分最高</option>
              <option value="lowest">评分最低</option>
            </select>
            
            <select
              value={filterBy}
              onChange={(e) => setFilterBy(e.target.value as FilterOption)}
              className="px-3 py-1.5 border border-zinc-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-black"
            >
              <option value="all">全部评分</option>
              <option value="high">高分 (≥8分)</option>
              <option value="medium">中等 (5-8分)</option>
              <option value="low">低分 (<5分)</option>
            </select>
          </div>
        </div>
      </div>

      {/* 书籍列表 */}
      <div className="max-w-5xl mx-auto px-4 py-6">
        {isLoading ? (
          <div className="text-center py-20 text-zinc-400">加载中...</div>
        ) : filteredAndSortedBooks.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-zinc-400 mb-2">暂无书籍评分</p>
            <p className="text-sm text-zinc-400">在推书帖中添加评分后会显示在这里</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredAndSortedBooks.map((book) => (
              <div
                key={book.id}
                className="bg-white border border-zinc-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow"
              >
                {/* 书籍基本信息 */}
                <div className="p-4">
                  <div className="flex items-start gap-4">
                    {/* 评分徽章 */}
                    <div className={`flex-shrink-0 w-20 h-20 rounded-lg border-2 flex flex-col items-center justify-center ${getScoreColor(book.final_score)}`}>
                      <div className="text-3xl font-bold">{book.final_score.toFixed(1)}</div>
                      <div className="text-xs font-bold mt-1">{getScoreLabel(book.final_score)}</div>
                    </div>

                    {/* 书籍信息 */}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-bold mb-1 line-clamp-1">{book.book_name}</h3>
                      <div className="text-sm text-zinc-600 space-y-1">
                        <p>作者: {book.book_author}</p>
                        {book.book_platform && <p>平台: {book.book_platform}</p>}
                        <p className="text-zinc-500">
                          评分人: {book.reviewer_name} · {new Date(book.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      
                      {/* 互动数据 */}
                      <div className="flex gap-4 mt-3 text-sm text-zinc-500">
                        {book.views_count !== undefined && (
                          <span className="flex items-center gap-1">
                            <Eye className="w-4 h-4" />
                            {book.views_count}
                          </span>
                        )}
                        {book.likes_count !== undefined && (
                          <span className="flex items-center gap-1">
                            <ThumbsUp className="w-4 h-4" />
                            {book.likes_count}
                          </span>
                        )}
                        {book.comments_count !== undefined && (
                          <span className="flex items-center gap-1">
                            <MessageSquare className="w-4 h-4" />
                            {book.comments_count}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* 展开按钮 */}
                    <button
                      onClick={() => toggleExpand(book.id)}
                      className="flex-shrink-0 p-2 hover:bg-zinc-100 rounded-full transition-colors"
                    >
                      <ChevronDown
                        className={`w-5 h-5 transition-transform ${expandedBookId === book.id ? 'rotate-180' : ''}`}
                      />
                    </button>
                  </div>

                  {/* 评价预览 */}
                  {book.reviewer_comment && (
                    <div className="mt-4 p-3 bg-zinc-50 rounded-lg">
                      <p className="text-sm text-zinc-700 line-clamp-2">{book.reviewer_comment}</p>
                    </div>
                  )}
                </div>

                {/* 详细评分展开区 */}
                {expandedBookId === book.id && (
                  <div className="border-t border-zinc-200 bg-zinc-50 p-4">
                    <h4 className="font-bold mb-3">详细评分</h4>
                    
                    {/* 评分概览 */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                      <div className="bg-white p-3 rounded border border-zinc-200">
                        <p className="text-xs text-zinc-500 mb-1">印象分</p>
                        <p className="text-2xl font-bold">{book.rating_details.impressed_score}</p>
                      </div>
                      <div className="bg-white p-3 rounded border border-zinc-200">
                        <p className="text-xs text-zinc-500 mb-1">准则扣分</p>
                        <p className="text-2xl font-bold text-red-600">
                          -{(book.rating_details.impressed_score - book.final_score - book.rating_details.extra_deduction).toFixed(1)}
                        </p>
                      </div>
                      <div className="bg-white p-3 rounded border border-zinc-200">
                        <p className="text-xs text-zinc-500 mb-1">额外扣分</p>
                        <p className="text-2xl font-bold text-red-600">-{book.rating_details.extra_deduction}</p>
                      </div>
                    </div>

                    {/* 评分准则详情 */}
                    <div className="bg-white rounded-lg border border-zinc-200 p-4">
                      <h5 className="font-bold mb-3 text-sm">评分准则明细</h5>
                      <div className="space-y-2 max-h-96 overflow-y-auto">
                        {Object.entries(book.rating_details.principle_scores).map(([key, value], index) => {
                          if (!value) return null;
                          const principleIndex = parseInt(key.replace('p', '')) - 1;
                          const principleText = PRINCIPLES_TEXT[principleIndex];
                          const remark = book.rating_details.principle_remarks[key];
                          
                          return (
                            <div key={key} className="text-sm border-b border-zinc-100 pb-2 last:border-0">
                              <div className="flex items-start gap-2">
                                <span className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                                  value === 'yes' ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'
                                }`}>
                                  {value === 'yes' ? '✗' : '✓'}
                                </span>
                                <div className="flex-1">
                                  <p className="text-zinc-700">{principleText}</p>
                                  {remark && <p className="text-xs text-zinc-500 mt-1">备注: {remark}</p>}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* 额外扣分说明 */}
                    {book.rating_details.extra_deduction > 0 && book.rating_details.extra_remark && (
                      <div className="mt-3 bg-red-50 border border-red-200 rounded-lg p-3">
                        <p className="text-sm font-bold text-red-800 mb-1">额外扣分原因</p>
                        <p className="text-sm text-red-700">{book.rating_details.extra_remark}</p>
                      </div>
                    )}

                    {/* 查看详情按钮 */}
                    <button
                      onClick={() => onBookClick(book.post_id)}
                      className="mt-4 w-full py-2 bg-black text-white rounded-lg hover:bg-zinc-800 transition-colors text-sm font-medium"
                    >
                      查看完整帖子
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
