import { store } from '../store/Store';

export function HomeScreen() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-8 bg-cap-cream relative overflow-hidden">
      {/* Background doodles */}
      <div className="absolute top-24 left-[6%] text-5xl animate-floaty">☁️</div>
      <div className="absolute top-20 right-[8%] text-4xl animate-floaty" style={{ animationDelay: '0.5s' }}>☁️</div>
      <div className="absolute bottom-32 left-[10%] text-3xl animate-wobble">🚗</div>
      <div className="absolute bottom-40 right-[12%] text-3xl animate-breathe">🔋</div>

      <div className="text-center mb-14 relative z-10 animate-popin">
        <h1 className="text-6xl font-black mb-3 text-cap-ink flex items-center justify-center gap-2">
          <span className="text-cap-peach-deep">C</span>
          <span className="text-cap-butter-deep">A</span>
          <span className="text-cap-mint-deep">P</span>
          <span className="inline-block animate-wobble text-cap-rose-deep text-4xl">✚</span>
        </h1>
        <p className="text-cap-ink-2 text-xl font-bold">客户数字分身平台</p>
        <p className="text-cap-ink-soft text-sm mt-2 font-semibold">AI 驱动的销售对练与用户调研</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl w-full relative z-10">
        {/* Training */}
        <button
          onClick={() => {
            store.setMode('training');
            store.setScreen('mode');
          }}
          className="group p-8 plush-lg text-left hover:-translate-y-1 transition-transform duration-200"
        >
          <div className="text-5xl mb-4 group-hover:scale-110 transition-transform">💬</div>
          <div className="chip chip-peach mb-3">销售对练</div>
          <p className="text-cap-ink-2 text-sm font-semibold leading-relaxed">
            与 AI 客户分身进行沉浸式销售对话演练，提升实战能力
          </p>
        </button>

        {/* Research */}
        <button
          onClick={() => {
            store.setMode('research');
            store.setScreen('mode');
          }}
          className="group p-8 plush-lg text-left hover:-translate-y-1 transition-transform duration-200"
        >
          <div className="text-5xl mb-4 group-hover:scale-110 transition-transform">🔍</div>
          <div className="chip chip-mint mb-3">用户调研</div>
          <p className="text-cap-ink-2 text-sm font-semibold leading-relaxed">
            与 AI 虚拟用户深度访谈，挖掘真实需求和痛点
          </p>
        </button>
      </div>

      <div className="mt-12 text-cap-ink-soft text-xs font-semibold relative z-10">
        POC 阶段 · 支持文本交互
      </div>
    </div>
  );
}
