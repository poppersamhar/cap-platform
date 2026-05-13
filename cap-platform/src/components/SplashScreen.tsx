import { useEffect } from 'react';
import { store } from '../store/Store';

export function SplashScreen() {
  useEffect(() => {
    const timer = setTimeout(() => {
      store.beginFromSplash();
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-cream-2 animate-popin">
      {/* Doodle decorations */}
      <div className="absolute top-20 left-[8%] text-6xl animate-floaty">☁️</div>
      <div className="absolute top-32 right-[10%] text-5xl animate-floaty" style={{ animationDelay: '0.4s' }}>☁️</div>
      <div className="absolute top-40 left-[15%] text-3xl animate-floaty" style={{ animationDelay: '0.8s' }}>✨</div>
      <div className="absolute bottom-40 right-[8%] text-4xl animate-wobble">💊</div>
      <div className="absolute bottom-32 left-[10%] text-3xl animate-breathe">❤️</div>

      <div className="relative z-10 flex flex-col items-center gap-6">
        {/* Title with plush style */}
        <h1 className="text-7xl font-black tracking-tight text-cap-ink flex items-center gap-3">
          <span className="text-cap-peach-deep">C</span>
          <span className="text-cap-butter-deep">A</span>
          <span className="text-cap-mint-deep">P</span>
          <span className="inline-block animate-wobble text-cap-rose-deep text-5xl ml-1">✚</span>
        </h1>

        <div className="chip chip-butter text-sm">
          客户数字分身平台
        </div>

        <p className="text-cap-ink-2 font-bold text-lg">
          AI 驱动的销售对练与用户调研
        </p>

        {/* Plush loading bar */}
        <div className="mt-6 w-56 h-4 bg-white border-[3px] border-cap-line rounded-full overflow-hidden shadow-[0_3px_0_#2B1E16]">
          <div className="h-full bg-cap-peach rounded-full animate-[loading_1.5s_ease-in-out_infinite]" style={{ width: '60%' }} />
        </div>
      </div>
    </div>
  );
}
