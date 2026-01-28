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
 * PostContent
 * - 渲染图文混排内容
 * - 自动兼容旧数据（纯文本）
 * - 不负责业务，只负责展示
 */
export default function PostContent({
  content,
  className = ''
}: PostContentProps) {
  let blocks: ContentBlock[] = [];

  /** 1️⃣ 尝试解析 JSON（新数据） */
  try {
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed)) {
      blocks = parsed;
    } else {
      throw new Error('not array');
    }
  } catch {
    /** 2️⃣ 兜底旧数据（纯文本） */
    return (
      <div className={`space-y-4 ${className}`}>
        <p className="whitespace-pre-wrap break-words">
          {content}
        </p>
      </div>
    );
  }

  /** 3️⃣ 正常渲染 block */
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
                className="
                  max-w-full
                  rounded-lg
                  border
                  border-zinc-200
                  mx-auto
                "
              />
            </div>
          );
        }

        return null;
      })}
    </div>
  );
}

