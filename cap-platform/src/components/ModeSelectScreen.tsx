import { store, useStore } from '../store/Store';

export function ModeSelectScreen() {
  const mode = useStore((s) => s.mode);

  const handleSelect = (selectedMode: 'training' | 'research') => {
    store.setMode(selectedMode);
    store.loadPersonas();
    store.setScreen('personaList');
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-8 bg-cap-cream relative">
      {/* Back button */}
      <button
        onClick={() => store.setScreen('home')}
        className="absolute top-6 left-6 text-cap-ink-2 hover:text-cap-ink text-sm font-bold transition-colors"
      >
        ← 返回
      </button>

      <div className="text-center mb-10 animate-popin">
        <div className={`chip chip-${mode === 'training' ? 'peach' : 'mint'} mx-auto mb-3`}>
          {mode === 'training' ? '销售对练' : '用户调研'}
        </div>
        <h2 className="text-3xl font-black text-cap-ink">选择演练模式</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl w-full">
        <button
          onClick={() => handleSelect(mode === 'training' ? 'training' : 'research')}
          className="group p-8 plush-lg text-left hover:-translate-y-1 transition-transform duration-200"
        >
          <div className="text-4xl mb-4 group-hover:scale-110 transition-transform">🎯</div>
          <h3 className="text-lg font-black mb-2 text-cap-ink">
            {mode === 'training' ? 'Deep-Dive 深度对练' : '深度访谈'}
          </h3>
          <p className="text-cap-ink-2 text-sm font-semibold leading-relaxed">
            {mode === 'training'
              ? '单一客户深度谈判，专注练习复杂场景'
              : '与单个分身进行深度访谈，获取详细洞察'}
          </p>
        </button>

        <div className="p-8 plush-lg opacity-60 cursor-not-allowed bg-cap-cream-2">
          <div className="text-4xl mb-4 grayscale">📊</div>
          <h3 className="text-lg font-black mb-2 text-cap-ink">
            {mode === 'training' ? 'Pipeline 批量对练' : '批量调研'}
          </h3>
          <p className="text-cap-ink-2 text-sm font-semibold leading-relaxed">
            {mode === 'training'
              ? '多客户并行演练（正式版开放）'
              : '并发访谈多个分身（正式版开放）'}
          </p>
          <span className="chip chip-butter mt-3 text-xs">即将上线</span>
        </div>
      </div>
    </div>
  );
}
