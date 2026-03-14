// src/components/admin/CompressLegacyImages.tsx
// 管理员工具：一键压缩 forum_images bucket 里的旧图片
// 使用方式：在管理员页面引入此组件即可，<CompressLegacyImages />

import React, { useState } from 'react';
import { supabase } from '../../services/supabaseClient';

// ─── 配置 ────────────────────────────────────────────────────────────────────
const BUCKET = 'forum_images';
const MAX_WIDTH = 1200;   // 压缩后最大宽度 px
const QUALITY = 0.82;     // jpeg 质量

// ─── 工具函数 ─────────────────────────────────────────────────────────────────

/** 将 File / Blob 压缩为 jpeg */
function compressToJpeg(file: File | Blob, name: string): Promise<File> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = img.width > MAX_WIDTH ? MAX_WIDTH / img.width : 1;
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);

      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);

      canvas.toBlob(
        (blob) => {
          if (!blob) { resolve(new File([file], name)); return; }
          resolve(new File([blob], name, { type: 'image/jpeg' }));
        },
        'image/jpeg',
        QUALITY
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(new File([file], name));
    };

    img.src = url;
  });
}

function fmtBytes(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(2)} MB`;
}

// ─── 类型 ─────────────────────────────────────────────────────────────────────

type FileStatus = 'pending' | 'skipped' | 'done' | 'error';

interface FileRecord {
  name: string;
  path: string;
  originalSize?: number;
  compressedSize?: number;
  status: FileStatus;
  reason?: string;
}

type RawFile = { name: string; path: string; size: number };

// ─── 组件 ─────────────────────────────────────────────────────────────────────

export default function CompressLegacyImages() {
  const [records, setRecords] = useState<FileRecord[]>([]);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);

  const update = (path: string, patch: Partial<FileRecord>) =>
    setRecords((prev) =>
      prev.map((r) => (r.path === path ? { ...r, ...patch } : r))
    );

  const handleRun = async () => {
    setRunning(true);
    setDone(false);
    setRecords([]);

    // 1. 递归扫描所有子文件夹，收集全部图片（含完整路径）
    // 实际结构：forum_images / posts / {帖子ID} / 图片文件
    const allFiles: RawFile[] = [];

    const scanFolder = async (folderPath: string) => {
      const { data, error } = await supabase.storage
        .from(BUCKET)
        .list(folderPath, { limit: 1000 });
      if (error || !data) return;

      for (const item of data) {
        const fullPath = folderPath ? `${folderPath}/${item.name}` : item.name;
        if (item.metadata) {
          // 有 metadata = 文件
          allFiles.push({ name: item.name, path: fullPath, size: item.metadata.size ?? 0 });
        } else {
          // 没有 metadata = 文件夹，递归进去
          await scanFolder(fullPath);
        }
      }
    };

    await scanFolder('');

    const imageFiles = allFiles.filter((f) =>
      /\.(jpe?g|png|webp|heic|heif|bmp|tiff?)$/i.test(f.name)
    );

    if (imageFiles.length === 0) {
      alert('未找到任何图片文件');
      setRunning(false);
      return;
    }

    const initial: FileRecord[] = imageFiles.map((f) => ({
      name: f.path,
      path: f.path,
      originalSize: f.size,
      status: 'pending',
    }));
    setRecords(initial);

    // 2. 逐个处理
    for (const f of imageFiles) {
      const path = f.path;

      // gif 跳过（压缩会丢失动画）
      if (/\.gif$/i.test(f.name)) {
        update(path, { status: 'skipped', reason: 'GIF 跳过' });
        continue;
      }

      // 已经是 jpg 且体积 < 300 KB，跳过
      const originalSize = f.size;
      if (/\.jpe?g$/i.test(f.name) && originalSize > 0 && originalSize < 300 * 1024) {
        update(path, { status: 'skipped', reason: '体积已达标，跳过' });
        continue;
      }

      try {
        // 2a. 下载原图
        const { data: dlData, error: dlErr } = await supabase.storage
          .from(BUCKET)
          .download(path);
        if (dlErr || !dlData) throw new Error('下载失败: ' + dlErr?.message);

        // 2b. 压缩
        const compressed = await compressToJpeg(dlData, f.name);
        const compressedSize = compressed.size;

        // 压缩后反而更大，跳过
        if (originalSize > 0 && compressedSize >= originalSize) {
          update(path, { status: 'skipped', reason: '压缩无收益，跳过' });
          continue;
        }

        // 2c. 覆盖上传，保持原路径（同一文件夹下）
        const newPath = path.replace(/\.[^.]+$/, '.jpg');
        const { error: upErr } = await supabase.storage
          .from(BUCKET)
          .upload(newPath, compressed, {
            cacheControl: '3600',
            upsert: true,
            contentType: 'image/jpeg',
          });
        if (upErr) throw new Error('上传失败: ' + upErr.message);

        // 原扩展名不是 jpg 时，删除旧文件
        if (newPath !== path) {
          await supabase.storage.from(BUCKET).remove([path]);
        }

        update(path, { status: 'done', compressedSize });
      } catch (err: any) {
        update(path, { status: 'error', reason: err.message });
      }
    }

    setRunning(false);
    setDone(true);
  };

  // ── 统计
  const total = records.length;
  const doneCount = records.filter((r) => r.status === 'done').length;
  const skippedCount = records.filter((r) => r.status === 'skipped').length;
  const errorCount = records.filter((r) => r.status === 'error').length;
  const savedBytes = records.reduce((acc, r) => {
    if (r.status === 'done' && r.originalSize && r.compressedSize) {
      return acc + r.originalSize - r.compressedSize;
    }
    return acc;
  }, 0);

  const statusColor: Record<FileStatus, string> = {
    pending: 'text-zinc-400',
    skipped: 'text-zinc-400',
    done: 'text-emerald-600',
    error: 'text-red-500',
  };

  const statusLabel: Record<FileStatus, string> = {
    pending: '等待中',
    skipped: '已跳过',
    done: '✓ 完成',
    error: '✗ 失败',
  };

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded-xl border border-zinc-200 shadow-sm space-y-5">
      <div>
        <h2 className="text-lg font-bold text-zinc-900">旧图片批量压缩</h2>
        <p className="text-sm text-zinc-500 mt-1">
          处理 <code className="bg-zinc-100 px-1 rounded">forum_images</code> 中的旧图片，压缩后原地覆盖，URL 不变。
        </p>
      </div>

      <button
        onClick={handleRun}
        disabled={running}
        className="px-5 py-2 bg-black text-white text-sm font-semibold rounded-lg disabled:bg-zinc-300 hover:bg-zinc-800 transition-colors"
      >
        {running ? '处理中…' : done ? '重新执行' : '开始压缩'}
      </button>

      {records.length > 0 && (
        <div className="space-y-3">
          <div className="text-sm text-zinc-500">
            共 {total} 张 · 完成 {doneCount} · 跳过 {skippedCount} · 失败 {errorCount}
            {savedBytes > 0 && (
              <span className="ml-2 text-emerald-600 font-medium">
                共节省 {fmtBytes(savedBytes)}
              </span>
            )}
          </div>

          <div className="divide-y divide-zinc-100 border border-zinc-100 rounded-lg overflow-hidden text-sm">
            {records.map((r) => (
              <div key={r.path} className="flex items-center justify-between px-4 py-2 gap-4">
                <span className="truncate text-zinc-700 flex-1">{r.name}</span>

                <span className="text-zinc-400 shrink-0">
                  {r.originalSize ? fmtBytes(r.originalSize) : '—'}
                  {r.status === 'done' && r.compressedSize && (
                    <> → {fmtBytes(r.compressedSize)}</>
                  )}
                </span>

                <span className={`shrink-0 font-medium ${statusColor[r.status]}`}>
                  {r.reason && r.status !== 'done'
                    ? r.reason
                    : statusLabel[r.status]}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}