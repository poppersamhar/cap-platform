import { store } from '../store/Store';

export function ResearchSelectScreen() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-8 bg-cap-cream relative">
      {/* Back button */}
      <button
        onClick={() => store.setScreen('home')}
        className="absolute top-6 left-6 text-cap-ink-2 hover:text-cap-ink text-sm font-semibold transition-colors"
      >
        ← 返回
      </button>

      <div className="text-center mb-10 animate-popin">
        <div className="chip chip-mint mx-auto mb-3">用户调研</div>
        <h2 className="text-3xl font-bold text-cap-ink">选择调研方式</h2>
        <p className="text-cap-ink-2 font-medium mt-2">
          两种调研方式，满足不同研究需求
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl w-full">
        {/* 深度访谈 */}
        <button
          onClick={() => {
            store.setMode('research');
            store.setScreen('researchSetup');
          }}
          className="group p-8 plush-lg text-left hover:-translate-y-0.5 transition-transform duration-200"
        >
          <div className="w-14 h-14 rounded-xl bg-cap-mint-soft flex items-center justify-center mb-5">
            <span className="text-3xl group-hover:scale-110 transition-transform">🎤</span>
          </div>
          <h3 className="text-lg font-bold mb-2 text-cap-ink">深度访谈</h3>
          <p className="text-cap-ink-2 text-sm font-medium leading-relaxed">
            与 AI 虚拟用户进行开放式深度对话，灵活挖掘真实需求与决策动机
          </p>
        </button>

        {/* 问卷调研 */}
        <button
          onClick={() => {
            store.setMode('research');
            store.setScreen('surveySetup');
          }}
          className="group p-8 plush-lg text-left hover:-translate-y-0.5 transition-transform duration-200"
        >
          <div className="w-14 h-14 rounded-xl bg-cap-sky-soft flex items-center justify-center mb-5">
            <span className="text-3xl group-hover:scale-110 transition-transform">📝</span>
          </div>
          <h3 className="text-lg font-bold mb-2 text-cap-ink">问卷调研</h3>
          <p className="text-cap-ink-2 text-sm font-medium leading-relaxed">
            批量让多个 AI 分身填写结构化问卷，快速收集标准化调研数据
          </p>
        </button>
      </div>
    </div>
  );
}
