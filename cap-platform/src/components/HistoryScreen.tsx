import { store, useHistory } from '../store/Store';

export function HistoryScreen() {
  const history = useHistory();

  return (
    <div className="min-h-screen px-6 py-8 bg-cap-cream overflow-y-auto"
    >
      <div className="max-w-3xl mx-auto"
      >
        <div className="flex items-center justify-between mb-6"
        >
          <button
            onClick={() => store.setScreen('home')}
            className="text-cap-ink-2 hover:text-cap-ink text-sm font-bold transition-colors"
          >
            ← 返回首页
          </button>
          {history.length > 0 && (
            <button
              onClick={() => {
                if (confirm('确定清空所有历史记录？')) {
                  store.clearAllHistory();
                }
              }}
              className="text-cap-rose-deep hover:text-cap-ink text-sm font-bold transition-colors"
            >
              清空记录
            </button>
          )}
        </div>

        <div className="mb-8"
        >
          <h2 className="text-3xl font-black mb-2 text-cap-ink"
          >历史记录</h2>
          <p className="text-cap-ink-2 font-semibold"
          >共 {history.length} 条记录</p>
        </div>

        {history.length === 0 && (
          <div className="plush-lg p-12 text-center"
          >
            <div className="text-5xl mb-4 animate-wobble"
            >📋</div>
            <p className="text-cap-ink-2 font-bold mb-2"
            >暂无历史记录</p>
            <p className="text-cap-ink-soft text-sm font-semibold"
            >完成一次对练或调研后，记录会保存在这里</p>
          </div>
        )}

        <div className="space-y-4"
        >
          {history.map((session) => {
            const overallScore = session.evaluation
              ? Math.round(
                  session.evaluation.round_scores.reduce((acc, s) =>
                    acc + s.insight + s.adaptation + s.matching + s.objection + s.trust_building, 0
                  ) / (session.evaluation.round_scores.length * 5)
                )
              : 0;
            return (
              <button
                key={session.id}
                onClick={() => store.viewHistory(session.id)}
                className="w-full p-5 plush-lg text-left hover:-translate-y-1 transition-transform duration-200"
              >
                <div className="flex items-center justify-between mb-2"
                >
                  <div className="flex items-center gap-3"
                  >
                    <div className="w-10 h-10 rounded-full bg-cap-butter border-[3px] border-cap-line flex items-center justify-center text-lg shadow-[0_2px_0_#2B1E16]"
                    >
                      {session.mode === 'training' ? '💬' : '🔍'}
                    </div>
                    <div>
                      <h3 className="font-black text-cap-ink text-sm"
                      >
                        {session.persona?.profile.name || session.persona_id}
                      </h3>
                      <p className="text-xs text-cap-ink-2 font-bold"
                      >
                        {session.mode === 'training' ? '销售对练' : '用户调研'} · {session.round}轮
                      </p>
                    </div>
                  </div>
                  {session.evaluation && (
                    <div className={`w-12 h-12 rounded-full border-[3px] border-cap-line flex items-center justify-center shadow-[0_2px_0_#2B1E16] ${
                      overallScore >= 75 ? 'bg-cap-mint' : overallScore >= 60 ? 'bg-cap-butter' : 'bg-cap-rose'
                    }`}
                    >
                      <span className="font-black text-cap-ink text-sm"
                      >{overallScore}</span>
                    </div>
                  )}
                </div>
                <p className="text-xs text-cap-ink-2 font-semibold"
                >
                  {new Date(session.created_at).toLocaleString('zh-CN', {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
