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
  previewMode?: boolean; // 新增：预览模式，用小字体，不显示图片
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
  className = '',
  previewMode = false,
}: PostContentProps) {
  // 预览模式下的文字样式：统一小字，颜色浅
  const textClass = previewMode
    ? 'text-xs text-zinc-400 leading-snug'
    : 'whitespace-pre-wrap break-words text-zinc-800 text-lg md:text-base leading-loose md:leading-relaxed';

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
      <div className={`${previewMode ? '' : 'space-y-5'} ${className}`}>
        <p className={textClass}>
          {content}
        </p>
      </div>
    );
  }
  /** 渲染图文混排内容 */
  return (
    <div className={`${previewMode ? '' : 'space-y-5'} ${className}`}>
      {blocks.map((block, index) => {
        if (block.type === 'text') {
          // 预览模式只取第一个文字块，截断显示
          if (previewMode && index > 0) return null;
          return (
            <p key={index} className={textClass}>
              {block.value}
            </p>
          );
        }
        // 预览模式不显示图片
        if (block.type === 'image') {
          if (previewMode) return null;
          return <PostImage key={index} url={block.url} />;
        }
        return null;
      })}
    </div>
  );
}
