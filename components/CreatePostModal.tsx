import React, { useState } from 'react';
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
type ContentBlock =
  | { type: 'text'; value: string }
  | { type: 'image'; file: File; preview: string };

export default function CreatePostModal({ user, onClose, onSuccess, showToast }: CreatePostModalProps) {
  // 基础表单状态
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<Category>('讨论👊🏻i女');
  
  // 新增:图文混排内容块
  const [blocks, setBlocks] = useState<ContentBlock[]>([
    { type: 'text', value: '' }
  ]);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);

  // 投票功能状态
  const [enablePoll, setEnablePoll] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '']);
  const [isMultiple, setIsMultiple] = useState(false);
  const [pollDeadline, setPollDeadline] = useState('');

  // 新增:插入图片(在最后添加)
  const insertImage = (file: File) => {
    const imageCount = blocks.filter(b => b.type === 'image').length;
    if (imageCount >= 9) {
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
      // 在所有块的最后添加图片块和新的文本块
      setBlocks(prev => [
        ...prev,
        { type: 'image', file, preview },
        { type: 'text', value: '' }
      ]);
    };
    reader.readAsDataURL(file);
  };

  // 新增:在指定文本块后插入图片
  const insertImageAfter = (textBlockIndex: number, file: File) => {
    const imageCount = blocks.filter(b => b.type === 'image').length;
    if (imageCount >= 9) {
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
      // 在指定位置后插入图片块和新的文本块
      setBlocks(prev => [
        ...prev.slice(0, textBlockIndex + 1),
        { type: 'image', file, preview },
        { type: 'text', value: '' },
        ...prev.slice(textBlockIndex + 1)
      ]);
    };
    reader.readAsDataURL(file);
  };

  // 新增:删除块
  const removeBlock = (index: number) => {
    // 至少保留一个文本块
    if (blocks.length === 1 && blocks[0].type === 'text') {
      showToast('至少需要保留一个文本框', 'warning');
      return;
    }
    setBlocks(blocks.filter((_, i) => i !== index));
  };

  // 新增:更新文本块内容
  const updateTextBlock = (index: number, value: string) => {
    const next = [...blocks];
    if (next[index].type === 'text') {
      next[index] = { ...next[index], value } as ContentBlock;
    }
    setBlocks(next);
  };

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

    // 检查是否有文本内容
    const hasText = blocks.some(b => b.type === 'text' && b.value.trim());
    if (!hasText) {
      showToast('请输入内容', 'error');
      return false;
    }

    // 计算总文本长度
    const totalTextLength = blocks
      .filter(b => b.type === 'text')
      .reduce((sum, b) => sum + (b as { type: 'text'; value: string }).value.length, 0);
    
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
      // 1. 收集并上传图片
      const imageBlocks = blocks.filter(b => b.type === 'image') as { type: 'image'; file: File; preview: string }[];
      
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
            // 只保留非空文本块
            return block.value.trim() 
              ? { type: 'text', value: block.value.trim() }
              : null;
          } else {
            // 图片块:使用上传后的URL
            return {
              type: 'image',
              url: uploadedImageUrls[imageUrlIndex++]
            };
          }
        })
        .filter(Boolean); // 过滤掉null值

      // 3. 创建帖子数据
      const postData: any = {
        user_id: user.id,
        user_name: user.user_name,
        title: title.trim(),
        content: JSON.stringify(finalContent), // 将混合内容序列化为JSON
        category,
        images: uploadedImageUrls.length > 0 ? uploadedImageUrls : undefined,
      };

      // 4. 添加投票数据
      if (enablePoll) {
        const validOptions = pollOptions.filter(opt => opt.trim());
        
        // 计算截止时间: 当前时间 + 选择的天数
        const deadlineDate = new Date();
        deadlineDate.setDate(deadlineDate.getDate() + parseInt(pollDeadline));
        
        postData.poll = {
          question: pollQuestion.trim(),
          options: validOptions.map((text, index) => ({
            id: `opt_${Date.now()}_${index}`,
            text: text.trim(),
            votes: []
          })),
          isMultiple,
          deadline: deadlineDate.toISOString()
        };
      }

      // 5. 创建帖子
      await create_post(postData);
      showToast('发帖成功！', 'success');
      onSuccess();
    } catch (error: any) {
      // 如果创建帖子失败,删除已上传的图片
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

  // 计算统计信息
  const totalTextLength = blocks
    .filter(b => b.type === 'text')
    .reduce((sum, b) => sum + (b as { type: 'text'; value: string }).value.length, 0);
  const imageCount = blocks.filter(b => b.type === 'image').length;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" role="dialog" aria-modal="true">
      <div className="bg-white w-full h-full overflow-y-auto">
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
              placeholder="标题建议加上前缀如 【推书】"
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
            
            {/* 内容块列表 */}
            <div className="space-y-4">
              {blocks.map((block, index) => {
                if (block.type === 'text') {
                  // 文本块
                  return (
                    <div key={index} className="space-y-2">
                      <div className="relative">
                        <textarea
                          value={block.value}
                          onChange={e => updateTextBlock(index, e.target.value)}
                          disabled={isSubmitting}
                          placeholder="写点什么..."
                          className="w-full p-3 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black resize-none disabled:opacity-50"
                          rows={4}
                        />
                        {/* 只有当不是唯一的文本块时才显示删除按钮 */}
                        {!(blocks.length === 1 && blocks[0].type === 'text') && (
                          <button
                            onClick={() => removeBlock(index)}
                            disabled={isSubmitting}
                            className="absolute top-2 right-2 p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                            title="删除"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                      {/* 在每个文本块后添加插入图片按钮 */}
                      <label className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-zinc-700 hover:text-black cursor-pointer transition-colors">
                        <ImageIcon className="w-4 h-4" />
                        <span>在此后插入图片</span>
                        <input
                          type="file"
                          accept="image/*"
                          disabled={isSubmitting || imageCount >= 9}
                          onChange={e => {
                            const file = e.target.files?.[0];
                            if (file) {
                              insertImageAfter(index, file);
                              e.target.value = '';
                            }
                          }}
                          className="hidden"
                        />
                      </label>
                    </div>
                  );
                }

                // 图片块
                return (
                  <div key={index} className="relative group">
                    <img
                      src={block.preview}
                      alt={`图片 ${index + 1}`}
                      className="w-full max-h-96 object-contain rounded-lg border border-zinc-200"
                    />
                    <button
                      onClick={() => removeBlock(index)}
                      disabled={isSubmitting}
                      className="absolute top-2 right-2 bg-red-600 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50"
                      title="删除图片"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="mt-2 text-xs text-zinc-500">
              💡 提示: 每个文本框下方都有【在此后插入图片】按钮,可以在任意位置插入图片实现图文混排
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
    </div>
  );
}
