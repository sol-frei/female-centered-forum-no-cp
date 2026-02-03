import React, { useState, useRef, useEffect } from 'react';
import { X, ImageIcon, Trash2, Loader } from 'lucide-react';
import { User, Category, BookRating } from '../types';
import { update_post, update_book_rating, create_book_rating } from '../services/storage';
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

const CATEGORIES: Category[] = ['推书📖排雷', '讨论👊🏻i女', '求书🔍求作', '自荐🙋🏻分享', '组务❗组规'];

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
      impressed_score: bookRating.impressed_score,
      principle_scores: bookRating.principle_scores,
      principle_remarks: bookRating.principle_remarks,
      extra_deduction: bookRating.extra_deduction,
      extra_remark: bookRating.extra_remark,
      final_score: bookRating.final_score,
      reviewer_comment: bookRating.reviewer_comment,
    } : null
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
    deleteBtn.style.cssText = 'position: absolute; top: 8px; right: 8px; background: #dc2626; color: white; border: none; border-radius: 9999px; width: 28px; height: 28px; cursor: pointer; opacity: 0; transition: opacity 0.2s;';
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
    if (imageMap.size >= 9) {
      showToast('最多只能插入9张图片', 'warning');
      return;
    }

    if (!file.type.startsWith('image/')) {
      showToast('只能上传图片文件', 'error');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      showToast('图片不能超过5MB', 'error');
      return;
    }

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
        if (text.trim()) {
          blocks.push({ type: 'text', value: text });
        }
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const element = node as HTMLElement;
        
        if (element.classList.contains('image-block')) {
          const imageId = element.getAttribute('data-image-id');
          if (imageId && imageMap.has(imageId)) {
            const imageInfo = imageMap.get(imageId)!;
            blocks.push({
              type: 'image',
              file: imageInfo.file,
              url: imageInfo.url,
              id: imageId
            });
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
    if (!title.trim()) {
      showToast('请输入标题', 'error');
      return;
    }

    const contentText = editorRef.current?.textContent?.trim() || '';
    if (!contentText && imageMap.size === 0) {
      showToast('请输入内容', 'error');
      return;
    }

    setIsSubmitting(true);
    setUploadProgress(0);

    try {
      // 1. 提取内容块
      const contentBlocks = extractContentBlocks();
      
      // 2. 上传新图片
      const newImageBlocks = contentBlocks.filter(b => b.type === 'image' && b.file);
      let uploadedUrls: string[] = [];
      
      if (newImageBlocks.length > 0) {
        showToast('正在上传图片...', 'info');
        uploadedUrls = await uploadImages(
          newImageBlocks.map(b => b.file),
          'forum_images',
          `posts/${user.id}`,
          (current, total) => {
            setUploadProgress(Math.round((current / total) * 100));
          }
        );
      }
      
      // 3. 构建最终内容
      let uploadIndex = 0;
      const finalContent = contentBlocks
        .map(block => {
          if (block.type === 'text') {
            return block.value.trim() 
              ? { type: 'text', value: block.value.trim() }
              : null;
          } else if (block.type === 'image') {
            if (block.file) {
              return { type: 'image', url: uploadedUrls[uploadIndex++] };
            } else {
              return { type: 'image', url: block.url };
            }
          }
          return null;
        })
        .filter(Boolean);

      // 4. 更新帖子
      await update_post(post.id, {
        title,
        content: JSON.stringify(finalContent),
        category,
        updated_at: new Date().toISOString()
      });

      // 5. 更新/创建评分
      if (editRating) {
        if (bookRating) {
          await update_book_rating(bookRating.id, editRating);
        } else {
          await create_book_rating({
            post_id: post.id,
            user_id: user.id,
            user_name: user.user_name,
            ...editRating
          });
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* 头部 */}
        <div className="sticky top-0 bg-white border-b border-zinc-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold">编辑帖子</h2>
          <button onClick={onClose} className="p-2 hover:bg-zinc-100 rounded-full transition-colors" disabled={isSubmitting}>
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 上传进度 */}
        {isSubmitting && uploadProgress > 0 && uploadProgress < 100 && (
          <div className="px-6 py-3 bg-blue-50 border-b border-blue-200">
            <div className="w-full bg-blue-200 rounded-full h-2">
              <div className="bg-blue-600 h-full transition-all" style={{ width: `${uploadProgress}%` }} />
            </div>
            <p className="text-xs text-zinc-500 mt-1 text-center">上传进度: {uploadProgress}%</p>
          </div>
        )}

        {/* 表单内容 */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* 分类 */}
          <div>
            <label className="block text-sm font-bold mb-2 text-zinc-700">分类 *</label>
            <select
              value={category}
              onChange={e => setCategory(e.target.value as Category)}
              disabled={isSubmitting}
              className="w-full p-3 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
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
              placeholder="请输入标题"
              className="w-full p-3 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
            />
          </div>

          {/* 富文本编辑器 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-bold text-zinc-700">
                内容 * 
                <span className="text-xs text-zinc-400 font-normal ml-2">
                  ({totalTextLength}/10000 字 · {imageCount}/9 图)
                </span>
              </label>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isSubmitting || imageCount >= 9}
                className="flex items-center gap-1 px-3 py-1.5 text-sm bg-zinc-100 hover:bg-zinc-200 rounded-lg transition-colors disabled:opacity-50"
              >
                <ImageIcon className="w-4 h-4" />
                插入图片
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    insertImage(file);
                    e.target.value = '';
                  }
                }}
                className="hidden"
              />
            </div>
            
            <div
              ref={editorRef}
              contentEditable={!isSubmitting}
              className="w-full min-h-[200px] p-3 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black bg-white"
              style={{ wordWrap: 'break-word', whiteSpace: 'pre-wrap' }}
            />
          </div>

          {/* 图书评分 */}
          <div className="border-t border-zinc-200 pt-4">
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-bold">图书评分（推书专用）</label>
              {editRating && (
                <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded font-medium">
                  当前评分: {editRating.final_score.toFixed(1)}分
                </span>
              )}
            </div>
            
            <button
              type="button"
              onClick={() => setShowRatingModal(true)}
              disabled={isSubmitting}
              className="w-full py-3 border-2 border-dashed border-zinc-300 rounded-lg hover:border-purple-500 hover:bg-purple-50 transition-colors disabled:opacity-50"
            >
              <div className="flex flex-col items-center gap-2">
                <span className="text-2xl">📚</span>
                <span className="text-sm font-medium text-zinc-700">
                  {editRating ? '修改图书评分' : bookRating ? '修改图书评分' : '添加图书评分'}
                </span>
                {editRating && (
                  <span className="text-xs text-zinc-500">
                    《{editRating.book_name}》 · {editRating.book_author}
                  </span>
                )}
              </div>
            </button>

            {editRating && (
              <button
                type="button"
                onClick={() => setEditRating(null)}
                className="mt-2 text-xs text-red-600 hover:underline"
              >
                移除评分
              </button>
            )}
          </div>
        </div>

        {/* 底部操作 */}
        <div className="sticky bottom-0 bg-white border-t border-zinc-200 p-4 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-6 py-2 border border-zinc-300 rounded-lg hover:bg-zinc-50 transition-colors"
            disabled={isSubmitting}
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="px-6 py-2 bg-black text-white rounded-lg hover:bg-zinc-800 transition-colors disabled:bg-zinc-400 flex items-center gap-2"
          >
            {isSubmitting && <Loader className="w-4 h-4 animate-spin" />}
            {isSubmitting ? '保存中...' : '保存修改'}
          </button>
        </div>
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
            impressed_score: bookRating.impressed_score,
            principle_scores: bookRating.principle_scores,
            principle_remarks: bookRating.principle_remarks,
            extra_deduction: bookRating.extra_deduction,
            extra_remark: bookRating.extra_remark,
            final_score: bookRating.final_score,
            reviewer_comment: bookRating.reviewer_comment,
          } : undefined)}
        />
      )}

      <style>{`
        [contenteditable] {
          outline: none;
        }
      `}</style>
    </div>
  );
}
