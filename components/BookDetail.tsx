import React, { useState, useRef } from 'react';
import { ArrowLeft, Edit2 } from 'lucide-react';
import { BookRating, ReaderReview, Character } from '../types';
import {
  upload_book_cover,
  upload_character_illustration,
  update_book_intro,
  submit_reader_review,
  toggle_review_like,
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

const STATUS_LABEL: Record<string, string> = {
  finished: '完结',
  ongoing: '连载中',
  hiatus: '断更',
};

const TAG_LABEL: Record<string, string> = {
  recommend: '推荐',
  warn: '排雷',
};

function BookIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"
      style={{ width: 24, height: 24, opacity: 0.2 }}>
      <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
    </svg>
  );
}

function PersonIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"
      style={{ width: 16, height: 16, opacity: 0.2 }}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.58-7 8-7s8 3 8 7" />
    </svg>
  );
}

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor" strokeWidth="2" style={{ width: 12, height: 12 }}>
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
  const [starRating, setStarRating] = useState(0);
  const [hoverStar, setHoverStar] = useState(0);
  const [reviewText, setReviewText] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadingCharIdx, setUploadingCharIdx] = useState<number | null>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const charInputRef = useRef<HTMLInputElement>(null);
  const [pendingCharIdx, setPendingCharIdx] = useState<number | null>(null);

  const reviews: ReaderReview[] = book.reader_reviews || [];
  const myReview = reviews.find(r => r.user_id === currentUserId);

  React.useEffect(() => {
    if (myReview) {
      setStarRating(myReview.impression_score);
      setReviewText(myReview.review_text || '');
    }
  }, []);

  // ── 封面上传 ──
  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !book.id) return;
    setUploadingCover(true);
    try {
      const url = await upload_book_cover(book.id, file);
      setBook(prev => ({ ...prev, cover_url: url }));
      showToast('封面上传成功', 'success');
    } catch {
      showToast('封面上传失败', 'error');
    } finally {
      setUploadingCover(false);
      e.target.value = '';
    }
  };

  // ── 人物插图上传 ──
  const handleCharUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || pendingCharIdx === null || !book.id) return;
    setUploadingCharIdx(pendingCharIdx);
    try {
      const updated = await upload_character_illustration(
        book.id,
        pendingCharIdx,
        file,
        book.book_characters || []
      );
      setBook(prev => ({ ...prev, book_characters: updated }));
      showToast('插图上传成功', 'success');
    } catch {
      showToast('插图上传失败', 'error');
    } finally {
      setUploadingCharIdx(null);
      setPendingCharIdx(null);
      e.target.value = '';
    }
  };

  // ── 简介保存 ──
  const handleSaveIntro = async () => {
    if (!book.id) return;
    try {
      await update_book_intro(book.id, introText);
      setBook(prev => ({ ...prev, book_intro: introText }));
      setEditingIntro(false);
      showToast('简介已保存', 'success');
    } catch {
      showToast('保存失败', 'error');
    }
  };

  // ── 提交印象分 ──
  const handleSubmitReview = async () => {
    if (!starRating) { showToast('请先选择分数', 'warning'); return; }
    if (!book.id) return;
    setSubmittingReview(true);
    try {
      const updated = await submit_reader_review(
        book.id,
        reviews,
        {
          user_id: currentUserId,
          user_name: currentUserName,
          impression_score: starRating,
          review_text: reviewText,
        }
      );
      setBook(prev => ({ ...prev, reader_reviews: updated }));
      showToast('评分已提交', 'success');
    } catch {
      showToast('提交失败', 'error');
    } finally {
      setSubmittingReview(false);
    }
  };

  // ── 书评点赞 ──
  const handleToggleLike = async (reviewIndex: number) => {
    if (!book.id) return;
    try {
      const updated = await toggle_review_like(
        book.id,
        reviews,
        reviewIndex,
        currentUserId
      );
      setBook(prev => ({ ...prev, reader_reviews: updated }));
    } catch {
      showToast('操作失败', 'error');
    }
  };

  const secTitle: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 500,
    color: '#a1a1aa',
    marginBottom: 8,
    letterSpacing: '0.04em',
  };

  const pill = (label: string, inv?: boolean): React.CSSProperties => ({
    fontSize: 11,
    padding: '2px 7px',
    borderRadius: 20,
    border: '0.5px solid',
    borderColor: inv ? '#18181b' : '#e4e4e7',
    backgroundColor: inv ? '#18181b' : 'transparent',
    color: inv ? '#ffffff' : '#71717a',
    display: 'inline-block',
  });

  return (
    <div className="min-h-screen bg-white">

      {/* ── 顶栏 ── */}
      <div
        className="sticky top-0 bg-white z-10 flex items-center gap-3 px-4 py-3"
        style={{ borderBottom: '0.5px solid #e4e4e7' }}
      >
        <button
          onClick={onNavigateBack}
          className="p-1.5 hover:bg-zinc-100 rounded-full transition-colors flex-shrink-0"
        >
          <ArrowLeft className="w-5 h-5" style={{ color: '#18181b' }} />
        </button>
        <span
          className="text-sm font-medium truncate"
          style={{ color: '#18181b' }}
        >
          {book.book_name}
        </span>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-5">

        {/* ── Hero ── */}
        <div className="flex gap-4">

          {/* 封面 */}
          <div
            className="flex-shrink-0 flex items-center justify-center overflow-hidden relative cursor-pointer group"
            style={{
              width: 80, height: 112,
              borderRadius: 6,
              backgroundColor: '#f4f4f5',
              border: '0.5px solid #e4e4e7',
            }}
            onClick={() => coverInputRef.current?.click()}
          >
            {uploadingCover ? (
              <div className="w-5 h-5 border-2 border-zinc-300 border-t-zinc-700 rounded-full animate-spin" />
            ) : book.cover_url ? (
              <img src={book.cover_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <BookIcon />
            )}
            <div
              className="absolute inset-0 flex items-end justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ background: 'rgba(0,0,0,0.35)', borderRadius: 6 }}
            >
              <span style={{ color: '#fff', fontSize: 10, paddingBottom: 6 }}>上传封面</span>
            </div>
          </div>
          <input ref={coverInputRef} type="file" accept="image/*" className="hidden" onChange={handleCoverUpload} />

          {/* 基础信息 */}
          <div className="flex-1 min-w-0">
            <div className="text-base font-medium mb-1" style={{ color: '#18181b', lineHeight: 1.3 }}>
              {book.book_name}
            </div>
            <div className="text-xs mb-2" style={{ color: '#71717a' }}>
              {book.book_author}
            </div>

            {/* 标签 */}
            <div className="flex flex-wrap gap-1.5 mb-3">
              {book.recommendation_tag && (
                <span style={pill(TAG_LABEL[book.recommendation_tag], book.recommendation_tag === 'recommend')}>
                  {TAG_LABEL[book.recommendation_tag]}
                </span>
              )}
              {book.book_category && (
                <span style={pill(book.book_category)}>
                  {book.book_category}
                </span>
              )}
              {book.serial_status && (
                <span style={pill(STATUS_LABEL[book.serial_status])}>
                  {STATUS_LABEL[book.serial_status]}
                </span>
              )}
            </div>

            {/* 评分公式 */}
            <div className="text-xl font-medium" style={{ color: '#18181b', lineHeight: 1 }}>
              {book.impressed_score}
              <span className="text-sm font-normal" style={{ color: '#71717a' }}> 印象均分</span>
            </div>
            <div className="text-xs mt-1" style={{ color: '#a1a1aa' }}>
              准则扣 −{(book.impressed_score - book.final_score).toFixed(1)} → 最终 {book.final_score.toFixed(1)}
            </div>
            <div className="text-xs mt-1" style={{ color: '#a1a1aa' }}>
              {reviews.length} 人评分
            </div>
          </div>
        </div>

        {/* ── 简介 ── */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span style={secTitle}>简介</span>
            {!editingIntro && (
              <button
                onClick={() => setEditingIntro(true)}
                className="flex items-center gap-1 text-xs"
                style={{ color: '#a1a1aa' }}
              >
                <Edit2 className="w-3 h-3" /> 编辑
              </button>
            )}
          </div>
          {editingIntro ? (
            <div>
              <textarea
                value={introText}
                onChange={e => setIntroText(e.target.value)}
                className="w-full text-sm outline-none resize-none"
                style={{
                  padding: '8px 10px',
                  border: '0.5px solid #e4e4e7',
                  borderRadius: 8,
                  height: 90,
                  marginBottom: 6,
                  color: '#18181b',
                  fontFamily: 'inherit',
                }}
              />
              <div className="flex gap-2">
                <button
                  onClick={handleSaveIntro}
                  className="text-xs px-3 py-1.5 rounded"
                  style={{ backgroundColor: '#18181b', color: '#fff' }}
                >
                  保存
                </button>
                <button
                  onClick={() => { setEditingIntro(false); setIntroText(book.book_intro || ''); }}
                  className="text-xs px-3 py-1.5 rounded"
                  style={{ border: '0.5px solid #e4e4e7', color: '#71717a' }}
                >
                  取消
                </button>
              </div>
            </div>
          ) : (
            <p className="text-sm leading-relaxed" style={{ color: book.book_intro ? '#3f3f46' : '#a1a1aa' }}>
              {book.book_intro || '暂无简介，点击编辑添加…'}
            </p>
          )}
        </div>

        {/* ── 人物 ── */}
        {book.book_characters && book.book_characters.length > 0 && (
          <div>
            <div style={secTitle}>人物</div>
            <div
              className="grid gap-2"
              style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))' }}
            >
              {book.book_characters.map((char: Character, idx: number) => (
                <div
                  key={idx}
                  className="cursor-pointer group"
                  style={{
                    border: '0.5px solid #e4e4e7',
                    borderRadius: 8,
                    padding: '8px 10px',
                    position: 'relative',
                  }}
                  onClick={() => {
                    setPendingCharIdx(idx);
                    charInputRef.current?.click();
                  }}
                >
                  <div
                    className="flex items-center justify-center overflow-hidden mb-2 relative"
                    style={{
                      width: '100%', height: 60,
                      borderRadius: 4,
                      backgroundColor: '#f4f4f5',
                    }}
                  >
                    {uploadingCharIdx === idx ? (
                      <div className="w-4 h-4 border-2 border-zinc-300 border-t-zinc-700 rounded-full animate-spin" />
                    ) : char.illustration_url ? (
                      <img src={char.illustration_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <PersonIcon />
                    )}
                    <div
                      className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ background: 'rgba(0,0,0,0.3)', borderRadius: 4 }}
                    >
                      <span style={{ color: '#fff', fontSize: 10 }}>上传插图</span>
                    </div>
                  </div>
                  <div className="text-xs font-medium" style={{ color: '#18181b' }}>{char.name}</div>
                  <div className="text-xs" style={{ color: '#a1a1aa', marginTop: 1 }}>{char.role}</div>
                </div>
              ))}
            </div>
            <input
              ref={charInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleCharUpload}
            />
          </div>
        )}


        {/* ── 读者书评 ── */}
        <div>
          <div style={secTitle}>读者书评</div>
          {reviews.length === 0 ? (
            <p className="text-xs" style={{ color: '#a1a1aa' }}>暂无书评</p>
          ) : (
            <div>
              {reviews.map((r, i) => {
                const liked = r.liked_by.includes(currentUserId);
                return (
                  <div
                    key={i}
                    className="flex gap-3 py-3"
                    style={{ borderBottom: '0.5px solid #f4f4f5' }}
                  >
                    <div
                      className="flex-shrink-0 flex items-center justify-center rounded-full text-xs font-medium"
                      style={{
                        width: 26, height: 26,
                        backgroundColor: '#f4f4f5',
                        border: '0.5px solid #e4e4e7',
                        color: '#71717a',
                      }}
                    >
                      {r.user_name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2 mb-1">
                        <span className="text-xs font-medium" style={{ color: '#18181b' }}>{r.user_name}</span>
                        <span className="text-xs" style={{ color: '#a1a1aa' }}>印象分 {r.impression_score.toFixed(1)}</span>
                      </div>
                      {r.review_text && (
                        <p className="text-xs leading-relaxed mb-2" style={{ color: '#3f3f46' }}>
                          {r.review_text}
                        </p>
                      )}
                      <button
                        onClick={() => handleToggleLike(i)}
                        className="flex items-center gap-1 text-xs transition-colors"
                        style={{
                          color: liked ? '#18181b' : '#a1a1aa',
                          border: '0.5px solid',
                          borderColor: liked ? '#e4e4e7' : '#f4f4f5',
                          borderRadius: 20,
                          padding: '2px 8px',
                          background: 'none',
                        }}
                      >
                        <HeartIcon filled={liked} />
                        <span>{r.likes}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── 我的印象分 ── */}
        <div
          style={{
            border: '0.5px solid #e4e4e7',
            borderRadius: 12,
            padding: 14,
          }}
        >
          <div className="text-xs font-medium mb-3" style={{ color: '#18181b' }}>
            {myReview ? '修改我的印象分' : '打印象分（1–10）'}
          </div>

          <div className="flex items-center gap-1 mb-3">
            {Array.from({ length: 10 }, (_, i) => {
              const n = i + 1;
              const lit = n <= (hoverStar || starRating);
              return (
                <span
                  key={n}
                  onClick={() => setStarRating(n)}
                  onMouseEnter={() => setHoverStar(n)}
                  onMouseLeave={() => setHoverStar(0)}
                  style={{
                    fontSize: 20,
                    cursor: 'pointer',
                    color: lit ? '#18181b' : '#e4e4e7',
                    lineHeight: 1,
                    userSelect: 'none',
                  }}
                >
                  ★
                </span>
              );
            })}
            <span className="text-xs ml-1" style={{ color: '#a1a1aa' }}>
              {starRating ? `${starRating} 分` : '点击评分'}
            </span>
          </div>

          <textarea
            value={reviewText}
            onChange={e => setReviewText(e.target.value)}
            placeholder="写下你的书评（可选）…"
            className="w-full text-xs outline-none resize-none"
            style={{
              padding: '7px 10px',
              border: '0.5px solid #e4e4e7',
              borderRadius: 8,
              height: 56,
              marginBottom: 8,
              color: '#18181b',
              fontFamily: 'inherit',
              backgroundColor: '#fafafa',
            }}
          />

          <button
            onClick={handleSubmitReview}
            disabled={submittingReview || !starRating}
            className="w-full text-sm font-medium py-2 rounded-lg transition-colors"
            style={{
              backgroundColor: starRating ? '#18181b' : '#f4f4f5',
              color: starRating ? '#fff' : '#a1a1aa',
              border: 'none',
            }}
          >
            {submittingReview ? '提交中…' : myReview ? '更新评分' : '提交评分'}
          </button>
        </div>

        {/* ── 查看完整帖子 ── */}
        <button
          onClick={() => onPostClick(book.post_id)}
          className="w-full py-2.5 text-sm transition-colors"
          style={{
            border: '0.5px solid #e4e4e7',
            borderRadius: 10,
            color: '#18181b',
            backgroundColor: 'transparent',
          }}
        >
          查看完整帖子 →
        </button>

        <div style={{ height: 24 }} />
      </div>
    </div>
  );
}
