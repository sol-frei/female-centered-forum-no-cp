import React, { useState, useRef } from 'react';
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

// 新增:内容块类型定义
type ContentBlock = {
  id: string;
  type: 'text' | 'image';
  content: string; // 文本内容或图片预览URL
  file?: File; // 图片文件对象
};

export default function CreatePostModal({ user, onClose, onSuccess, showToast }: CreatePostModalProps) {
  // 基础表单状态
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<Category>('讨论👊🏻i女');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);

  // 新增:图文混合内容块
  const [contentBlocks, setContentBlocks] = useState<ContentBlock[]>([
    { id: `text-${Date.now()}`, type: 'text', content: '' }
  ]);
  
  const textareaRefs = useRef<{ [key: string]: HTMLTextAreaElement | null }>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeBlockId, setActiveBlockId] = useState<string | null>(null);

  // 投票功能状态
  const [enablePoll, setEnablePoll] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '']);
  const [isMultiple, setIsMultiple] = useState(false);
  const [pollDeadline, setPollDeadline] = useState('');

  // 新增:添加文本块
  const addTextBlock = (afterId?: string) => {
    const newBlock: ContentBlock = {
      id: `text-${Date.now()}`,
      type: 'text',
      content: ''
    };

    if (afterId) {
      const index = contentBlocks.findIndex(b => b.id === afterId);
      const newBlocks = [...contentBlocks];
      newBlocks.splice(index + 1, 0, newBlock);
      setContentBlocks(newBlocks);
    } else {
      setContentBlocks([...contentBlocks, newBlock]);
    }

    // 自动聚焦到新文本块
    setTimeout(() => {
      textareaRefs.current[newBlock.id]?.focus();
    }, 0);
  };

  // 新增:添加图片块
  const addImageBlock = (afterId: string) => {
    setActiveBlockId(afterId);
    fileInputRef.current?.click();
  };

  // 新增:处理图片上传
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !activeBlockId) return;

    const currentImageCount = contentBlocks.filter(b => b.type === 'image').length;
    
    if (currentImageCount + files.length > 9) {
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
        
        const newBlock: ContentBlock = {
          id: `image-${Date.now()}-${Math.random()}`,
          type: 'image',
          content: result,
          file: file
        };

        const index = contentBlocks.findIndex(b => b.id === activeBlockId);
        const newBlocks = [...contentBlocks];
        newBlocks.splice(index + 1, 0, newBlock);
        setContentBlocks(newBlocks);
      };
      reader.readAsDataURL(file);
    });

    // 重置文件输入
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // 新增:更新文本块内容
  const updateTextBlock = (id: string, content: string) => {
    setContentBlocks(blocks =>
      blocks.map(block =>
        block.id === id ? { ...block, content } : block
      )
    );
  };

  // 新增:删除内容块
  const removeBlock = (id: string) => {
    // 至少保留一个文本块
    if (contentBlocks.length === 1 && contentBlocks[0].type === 'text') {
      showToast('至少需要保留一个文本框', 'warning');
      return;
    }
    
    setContentBlocks(blocks => blocks.filter(block => block.id !== id));
  };

  // 新增:向上移动块
  const moveBlockUp = (id: string) => {
    const index = contentBlocks.findIndex(b => b.id === id);
    if (index === 0) return;
    
    const newBlocks = [...contentBlocks];
    [newBlocks[index - 1], newBlocks[index]] = [newBlocks[index], newBlocks[index - 1]];
    setContentBlocks(newBlocks);
  };

  // 新增:向下移动块
  const moveBlockDown = (id: string) => {
    const index = contentBlocks.findIndex(b => b.id === id);
    if (index === contentBlocks.length - 1) return;
    
    const newBlocks = [...contentBlocks];
    [newBlocks[index], newBlocks[index + 1]] = [newBlocks[index + 1], newBlocks[index]];
    setContentBlocks(newBlocks);
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

    // 检查是否有文本内容
    const hasTextContent = contentBlocks.some(
      block => block.type === 'text' && block.content.trim()
    );
    
    if (!hasTextContent) {
      showToast('请输入内容', 'error');
      return false;
    }

    // 计算总文本长度
    const totalTextLength = contentBlocks
      .filter(b => b.type === 'text')
      .reduce((sum, b) => sum + b.content.length, 0);
    
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
      // 1. 收集所有图片文件
      const imageFiles = contentBlocks
        .filter(block => block.type === 'image' && block.file)
        .map(block => block.file!);

      // 2. 上传图片
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

      // 3. 构建混合内容
      // 创建图片URL映射
      let imageUrlIndex = 0;
      const mixedContent = contentBlocks.map(block => {
        if (block.type === 'text') {
          return {
            type: 'text',
            content: block.content
          };
        } else {
          return {
            type: 'image',
            url: uploadedImageUrls[imageUrlIndex++]
          };
        }
      });

      // 4. 创建帖子数据
      const postData: any = {
        user_id: user.id,
        user_name: user.user_name,
        title: title.trim(),
        content: JSON.stringify(mixedContent), // 将混合内容序列化
        category,
        images: uploadedImageUrls.length > 0 ? uploadedImageUrls : undefined,
      };

      // 5. 添加投票数据
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

      // 6. 创建帖子
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

  // 计算总字数
  const totalTextLength = contentBlocks
    .filter(b => b.type === 'text')
    .reduce((sum, b) => sum + b.content.length, 0);

  const imageCount = contentBlocks.filter(b => b.type === 'image').length;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true">
      <div className="bg-white rounded-lg w-full max-w-6xl max-h-[90vh] overflow-y-auto">
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

          {/* 图文混合内容编辑区 */}
          <div>
            <label className="block text-sm font-bold mb-2 text-zinc-700">
              内容 * 
              <span className="text-xs text-zinc-400 font-normal ml-2">
                ({totalTextLength}/10000 字 · {imageCount}/9 图)
              </span>
            </label>
            
            <div className="space-y-3 border border-zinc-300 rounded-lg p-4 bg-zinc-50">
              {contentBlocks.map((block, index) => (
                <div key={block.id} className="bg-white rounded-lg border border-zinc-200 p-3">
                  {block.type === 'text' ? (
                    // 文本块
                    <div className="space-y-2">
                      <textarea
                        ref={el => textareaRefs.current[block.id] = el}
                        value={block.content}
                        onChange={e => updateTextBlock(block.id, e.target.value)}
                        disabled={isSubmitting}
                        placeholder="输入文字内容..."
                        className="w-full p-3 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black resize-none disabled:opacity-50"
                        rows={6}
                      />
                      <div className="flex items-center justify-between">
                        <div className="flex gap-2">
                          <button
                            onClick={() => addImageBlock(block.id)}
                            disabled={isSubmitting || imageCount >= 9}
                            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <ImageIcon className="w-4 h-4" />
                            插入图片
                          </button>
                          <button
                            onClick={() => addTextBlock(block.id)}
                            disabled={isSubmitting}
                            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
                          >
                            <Plus className="w-4 h-4" />
                            添加文本
                          </button>
                        </div>
                        <div className="flex gap-1">
                          {index > 0 && (
                            <button
                              onClick={() => moveBlockUp(block.id)}
                              disabled={isSubmitting}
                              className="p-1.5 text-zinc-600 hover:bg-zinc-100 rounded"
                              title="上移"
                            >
                              ↑
                            </button>
                          )}
                          {index < contentBlocks.length - 1 && (
                            <button
                              onClick={() => moveBlockDown(block.id)}
                              disabled={isSubmitting}
                              className="p-1.5 text-zinc-600 hover:bg-zinc-100 rounded"
                              title="下移"
                            >
                              ↓
                            </button>
                          )}
                          <button
                            onClick={() => removeBlock(block.id)}
                            disabled={isSubmitting}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                            title="删除"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    // 图片块
                    <div className="space-y-2">
                      <img 
                        src={block.content} 
                        alt="预览" 
                        className="w-full max-h-96 object-contain rounded-lg border border-zinc-200" 
                      />
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-zinc-500">图片</span>
                        <div className="flex gap-1">
                          {index > 0 && (
                            <button
                              onClick={() => moveBlockUp(block.id)}
                              disabled={isSubmitting}
                              className="p-1.5 text-zinc-600 hover:bg-zinc-100 rounded"
                              title="上移"
                            >
                              ↑
                            </button>
                          )}
                          {index < contentBlocks.length - 1 && (
                            <button
                              onClick={() => moveBlockDown(block.id)}
                              disabled={isSubmitting}
                              className="p-1.5 text-zinc-600 hover:bg-zinc-100 rounded"
                              title="下移"
                            >
                              ↓
                            </button>
                          )}
                          <button
                            onClick={() => removeBlock(block.id)}
                            disabled={isSubmitting}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                            title="删除"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* 隐藏的文件输入 */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleImageUpload}
              className="hidden"
            />
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
