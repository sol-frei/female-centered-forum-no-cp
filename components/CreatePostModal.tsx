import React, { useState, useRef, useEffect } from 'react';
import { X, ImageIcon, Plus, Trash2, Loader } from 'lucide-react';
import { User, Category } from '../types';
import { create_post } from '../services/storage';
import { uploadImages, deleteImage } from '../services/storageService';

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
            const { file, preview } = imageMap.get(imageId)!;
            blocks.push({ type: 'image', file, preview, id: imageId });
          }
        } else if (element.tagName === 'BR') {
          // 换行符作为文本块的一部分
          if (blocks.length > 0 && blocks[blocks.length - 1].type === 'text') {
            blocks[blocks.length - 1].value += '\n';
          }
        } else if (element.tagName === 'DIV' || element.tagName === 'P') {
          // 块级元素，递归处理子节点
          for (let i = 0; i < element.childNodes.length; i++) {
            traverse(element.childNodes[i]);
          }
          // 块级元素后添加换行
          if (blocks.length > 0 && blocks[blocks.length - 1].type === 'text') {
            blocks[blocks.length - 1].value += '\n';
          }
        } else {
          // 其他元素，递归处理
          for (let i = 0; i < element.childNodes.length; i++) {
            traverse(element.childNodes[i]);
          }
        }
      }
    };

    for (let i = 0; i < editor.childNodes.length; i++) {
      traverse(editor.childNodes[i]);
    }

    return blocks;
  };

  // 计算统计信息
  const getStats = () => {
    const blocks = extractContentBlocks();
    const textLength = blocks
      .filter(b => b.type === 'text')
      .reduce((sum, b) => sum + (b as { type: 'text'; value: string }).value.length, 0);
    const imageCount = blocks.filter(b => b.type === 'image').length;
    return { textLength, imageCount };
  };

  const { textLength: totalTextLength, imageCount } = getStats();

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

    const blocks = extractContentBlocks();
    const hasText = blocks.some(b => b.type === 'text' && b.value.trim());
    if (!hasText) {
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

    // 验证用户信息
    if (!user.id) {
      showToast('用户信息缺失，请重新登录', 'error');
      return;
    }
    
    // 获取用户名（兼容多种可能的属性名）
    const userName = (user as any).user_name || user.name || user.username || '匿名用户';

    setIsSubmitting(true);
    setUploadProgress(0);
    let uploadedImageUrls: string[] = [];

    try {
      const blocks = extractContentBlocks();
      
      // 1. 收集并上传图片
      const imageBlocks = blocks.filter(b => b.type === 'image') as { type: 'image'; file: File; preview: string; id: string }[];
      
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

      // 2. 构建混合内容(将图片预览URL替换为实际上传URL)
      let imageUrlIndex = 0;
      const finalContent = blocks
        .map(block => {
          if (block.type === 'text') {
            return block.value.trim() 
              ? { type: 'text', value: block.value.trim() }
              : null;
          }
          if (block.type === 'image') {
            return { type: 'image', url: uploadedImageUrls[imageUrlIndex++] };
          }
          return null;
        })
        .filter(b => b !== null);

      // 3. 准备投票数据
      let pollData = null;
      if (enablePoll) {
        const validOptions = pollOptions.filter(opt => opt.trim());
        const deadlineDate = new Date();
        deadlineDate.setDate(deadlineDate.getDate() + parseInt(pollDeadline));

        pollData = {
          question: pollQuestion.trim(),
          options: validOptions.map(opt => ({
            text: opt.trim(),
            votes: 0,
            voters: []
          })),
          isMultiple,
          deadline: deadlineDate.toISOString(),
          totalVotes: 0
        };
      }

      // 4. 提取所有图片URL（兼容旧的images字段）
      const imageUrls = finalContent
        .filter(block => block && block.type === 'image')
        .map(block => block.url);

      // 5. 创建帖子
      await create_post({
        title: title.trim(),
        content: JSON.stringify(finalContent),
        category,
        poll: pollData,
        user_id: user.id,
        user_name: userName, // 使用验证后的用户名
        images: imageUrls // 同时填充images字段供旧代码使用
      });

      showToast('发布成功！', 'success');
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('发布失败:', error);
      showToast(error.message || '发布失败，请重试', 'error');

      // 上传失败时删除已上传的图片
      if (uploadedImageUrls.length > 0) {
        try {
          await Promise.all(uploadedImageUrls.map(url => deleteImage(url)));
        } catch (cleanupError) {
          console.error('清理图片失败:', cleanupError);
        }
      }
    } finally {
      setIsSubmitting(false);
      setUploadProgress(0);
    }
  };

  // 监听编辑器变化，保存光标位置
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    const handleSelectionChange = () => {
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0 && editor.contains(selection.anchorNode)) {
        saveSelection();
      }
    };

    document.addEventListener('selectionchange', handleSelectionChange);
    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
    };
  }, []);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl">
        {/* 头部 */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-200">
          <h2 className="text-xl font-bold">发布新帖子</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-zinc-100 rounded-full transition-colors"
            disabled={isSubmitting}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 进度条 */}
        {isSubmitting && uploadProgress > 0 && (
          <div className="px-4 pt-2">
            <div className="h-1 bg-zinc-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-black transition-all duration-300"
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
    </div>
  );
}
