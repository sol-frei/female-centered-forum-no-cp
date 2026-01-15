import React from 'react';
import { Lock } from 'lucide-react';

interface LandingProps {
  onLoginClick: () => void;
}

export default function Landing({ onLoginClick }: LandingProps) {
  return (
    <div className="min-h-screen bg-white text-zinc-900 flex flex-col items-center justify-center p-6">
      <div className="max-w-2xl w-full text-center space-y-8 animate-in fade-in duration-700">
        
        {/* Header */}
        <div className="space-y-4">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight border-b-4 border-black inline-block pb-2 mb-4">
            女主无cp/无男主小说交流中心
          </h1>
          <p className="text-lg text-zinc-600 font-light leading-relaxed max-w-xl mx-auto">
            以分享和推荐无男主的爱女小说为主的小组。
            <br />
            推荐的小说内容以女主自立自强发展事业并对社会做出一定的贡献，而不只是拘泥于女男之间的感情。
          </p>
        </div>

        {/* Rules Box */}
        <div className="bg-zinc-50 border border-zinc-200 p-8 rounded-none text-left space-y-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <div className="text-black">
            <p className="font-bold">
              🚫 本组禁推言情、耽丑、百合、男频文、男主文、男作者文。
            </p>
            <p className="mt-1">只允许推荐女主无cp/无男主，请遵守组规。</p>
            <p className="mt-4 text-xl font-bold text-center">
              “女性为第一性，爱女永不停歇！”
            </p>
          </div>
        </div>

        {/* Action */}
        <div className="pt-8">
          <button 
            onClick={onLoginClick}
            className="group relative inline-flex items-center justify-center px-8 py-3 text-lg font-medium text-white bg-black hover:bg-zinc-800 transition-all duration-200"
          >
            <Lock className="w-4 h-4 mr-2" />
            <span>登录进入小组</span>
            <div className="absolute inset-0 border-2 border-black translate-x-1 translate-y-1 -z-10 group-hover:translate-x-2 group-hover:translate-y-2 transition-transform"></div>
          </button>
          <p className="mt-4 text-xs text-zinc-400">
            *本站实行邀请制，请联系管理员获取 ID 和密码
          </p>
        </div>

      </div>
    </div>
  );
}