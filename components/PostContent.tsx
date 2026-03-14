import React, { useState } from 'react';

type TextBlock = {
  type: 'text';
  value: string;
};

type ImageBlock = {
  type: 'image';
  url: string;
};

type ContentBlock = TextBlock | ImageBlock;

interface PostContentProps {
  content: string;
  className?: string;
}

/** 单张图片：加载前显示骨架占位，加载完成后渐入 */
function PostImage({ url }: { url: string }) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  const handlePreview = () => {
    window.dispatchEvent(new CustomEvent('preview-image', { detail: { url } }));
  };

  return (
    <div className="w-full relative">
      {/* 骨架占位：图片未加载完成时显示，保持布局稳定 */}
      {!loaded && !error && (
        <div className="w-full rounded-lg bg-zinc-100 animate-pulse" style={{ minHeight: '12rem' }} />
      )}

      {error && (
        <div className="w-full rounded-lg bg-zinc-100 flex items-center justify-center text-zinc-400 text-sm" style={{ minHeight: '6rem' }}>
          图片加载失败
        </div>
      )}

      <img
        src={url}
        alt=""
        // 移除 loading="lazy"：详情页图片是主体内容，应立即加载
        // fetchpriority="high" 告知浏览器优先获取
        fetchPriority="high"
        onLoad={() => setLoaded(true)}
        onError={() => setError(true)}
        onClick={handlePreview}
        className={`max-w-full rounded-lg border border-zinc-200 mx-auto cursor-pointer hover:opacity-90 transition-opacity duration-300 ${
          loaded ? 'opacity-100' : 'opacity-0 absolute inset-0'
        }`}
      />
    </div>
  );
}

/**
 * PostContent - 显示图文混排内容
 * 自动兼容新旧数据格式
 */
export default function PostContent({
  content,
  className = ''
}: PostContentProps) {
  let blocks: ContentBlock[] = [];

  /** 尝试解析JSON格式(新数据) */
  try {
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed)) {
      blocks = parsed;
    } else {
      throw new Error('not array');
    }
  } catch {
    /** 兜底旧数据(纯文本) */
    return (
      <div className={`space-y-4 ${className}`}>
        <p className="whitespace-pre-wrap break-words text-zinc-800 leading-relaxed">
          {content}
        </p>
      </div>
    );
  }

  /** 渲染图文混排内容 */
  return (
    <div className={`space-y-4 ${className}`}>
      {blocks.map((block, index) => {
        if (block.type === 'text') {
          return (
            <p
              key={index}
              className="whitespace-pre-wrap break-words text-zinc-800 leading-relaxed"
            >
              {block.value}
            </p>
          );
        }

        if (block.type === 'image') {
          return <PostImage key={index} url={block.url} />;
        }

        return null;
      })}
    </div>
  );
}