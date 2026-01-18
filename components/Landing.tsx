import React from 'react';
import { Lock, BookOpen } from 'lucide-react';

interface LandingProps {
  onLoginClick: () => void;
}

export default function Landing({ onLoginClick }: LandingProps) {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* 上半部分：黑色背景区域 */}
      <div className="bg-[#1a1a1a] text-white p-8 md:p-16 flex flex-col items-center justify-center space-y-10">
        {/* 顶部的标签 */}
        <div className="flex gap-3">
          <span className="bg-white text-black px-3 py-1 text-sm font-bold rounded-sm">NO CP</span>
          <span className="bg-zinc-700 text-white px-3 py-1 text-sm font-bold rounded-sm">NO MALE LEAD</span>
        </div>

        {/* 主标题 */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl md:text-6xl font-bold tracking-tighter">
            女主无CP
          </h1>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tighter">
            小说交流中心
          </h1>
        </div>

        {/* 介绍文字 */}
        <p className="text-zinc-400 text-center max-w-md leading-relaxed text-lg">
          以分享和推荐无男主的爱女小说为主的小组。推荐的小说内容以女主自立自强发展事业并对社会做出一定的贡献，而不只是拘泥于女男之间的感情。
        </p>

        {/* 登录按钮区域 */}
        <div className="flex flex-col items-center space-y-4 w-full max-w-xs">
          <button 
            onClick={onLoginClick}
            className="w-full bg-white text-black py-4 rounded-lg text-xl font-bold hover:bg-zinc-200 transition-colors flex items-center justify-center gap-2"
          >
            立即加入 / 登录
          </button>
          <p className="text-zinc-500 text-sm">
            *本站实行邀请制，请联系管理员获取 ID 和密码
          </p>
        </div>
      </div>

      {/* 下半部分：白色背景区域 */}
      <div className="flex-1 bg-white p-10 flex flex-col items-center">
        <div className="max-w-md w-full flex gap-4 items-start">
          {/* 左侧图标 */}
          <div className="bg-zinc-100 p-4 rounded-xl">
            <BookOpen className="w-8 h-8 text-black" />
          </div>
          {/* 右侧文字 */}
          <div className="space-y-2">
            <h3 className="text-2xl font-bold text-black">
              女性为第一性，爱女永不停歇！
            </h3>
            <p className="text-zinc-600 leading-snug">
              本组禁推言情、耽丑、百合、男频文、男主文、男作者文。只允许推荐女主无CP/无男主，请遵守组规。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}