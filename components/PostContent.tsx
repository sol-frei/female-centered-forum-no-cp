import React from 'react';

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
  return (
    <div key={index} className="w-full">
      <img
        src={block.url}
        alt=""
        loading="lazy"
        onClick={() => {
          // 触发父组件的图片预览
          window.dispatchEvent(new CustomEvent('preview-image', { detail: { url: block.url } }));
        }}
        className="max-w-full rounded-lg border border-zinc-200 mx-auto cursor-pointer hover:opacity-90 transition-opacity"
      />
    </div>
  );
}
        
        return null;
      })}
    </div>
  );
}
