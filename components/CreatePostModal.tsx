import React, { useState, useRef, useEffect } from 'react';
import { X, ImageIcon, Plus, Trash2, Loader } from 'lucide-react';
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

// 内容块类型定义
type ContentBlock =
  | { type: 'text'; value: string }
  | { type: 'image'; file: File; preview: string; id: string };

export default function CreatePostModal({ user, onClose, onSuccess, showToast }: CreatePostModalProps) {
  // 基础表单状态
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<Category>('讨论👊🏻i女');
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);

  // 投票功能状态
  const [enablePoll, setEnablePoll] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '']);
  const [isMultiple, setIsMultiple] = useState(false);
  const [pollDeadline, setPollDeadline] = useState('');

  // 图书评分功能状态
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [bookRating, setBookRating] = useState<BookRatingData | null>(null);

  // 富文本编辑器相关
  const editorRef = useRef<HTMLDivElement>(null);
  const [imageMap, setImageMap] = useState<Map<string, { file: File; preview: string }>>(new Map());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastSelectionRef = useRef<Range | null>(null);

  // 保存光标位置
  const saveSelection = () => {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      lastSelectionRef.current = selection.getRangeAt(0);
    }
  };

  // 恢复光标位置
  const restoreSelection = () => {
    if (lastSelectionRef.current) {
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(lastSelectionRef.current);
    }
  };

  // 在光标位置插入图片
  const insertImageAtCursor = (file: File) => {
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
      
      // 保存图片信息到 Map
      setImageMap(prev => new Map(prev).set(imageId, { file, preview }));

      // 创建图片元素
      const imgWrapper = document.createElement('div');
      imgWrapper.className = 'image-block';
      imgWrapper.contentEditable = 'false';
      imgWrapper.setAttribute('data-image-id', imageId);
      imgWrapper.style.cssText = 'position: relative; display: inline-block; margin: 8px 0; width: 100%; max-width: 100%;';

      const img = document.createElement('img');
      img.src = preview;
      img.className = 'cursor-pointer hover:opacity-90 transition-opacity';
      img.style.cssText = 'max-width: 100%; max-height: 400px; border-radius: 8px; border: 1px solid #e4e4e7; display: block;';
      
      const deleteBtn = document.createElement('button');
      deleteBtn.innerHTML = '✕';
      deleteBtn.className = 'delete-image-btn';
      deleteBtn.style.cssText = 'position: absolute; top: 8px; right: 8px; background: #dc2626; color: white; border: none; border-radius: 9999px; width: 28px; height: 28px; cursor: pointer; opacity: 0; transition: opacity 0.2s; font-size: 16px; line-height: 1; display: flex; align-items: center; justify-content: center;';
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

      imgWrapper.onmouseenter = () => {
        deleteBtn.style.opacity = '1';
      };
      imgWrapper.onmouseleave = () => {
        deleteBtn.style.opacity = '0';
      };

      imgWrapper.appendChild(img);
      imgWrapper.appendChild(deleteBtn);

      // 插入到光标位置
      restoreSelection();
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        range.deleteContents();
        
        // 插入图片和换行
        range.insertNode(imgWrapper);
        range.collapse(false);
        
        // 在图片后添加一个换行，确保可以继续输入
        const br = document.createElement('br');
        range.insertNode(br);
        range.setStartAfter(br);
        range.collapse(true);
        
        selection.removeAllRanges();
        selection.addRange(range);
      } else {
        // 如果没有选区，添加到末尾
        editorRef.current?.appendChild(imgWrapper);
        editorRef.current?.appendChild(document.createElement('br'));
      }

      // 聚焦编辑器
      editorRef.current?.focus();
    };
    reader.readAsDataURL(file);
  };

  // 处理粘贴事件（支持粘贴图片）
  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          insertImageAtCursor(file);
        }
        break;
      }
    }
  };

  // 处理拖拽上传
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (file.type.startsWith('image/')) {
        insertImageAtCursor(file);
      }
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  // 点击上传按钮
  const handleImageButtonClick = () => {
    saveSelection();
    fileInputRef.current?.click();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      insertImageAtCursor(file);
      e.target.value = '';
    }
  };

  // 从编辑器提取内容块
  const extractContentBlocks = (): ContentBlock[] => {
    const blocks: ContentBlock[] = [];
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
              preview: imageInfo.preview,
              id: imageId
            });
          }
        } else {
          // 递归处理子节点
          node.childNodes.forEach(child => traverse(child));
        }
      }
    };

    editor.childNodes.forEach(node => traverse(node));
    return blocks;
  };

  // 计算文本长度和图片数量
  const totalTextLength = editorRef.current?.textContent?.length || 0;
  const imageCount = imageMap.size;

  // 添加投票选项
  const addPollOption = () => {
    if (pollOptions.length >= 10) {
      showToast('最多只能添加10个选项', 'warning');
      return;
    }
    setPollOptions([...pollOptions, '']);
  };

  // 删除投票选项
  const removePollOption = (index: number) => {
    if (pollOptions.length <= 2) {
      showToast('至少需要2个选项', 'warning');
      return;
    }
    setPollOptions(pollOptions.filter((_, i) => i !== index));
  };

  // 更新投票选项
  const updatePollOption = (index: number, value: string) => {
    const newOptions = [...pollOptions];
    newOptions[index] = value;
    setPollOptions(newOptions);
  };

  // 表单验证
  const validateForm = () => {
    if (!title.trim()) {
      showToast('请输入标题', 'error');
      return false;
    }
    if (title.length > 100) {
      showToast('标题不能超过100字', 'error');
      return false;
    }

    const contentText = editorRef.current?.textContent?.trim() || '';
    if (!contentText && imageMap.size === 0) {
      showToast('请输入内容', 'error');
      return false;
    }

    if (totalTextLength > 10000) {
      showToast('内容不能超过10000字', 'error');
      return false;
    }

    // 投票验证
    if (enablePoll) {
      if (!pollQuestion.trim()) {
        showToast('请输入投票问题', 'error');
        return false;
      }
      const validOptions = pollOptions.filter(opt => opt.trim());
      if (validOptions.length < 2) {
        showToast('投票至少需要2个有效选项', 'error');
        return false;
      }
      if (!pollDeadline) {
        showToast('请选择投票时长', 'error');
        return false;
      }
    }

    return true;
  };

  // 提交帖子
  const handleSubmit = async () => {
    if (!validateForm()) return;

    setIsSubmitting(true);
    setUploadProgress(0);
    let uploadedImageUrls: string[] = [];

    try {
      // 1. 提取内容块
      const contentBlocks = extractContentBlocks();
      
      // 2. 上传所有图片
      const imageBlocks = contentBlocks.filter(b => b.type === 'image') as Array<ContentBlock & { type: 'image' }>;
      
      if (imageBlocks.length > 0) {
        showToast('正在上传图片...', 'info');
        uploadedImageUrls = await uploadImages(
          imageBlocks.map(b => b.file),
          'forum_images',
          `posts/${user.id}`,
          (current, total) => {
            setUploadProgress(Math.round((current / total) * 100));
          }
        );
      }

      // 3. 构建最终内容（替换预览URL为上传URL）
      let imageUrlIndex = 0;
      const finalContent = contentBlocks
        .map(block => {
          if (block.type === 'text') {
            return block.value.trim() 
              ? { type: 'text', value: block.value.trim() }
              : null;
          } else if (block.type === 'image') {
            return { type: 'image', url: uploadedImageUrls[imageUrlIndex++] };
          }
          return null;
        })
        .filter(Boolean);

      // 4. 构建投票数据
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

      // 5. 创建帖子
      const newPost = await create_post({
        title,
        content: JSON.stringify(finalContent),
        category,
        user_id: user.id,
        user_name: user.user_name,
        images: uploadedImageUrls,
        poll: pollData,
      });

      // 6. 如果有图书评分，保存评分数据
      if (bookRating) {
        try {
          await create_book_rating({
            post_id: newPost.id,
            user_id: user.id,
            user_name: user.user_name,
            ...bookRating,
          });
        } catch (error) {
          console.error('保存图书评分失败:', error);
          showToast('帖子发布成功，但评分保存失败', 'warning');
        }
      }

      showToast('发布成功', 'success');
      onSuccess();
    } catch (error: any) {
      console.error('发布失败:', error);
      
      // 如果上传了图片但发布失败，清理图片
      if (uploadedImageUrls.length > 0) {
        try {
          await Promise.all(uploadedImageUrls.map(url => deleteImage(url)));
        } catch (cleanupError) {
          console.error('清理图片失败:', cleanupError);
        }
      }
      
      showToast(error.message || '发布失败，请重试', 'error');
    } finally {
      setIsSubmitting(false);
      setUploadProgress(0);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* 头部 */}
        <div className="sticky top-0 bg-white border-b border-zinc-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold">发布新帖</h2>
          <button onClick={onClose} className="p-2 hover:bg-zinc-100 rounded-full transition-colors" disabled={isSubmitting}>
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 上传进度 */}
        {isSubmitting && uploadProgress > 0 && uploadProgress < 100 && (
          <div className="px-6 py-3 bg-blue-50 border-b border-blue-200">
            <div className="w-full bg-blue-200 rounded-full h-2 overflow-hidden">
              <div 
                className="bg-blue-600 h-full transition-all duration-300" 
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
            <p className="text-xs text-zinc-500 mt-1 text-center">上传进度: {uploadProgress}%</p>
          </div>
        )}

        {/* 表单内容 */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
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
                onClick={handleImageButtonClick}
                disabled={isSubmitting || imageCount >= 9}
                className="flex items-center gap-1 px-3 py-1.5 text-sm bg-zinc-100 hover:bg-zinc-200 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ImageIcon className="w-4 h-4" />
                插入图片
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>
            
            <div
              ref={editorRef}
              contentEditable={!isSubmitting}
              onPaste={handlePaste}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              className="w-full min-h-[200px] p-3 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black disabled:opacity-50 overflow-y-auto max-h-[400px]"
              style={{
                wordWrap: 'break-word',
                whiteSpace: 'pre-wrap'
              }}
              data-placeholder="写点什么... (支持粘贴图片、拖拽图片)"
            />

            <div className="mt-2 text-xs text-zinc-500 space-y-1">
              <p>💡 提示:</p>
              <p>• 点击上方【插入图片】按钮在光标处插入图片</p>
              <p>• 支持 Ctrl+V 粘贴图片、拖拽图片到编辑器</p>
              <p>• 鼠标悬停图片显示删除按钮</p>
            </div>

            <style>{`
              [contenteditable][data-placeholder]:empty:before {
                content: attr(data-placeholder);
                color: #a1a1aa;
                pointer-events: none;
              }
              [contenteditable] {
                outline: none;
              }
            `}</style>
          </div>

          {/* 图书评分功能 */}
          <div className="border-t border-zinc-200 pt-4">
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-bold">图书评分（推书专用）</label>
              {bookRating && (
                <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded font-medium">
                  已添加评分: {bookRating.final_score.toFixed(1)}分
                </span>
              )}
            </div>
            
            <button
              type="button"
              onClick={() => setShowRatingModal(true)}
              disabled={isSubmitting}
              className="w-full py-3 border-2 border-dashed border-zinc-300 rounded-lg hover:border-purple-500 hover:bg-purple-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="flex flex-col items-center gap-2">
                <span className="text-2xl">📚</span>
                <span className="text-sm font-medium text-zinc-700">
                  {bookRating ? '修改图书评分' : '添加图书评分'}
                </span>
                {bookRating && (
                  <span className="text-xs text-zinc-500">
                    《{bookRating.book_name}》 · {bookRating.book_author}
                  </span>
                )}
              </div>
            </button>
            
            {bookRating && (
              <div className="mt-2 p-3 bg-purple-50 rounded-lg border border-purple-200">
                <div className="text-xs text-purple-700 space-y-1">
                  <p className="font-bold">评分预览</p>
                  <div className="grid grid-cols-3 gap-2 mt-2">
                    <div className="bg-white rounded p-2 text-center">
                      <div className="text-lg font-bold text-blue-600">{bookRating.impressed_score}</div>
                      <div className="text-[10px] text-zinc-500">印象分</div>
                    </div>
                    <div className="bg-white rounded p-2 text-center">
                      <div className="text-lg font-bold text-red-600">
                        -{(bookRating.impressed_score - bookRating.final_score - bookRating.extra_deduction).toFixed(1)}
                      </div>
                      <div className="text-[10px] text-zinc-500">准则扣分</div>
                    </div>
                    <div className="bg-white rounded p-2 text-center">
                      <div className="text-lg font-bold text-purple-600">{bookRating.final_score.toFixed(1)}</div>
                      <div className="text-[10px] text-zinc-500">最终得分</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setBookRating(null)}
                    className="mt-2 text-xs text-red-600 hover:underline"
                  >
                    移除评分
                  </button>
                </div>
              </div>
            )}
            
            <div className="mt-2 text-xs text-zinc-500">
              💡 提示: 发布后，此书将出现在书架中，其他成员可以查看详细评分
            </div>
          </div>

          {/* 投票功能 */}
          <div className="border-t border-zinc-200 pt-4">
            <label className="flex items-center gap-2 cursor-pointer mb-3">
              <input
                type="checkbox"
                checked={enablePoll}
                onChange={e => setEnablePoll(e.target.checked)}
                disabled={isSubmitting}
                className="w-4 h-4 accent-black"
              />
              <span className="text-sm font-bold">添加投票</span>
            </label>

            {enablePoll && (
              <div className="space-y-3 bg-zinc-50 p-4 rounded-lg">
                {/* 投票问题 */}
                <div>
                  <label className="block text-sm font-bold mb-1">投票问题 *</label>
                  <input
                    type="text"
                    value={pollQuestion}
                    onChange={e => setPollQuestion(e.target.value)}
                    disabled={isSubmitting}
                    placeholder="你想问什么？"
                    className="w-full p-2 border border-zinc-300 rounded disabled:opacity-50"
                  />
                </div>

                {/* 投票选项 */}
                <div>
                  <label className="block text-sm font-bold mb-2">选项 *</label>
                  <div className="space-y-2">
                    {pollOptions.map((option, index) => (
                      <div key={index} className="flex gap-2">
                        <input
                          type="text"
                          value={option}
                          onChange={e => updatePollOption(index, e.target.value)}
                          disabled={isSubmitting}
                          placeholder={`选项 ${index + 1}`}
                          className="flex-1 p-2 border border-zinc-300 rounded disabled:opacity-50"
                        />
                        {pollOptions.length > 2 && (
                          <button
                            onClick={() => removePollOption(index)}
                            disabled={isSubmitting}
                            className="p-2 text-red-600 hover:bg-red-50 rounded disabled:opacity-50"
                            aria-label="删除选项"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  {pollOptions.length < 10 && (
                    <button
                      onClick={addPollOption}
                      disabled={isSubmitting}
                      className="mt-2 flex items-center gap-1 text-sm text-blue-600 hover:underline disabled:opacity-50"
                    >
                      <Plus className="w-4 h-4" /> 添加选项
                    </button>
                  )}
                </div>

                {/* 投票设置 */}
                <div className="space-y-3">
                  <div>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={isMultiple}
                        onChange={e => setIsMultiple(e.target.checked)}
                        disabled={isSubmitting}
                        className="w-4 h-4 accent-black"
                      />
                      <span className="text-sm">允许多选</span>
                    </label>
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1 text-zinc-700">投票时长 *</label>
                    <select
                      value={pollDeadline}
                      onChange={e => setPollDeadline(e.target.value)}
                      disabled={isSubmitting}
                      className="w-full px-2 py-1.5 border border-zinc-300 rounded text-xs disabled:opacity-50 focus:outline-none focus:ring-1 focus:ring-black bg-white"
                    >
                      <option value="">请选择时长</option>
                      <option value="1">1天后结束</option>
                      <option value="3">3天后结束</option>
                      <option value="7">7天后结束</option>
                      <option value="15">15天后结束</option>
                      <option value="30">30天后结束</option>
                    </select>
                  </div>
                </div>
              </div>
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
            className="px-6 py-2 bg-black text-white rounded-lg hover:bg-zinc-800 transition-colors disabled:bg-zinc-400 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isSubmitting && <Loader className="w-4 h-4 animate-spin" />}
            {isSubmitting ? '发布中...' : '发布'}
          </button>
        </div>
      </div>

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
