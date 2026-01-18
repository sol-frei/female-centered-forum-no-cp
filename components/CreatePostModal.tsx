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

export default function CreatePostModal({ user, onClose, onSuccess, showToast }: CreatePostModalProps) {
  // 基础表单状态
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState<Category>('讨论👊🏻i女');
  const [images, setImages] = useState<string[]>([]);
  const [imageFiles, setImageFiles] = useState<File[]>([]); // 存储文件对象
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);

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

    const newFiles: File[] = [];
    const newPreviews: string[] = [];

    Array.from(files).forEach((file: File) => {
      if (file.size > 5 * 1024 * 1024) {
        showToast('图片大小不能超过5MB', 'error');
        return;
      }

      // 验证文件类型
      if (!file.type.startsWith('image/')) {
        showToast('只能上传图片文件', 'error');
        return;
      }

      newFiles.push(file);

      // 生成预览
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        newPreviews.push(result);
        
        // 当所有图片都加载完成后更新状态
        if (newPreviews.length === newFiles.length) {
          setImages(prev => [...prev, ...newPreviews]);
          setImageFiles(prev => [...prev, ...newFiles]);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  // 删除图片
  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
    setImageFiles(prev => prev.filter((_, i) => i !== index));
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
    let uploadedImageUrls: string[] = [];

    try {
      // 1. 先上传图片到 Supabase Storage
      if (imageFiles.length > 0) {
        showToast('正在上传图片...', 'info');
        uploadedImageUrls = await uploadImages(
          imageFiles,
          'forum-images',
          `posts/${user.id}`,
          (current, total) => {
            setUploadProgress(Math.round((current / total) * 100));
          }
        );
      }

      // 2. 创建帖子数据
      const postData: any = {
        author_id: user.id,
        author_name: user.user_name,
        title: title.trim(),
        content: content.trim(),
        category,
        images: uploadedImageUrls.length > 0 ? uploadedImageUrls : undefined,
      };

      // 3. 添加投票数据
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

      // 4. 创建帖子
      await create_post(postData);
      showToast('发帖成功！', 'success');
      onSuccess();
    } catch (error: any) {
      // 如果创建帖子失败，删除已上传的图片
      if (uploadedImageUrls.length > 0) {
        try {
          const { deleteImages } = await import('../services/storageService');
          await deleteImages(uploadedImageUrls, 'forum-images');
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

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true">
      <div className="bg-white rounded-lg w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        {/* 头部 */}
        <div className="sticky top-0 bg-white border-b border-zinc-200 p-4 flex justify-between items-center z-10">
          <h2 className="text-xl font-bold">发布新帖</h2>
          <button onClick={onClose} disabled={isSubmitting} className="text-zinc-500 hover:text-black disabled:opacity-50" aria-label="关闭">
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
              placeholder="给你的帖子起个标题..."
              className="w-full p-3 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black disabled:opacity-50"
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
              disabled={isSubmitting}
              placeholder="详细描述你的想法..."
              className="w-full p-3 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black resize-none disabled:opacity-50"
            />
          </div>

          {/* 图片上传 */}
          <div>
            <label className="block text-sm font-bold mb-2 text-zinc-700">
              图片 <span className="text-xs text-zinc-400 font-normal">(最多9张，每张最大5MB)</span>
            </label>
            <div className="grid grid-cols-3 gap-3">
              {images.map((img, index) => (
                <div key={index} className="relative group">
                  <img src={img} alt={`预览 ${index + 1}`} className="w-full h-32 object-cover rounded-lg border border-zinc-200" />
                  <button
                    onClick={() => removeImage(index)}
                    disabled={isSubmitting}
                    className="absolute top-2 right-2 bg-red-600 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50"
                    aria-label="删除图片"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {images.length < 9 && (
                <label className={`w-full h-32 border-2 border-dashed border-zinc-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-black transition-colors ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}>
                  <ImageIcon className="w-8 h-8 text-zinc-400 mb-2" />
                  <span className="text-sm text-zinc-500">上传图片</span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleImageUpload}
                    disabled={isSubmitting}
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