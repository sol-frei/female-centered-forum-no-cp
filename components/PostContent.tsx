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

export default function PostContent({
  content,
  className = 'text-lg md:text-base'
}: PostContentProps) {
  let blocks: ContentBlock[] = [];

  try {
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed)) {
      blocks = parsed;
    } else {
      throw new Error('not array');
    }
  } catch {
    return (
      <div>
        <p className={`whitespace-pre-wrap break-words text-zinc-800 leading-loose md:leading-relaxed ${className}`}>
          {content}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {blocks.map((block, index) => {
        if (block.type === 'text') {
          return (
            <p
              key={index}
              className={`whitespace-pre-wrap break-words text-zinc-800 leading-loose md:leading-relaxed ${className}`}
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
