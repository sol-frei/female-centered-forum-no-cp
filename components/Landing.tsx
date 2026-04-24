import React from 'react';
import { BookOpen } from 'lucide-react';

interface LandingProps {
  onLoginClick: () => void;
}

export default function Landing({ onLoginClick }: LandingProps) {
  return (
    <div className="min-h-screen flex flex-col font-sans">
      {/* 1. 上半部分：黑色背景区域 - 占比 4 */}
      <div className="flex-[4] bg-[#1a1a1a] text-white p-8 pt-16 flex flex-col items-center">
        
        {/* 顶部的标签 - 紧凑间距 */}
        <div className="flex gap-3 justify-center mb-6"> 
          <span className="bg-white text-black px-3 py-1 text-sm font-bold rounded-sm">NO CP</span>
          <span className="bg-zinc-700 text-white px-3 py-1 text-sm font-bold rounded-sm">NO MALE LEAD</span>
        </div>

        {/* 主标题 - 移除居中容器，使其自然上浮 */}
        <div className="text-center space-y-4">
          <h1 className="text-4xl md:text-6xl font-bold tracking-tighter leading-tight">
            女主无cp/无男主<br />小说交流中心
          </h1>
        </div>

        {/* 登录按钮区域 - 强制到底部 */}
        <div className="mt-auto flex flex-col items-center space-y-4 w-full max-w-xs pb-10">
          <button 
            onClick={onLoginClick}
            className="w-full bg-white text-black py-4 rounded-lg text-xl font-bold hover:bg-zinc-200 transition-all active:scale-[0.98] shadow-2xl"
          >
            立即登录
          </button>
          <p className="text-zinc-500 text-[10px] tracking-widest text-center uppercase">
            *本站实行邀请制，请联系管理员获取 ID 和密码
          </p>
        </div>
      </div>

      {/* 2. 下半部分：白色背景区域 - 占比 1 */}
      <div className="flex-[1] bg-white p-6 flex items-center justify-center border-t border-zinc-100">
        <div className="max-w-md w-full text-center">
          <h3 className="text-lg font-bold text-black mb-1">
            女性为第一性，爱女永不停歇！
          </h3>
          <p className="text-zinc-500 text-xs">
            只允许推荐女主无cp/无男主，请遵守组规。
          </p>
        </div>
      </div>
    </div>
  );
}
