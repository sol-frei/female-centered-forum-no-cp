import React, { useState } from 'react';
import { X, ImageIcon, Plus, Trash2, Loader } from 'lucide-react';
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

const CATEGORIES: Category[] = [
  '推书📖排雷',
  '讨论👊🏻i女',
  '求书🔍求作',
  '自荐🙋🏻分享',
  '组务❗组规'
];

type ContentBlock =
  | { type: 'text'; value: string }
  | { type: 'image'; file: File; preview: string };

export default function CreatePostModal({
  user,
  onClose,
  onSuccess,
  showToast
}: CreatePostModalProps) {
  /** 基础表单 */
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<Category>('讨论👊🏻i女');
  const [blocks, setBlocks] = useState<ContentBlock[]>([
    { type: 'text', value: '' }
  ]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  /** 投票 */
  const [enablePoll, setEnablePoll] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '']);
  const [isMultiple, setIsMultiple] = useState(false);
  const [pollDeadline, setPollDeadline] = useState('');

  /** 插入图片（图文混排核心） */
  const insertImage = (file: File) => {
    const imageCount = blocks.filter(b => b.type === 'image').length;
    if (imageCount >= 9) {
      showToast('最多只能插入 9 张图片', 'warning');
      return;
    }

    if (!file.type.startsWith('image/')) {
      showToast('只能上传图片文件', 'error');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      showToast('图片不能超过 5MB', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = e => {
      const preview = e.target?.result as string;
      setBlocks(prev => [
        ...prev.slice(0, prev.length - 1),
        { type: 'image', file, preview },
        { type: 'text', value: '' }
      ]);
    };
    reader.readAsDataURL(file);
  };

  /** 表单校验 */
  const validateForm = () => {
    if (!title.trim()) {
      showToast('请输入标题', 'error');
      return false;
    }

    if (title.length > 100) {
      showToast('标题不能超过 100 字', 'error');
      return false;
    }

    const hasText = blocks.some(
      b => b.type === 'text' && b.value.trim()
    );

    if (!hasText) {
      showToast('请输入内容', 'error');
      return false;
    }

    if (enablePoll) {
      if (!pollQuestion.trim()) {
        showToast('请输入投票问题', 'error');
        return false;
      }

      const validOptions = pollOptions.filter(o => o.trim());
      if (validOptions.length < 2) {
        showToast('投票至少需要 2 个选项', 'error');
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

  /** 提交 */
  const handleSubmit = async () => {
    if (!validateForm()) return;

    setIsSubmitting(true);
    setUploadProgress(0);

    try {
      /** 1. 上传图片 */
      const imageBlocks = blocks.filter(
        b => b.type === 'image'
      ) as { type: 'image'; file: File }[];

      let uploadedUrls: string[] = [];

      if (imageBlocks.length > 0) {
        showToast('正在上传图片...', 'info');
        uploadedUrls = await uploadImages(
          imageBlocks.map(b => b.file),
          'forum_images',
          `posts/${user.id}`,
          (cur, total) =>
            setUploadProgress(Math.round((cur / total) * 100))
        );
      }

      /** 2. 生成 content JSON */
      let imgIndex = 0;
      const finalContent = blocks
        .map(b => {
          if (b.type === 'text') {
            return b.value.trim()
              ? { type: 'text', value: b.value.trim() }
              : null;
          }
          return {
            type: 'image',
            url: uploadedUrls[imgIndex++]
          };
        })
        .filter(Boolean);

      /** 3. 组装帖子数据 */
      const postData: any = {
        user_id: user.id,
        user_name: user.user_name,
        title: title.trim(),
        category,
        content: JSON.stringify(finalContent)
      };

      if (enablePoll) {
        const validOptions = pollOptions.filter(o => o.trim());
        postData.poll = {
          question: pollQuestion.trim(),
          options: validOptions.map((text, index) => ({
            id: `opt_${Date.now()}_${index}`,
            text,
            votes: []
          })),
          isMultiple,
          deadline: new Date(pollDeadline).toISOString()
        };
      }

      await create_post(postData);
      showToast('发帖成功！', 'success');
      onSuccess();
    } catch (e: any) {
      showToast(`发帖失败：${e.message}`, 'error');
    } finally {
      setIsSubmitting(false);
      setUploadProgress(0);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-6xl max-h-[90vh] overflow-y-auto">
        {/* 头部 */}
        <div className="sticky top-0 bg-white border-b p-4 flex justify-between">
          <h2 className="text-xl font-bold">发布新帖</h2>
          <button onClick={onClose} disabled={isSubmitting}>
            <X />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* 分类 */}
          <select
            value={category}
            onChange={e => setCategory(e.target.value as Category)}
            className="w-full p-3 border rounded-lg"
          >
            {CATEGORIES.map(c => (
              <option key={c}>{c}</option>
            ))}
          </select>

          {/* 标题 */}
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="标题"
            maxLength={100}
            className="w-full p-3 border rounded-lg"
          />

          {/* 内容编辑器 */}
          <div className="space-y-4">
            {blocks.map((block, index) => {
              if (block.type === 'text') {
                return (
                  <textarea
                    key={index}
                    value={block.value}
                    rows={4}
                    placeholder="写点什么..."
                    onChange={e => {
                      const next = [...blocks];
                      next[index] = {
                        ...block,
                        value: e.target.value
                      };
                      setBlocks(next);
                    }}
                    className="w-full p-3 border rounded-lg resize-none"
                  />
                );
              }

              return (
                <div key={index} className="relative">
                  <img
                    src={block.preview}
                    className="rounded-lg max-h-96 mx-auto"
                  />
                  <button
                    onClick={() =>
                      setBlocks(blocks.filter((_, i) => i !== index))
                    }
                    className="absolute top-2 right-2 bg-black/70 text-white p-1 rounded"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>

          {/* 插入图片 */}
          <label className="inline-flex items-center gap-2 cursor-pointer text-sm">
            <ImageIcon className="w-4 h-4" />
            插入图片
            <input
              type="file"
              accept="image/*"
              hidden
              onChange={e => {
                if (e.target.files?.[0]) {
                  insertImage(e.target.files[0]);
                  e.target.value = '';
                }
              }}
            />
          </label>

          {/* 投票 */}
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={enablePoll}
              onChange={e => setEnablePoll(e.target.checked)}
            />
            添加投票
          </label>

          {enablePoll && (
            <div className="bg-zinc-50 p-4 rounded space-y-2">
              <input
                value={pollQuestion}
                onChange={e => setPollQuestion(e.target.value)}
                placeholder="投票问题"
                className="w-full p-2 border rounded"
              />

              {pollOptions.map((opt, i) => (
                <input
                  key={i}
                  value={opt}
                  onChange={e => {
                    const next = [...pollOptions];
                    next[i] = e.target.value;
                    setPollOptions(next);
                  }}
                  placeholder={`选项 ${i + 1}`}
                  className="w-full p-2 border rounded"
                />
              ))}

              <button
                onClick={() =>
                  setPollOptions([...pollOptions, ''])
                }
                className="text-sm text-blue-600"
              >
                + 添加选项
              </button>

              <input
                type="datetime-local"
                value={pollDeadline}
                onChange={e => setPollDeadline(e.target.value)}
                className="w-full p-2 border rounded"
              />
            </div>
          )}
        </div>

        {/* 底部 */}
        <div className="border-t p-4 flex justify-end gap-3">
          <button onClick={onClose}>取消</button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="bg-black text-white px-6 py-2 rounded"
          >
            {isSubmitting ? (
              <Loader className="w-4 h-4 animate-spin" />
            ) : (
              '发布'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
