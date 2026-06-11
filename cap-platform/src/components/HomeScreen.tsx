import { store } from '../store/Store';

export function HomeScreen() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-8 bg-cap-cream relative">
      {/* 顶部装饰线 */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cap-peach via-cap-butter to-cap-mint" />

      {/* 历史记录入口 */}
      <button
        onClick={() => store.setScreen('history')}
        className="absolute top-4 right-6 z-20 flex items-center gap-1.5 text-cap-ink-2 hover:text-cap-ink text-sm font-bold px-3 py-1.5 rounded-lg hover:bg-cap-cream-2 transition-colors"
      >
        <span>📋</span>
        <span>历史记录</span>
      </button>

      <div className="text-center mb-16 relative z-10 animate-fadein">
        {/* 品牌标识 */}
        <div className="flex items-center justify-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-cap-peach flex items-center justify-center">
            <span className="text-white font-bold text-lg">C</span>
          </div>
          <h1 className="text-4xl font-bold text-cap-ink tracking-tight">
            客户数字分身平台
          </h1>
        </div>
        <p className="text-cap-ink-2 text-base font-medium">
          AI 驱动的销售对练与用户调研系统
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-2xl w-full relative z-10">
        {/* Research */}
        <button
          onClick={() => store.setScreen('researchSelect')}
          className="group p-7 plush-lg text-left hover:-translate-y-0.5 transition-all duration-200"
        >
          <div className="flex items-center gap-4 mb-5">
            <div className="w-12 h-12 rounded-xl bg-cap-mint-soft flex items-center justify-center">
              <span className="text-2xl">🔍</span>
            </div>
            <div>
              <h3 className="font-bold text-cap-ink text-lg">用户调研</h3>
            </div>
          </div>
          <p className="text-cap-ink-2 text-sm font-medium leading-relaxed">
            深度访谈与问卷调研两种方式，系统挖掘真实需求、痛点与决策动机
          </p>
        </button>

        {/* Training */}
        <button
          onClick={() => {
            store.setMode('training');
            store.setScreen('personaList');
          }}
          className="group p-7 plush-lg text-left hover:-translate-y-0.5 transition-all duration-200"
        >
          <div className="flex items-center gap-4 mb-5">
            <div className="w-12 h-12 rounded-xl bg-cap-peach-soft flex items-center justify-center">
              <span className="text-2xl">🎯</span>
            </div>
            <div>
              <h3 className="font-bold text-cap-ink text-lg">销售对练</h3>
            </div>
          </div>
          <p className="text-cap-ink-2 text-sm font-medium leading-relaxed">
            与 AI 客户分身进行沉浸式销售对话演练，在真实场景中提升实战能力
          </p>
        </button>

        {/* Persona Factory */}
        <button
          onClick={() => store.setScreen('factory')}
          className="group p-7 plush-lg text-left hover:-translate-y-0.5 transition-all duration-200"
        >
          <div className="flex items-center gap-4 mb-5">
            <div className="w-12 h-12 rounded-xl bg-cap-sky-soft flex items-center justify-center">
              <span className="text-2xl">🏭</span>
            </div>
            <div>
              <h3 className="font-bold text-cap-ink text-lg">分身工厂</h3>
            </div>
          </div>
          <p className="text-cap-ink-2 text-sm font-medium leading-relaxed">
            上传真实用户数据 Excel，AI 自动聚类并生成 3-4 个典型客户分身
          </p>
        </button>

        {/* Knowledge Base */}
        <button
          onClick={() => {
            store.setScreen('knowledge');
            store.loadKnowledgeSources();
          }}
          className="group p-7 plush-lg text-left hover:-translate-y-0.5 transition-all duration-200"
        >
          <div className="flex items-center gap-4 mb-5">
            <div className="w-12 h-12 rounded-xl bg-cap-butter-soft flex items-center justify-center">
              <span className="text-2xl">📚</span>
            </div>
            <div>
              <h3 className="font-bold text-cap-ink text-lg">培训知识库</h3>
            </div>
          </div>
          <p className="text-cap-ink-2 text-sm font-medium leading-relaxed">
            上传销售培训文档、话术手册、竞品资料，让 AI 客户从中学到该问什么问题
          </p>
        </button>
      </div>

      <div className="mt-16 text-cap-ink-soft text-xs font-medium relative z-10">
        上汽集团 × MiniMax 联合打造 · POC 阶段
      </div>
    </div>
  );
}
