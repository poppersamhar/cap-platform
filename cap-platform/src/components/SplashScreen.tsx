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
    <div className="flex flex-col items-center justify-center min-h-screen bg-cap-cream animate-fadein">
      <div className="relative z-10 flex flex-col items-center gap-6">
        {/* Title */}
        <h1 className="text-5xl font-bold tracking-tight text-cap-ink flex items-center gap-3">
          <span className="text-cap-peach">C</span>
          <span className="text-cap-butter">A</span>
          <span className="text-cap-mint">P</span>
        </h1>

        <div className="chip chip-butter text-sm">
          客户数字分身平台
        </div>

        <p className="text-cap-ink-2 font-medium text-lg">
          AI 驱动的销售对练与用户调研
        </p>

        {/* Loading bar */}
        <div className="mt-6 w-56 h-2 bg-cap-line-light rounded-full overflow-hidden">
          <div className="h-full bg-cap-peach rounded-full animate-[loading_1.5s_ease-in-out_infinite]" style={{ width: '60%' }} />
        </div>
      </div>
    </div>
  );
}
