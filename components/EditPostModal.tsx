import React, { useState, useRef, useEffect } from 'react';
import { X, ImageIcon, Trash2, Loader, BookOpen } from 'lucide-react';
import { User, Category, BookRating } from '../types';
import { update_post, update_book_rating, create_book_rating ,check_sensitive_words} from '../services/storage';
import { uploadImages, deleteImage } from '../services/storageService';
import BookRatingModal, { BookRatingData } from './BookRatingModal';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface EditPostModalProps {
  user: User;
  post: any;
  bookRating: BookRating | null;
  onClose: () => void;
  onSuccess: () => void;
  showToast: (msg: string, type: ToastType) => void;
}

const CATEGORIES: Category[] = ['📍 旧屋路标', '🔨 雕梁画栋', '🎉 乔迁之喜', '🏠建设经验', '组务❗组规'];

export default function EditPostModal({ user, post, bookRating, onClose, onSuccess, showToast }: EditPostModalProps) {
  const [title, setTitle] = useState(post.title);
  const [category, setCategory] = useState<Category>(post.category);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);

  // 图书评分状态
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [editRating, setEditRating] = useState<BookRatingData | null>(
    bookRating ? {
      book_name: bookRating.book_name,
      book_author: bookRating.book_author,
      book_platform: bookRating.book_platform,
      reviewer_name: bookRating.reviewer_name ?? '',
      // 回填原始印象分（而非被读者评分平均过的值），确保编辑时看到的是评分人录入的原始值
      impressed_score: bookRating.post_impressed_score ?? bookRating.impressed_score,
      principle_scores: bookRating.principle_scores,
      principle_remarks: bookRating.principle_remarks,
      extra_deduction: bookRating.extra_deduction,
      extra_remark: bookRating.extra_remark,
      final_score: bookRating.post_final_score ?? bookRating.final_score,
      // 补全扩展字段，防止 update_book_rating 时丢失
      book_characters: bookRating.book_characters,
      book_category: bookRating.book_category,
      book_intro: bookRating.book_intro,
      cover_url: bookRating.cover_url,
      serial_status: bookRating.serial_status,
      recommendation_tag: bookRating.recommendation_tag,
      reader_reviews: bookRating.reader_reviews,
      reviewer_comment: bookRating.reviewer_comment,
      original_impressed_score: bookRating.original_impressed_score,
    } as BookRatingData : null
  );

  // 富文本编辑器
  const editorRef = useRef<HTMLDivElement>(null);
  const [imageMap, setImageMap] = useState<Map<string, { file?: File; url?: string; preview: string }>>(new Map());
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 初始化编辑器内容
  useEffect(() => {
    if (!editorRef.current) return;
    
    try {
      const blocks = JSON.parse(post.content);
      if (Array.isArray(blocks)) {
        editorRef.current.innerHTML = '';
        const map = new Map();
        
        blocks.forEach((block, index) => {
          if (block.type === 'text') {
            const textNode = document.createTextNode(block.value);
            editorRef.current!.appendChild(textNode);
            editorRef.current!.appendChild(document.createElement('br'));
          } else if (block.type === 'image') {
            const imageId = `img_${index}`;
            map.set(imageId, { url: block.url, preview: block.url });
            
            const imgWrapper = createImageElement(imageId, block.url);
            editorRef.current!.appendChild(imgWrapper);
            editorRef.current!.appendChild(document.createElement('br'));
          }
        });
        
        setImageMap(map);
      }
    } catch {
      editorRef.current.textContent = post.content;
    }
  }, []);

  const createImageElement = (imageId: string, previewUrl: string) => {
    const imgWrapper = document.createElement('div');
    imgWrapper.className = 'image-block';
    imgWrapper.contentEditable = 'false';
    imgWrapper.setAttribute('data-image-id', imageId);
    imgWrapper.style.cssText = 'position: relative; display: inline-block; margin: 8px 0; width: 100%; max-width: 100%;';

    const img = document.createElement('img');
    img.src = previewUrl;
    img.style.cssText = 'max-width: 100%; max-height: 400px; border-radius: 8px; border: 1px solid #e4e4e7; display: block;';
    
    const deleteBtn = document.createElement('button');
    deleteBtn.innerHTML = '✕';
    deleteBtn.className = 'delete-image-btn';
    deleteBtn.style.cssText = 'position: absolute; top: 8px; right: 8px; background: rgba(0,0,0,0.5); color: white; border: none; border-radius: 9999px; width: 28px; height: 28px; cursor: pointer; opacity: 0; transition: opacity 0.2s; font-size: 14px; display: flex; align-items: center; justify-content: center;';
    deleteBtn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      imgWrapper.remove();
      setImageMap(prev => {
        const next = new Map(prev);
        next.delete(imageId);
        return next;
      });
    };

    imgWrapper.onmouseenter = () => { deleteBtn.style.opacity = '1'; };
    imgWrapper.onmouseleave = () => { deleteBtn.style.opacity = '0'; };

    imgWrapper.appendChild(img);
    imgWrapper.appendChild(deleteBtn);
    
    return imgWrapper;
  };

  const insertImage = (file: File) => {
    if (!file.type.startsWith('image/')) { showToast('只能上传图片文件', 'error'); return; }
    if (file.size > 5 * 1024 * 1024) { showToast('图片不能超过5MB', 'error'); return; }

    const reader = new FileReader();
    reader.onload = e => {
      const preview = e.target?.result as string;
      const imageId = `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      setImageMap(prev => new Map(prev).set(imageId, { file, preview }));
      
      const imgWrapper = createImageElement(imageId, preview);
      
      if (editorRef.current) {
        editorRef.current.appendChild(imgWrapper);
        editorRef.current.appendChild(document.createElement('br'));
        editorRef.current.focus();
      }
    };
    reader.readAsDataURL(file);
  };

  const extractContentBlocks = (): any[] => {
    const blocks: any[] = [];
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
            blocks.push({ type: 'image', file: imageInfo.file, url: imageInfo.url, id: imageId });
          }
        } else {
          node.childNodes.forEach(child => traverse(child));
        }
      }
    };

    editor.childNodes.forEach(node => traverse(node));
    return blocks;
  };

  const handleSubmit = async () => {
    if (!title.trim()) { showToast('请输入标题', 'error'); return; }

    const contentText = editorRef.current?.textContent?.trim() || '';
    if (!contentText && imageMap.size === 0) { showToast('请输入内容', 'error'); return; }

    setIsSubmitting(true);
    setUploadProgress(0);

    try {
      const contentBlocks = extractContentBlocks();
      
      const newImageBlocks = contentBlocks.filter(b => b.type === 'image' && b.file);
      let uploadedUrls: string[] = [];
      
      if (newImageBlocks.length > 0) {
        showToast('正在上传图片...', 'info');
        uploadedUrls = await uploadImages(
          newImageBlocks.map(b => b.file),
          'forum_images',
          `posts/${user.id}`,
          (current, total) => setUploadProgress(Math.round((current / total) * 100))
        );
      }
      
      let uploadIndex = 0;
      const finalContent = contentBlocks
        .map(block => {
          if (block.type === 'text') return block.value.trim() ? { type: 'text', value: block.value.trim() } : null;
          if (block.type === 'image') {
            if (block.file) return { type: 'image', url: uploadedUrls[uploadIndex++] };
            else return { type: 'image', url: block.url };
          }
          return null;
        })
        .filter(Boolean);

      await update_post(post.id, {
        title,
        content: JSON.stringify(finalContent),
        category,
        // 保留原有字段，防止更新时丢失主角、简介等信息
        protagonist: post.protagonist,
        description: post.description,
        updated_at: new Date().toISOString()
      });

      // 更新/创建评分
      if (editRating) {
        // 1. 构造一个符合新数据库字段名的 Payload
        const ratingPayload = {
          ...editRating,
          post_impressed_score: editRating.impressed_score, // 将 弹窗分 映射到 楼主原始分
          post_final_score: editRating.final_score,         // 将 弹窗总分 映射到 楼主初始总分
        };
      
        if (bookRating) {
          // 更新现有评分
          await update_book_rating(bookRating.id, ratingPayload);
        } else {
          // 创建新评分
          const ratingUserName =
            editRating.reviewer_name?.trim()
              ? editRating.reviewer_name.trim()
              : user.user_name;
      
          await create_book_rating({
            post_id: post.id,
            user_id: user.id,
            ...ratingPayload,
            user_name: ratingUserName,
          } as any);
        }
      }

      showToast('修改成功', 'success');
      onSuccess();
    } catch (error: any) {
      console.error('修改失败:', error);
      showToast(error.message || '修改失败，请重试', 'error');
    } finally {
      setIsSubmitting(false);
      setUploadProgress(0);
    }
  };

  const totalTextLength = editorRef.current?.textContent?.length || 0;
  const imageCount = imageMap.size;

  return (
    <div className="fixed inset-0 bg-white z-50 flex flex-col">
      {/* 顶部栏 */}
      <div className="flex items-center justify-between px-4 py-3">
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
          {isSubmitting ? '保存中...' : '保存修改'}
        </button>
      </div>

      {/* 上传进度 */}
      {isSubmitting && uploadProgress > 0 && uploadProgress < 100 && (
        <div className="h-1 bg-zinc-100">
          <div className="h-full bg-black transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
        </div>
      )}

      {/* 分类选择 */}
      <div className="px-4 pb-1">
        <select
          value={category}
          onChange={e => setCategory(e.target.value as Category)}
          disabled={isSubmitting}
          className="text-sm text-zinc-400 bg-transparent border-none focus:outline-none cursor-pointer disabled:opacity-50"
        >
          {CATEGORIES.map(cat => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
      </div>

      {/* 表单内容 */}
      <div className="flex-1 overflow-y-auto flex flex-col px-4">

        {/* 标题 */}
        <input
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          maxLength={100}
          disabled={isSubmitting}
          placeholder="标题"
          className="w-full py-3 text-2xl font-bold text-zinc-800 placeholder-zinc-300 border-b border-zinc-100 focus:outline-none bg-transparent disabled:opacity-50"
        />

        {/* 内容编辑器 */}
        <div className="flex-1 flex flex-col">
          <div
            ref={editorRef}
            contentEditable={!isSubmitting}
            className="flex-1 w-full py-4 text-zinc-800 focus:outline-none"
            style={{ wordWrap: 'break-word', whiteSpace: 'pre-wrap', minHeight: '200px' }}
          />
        </div>

        {/* 图书评分预览（已添加时展示） */}
        {editRating && (
          <div className="p-4 bg-purple-50 rounded-xl border border-purple-100 mb-4">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="font-medium text-zinc-800">《{editRating.book_name}》</p>
                <p className="text-sm text-zinc-500">{editRating.book_author}</p>
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
                <div className="text-base font-bold text-blue-600">{editRating.impressed_score}</div>
                <div className="text-[10px] text-zinc-400">印象分</div>
              </div>
              <div className="bg-white rounded-lg p-2 text-center">
                <div className="text-base font-bold text-red-500">
                  -{(editRating.impressed_score - editRating.final_score - editRating.extra_deduction).toFixed(1)}
                </div>
                <div className="text-[10px] text-zinc-400">准则扣分</div>
              </div>
              <div className="bg-white rounded-lg p-2 text-center">
                <div className="text-base font-bold text-purple-600">{editRating.final_score.toFixed(1)}</div>
                <div className="text-[10px] text-zinc-400">最终得分</div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setEditRating(null)}
              className="mt-3 text-xs text-red-500 hover:underline"
            >
              移除评分
            </button>
          </div>
        )}

      </div>

      {/* 底部工具栏 - 固定在底部 */}
      <div className="flex items-center gap-1 px-3 py-2 border-t border-zinc-100 bg-white">
        {/* 插入图片 */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isSubmitting}
          title="插入图片"
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <ImageIcon className="w-4 h-4" />
          <span>图片</span>
          {imageCount > 0 && <span className="text-xs text-zinc-400">{imageCount}</span>}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => {
            const files = Array.from(e.target.files || []);
            files.forEach(file => insertImage(file));
            e.target.value = '';
          }}
          className="hidden"
        />

        {/* 图书评分 */}
        <button
          type="button"
          onClick={() => setShowRatingModal(true)}
          disabled={isSubmitting}
          title="添加/修改图书评分"
          className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition-colors disabled:opacity-40 ${
            editRating
              ? 'text-purple-700 bg-purple-100 hover:bg-purple-200'
              : 'text-zinc-600 hover:bg-zinc-100'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span>{editRating ? `评分 ${editRating.final_score.toFixed(1)}` : '评分'}</span>
        </button>

        <span className="ml-auto text-xs text-zinc-300">{totalTextLength}/10000</span>
      </div>

      {/* 图书评分弹窗 */}
      {showRatingModal && (
        <BookRatingModal
          onClose={() => setShowRatingModal(false)}
          onSave={(ratingData) => {
            setEditRating(ratingData);
            setShowRatingModal(false);
            showToast('评分已更新', 'success');
          }}
          showToast={showToast}
          initialData={editRating || (bookRating ? {
            book_name: bookRating.book_name,
            book_author: bookRating.book_author,
            book_platform: bookRating.book_platform,
            reviewer_name: bookRating.reviewer_name ?? '',
            // ✨ 关键修改：回填楼主自己的原始分字段
            impressed_score: bookRating.post_impressed_score ?? bookRating.impressed_score,
            // ✨ 关键修改：回填楼主自己的初始总分字段
            final_score: bookRating.post_final_score ?? bookRating.final_score,
            principle_scores: bookRating.principle_scores,
            principle_remarks: bookRating.principle_remarks,
            extra_deduction: bookRating.extra_deduction,
            extra_remark: bookRating.extra_remark,
            book_characters: bookRating.book_characters,
            book_category: bookRating.book_category,
            book_intro: bookRating.book_intro,
            book_link: bookRating.book_link,
            cover_url: bookRating.cover_url,
            serial_status: bookRating.serial_status,
            recommendation_tag: bookRating.recommendation_tag,
            reader_reviews: bookRating.reader_reviews,
            reviewer_comment: bookRating.reviewer_comment,
            original_impressed_score: bookRating.original_impressed_score,
          } as BookRatingData : undefined)}
        />
      )}

      <style>{`
        [contenteditable] { outline: none; }
      `}</style>
    </div>
  );
}
