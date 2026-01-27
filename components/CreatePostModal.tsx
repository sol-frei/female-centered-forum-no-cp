import React, { useState, useRef } from 'react';
import { X, ImageIcon, Trash2, Loader } from 'lucide-react';
import { User, Category } from '../types';
import { create_post } from '../services/storage';
import { uploadImages } from '../services/storageService';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface CreatePostModalProps {
  user: User;
  onClose: () => void;
  onSuccess: () => void;
  showToast: (msg: string, type: ToastType) => void;
}

const CATEGORIES: Category[] = ['推书📖排雷', '讨论👊🏻i女', '求书🔍求作', '自荐🙋🏻分享', '组务❗组规'];

// 内容项类型
type ContentItem = {
  id: string;
  type: 'text' | 'image';
  content: string; // 文本内容或图片预览URL
  file?: File; // 图片文件
  caption?: string; // 图片注释
};

export default function CreatePostModal({ user, onClose, onSuccess, showToast }: CreatePostModalProps) {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<Category>('讨论👊🏻i女');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);

  // 内容编辑
  const [content, setContent] = useState(''); // 主文本框内容
  const [cursorPosition, setCursorPosition] = useState(0); // 光标位置
  const [insertedImages, setInsertedImages] = useState<ContentItem[]>([]); // 插入的图片
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 投票功能状态
  const [enablePoll, setEnablePoll] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '']);
  const [isMultiple, setIsMultiple] = useState(false);
  const [pollDeadline, setPollDeadline] = useState('');

  // 处理文本框光标位置
  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
    setCursorPosition(e.target.selectionStart);
  };

  const handleTextClick = (e: React.MouseEvent<HTMLTextAreaElement>) => {
    const target = e.target as HTMLTextAreaElement;
    setCursorPosition(target.selectionStart);
  };

  // 插入图片到光标位置
  const handleInsertImage = () => {
    if (insertedImages.length >= 9) {
      showToast('最多只能上传9张图片', 'warning');
      return;
    }
    
    // 保存当前光标位置
    if (textareaRef.current) {
      setCursorPosition(textareaRef.current.selectionStart);
    }
    
    fileInputRef.current?.click();
  };

  // 处理图片上传
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    if (insertedImages.length + files.length > 9) {
      showToast('最多只能上传9张图片', 'warning');
      return;
    }

    Array.from(files).forEach((file: File) => {
      if (file.size > 5 * 1024 * 1024) {
        showToast('图片大小不能超过5MB', 'error');
        return;
      }

      if (!file.type.startsWith('image/')) {
        showToast('只能上传图片文件', 'error');
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        
        const imageId = `[图片${insertedImages.length + 1}]`;
        const newImage: ContentItem = {
          id: `img-${Date.now()}-${Math.random()}`,
          type: 'image',
          content: result,
          file: file,
          caption: ''
        };

        // 在光标位置插入图片占位符
        const before = content.substring(0, cursorPosition);
        const after = content.substring(cursorPosition);
        const newContent = before + `\n${imageId}\n` + after;
        
        setContent(newContent);
        setInsertedImages(prev => [...prev, newImage]);
        
        // 更新光标位置到图片占位符之后
        const newCursorPos = cursorPosition + imageId.length + 2;
        setCursorPosition(newCursorPos);
        
        // 聚焦到文本框
        setTimeout(() => {
          if (textareaRef.current) {
            textareaRef.current.focus();
            textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
          }
        }, 0);
      };
      reader.readAsDataURL(file);
    });

    // 重置文件输入
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // 删除图片
  const removeImage = (imageId: string, index: number) => {
    const placeholder = `[图片${index + 1}]`;
    
    // 从文本中移除占位符
    const newContent = content.replace(new RegExp(`\\n?${placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\n?`, 'g'), '');
    setContent(newContent);
    
    // 移除图片
    setInsertedImages(prev => prev.filter(img => img.id !== imageId));
    
    // 重新编号剩余图片的占位符
    setTimeout(() => {
      let updatedContent = newContent;
      insertedImages.forEach((img, idx) => {
        if (img.id !== imageId) {
          const oldNum = idx < index ? idx + 1 : idx + 2;
          const newNum = idx < index ? idx + 1 : idx + 1;
          updatedContent = updatedContent.replace(`[图片${oldNum}]`, `[图片${newNum}]`);
        }
      });
      setContent(updatedContent);
    }, 0);
  };

  // 更新图片注释
  const updateImageCaption = (imageId: string, caption: string) => {
    setInsertedImages(prev =>
      prev.map(img => img.id === imageId ? { ...img, caption } : img)
    );
  };

  // 投票功能处理
  const addPollOption = () => {
    if (pollOptions.length >= 10) {
      showToast('最多只能添加10个选项', 'warning');
      return;
    }
    setPollOptions([...pollOptions, '']);
  };

  const removePollOption = (index: number) => {
    if (pollOptions.length <= 2) {
      showToast('至少需要2个选项', 'warning');
      return;
    }
    setPollOptions(pollOptions.filter((_, i) => i !== index));
  };

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

    // 移除图片占位符后检查是否有文本内容
    const contentWithoutPlaceholders = content.replace(/\[图片\d+\]/g, '').trim();
    if (!contentWithoutPlaceholders && insertedImages.length === 0) {
      showToast('请输入内容或上传图片', 'error');
      return false;
    }

    if (content.length > 10000) {
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
        showToast('请选择投票截止时间', 'error');
        return false;
      }
      if (new Date(pollDeadline) <= new Date()) {
        showToast('投票截止时间必须晚于当前时间', 'error');
        return false;
      }
    }

    return true;
  };

  // 提交帖子
  const handleSubmit = async () => {
    if (!validateForm()) return;

    setIsSubmitting(true);
    let uploadedImageUrls: string[] = [];

    try {
      // 1. 上传图片
      const imageFiles = insertedImages.map(img => img.file!);
      if (imageFiles.length > 0) {
        showToast('正在上传图片...', 'info');
        uploadedImageUrls = await uploadImages(
          imageFiles,
          'forum_images',
          `posts/${user.id}`,
          (current, total) => {
            setUploadProgress(Math.round((current / total) * 100));
          }
        );
      }

      // 2. 构建混合内容
      // 将文本按图片占位符分割
      let mixedContent: any[] = [];
      let textParts = content.split(/(\[图片\d+\])/);
      
      textParts.forEach((part, index) => {
        const match = part.match(/\[图片(\d+)\]/);
        if (match) {
          const imageIndex = parseInt(match[1]) - 1;
          if (imageIndex < insertedImages.length) {
            mixedContent.push({
              type: 'image',
              url: uploadedImageUrls[imageIndex],
              caption: insertedImages[imageIndex].caption || ''
            });
          }
        } else if (part.trim()) {
          mixedContent.push({
            type: 'text',
            content: part.trim()
          });
        }
      });

      // 3. 创建帖子数据
      const postData: any = {
        user_id: user.id,
        user_name: user.user_name,
        title: title.trim(),
        content: JSON.stringify(mixedContent),
        category,
        images: uploadedImageUrls.length > 0 ? uploadedImageUrls : undefined,
      };

      // 4. 添加投票数据
      if (enablePoll) {
        const validOptions = pollOptions.filter(opt => opt.trim());
        postData.poll = {
          question: pollQuestion.trim(),
          options: validOptions.map((text, index) => ({
            id: `opt_${Date.now()}_${index}`,
            text: text.trim(),
            votes: []
          })),
          isMultiple,
          deadline: new Date(pollDeadline).toISOString()
        };
      }

      // 5. 创建帖子
      await create_post(postData);
      showToast('发帖成功！', 'success');
      onSuccess();
    } catch (error: any) {
      // 如果创建帖子失败，删除已上传的图片
      if (uploadedImageUrls.length > 0) {
        try {
          const { deleteImages } = await import('../services/storageService');
          await deleteImages(uploadedImageUrls, 'forum_images');
        } catch (deleteError) {
          console.error('清理图片失败:', deleteError);
        }
      }
      showToast(`发帖失败: ${error.message}`, 'error');
    } finally {
      setIsSubmitting(false);
      setUploadProgress(0);
    }
  };

  // 计算字数(不包括图片占位符)
  const textLength = content.replace(/\[图片\d+\]/g, '').length;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true">
      <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        {/* 头部 */}
        <div className="sticky top-0 bg-white border-b border-zinc-200 p-4 flex justify-between items-center z-10">
          <h2 className="text-xl font-bold">发布新帖</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-700" disabled={isSubmitting}>
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* 上传进度提示 */}
        {isSubmitting && uploadProgress > 0 && uploadProgress < 100 && (
          <div className="bg-blue-50 border-b border-blue-200 p-3">
            <div className="flex items-center gap-3">
              <Loader className="w-4 h-4 animate-spin text-blue-600" />
              <div className="flex-1">
                <div className="text-sm text-blue-900 mb-1">正在上传图片... {uploadProgress}%</div>
                <div className="w-full bg-blue-200 rounded-full h-2">
                  <div className="bg-blue-600 h-2 rounded-full transition-all" style={{ width: `${uploadProgress}%` }}></div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 表单内容 */}
        <div className="p-6 space-y-4">
          {/* 分类选择 */}
          <div>
            <label className="block text-sm font-bold mb-2 text-zinc-700">分类 *</label>
            <select
              value={category}
              onChange={e => setCategory(e.target.value as Category)}
              disabled={isSubmitting}
              className="w-full p-3 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black disabled:opacity-50"
            >
              {CATEGORIES.map(c => (
                <option key={c} value={c}>{c}</option>
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
              placeholder="标题 (建议加上前缀如 [推书])"
              className="w-full p-3 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black disabled:opacity-50"
            />
          </div>

          {/* 内容编辑区 */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-sm font-bold text-zinc-700">
                内容 * 
                <span className="text-xs text-zinc-400 font-normal ml-2">
                  ({textLength}/10000 字 · {insertedImages.length}/9 图)
                </span>
              </label>
              <button
                onClick={handleInsertImage}
                disabled={isSubmitting || insertedImages.length >= 9}
                className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ImageIcon className="w-4 h-4" />
                插入图片
              </button>
            </div>

            {/* 主文本框 */}
            <textarea
              ref={textareaRef}
              value={content}
              onChange={handleTextChange}
              onClick={handleTextClick}
              onKeyUp={handleTextClick}
              disabled={isSubmitting}
              placeholder="输入内容，点击上方"插入图片"按钮可在光标位置插入图片..."
              className="w-full p-4 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black resize-none disabled:opacity-50 font-mono text-sm"
              rows={12}
              />

            {/* 图片预览和注释编辑 */}
            {insertedImages.length > 0 && (
              <div className="mt-4 space-y-3">
                <div className="text-sm font-bold text-zinc-700">已插入的图片:</div>
                {insertedImages.map((image, index) => (
                  <div key={image.id} className="border border-zinc-200 rounded-lg p-3 bg-zinc-50">
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-20 h-20">
                        <img
                          src={image.content}
                          alt={`图片${index + 1}`}
                          className="w-full h-full object-cover rounded"
                        />
                      </div>
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-zinc-600">图片 {index + 1}</span>
                          <button
                            onClick={() => removeImage(image.id, index)}
                            disabled={isSubmitting}
                            className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                            title="删除图片"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <input
                          type="text"
                          value={image.caption}
                          onChange={e => updateImageCaption(image.id, e.target.value)}
                          disabled={isSubmitting}
                          placeholder="添加图片注释(可选)"
                          className="w-full p-2 border border-zinc-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-black disabled:opacity-50"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 隐藏的文件输入 */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleImageUpload}
              className="hidden"
            />

            <div className="mt-2 text-xs text-zinc-500">
              💡 提示: 点击"插入图片"按钮可在当前光标位置插入图片,图片会以[图片1]、[图片2]等形式显示在文本中
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
                      <ImageIcon className="w-4 h-4" /> 添加选项
                    </button>
                  )}
                </div>

                {/* 投票设置 */}
                <div className="grid grid-cols-2 gap-3">
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
                    <label className="block text-sm mb-1">截止时间 *</label>
                    <input
                      type="datetime-local"
                      value={pollDeadline}
                      onChange={e => setPollDeadline(e.target.value)}
                      disabled={isSubmitting}
                      min={new Date().toISOString().slice(0, 16)}
                      className="w-full p-2 border border-zinc-300 rounded text-sm disabled:opacity-50"
                    />
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
