import React, { useState, useRef, useEffect } from 'react';
import { ArrowLeft, Edit2, ChevronDown, ChevronUp, X } from 'lucide-react';
import { BookRating, ReaderReview } from '../types';

import {
  upload_book_cover,
  upload_character_illustration,
  update_book_intro,
  submit_reader_review,
  toggle_review_like,
  check_sensitive_words,
} from '../services/storage';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface BookDetailProps {
  book: BookRating;
  currentUserId: string;
  currentUserName: string;
  /**
   * 当前用户的角色标识。
   * 取值建议：'admin' | 'i女er' | 'user' 或任意字符串。
   * 发帖人通过 book.author_id === currentUserId 判断。
   */
  currentUserRole?: string;
  onNavigateBack: () => void;
  onPostClick: (postId: string) => void;
  showToast: (msg: string, type: ToastType) => void;
}

const STATUS_LABEL: Record<string, string> = {
  finished: '完结',
  ongoing: '连载中',
  hiatus: '断更',
};

// ── 图片压缩工具函数 ──────────────────────────────────────────────
/**
 * 在上传前压缩图片。
 * - 封面：最长边限制 1200px，质量 0.85
 * - 人物图：最长边限制 800px，质量 0.82
 * 压缩后以 File 对象返回，保持原始文件名与 MIME 类型。
 */
async function compressImage(
  file: File,
  maxSize: number,
  quality: number
): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      let { width, height } = img;

      // 按比例缩放：只在超出限制时缩小，不放大
      if (width > maxSize || height > maxSize) {
        if (width >= height) {
          height = Math.round((height / width) * maxSize);
          width = maxSize;
        } else {
          width = Math.round((width / height) * maxSize);
          height = maxSize;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('canvas context unavailable')); return; }

      // 高质量缩放
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, width, height);

      // 优先 webp（体积更小），不支持则回退原格式
      const mimeType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
      canvas.toBlob(
        (blob) => {
          if (!blob) { reject(new Error('toBlob failed')); return; }
          const compressed = new File([blob], file.name, { type: mimeType, lastModified: Date.now() });
          resolve(compressed);
        },
        mimeType,
        quality
      );
    };

    img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('image load failed')); };
    img.src = objectUrl;
  });
}

// ── 内部图标组件 ──────────────────────────────────────────────────
function BookIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-8 h-8 opacity-20">
      <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
    </svg>
  );
}

function PersonIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-6 h-6 opacity-20">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.58-7 8-7s8 3 8 7" />
    </svg>
  );
}

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill={filled ? '#ef4444' : 'none'}
      stroke={filled ? '#ef4444' : '#d1d5db'} strokeWidth="2" className="w-4 h-4">
      <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
    </svg>
  );
}

// ── 图片灯箱组件 ──────────────────────────────────────────────────
interface LightboxProps {
  url: string;
  alt?: string;
  onClose: () => void;
}
function ImageLightbox({ url, alt = '', onClose }: LightboxProps) {
  // 点击背景或按 ESC 关闭
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      {/* 关闭按钮 */}
      <button
        className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
        onClick={onClose}
      >
        <X className="w-5 h-5 text-white" />
      </button>
      {/* 图片：点击图片本身不冒泡关闭 */}
      <img
        src={url}
        alt={alt}
        className="max-w-[90vw] max-h-[85vh] rounded-xl object-contain shadow-2xl"
        onClick={e => e.stopPropagation()}
      />
    </div>
  );
}

export default function BookDetail({
  book: initialBook,
  currentUserId,
  currentUserName,
  currentUserRole = 'user',
  onNavigateBack,
  onPostClick,
  showToast,
}: BookDetailProps) {
  const [book, setBook] = useState<BookRating>(initialBook);
  const [editingIntro, setEditingIntro] = useState(false);
  const [introText, setIntroText] = useState(initialBook.book_intro || '');
  const [introExpanded, setIntroExpanded] = useState(false);

  // ── 评价弹窗状态 ──
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [starRating, setStarRating] = useState(0);
  const [hoverStar, setHoverStar] = useState(0);
  const [reviewText, setReviewText] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadingCharIdx, setUploadingCharIdx] = useState<number | null>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const charInputRef = useRef<HTMLInputElement>(null);
  const [pendingCharIdx, setPendingCharIdx] = useState<number | null>(null);

  // ── 灯箱状态 ──
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [lightboxAlt, setLightboxAlt] = useState('');

  const reviews: ReaderReview[] = book.reader_reviews || [];
  const myReview = reviews.find(r => r.user_id === currentUserId);

  // ── 权限判断 ──────────────────────────────────────────────────────
  // book_ratings_full 视图中发帖人字段为 user_id（非 author_id）
  const isAuthor = book.user_id === currentUserId;
  const isIer    = currentUserRole === 'i女er';
  const isAdmin  = currentUserRole === 'admin';
  const canEdit  = isAuthor || isIer || isAdmin;

  // 仅同步当前用户已有评价的初始值，不重复拉取整个 book（避免提交后"闪两次"）
  useEffect(() => {
    const existingReview = (initialBook.reader_reviews || []).find(
      (r: ReaderReview) => r.user_id === currentUserId
    );
    if (existingReview) {
      setStarRating(existingReview.impression_score);
      setReviewText(existingReview.review_text || '');
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── 处理逻辑 ──────────────────────────────────────────────────────
  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !book.id) return;
    // 权限二次校验
    if (!canEdit) { showToast('没有修改权限', 'warning'); return; }
    setUploadingCover(true);
    try {
      // 压缩：最长边 1200px，质量 0.85
      const compressed = await compressImage(file, 1200, 0.85);
      const url = await upload_book_cover(book.id, compressed);
      setBook(prev => ({ ...prev, cover_url: url }));
      showToast('封面上传成功', 'success');
    } catch {
      showToast('上传失败', 'error');
    } finally {
      setUploadingCover(false);
      // 清空 input value，保证同一文件可重复选择
      if (coverInputRef.current) coverInputRef.current.value = '';
    }
  };

  const handleCharUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || pendingCharIdx === null || !book.id) return;
    if (!canEdit) { showToast('没有修改权限', 'warning'); return; }
    setUploadingCharIdx(pendingCharIdx);
    try {
      // 压缩：最长边 800px，质量 0.82（头像尺寸更小）
      const compressed = await compressImage(file, 800, 0.82);
      const updated = await upload_character_illustration(book.id, pendingCharIdx, compressed, book.book_characters || []);
      setBook(prev => ({ ...prev, book_characters: updated }));
      showToast('人物图上传成功', 'success');
    } catch {
      showToast('上传失败', 'error');
    } finally {
      setUploadingCharIdx(null);
      setPendingCharIdx(null);
      if (charInputRef.current) charInputRef.current.value = '';
    }
  };

  const handleSaveIntro = async () => {
    if (!book.id) return;
    if (!canEdit) { showToast('没有修改权限', 'warning'); return; }
    try {
      await check_sensitive_words(introText);
      await update_book_intro(book.id, introText);
      setBook(prev => ({ ...prev, book_intro: introText }));
      setEditingIntro(false);
      showToast('简介已更新', 'success');
    } catch (err: any) {
      showToast(err?.message || '保存失败', 'error');
    }
  };

  const handleSubmitReview = async () => {
    if (!starRating) { showToast('请先选择分数', 'warning'); return; }
    if (!book.id) return;
    setSubmittingReview(true);
    try {
      await check_sensitive_words(reviewText);
      const { freshBook } = await submit_reader_review(
        book.id,
        reviews,
        {
          user_id: currentUserId,
          user_name: currentUserName,
          impression_score: starRating,
          review_text: reviewText,
        }
      );
      // 把所有成功后的 setState 放在同一个 React.startTransition 批次里，
      // 保证只触发一次渲染，消除双重刷新。
      React.startTransition(() => {
        setBook({ ...freshBook, reader_reviews: freshBook.reader_reviews || [] });
        setIsReviewModalOpen(false);
        setSubmittingReview(false);
      });
      showToast('提交成功', 'success');
    } catch (err: any) {
      setSubmittingReview(false);
      showToast(err?.message || '提交失败', 'error');
    }
  };

  const handleToggleLike = async (reviewIndex: number) => {
    if (!book.id) return;
    // 乐观更新：先立即更新本地状态，不等网络返回，体感更快
    const optimistic = reviews.map((r, i) => {
      if (i !== reviewIndex) return r;
      const liked = r.liked_by.includes(currentUserId);
      return {
        ...r,
        likes: liked ? r.likes - 1 : r.likes + 1,
        liked_by: liked ? r.liked_by.filter(id => id !== currentUserId) : [...r.liked_by, currentUserId],
      };
    });
    setBook(prev => ({ ...prev, reader_reviews: optimistic }));
    try {
      // 后台同步，失败时回滚
      await toggle_review_like(book.id, reviews, reviewIndex, currentUserId);
    } catch {
      setBook(prev => ({ ...prev, reader_reviews: reviews })); // 回滚
      showToast('点赞操作失败', 'error');
    }
  };

  const sectionCard = "bg-white rounded-2xl border border-zinc-100 p-5";
  // 移动端可读字号：标题 16px（font-bold），正文统一用 text-base(16px) 或 text-[15px]
  const sectionTitle = "text-[17px] font-bold text-zinc-800 mb-4 flex items-center gap-2";

  return (
    <div className="relative min-h-screen bg-[#fafafa] pb-32 text-zinc-900">
      {/* ── 顶栏 ── */}
      <div className="sticky top-0 z-40 w-full bg-white/70 backdrop-blur-md border-b border-zinc-100 px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <button onClick={onNavigateBack} className="text-zinc-500 hover:text-black flex items-center gap-1 transition-colors">
            <ArrowLeft className="w-5 h-5" />
            <span className="text-sm font-medium">返回</span>
          </button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">

        {/* ── Hero 区域 ── */}
        <div className="flex gap-6 items-start">
          {/* 封面：有权限→上传，无权限且有图→灯箱预览 */}
          <div
            className={`flex-shrink-0 relative shadow-md ${
              canEdit ? 'group cursor-pointer'
              : book.cover_url ? 'cursor-zoom-in'
              : 'cursor-default'
            }`}
            style={{ width: 100, height: 140, borderRadius: 10, overflow: 'hidden', border: '1px solid #f4f4f5' }}
            onClick={() => {
              if (canEdit) { coverInputRef.current?.click(); return; }
              if (book.cover_url) { setLightboxUrl(book.cover_url); setLightboxAlt(book.book_name); }
            }}
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
            {/* 悬浮提示仅对有权限用户展示 */}
            {canEdit && (
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-center pb-2">
                <span className="text-white text-[10px]">更换封面</span>
              </div>
            )}
          </div>
          <input ref={coverInputRef} type="file" accept="image/*" className="hidden" onChange={handleCoverUpload} />

          {/* 书名、作者、标签 */}
          <div className="flex-1 flex flex-col justify-between h-[140px]">
            <div>
              <h1 className="text-xl sm:text-2xl font-extrabold leading-tight mb-0.5">{book.book_name}</h1>
              {/* 作者行：加"作者"标签 */}
              <p className="text-sm text-zinc-400 mb-2">
                <span className="text-[11px] bg-zinc-100 text-zinc-400 px-1.5 py-0.5 rounded mr-1.5 font-medium">作者</span>
                {book.book_author}
              </p>
              {/* 标签行：flex-nowrap 防换行，超出滚动 */}
              <div className="flex flex-nowrap gap-1.5 items-center overflow-x-auto scrollbar-hide">
                {book.book_category && (
                  <span className="flex-shrink-0 px-2 py-0.5 rounded-md bg-zinc-50 border border-zinc-100 text-zinc-500 text-xs">{book.book_category}</span>
                )}
                {book.serial_status && (
                  <span className="flex-shrink-0 px-2 py-0.5 rounded-md bg-zinc-50 text-zinc-500 text-xs">{STATUS_LABEL[book.serial_status]}</span>
                )}
                <button
                  onClick={() => onPostClick(book.post_id)}
                  className="flex-shrink-0 h-6 px-2.5 rounded-full bg-zinc-900 text-white flex items-center justify-center active:scale-95 transition-all shadow-sm text-xs font-bold whitespace-nowrap"
                >
                  {book.recommendation_tag === 'recommend' ? '推荐帖' : '排雷帖'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ── 评分卡片 + 评价按钮 ── */}
        <section className={sectionCard+" -mx-3"}>
          <div className="flex items-center justify-between">
            <div className="flex items-baseline gap-2">
              <span className="text-5xl font-black text-zinc-900 leading-none">{book.final_score.toFixed(1)}</span>
              <span className="text-zinc-300 text-2xl font-light leading-none">/</span>
              <span className="text-zinc-400 text-xl font-bold leading-none">10</span>
            </div>
            <div className="flex flex-col items-end gap-2">
              {/* 移动端评价人数字号从 text-[11px] 提升到 text-xs */}
              <div className="text-xs text-zinc-400">{reviews.length + 1} 人已评</div>
              <div className="flex gap-0.5">
                {[...Array(10)].map((_, i) => (
                  <div
                    key={i}
                    className={`w-1.5 h-4 rounded-sm ${i < Math.round(book.final_score) ? 'bg-zinc-800' : 'bg-zinc-100'}`}
                  />
                ))}
              </div>
              <button
                onClick={() => setIsReviewModalOpen(true)}
                className="mt-1 bg-zinc-900 text-white px-4 py-1.5 rounded-lg text-xs font-bold hover:bg-black active:scale-95 transition-all"
              >
                {myReview ? '修改评价' : '我读过'}
              </button>
            </div>
          </div>
        </section>

        {/* ── 简介 ── */}
        <section className={sectionCard + " -mx-3"}>
          <div className="flex justify-between items-center mb-2">
            <h2 className={sectionTitle}>书籍简介</h2>
            {/* 编辑按钮仅对有权限用户展示 */}
            {!editingIntro && canEdit && (
              <button onClick={() => setEditingIntro(true)} className="text-zinc-400 hover:text-zinc-600">
                <Edit2 className="w-4 h-4" />
              </button>
            )}
          </div>
          {editingIntro ? (
            <div className="space-y-3">
              <textarea
                value={introText}
                onChange={e => setIntroText(e.target.value)}
                className="w-full text-base p-3 bg-zinc-50 border border-zinc-200 rounded-xl outline-none min-h-[140px] leading-[1.85]"
              />
              <div className="flex gap-2 justify-end">
                <button onClick={() => setEditingIntro(false)} className="px-4 py-1.5 text-sm text-zinc-400">取消</button>
                <button onClick={handleSaveIntro} className="px-4 py-1.5 text-sm bg-zinc-900 text-white rounded-lg">保存</button>
              </div>
            </div>
          ) : (
            <div className="relative -mx-5 px-4">
              <div
                className={`text-zinc-600 text-[17px] leading-[1.9] transition-all duration-300 ${!introExpanded && 'max-h-36 overflow-hidden'}`}
                style={{ whiteSpace: 'pre-wrap' }}
              >
                {book.book_intro || '暂无简介...'}
              </div>
              {book.book_intro && book.book_intro.length > 100 && (
                <button
                  onClick={() => setIntroExpanded(!introExpanded)}
                  className="w-full mt-3 py-1 text-xs font-bold text-zinc-400 flex items-center justify-center gap-1 border-t border-zinc-50"
                >
                  {introExpanded
                    ? <><ChevronUp className="w-3 h-3" /> 收起内容</>
                    : <><ChevronDown className="w-3 h-3" /> 展开全文</>}
                </button>
              )}
            </div>
          )}
        </section>

        {/* ── 人物图 ── */}
        {book.book_characters && book.book_characters.length > 0 && (
          <section>
            <h2 className={sectionTitle + " px-1"}>人物档案</h2>
            <div className="flex gap-4 overflow-x-auto pb-4 px-1 scrollbar-hide">
              {book.book_characters.map((char, idx) => (
              <div
                  key={idx}
                  className={`flex-shrink-0 w-20 ${
                    canEdit ? 'group cursor-pointer'
                    : char.illustration_url ? 'cursor-zoom-in'
                    : 'cursor-default'
                  }`}
                  onClick={() => {
                    if (canEdit) { setPendingCharIdx(idx); charInputRef.current?.click(); return; }
                    if (char.illustration_url) { setLightboxUrl(char.illustration_url); setLightboxAlt(char.name); }
                  }}
                >
                  <div className="w-20 h-20 rounded-full bg-zinc-100 border-2 border-white shadow-sm overflow-hidden mb-2 relative">
                    {uploadingCharIdx === idx ? (
                      <div className="absolute inset-0 flex items-center justify-center bg-zinc-50/80">
                        <div className="w-4 h-4 border-2 border-zinc-200 border-t-zinc-800 rounded-full animate-spin" />
                      </div>
                    ) : char.illustration_url ? (
                      <img src={char.illustration_url} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center"><PersonIcon /></div>
                    )}
                    {/* 悬浮编辑图标仅对有权限用户 */}
                    {canEdit && (
                      <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Edit2 className="w-4 h-4 text-white" />
                      </div>
                    )}
                  </div>
                  <div className="text-center">
                    <div className="text-[15px] font-bold text-zinc-800 truncate">{char.name}</div>
                    <div className="text-sm text-zinc-400 mt-0.5">{char.role}</div>
                  </div>
                </div>
              ))}
            </div>
            <input ref={charInputRef} type="file" accept="image/*" className="hidden" onChange={handleCharUpload} />
          </section>
        )}

        {/* ── 书友短评 ── */}
        <section className="space-y-4">
          <h2 className={sectionTitle + " -mx-3"}>读者评论 ({reviews.length})</h2>
          {reviews.length === 0 ? (
            <div className="text-center py-10 text-zinc-400 text-sm">暂无评论</div>
          ) : (
            <div className="space-y-3">
              {reviews.map((r, i) => (
                <div key={i} className="bg-white p-4 rounded-xl border border-zinc-100">
                  <div className="flex justify-between items-center mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-zinc-50 border border-zinc-100 flex items-center justify-center text-xs font-bold text-zinc-400 uppercase">
                        {r.user_name.charAt(0)}
                      </div>
                      <span className="text-[15px] font-bold text-zinc-700">{r.user_name}</span>
                    </div>
                    {/* SCORE + 点赞同行，节省空间；点赞用乐观更新立即响应 */}
                    <div className="flex items-center gap-2">
                      <div className="text-sm font-black bg-zinc-50 px-2 py-0.5 rounded text-zinc-400 italic uppercase">
                        印象分 {r.impression_score.toFixed(1)}
                      </div>
                      <button
                        onClick={() => handleToggleLike(i)}
                        className={`flex items-center gap-1 text-xs transition-colors ${r.liked_by.includes(currentUserId) ? 'text-red-500' : 'text-zinc-300'}`}
                      >
                        <HeartIcon filled={r.liked_by.includes(currentUserId)} />
                        {r.likes}
                      </button>
                    </div>
                  </div>
                  <p className="text-base text-zinc-600 leading-[1.85] pl-10">{r.review_text}</p>
                </div>
              ))}
            </div>
          )}
        </section>

      </div>

      {/* ── 评价弹窗 ── */}
      {isReviewModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm animate-in fade-in duration-300"
            onClick={() => setIsReviewModalOpen(false)}
          />

          <section className="relative w-full max-w-lg bg-zinc-50 rounded-[24px] p-6 text-zinc-900 shadow-2xl animate-in slide-in-from-bottom-10 duration-300">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-base font-bold flex items-center gap-2">
                <span className="w-2 h-2 bg-zinc-900 rounded-full"></span>
                {myReview ? '修改我的评价' : '发表我的印象分'}
              </h2>
              <button onClick={() => setIsReviewModalOpen(false)} className="p-1 hover:bg-zinc-100 rounded-full transition-colors">
                <X className="w-5 h-5 text-zinc-400" />
              </button>
            </div>

            {/* 评分区域 */}
            <div className="flex flex-col items-center gap-4 mb-6">
              <div className="flex items-center gap-1.5 overflow-x-auto w-full justify-center px-2 scrollbar-hide">
                {[...Array(10)].map((_, i) => (
                  <button
                    key={i}
                    onMouseEnter={() => setHoverStar(i + 1)}
                    onMouseLeave={() => setHoverStar(0)}
                    onClick={() => setStarRating(i + 1)}
                    className={`text-2xl transition-all duration-200 ${(hoverStar || starRating) > i ? 'text-zinc-900 scale-110' : 'text-zinc-200 hover:text-zinc-400'}`}
                  >
                    ★
                  </button>
                ))}
              </div>
              <span className="text-3xl font-black text-zinc-900 italic leading-none">{starRating || '0'}</span>
            </div>

            <textarea
              value={reviewText}
              onChange={e => setReviewText(e.target.value)}
              placeholder="写下你对此书的排雷或安利感悟..."
              className="w-full bg-zinc-100 border border-zinc-200 rounded-2xl p-4 text-base text-zinc-900 placeholder:text-zinc-400 focus:ring-1 focus:ring-zinc-300 outline-none min-h-[140px] mb-6 leading-[1.85]"
            />

            <button
              onClick={handleSubmitReview}
              disabled={submittingReview || !starRating}
              className={`w-full py-4 rounded-2xl text-base font-black transition-all active:scale-[0.98] ${starRating ? 'bg-zinc-900 text-white shadow-xl hover:bg-black' : 'bg-zinc-200 text-zinc-500 cursor-not-allowed'}`}
            >
              {submittingReview ? '正在提交...' : myReview ? '更新评价' : '发布评价'}
            </button>
          </section>
        </div>
      )}

      {/* ── 图片灯箱 ── */}
      {lightboxUrl && (
        <ImageLightbox
          url={lightboxUrl}
          alt={lightboxAlt}
          onClose={() => { setLightboxUrl(null); setLightboxAlt(''); }}
        />
      )}
    </div>
  );
}
