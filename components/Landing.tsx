import React from 'react';

interface LandingProps {
  onLoginClick: () => void;
}

export default function Landing({ onLoginClick }: LandingProps) {
  return (
    <div className="min-h-screen flex flex-col items-center px-8 pb-10 bg-[#FAF8F4]">
      {/* 标题区，占据主要视觉重量 */}
      <div className="flex-[1.3] flex flex-col items-center justify-center">
        <h1 className="text-6xl md:text-7xl font-bold tracking-tighter leading-none text-[#231F1C] text-center">
          New<br />Haus
        </h1>
        <div className="w-8 h-[3px] bg-[#5B4A57] mt-6" />
      </div>

      {/* 标语，字号和颜色更轻，退居次要位置 */}
      <div className="flex-[0.8] flex flex-col items-center justify-center text-center max-w-xs">
        <h3 className="text-sm font-semibold tracking-tight text-[#4A453F] mb-1.5">
          为了建造一座，更值得居住的新屋
        </h3>
        <p className="text-[11px] text-[#9A9186]">12bt 持续践行</p>
      </div>

      {/* 登录按钮固定在底部 */}
      <div className="w-full max-w-xs flex flex-col items-center text-center">
        <button
          onClick={onLoginClick}
          className="w-full bg-[#231F1C] text-[#FAF8F4] py-4 rounded-lg text-base font-semibold tracking-wide hover:bg-[#3a3530] transition-all active:scale-[0.98]"
        >
          立即登录
        </button>
        <p className="text-[11px] text-[#9A9186] mt-3.5">
          邀请制，请联系管理员获取 ID 和密码
        </p>
      </div>
    </div>
  );
}
