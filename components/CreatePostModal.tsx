import React, { useState } from 'react';
import { X, ImageIcon, Plus, Trash2, Calendar } from 'lucide-react';
import { User, Category, ToastType } from '../types';
import { create_post } from '../services/storage';

interface CreatePostModalProps {
  user: User;
  onClose: () => void;
  onSuccess: () => void;
  showToast: (msg: string, type: ToastType) => void;
}

const CATEGORIES: Category[] = ['推书📖排雷', '讨论👊🏻i女', '求书🔍求作', '自荐🙋🏻分享', '组务❗组规'];

export default function CreatePostModal({ user, onClose, onSuccess, showToast }: CreatePostModalProps) {
  // 基础表单状态
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState<Category>('讨论👊🏻i女');
  const [images, setImages] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 投票功能状态
  const [enablePoll, setEnablePoll] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '']);
  const [isMultiple, setIsMultiple] = useState(false);
  const [pollDeadline, setPollDeadline] = useState('');

  // 图片上传处理
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    if (images.length + files.length > 9) {
      showToast('最多只能上传9张图片', 'warning');
      return;
    }

    Array.from(files).forEach(file => {
      if (file.size > 5 * 1024 * 1024) {
        showToast('图片大小不能超过5MB', 'error');
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        setImages(prev => [...prev, result]);
      };
      reader.readAsDataURL(file);
    });
  };

  // 删除图片
  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
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
    if (!content.trim()) {
      showToast('请输入内容', 'error');
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
    try {
      const postData: any = {
        author_id: user.id,
        author_name: user.user_name,
        title: title.trim(),
        content: content.trim(),
        category,
        images: images.length > 0 ? images : undefined,
      };

      // 添加投票数据
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

      await create_post(postData);
      showToast('发帖成功！', 'success');
      onSuccess();
    } catch (error: any) {
      showToast(`发帖失败: ${error.message}`, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true">
      <div className="bg-white rounded-lg w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        {/* 头部 */}
        <div className="sticky top-0 bg-white border-b border-zinc-200 p-4 flex justify-between items-center">
          <h2 className="text-xl font-bold">发布新帖</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-black" aria-label="关闭">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* 表单内容 */}
        <div className="p-6 space-y-4">
          {/* 分类选择 */}
          <div>
            <label className="block text-sm font-bold mb-2 text-zinc-700">分类 *</label>
            <select
              value={category}
              onChange={e => setCategory(e.target.value as Category)}
              className="w-full p-3 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
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
              placeholder="给你的帖子起个标题..."
              className="w-full p-3 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
            />
          </div>

          {/* 内容 */}
          <div>
            <label className="block text-sm font-bold mb-2 text-zinc-700">
              内容 * <span className="text-xs text-zinc-400 font-normal">({content.length}/10000)</span>
            </label>
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              maxLength={10000}
              rows={10}
              placeholder="详细描述你的想法..."
              className="w-full p-3 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black resize-none"
            />
          </div>

          {/* 图片上传 */}
          <div>
            <label className="block text-sm font-bold mb-2 text-zinc-700">图片 (最多9张)</label>
            <div className="grid grid-cols-3 gap-3">
              {images.map((img, index) => (
                <div key={index} className="relative group">
                  <img src={img} alt={`上传图片 ${index + 1}`} className="w-full h-32 object-cover rounded-lg border border-zinc-200" />
                  <button
                    onClick={() => removeImage(index)}
                    className="absolute top-2 right-2 bg-red-600 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    aria-label="删除图片"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {images.length < 9 && (
                <label className="w-full h-32 border-2 border-dashed border-zinc-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-black transition-colors">
                  <ImageIcon className="w-8 h-8 text-zinc-400 mb-2" />
                  <span className="text-sm text-zinc-500">上传图片</span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                </label>
              )}
            </div>
          </div>

          {/* 投票功能 */}
          <div className="border-t border-zinc-200 pt-4">
            <label className="flex items-center gap-2 cursor-pointer mb-3">
              <input
                type="checkbox"
                checked={enablePoll}
                onChange={e => setEnablePoll(e.target.checked)}
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
                    placeholder="你想问什么？"
                    className="w-full p-2 border border-zinc-300 rounded"
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
                          placeholder={`选项 ${index + 1}`}
                          className="flex-1 p-2 border border-zinc-300 rounded"
                        />
                        {pollOptions.length > 2 && (
                          <button
                            onClick={() => removePollOption(index)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded"
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
                      className="mt-2 flex items-center gap-1 text-sm text-blue-600 hover:underline"
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
                      min={new Date().toISOString().slice(0, 16)}
                      className="w-full p-2 border border-zinc-300 rounded text-sm"
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
            className="px-6 py-2 bg-black text-white rounded-lg hover:bg-zinc-800 transition-colors disabled:bg-zinc-400 disabled:cursor-not-allowed"
          >
            {isSubmitting ? '发布中...' : '发布'}
          </button>
        </div>
      </div>
    </div>
  );
}