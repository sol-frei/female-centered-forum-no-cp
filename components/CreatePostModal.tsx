import React, { useState, useRef } from 'react';
import { X, ImageIcon, Plus, Trash2, Loader, BookOpen, BarChart2 } from 'lucide-react';
import { User, Category } from '../types';
import { create_post, create_book_rating } from '../services/storage';
import { uploadImages, deleteImage } from '../services/storageService';
import BookRatingModal, { BookRatingData } from './BookRatingModal';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface CreatePostModalProps {
  user: User;
  onClose: () => void;
  onSuccess: () => void;
  showToast: (msg: string, type: ToastType) => void;
}

const CATEGORIES: Category[] = ['推书📖排雷', '讨论👊🏻i女', '求书🔍求作', '自荐🙋🏻分享', '组务❗组规'];

type ContentBlock =
  | { type: 'text'; value: string }
  | { type: 'image'; file: File; preview: string; id: string };

export default function CreatePostModal({ user, onClose, onSuccess, showToast }: CreatePostModalProps) {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<Category>('讨论👊🏻i女');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);

  // 投票
  const [enablePoll, setEnablePoll] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '']);
  const [isMultiple, setIsMultiple] = useState(false);
  const [pollDeadline, setPollDeadline] = useState('');

  // 图书评分
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [bookRating, setBookRating] = useState<BookRatingData | null>(null);

  // 富文本编辑器
  const editorRef = useRef<HTMLDivElement>(null);
  const [imageMap, setImageMap] = useState<Map<string, { file: File; preview: string }>>(new Map());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastSelectionRef = useRef<Range | null>(null);

  const saveSelection = () => {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      lastSelectionRef.current = selection.getRangeAt(0);
    }
  };

  const restoreSelection = () => {
    if (lastSelectionRef.current) {
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(lastSelectionRef.current);
    }
  };

  const insertImageAtCursor = (file: File) => {
    if (imageMap.size >= 9) { showToast('最多只能插入9张图片', 'warning'); return; }
    if (!file.type.startsWith('image/')) { showToast('只能上传图片文件', 'error'); return; }
    if (file.size > 5 * 1024 * 1024) { showToast('图片不能超过5MB', 'error'); return; }

    const reader = new FileReader();
    reader.onload = e => {
      const preview = e.target?.result as string;
      const imageId = `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      setImageMap(prev => new Map(prev).set(imageId, { file, preview }));

      const imgWrapper = document.createElement('div');
      imgWrapper.className = 'image-block';
      imgWrapper.contentEditable = 'false';
      imgWrapper.setAttribute('data-image-id', imageId);
      imgWrapper.style.cssText = 'position: relative; display: inline-block; margin: 8px 0; width: 100%; max-width: 100%;';

      const img = document.createElement('img');
      img.src = preview;
      img.style.cssText = 'max-width: 100%; max-height: 400px; border-radius: 8px; border: 1px solid #e4e4e7; display: block;';

      const deleteBtn = document.createElement('button');
      deleteBtn.innerHTML = '✕';
      deleteBtn.style.cssText = 'position: absolute; top: 8px; right: 8px; background: rgba(0,0,0,0.5); color: white; border: none; border-radius: 9999px; width: 28px; height: 28px; cursor: pointer; opacity: 0; transition: opacity 0.2s; font-size: 14px; display: flex; align-items: center; justify-content: center;';
      deleteBtn.onclick = (e) => {
        e.preventDefault(); e.stopPropagation();
        imgWrapper.remove();
        setImageMap(prev => { const next = new Map(prev); next.delete(imageId); return next; });
      };
      imgWrapper.onmouseenter = () => { deleteBtn.style.opacity = '1'; };
      imgWrapper.onmouseleave = () => { deleteBtn.style.opacity = '0'; };
      imgWrapper.appendChild(img);
      imgWrapper.appendChild(deleteBtn);

      restoreSelection();
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        range.deleteContents();
        range.insertNode(imgWrapper);
        range.collapse(false);
        const br = document.createElement('br');
        range.insertNode(br);
        range.setStartAfter(br);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
      } else {
        editorRef.current?.appendChild(imgWrapper);
        editorRef.current?.appendChild(document.createElement('br'));
      }
      editorRef.current?.focus();
    };
    reader.readAsDataURL(file);
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        e.preventDefault();
        const file = items[i].getAsFile();
        if (file) insertImageAtCursor(file);
        break;
      }
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    const file = e.dataTransfer?.files?.[0];
    if (file?.type.startsWith('image/')) insertImageAtCursor(file);
  };

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); };

  const handleImageButtonClick = () => { saveSelection(); fileInputRef.current?.click(); };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) { insertImageAtCursor(file); e.target.value = ''; }
  };

  const extractContentBlocks = (): ContentBlock[] => {
    const blocks: ContentBlock[] = [];
    const editor = editorRef.current;
    if (!editor) return blocks;
    const traverse = (node: Node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent || '';
        if (text.trim()) blocks.push({ type: 'text', value: text });
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const element = node as HTMLElement;
        if (element.classList.contains('image-block')) {
          const imageId = element.getAttribute('data-image-id');
          if (imageId && imageMap.has(imageId)) {
            const imageInfo = imageMap.get(imageId)!;
            blocks.push({ type: 'image', file: imageInfo.file, preview: imageInfo.preview, id: imageId });
          }
        } else {
          node.childNodes.forEach(child => traverse(child));
        }
      }
    };
    editor.childNodes.forEach(node => traverse(node));
    return blocks;
  };

  const totalTextLength = editorRef.current?.textContent?.length || 0;
  const imageCount = imageMap.size;

  const addPollOption = () => {
    if (pollOptions.length >= 10) { showToast('最多只能添加10个选项', 'warning'); return; }
    setPollOptions([...pollOptions, '']);
  };
  const removePollOption = (index: number) => {
    if (pollOptions.length <= 2) { showToast('至少需要2个选项', 'warning'); return; }
    setPollOptions(pollOptions.filter((_, i) => i !== index));
  };
  const updatePollOption = (index: number, value: string) => {
    const newOptions = [...pollOptions];
    newOptions[index] = value;
    setPollOptions(newOptions);
  };

  const validateForm = () => {
    if (!title.trim()) { showToast('请输入标题', 'error'); return false; }
    if (title.length > 100) { showToast('标题不能超过100字', 'error'); return false; }
    const contentText = editorRef.current?.textContent?.trim() || '';
    if (!contentText && imageMap.size === 0) { showToast('请输入内容', 'error'); return false; }
    if (totalTextLength > 10000) { showToast('内容不能超过10000字', 'error'); return false; }
    if (enablePoll) {
      if (!pollQuestion.trim()) { showToast('请输入投票问题', 'error'); return false; }
      if (pollOptions.filter(opt => opt.trim()).length < 2) { showToast('投票至少需要2个有效选项', 'error'); return false; }
      if (!pollDeadline) { showToast('请选择投票时长', 'error'); return false; }
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;
    setIsSubmitting(true);
    setUploadProgress(0);
    let uploadedImageUrls: string[] = [];

    try {
      const contentBlocks = extractContentBlocks();
      const imageBlocks = contentBlocks.filter(b => b.type === 'image') as Array<ContentBlock & { type: 'image' }>;

      if (imageBlocks.length > 0) {
        showToast('正在上传图片...', 'info');
        uploadedImageUrls = await uploadImages(
          imageBlocks.map(b => b.file),
          'forum_images',
          `posts/${user.id}`,
          (current, total) => setUploadProgress(Math.round((current / total) * 100))
        );
      }

      let imageUrlIndex = 0;
      const finalContent = contentBlocks
        .map(block => {
          if (block.type === 'text') return block.value.trim() ? { type: 'text', value: block.value.trim() } : null;
          if (block.type === 'image') return { type: 'image', url: uploadedImageUrls[imageUrlIndex++] };
          return null;
        })
        .filter(Boolean);

      let pollData = null;
      if (enablePoll) {
        const validOptions = pollOptions.filter(opt => opt.trim());
        const deadlineDate = new Date();
        deadlineDate.setDate(deadlineDate.getDate() + parseInt(pollDeadline));
        pollData = {
          question: pollQuestion.trim(),
          options: validOptions.map(opt => ({
            id: `opt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            text: opt.trim(),
            votes: []
          })),
          is_multiple: isMultiple,
          deadline: deadlineDate.toISOString(),
          total_votes: 0
        };
      }

      const newPost = await create_post({
        title,
        content: JSON.stringify(finalContent),
        category,
        user_id: user.id,
        user_name: user.user_name,
        images: uploadedImageUrls,
        poll: pollData,
      });

      if (bookRating) {
        try {
          // 【修复】如果填写了打分人(reviewer_name)，优先用它作为 user_name
          // 这样书架和帖子里显示的评分人保持一致
          const ratingUserName = bookRating.reviewer_name?.trim() && bookRating.reviewer_name !== '匿名发帖者'
            ? bookRating.reviewer_name.trim()
            : user.user_name;
          // user_name 放在 ...bookRating 之后，确保覆盖 bookRating 内部同名字段
          // as any 用于绕过类型检查，因为 create_book_rating 类型可能不包含 user_name
          await create_book_rating({
            post_id: newPost.id,
            user_id: user.id,
            ...bookRating,
            user_name: ratingUserName,
          } as any);
        } catch (error) {
          console.error('保存图书评分失败:', error);
          showToast('帖子发布成功，但评分保存失败', 'warning');
        }
      }

      showToast('发布成功', 'success');
      onSuccess();
    } catch (error: any) {
      console.error('发布失败:', error);
      if (uploadedImageUrls.length > 0) {
        try { await Promise.all(uploadedImageUrls.map(url => deleteImage(url))); } catch {}
      }
      showToast(error.message || '发布失败，请重试', 'error');
    } finally {
      setIsSubmitting(false);
      setUploadProgress(0);
    }
  };

  return (
    <div className="fixed inset-0 bg-white z-50 flex flex-col">
      {/* 顶部栏 */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-zinc-100">
        <button
          onClick={onClose}
          disabled={isSubmitting}
          className="p-1.5 hover:bg-zinc-100 rounded-full transition-colors text-zinc-500"
        >
          <X className="w-5 h-5" />
        </button>
        <button
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="flex items-center gap-1.5 px-5 py-1.5 bg-black text-white text-sm font-medium rounded-full hover:bg-zinc-800 transition-colors disabled:bg-zinc-300 disabled:cursor-not-allowed"
        >
          {isSubmitting && <Loader className="w-3.5 h-3.5 animate-spin" />}
          {isSubmitting ? '发布中...' : '发布'}
        </button>
      </div>

      {/* 上传进度 */}
      {isSubmitting && uploadProgress > 0 && uploadProgress < 100 && (
        <div className="h-1 bg-zinc-100">
          <div className="h-full bg-black transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
        </div>
      )}

      {/* 表单内容 */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-6 py-6 space-y-5">

          {/* 分类 */}
          <div>
            <label className="block text-sm font-bold mb-2 text-zinc-700">分类 *</label>
            <select
              value={category}
              onChange={e => setCategory(e.target.value as Category)}
              disabled={isSubmitting}
              className="w-full p-3 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black disabled:opacity-50"
            >
              {CATEGORIES.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          {/* 标题 */}
          <div>
            <label className="block text-sm font-bold mb-2 text-zinc-700">
              标题 * <span className="text-xs text-zinc-400 font-normal">({title.length}/100)</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              maxLength={100}
              disabled={isSubmitting}
              placeholder="标题建议加上前缀如 【推书】"
              className="w-full p-3 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black disabled:opacity-50"
            />
          </div>

          {/* 内容编辑器 */}
          <div className="border border-zinc-200 rounded-xl overflow-hidden">
            {/* 编辑区 */}
            <div
              ref={editorRef}
              contentEditable={!isSubmitting}
              onPaste={handlePaste}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              className="w-full min-h-[280px] p-4 text-zinc-800 focus:outline-none overflow-y-auto"
              style={{ wordWrap: 'break-word', whiteSpace: 'pre-wrap' }}
              data-placeholder="写点什么..."
            />

            {/* 工具栏：底部 */}
            <div className="flex items-center gap-1 px-3 py-2 border-t border-zinc-100 bg-zinc-50">
              {/* 插入图片 */}
              <button
                type="button"
                onClick={handleImageButtonClick}
                disabled={isSubmitting || imageCount >= 9}
                title="插入图片"
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-200 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ImageIcon className="w-4 h-4" />
                <span>图片</span>
                {imageCount > 0 && <span className="text-xs text-zinc-400">{imageCount}/9</span>}
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />

              {/* 图书评分 */}
              <button
                type="button"
                onClick={() => setShowRatingModal(true)}
                disabled={isSubmitting}
                title="添加图书评分"
                className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition-colors disabled:opacity-40 ${
                  bookRating
                    ? 'text-purple-700 bg-purple-100 hover:bg-purple-200'
                    : 'text-zinc-600 hover:bg-zinc-200'
                }`}
              >
                <BookOpen className="w-4 h-4" />
                <span>{bookRating ? `评分 ${bookRating.final_score.toFixed(1)}` : '评分'}</span>
              </button>

              {/* 投票 */}
              <button
                type="button"
                onClick={() => setEnablePoll(!enablePoll)}
                disabled={isSubmitting}
                title="添加投票"
                className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition-colors disabled:opacity-40 ${
                  enablePoll
                    ? 'text-blue-700 bg-blue-100 hover:bg-blue-200'
                    : 'text-zinc-600 hover:bg-zinc-200'
                }`}
              >
                <BarChart2 className="w-4 h-4" />
                <span>投票</span>
              </button>

              <span className="ml-auto text-xs text-zinc-300">{totalTextLength}/10000</span>
            </div>
          </div>

          {/* 图书评分预览（已添加时展示） */}
          {bookRating && (
            <div className="p-4 bg-purple-50 rounded-xl border border-purple-100">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="font-medium text-zinc-800">《{bookRating.book_name}》</p>
                  <p className="text-sm text-zinc-500">{bookRating.book_author}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowRatingModal(true)}
                  className="text-xs text-purple-600 hover:underline"
                >
                  修改
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-white rounded-lg p-2 text-center">
                  <div className="text-base font-bold text-blue-600">{bookRating.impressed_score}</div>
                  <div className="text-[10px] text-zinc-400">印象分</div>
                </div>
                <div className="bg-white rounded-lg p-2 text-center">
                  <div className="text-base font-bold text-red-500">
                    -{(bookRating.impressed_score - bookRating.final_score - bookRating.extra_deduction).toFixed(1)}
                  </div>
                  <div className="text-[10px] text-zinc-400">准则扣分</div>
                </div>
                <div className="bg-white rounded-lg p-2 text-center">
                  <div className="text-base font-bold text-purple-600">{bookRating.final_score.toFixed(1)}</div>
                  <div className="text-[10px] text-zinc-400">最终得分</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setBookRating(null)}
                className="mt-3 text-xs text-red-500 hover:underline"
              >
                移除评分
              </button>
            </div>
          )}

          {/* 投票设置（展开时显示） */}
          {enablePoll && (
            <div className="p-4 bg-blue-50 rounded-xl border border-blue-100 space-y-3">
              <p className="text-sm font-medium text-zinc-700">投票设置</p>
              <input
                type="text"
                value={pollQuestion}
                onChange={e => setPollQuestion(e.target.value)}
                disabled={isSubmitting}
                placeholder="投票问题"
                className="w-full p-2.5 border border-zinc-200 rounded-lg text-sm bg-white outline-none focus:ring-1 focus:ring-black"
              />
              <div className="space-y-2">
                {pollOptions.map((option, index) => (
                  <div key={index} className="flex gap-2">
                    <input
                      type="text"
                      value={option}
                      onChange={e => updatePollOption(index, e.target.value)}
                      disabled={isSubmitting}
                      placeholder={`选项 ${index + 1}`}
                      className="flex-1 p-2.5 border border-zinc-200 rounded-lg text-sm bg-white outline-none focus:ring-1 focus:ring-black"
                    />
                    {pollOptions.length > 2 && (
                      <button onClick={() => removePollOption(index)} disabled={isSubmitting} className="p-2 text-zinc-400 hover:text-red-500 rounded-lg">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {pollOptions.length < 10 && (
                <button onClick={addPollOption} disabled={isSubmitting} className="flex items-center gap-1 text-sm text-blue-600 hover:underline">
                  <Plus className="w-4 h-4" /> 添加选项
                </button>
              )}
              <div className="flex items-center gap-4 pt-1">
                <label className="flex items-center gap-2 text-sm text-zinc-600 cursor-pointer">
                  <input type="checkbox" checked={isMultiple} onChange={e => setIsMultiple(e.target.checked)} className="w-4 h-4 accent-black" />
                  允许多选
                </label>
                <select
                  value={pollDeadline}
                  onChange={e => setPollDeadline(e.target.value)}
                  disabled={isSubmitting}
                  className="flex-1 px-2 py-1.5 border border-zinc-200 rounded-lg text-sm bg-white outline-none"
                >
                  <option value="">投票时长</option>
                  <option value="1">1天</option>
                  <option value="3">3天</option>
                  <option value="7">7天</option>
                  <option value="15">15天</option>
                  <option value="30">30天</option>
                </select>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* CSS placeholder */}
      <style>{`
        [contenteditable][data-placeholder]:empty:before {
          content: attr(data-placeholder);
          color: #d4d4d8;
          pointer-events: none;
        }
        [contenteditable] { outline: none; }
      `}</style>

      {/* 图书评分弹窗 */}
      {showRatingModal && (
        <BookRatingModal
          onClose={() => setShowRatingModal(false)}
          onSave={(ratingData) => {
            setBookRating(ratingData);
            setShowRatingModal(false);
            showToast('评分已添加', 'success');
          }}
          showToast={showToast}
          initialData={bookRating || undefined}
        />
      )}
    </div>
  );
}