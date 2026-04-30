import React, { useState, useRef, useEffect } from 'react';
import { ArrowLeft, Edit2, ChevronDown, ChevronUp, X, ArrowRight } from 'lucide-react';
import { BookRating, ReaderReview } from '../types';

import {
  upload_book_cover,
  upload_character_illustration,
  update_book_intro,
  submit_reader_review,
  toggle_review_like,
  get_book_rating_by_id
} from '../services/storage';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface BookDetailProps {
  book: BookRating;
  currentUserId: string;
  currentUserName: string;
  onNavigateBack: () => void;
  onPostClick: (postId: string) => void;
  showToast: (msg: string, type: ToastType) => void;
}

const STATUS_LABEL: Record<string, string> = {
  finished: '完结',
  ongoing: '连载中',
  hiatus: '断更',
};

const TAG_LABEL: Record<string, string> = {
  recommend: '推荐帖',
  warn: '排雷帖',
};

// ── 内部图标组件 ──
function BookIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-8 h-8 opacity-20">
      <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
    </svg>
  );
}

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
      <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
    </svg>
  );
}

export default function BookDetail({
  book: initialBook,
  currentUserId,
  currentUserName,
  onNavigateBack,
  onPostClick,
  showToast,
}: BookDetailProps) {
  const [book, setBook] = useState<BookRating>(initialBook);
  const [editingIntro, setEditingIntro] = useState(false);
  const [introText, setIntroText] = useState(initialBook.book_intro || '');
  const [introExpanded, setIntroExpanded] = useState(false);
  
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [starRating, setStarRating] = useState(0);
  const [hoverStar, setHoverStar] = useState(0);
  const [reviewText, setReviewText] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  const [uploadingCover, setUploadingCover] = useState(false);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const reviews: ReaderReview[] = book.reader_reviews || [];
  const myReview = reviews.find(r => r.user_id === currentUserId);

  useEffect(() => {
    async function loadBook() {
      if (!initialBook.id) return;
      try {
        const fresh = await get_book_rating_by_id(initialBook.id);
        setBook({ ...fresh, reader_reviews: fresh.reader_reviews || [] });
        setIntroText(fresh.book_intro || '');
        const currentMyReview = fresh.reader_reviews?.find(r => r.user_id === currentUserId);
        if (currentMyReview) {
          setStarRating(currentMyReview.impression_score);
          setReviewText(currentMyReview.review_text || '');
        }
      } catch (e) {
        console.error('加载失败', e);
      }
    }
    loadBook();
  }, [initialBook.id, currentUserId]);

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !book.id) return;
    setUploadingCover(true);
    try {
      const url = await upload_book_cover(book.id, file);
      setBook(prev => ({ ...prev, cover_url: url }));
      showToast('封面上传成功', 'success');
    } catch {
      showToast('上传失败', 'error');
    } finally {
      setUploadingCover(false);
    }
  };

  const handleSaveIntro = async () => {
    if (!book.id) return;
    try {
      await update_book_intro(book.id, introText);
      setBook(prev => ({ ...prev, book_intro: introText }));
      setEditingIntro(false);
      showToast('简介已更新', 'success');
    } catch {
      showToast('保存失败', 'error');
    }
  };

  const handleSubmitReview = async () => {
    if (!starRating) { showToast('请先选择分数', 'warning'); return; }
    if (!book.id) return;
    setSubmittingReview(true);
    try {
      const { updatedReviews, newImpressedScore, newFinalScore } = await submit_reader_review(
        book.id,
        reviews,
        {
          user_id: currentUserId,
          user_name: currentUserName,
          impression_score: starRating,
          review_text: reviewText,
        }
      );
      setBook(prev => ({
        ...prev,
        reader_reviews: updatedReviews,
        impressed_score: newImpressedScore,
        final_score: newFinalScore,
      }));
      showToast('提交成功', 'success');
      setIsReviewModalOpen(false);
    } catch {
      showToast('提交失败', 'error');
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleToggleLike = async (reviewIndex: number) => {
    if (!book.id) return;
    try {
      const updated = await toggle_review_like(book.id, reviews, reviewIndex, currentUserId);
      setBook(prev => ({ ...prev, reader_reviews: updated }));
    } catch {
      showToast('操作失败', 'error');
    }
  };

  const sectionCard = "bg-white rounded-2xl border border-zinc-100 p-5 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)]";
  const sectionTitle = "text-[14px] font-bold text-zinc-800 mb-4 flex items-center gap-2";

  return (
    <div className="relative min-h-screen bg-[#fafafa] pb-10 text-zinc-900">
      {/* ── 顶栏 ── */}
      <div className="sticky top-0 z-40 w-full bg-white/70 backdrop-blur-md border-b border-zinc-100 px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <button onClick={onNavigateBack} className="text-zinc-500 hover:text-black flex items-center gap-1 transition-colors">
            <ArrowLeft className="w-5 h-5" />
            <span className="text-sm font-medium">书籍详情</span>
          </button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        
        {/* ── 顶部书名区域 ── */}
        <div className="flex gap-6 items-start">
          <div
            className="flex-shrink-0 relative group cursor-pointer shadow-md"
            style={{ width: 90, height: 126, borderRadius: 12, overflow: 'hidden', border: '1px solid #f4f4f5' }}
            onClick={() => coverInputRef.current?.click()}
          >
            {uploadingCover ? (
              <div className="absolute inset-0 flex items-center justify-center bg-zinc-50">
                <div className="w-5 h-5 border-2 border-zinc-200 border-t-zinc-800 rounded-full animate-spin" />
              </div>
            ) : book.cover_url ? (
              <img src={book.cover_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-zinc-100 flex items-center justify-center"><BookIcon /></div>
            )}
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-center pb-2">
              <span className="text-white text-[10px]">更换封面</span>
            </div>
          </div>
          <input ref={coverInputRef} type="file" accept="image/*" className="hidden" onChange={handleCoverUpload} />

          <div className="flex-1 min-w-0">
            <h1 className="text-[22px] font-black leading-tight mb-1 truncate">{book.book_name}</h1>
            <p className="text-zinc-400 text-[13px] font-medium mb-3">{book.book_author}</p>
            
            <div className="flex flex-wrap items-center gap-2 mb-4">
              {/* 小巧的推荐/排雷按钮 */}
              {book.recommendation_tag && (
                <button 
                  onClick={() => onPostClick(book.post_id)}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold shadow-sm transition-all active:scale-95 ${book.recommendation_tag === 'recommend' ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-600 border border-zinc-200'}`}
                >
                  {TAG_LABEL[book.recommendation_tag]}
                  <ArrowRight className="w-2.5 h-2.5" />
                </button>
              )}
              {book.book_category && <span className="px-2 py-1 rounded-lg bg-zinc-50 border border-zinc-100 text-zinc-400 text-[10px] font-bold">{book.book_category}</span>}
              {book.serial_status && <span className="px-2 py-1 rounded-lg bg-zinc-50 text-zinc-400 text-[10px] font-bold">{STATUS_LABEL[book.serial_status]}</span>}
            </div>
          </div>
        </div>

        {/* ── 独立评分模块 (已移除“最终得分”) ── */}
        <section className="bg-white rounded-2xl border border-zinc-100 p-6 flex items-center justify-between shadow-[0_4px_20px_-10px_rgba(0,0,0,0.05)]">
          <div className="flex flex-col">
            <div className="flex items-baseline gap-2">
              <span className="text-5xl font-black text-zinc-900 leading-none">{book.final_score.toFixed(1)}</span>
              <span className="text-zinc-300 text-[12px] font-bold tracking-tight">/ {reviews.length + 1}人已评</span>
            </div>
            <div className="mt-2.5 flex gap-0.5">
               {/* 纯展示用的静态小星星 */}
               {[...Array(5)].map((_, i) => (
                 <span key={i} className={`text-xs ${i < Math.round(book.final_score / 2) ? 'text-zinc-900' : 'text-zinc-100'}`}>★</span>
               ))}
            </div>
          </div>
          
          <button 
            onClick={() => setIsReviewModalOpen(true)}
            className="flex flex-col items-center justify-center w-16 h-16 rounded-2xl bg-zinc-50 border border-zinc-100 hover:bg-zinc-100 transition-colors group"
          >
            <Edit2 className="w-5 h-5 text-zinc-400 group-hover:text-zinc-900 transition-colors" />
            <span className="text-[10px] font-bold text-zinc-400 mt-1">{myReview ? '修改' : '评分'}</span>
          </button>
        </section>

        {/* ── 简介 ── */}
        <section className={sectionCard}>
          <div className="flex justify-between items-center mb-4">
            <h2 className={sectionTitle}>书籍简介</h2>
            {!editingIntro && (
              <button onClick={() => setEditingIntro(true)} className="text-zinc-400 hover:text-zinc-600">
                <Edit2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          {editingIntro ? (
            <div className="space-y-3">
              <textarea
                value={introText}
                onChange={e => setIntroText(e.target.value)}
                className="w-full text-sm p-4 bg-zinc-50 border border-zinc-100 rounded-xl outline-none min-h-[120px] leading-relaxed"
              />
              <div className="flex gap-2 justify-end">
                <button onClick={() => setEditingIntro(false)} className="px-4 py-1.5 text-xs text-zinc-400 font-bold">取消</button>
                <button onClick={handleSaveIntro} className="px-4 py-1.5 text-xs bg-zinc-900 text-white rounded-lg font-bold">保存</button>
              </div>
            </div>
          ) : (
            <div className="relative">
              <div className={`text-zinc-600 text-[14px] leading-relaxed transition-all duration-300 ${!introExpanded && 'max-h-24 overflow-hidden'}`} style={{ whiteSpace: 'pre-wrap' }}>
                {book.book_intro || '暂无简介...'}
              </div>
              {book.book_intro && book.book_intro.length > 100 && (
                <button onClick={() => setIntroExpanded(!introExpanded)} className="w-full mt-3 py-1 text-xs font-bold text-zinc-300 flex items-center justify-center gap-1 border-t border-zinc-50">
                  {introExpanded ? <><ChevronUp className="w-3 h-3"/> 收起</> : <><ChevronDown className="w-3 h-3"/> 展开</>}
                </button>
              )}
            </div>
          )}
        </section>

        {/* ── 书友短评 ── */}
        <section className="space-y-4">
          <h2 className={sectionTitle + " px-1"}>书友短评 ({reviews.length})</h2>
          {reviews.length === 0 ? (
            <div className="text-center py-10 text-zinc-300 text-xs font-bold">目前还没有评论</div>
          ) : (
            <div className="space-y-3">
              {reviews.map((r, i) => (
                <div key={i} className="bg-white p-5 rounded-2xl border border-zinc-100">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-zinc-100 flex items-center justify-center text-[10px] font-black text-zinc-400">
                        {r.user_name.charAt(0)}
                      </div>
                      <span className="text-xs font-black text-zinc-700">{r.user_name}</span>
                    </div>
                    <div className="text-[10px] font-black bg-zinc-50 px-2 py-0.5 rounded-lg text-zinc-300 italic">
                      SCORE {r.impression_score.toFixed(1)}
                    </div>
                  </div>
                  <p className="text-sm text-zinc-500 leading-relaxed mb-4 pl-9">{r.review_text}</p>
                  <div className="flex justify-end">
                    <button 
                      onClick={() => handleToggleLike(i)}
                      className={`flex items-center gap-1.5 text-[10px] font-bold px-3 py-1.5 rounded-full transition-all ${r.liked_by.includes(currentUserId) ? 'bg-zinc-900 text-white shadow-md' : 'bg-zinc-50 text-zinc-400'}`}
                    >
                      <HeartIcon filled={r.liked_by.includes(currentUserId)} />
                      {r.likes}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* ── 评价弹窗 ── */}
      {isReviewModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="absolute inset-0 bg-zinc-900/20 backdrop-blur-sm" onClick={() => setIsReviewModalOpen(false)}/>
          <section className="relative w-full max-w-lg bg-zinc-50 rounded-[28px] p-8 text-zinc-900 shadow-2xl animate-in slide-in-from-bottom-10 duration-300">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-[16px] font-black flex items-center gap-2">
                <span className="w-2 h-2 bg-zinc-900 rounded-full"></span>
                {myReview ? '修改我的评价' : '发表读者评分'}
              </h2>
              <button onClick={() => setIsReviewModalOpen(false)} className="p-1 hover:bg-zinc-200 rounded-full transition-colors">
                <X className="w-5 h-5 text-zinc-400" />
              </button>
            </div>

            <div className="flex flex-col items-center gap-6 mb-8">
              <div className="flex items-center gap-1">
                {[...Array(10)].map((_, i) => (
                  <button
                    key={i}
                    onMouseEnter={() => setHoverStar(i + 1)}
                    onMouseLeave={() => setHoverStar(0)}
                    onClick={() => setStarRating(i + 1)}
                    className={`text-2xl transition-all duration-200 ${ (hoverStar || starRating) > i ? 'text-zinc-900 scale-110' : 'text-zinc-200'}`}
                  >
                    ★
                  </button>
                ))}
              </div>
              <span className="text-4xl font-black text-zinc-900 italic">{starRating || '0'}</span>
            </div>

            <textarea
              value={reviewText}
              onChange={e => setReviewText(e.target.value)}
              placeholder="写下你对此书的排雷或安利感悟..."
              className="w-full bg-white border border-zinc-200 rounded-2xl p-4 text-[14px] text-zinc-900 placeholder:text-zinc-300 focus:ring-1 focus:ring-zinc-900 outline-none min-h-[140px] mb-8 leading-relaxed shadow-sm"
            />

            <button
              onClick={handleSubmitReview}
              disabled={submittingReview || !starRating}
              className={`w-full py-4 rounded-2xl text-[15px] font-black transition-all active:scale-95 ${starRating ? 'bg-zinc-900 text-white shadow-xl' : 'bg-zinc-200 text-zinc-400 cursor-not-allowed'}`}
            >
              {submittingReview ? '正在提交...' : myReview ? '保存修改' : '确认发布'}
            </button>
          </section>
        </div>
      )}
    </div>
  );
}
